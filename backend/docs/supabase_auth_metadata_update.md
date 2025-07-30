# Supabase Auth Metadata Update for Multi-Restaurant Support

## Overview
This document outlines the required changes to Supabase authentication metadata to support multi-restaurant management for Omega plan users.

## Current Auth Flow
1. Users sign up on website (fynlo.co.uk) - NOT in mobile app
2. Choose subscription plan: Alpha (£0/month + 1%), Beta (£49/month + 1%), or Omega (£119/month + 1%)
3. Supabase creates account with plan metadata
4. Mobile app login calls `/api/v1/auth/verify` with Supabase token

## Required Metadata Structure Changes

### 1. User Metadata (app_metadata)
```json
{
  "subscription_plan": "omega", // alpha, beta, or omega
  "primary_restaurant_id": "uuid", // User's primary restaurant
  "current_restaurant_id": "uuid", // Currently selected restaurant (for multi-restaurant users)
  "role": "restaurant_owner", // platform_owner, restaurant_owner, manager, employee
  "multi_restaurant_enabled": true, // Only for omega plan owners
  "assigned_restaurants": ["uuid1", "uuid2"], // List of accessible restaurant IDs
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 2. Custom Claims (for JWT)
```json
{
  "role": "restaurant_owner",
  "subscription_plan": "omega",
  "restaurants": ["uuid1", "uuid2"],
  "current_restaurant": "uuid1"
}
```

## Implementation Steps

### 1. Update Supabase Auth Hooks
Create a PostgreSQL function to sync user_restaurants with auth metadata:

```sql
CREATE OR REPLACE FUNCTION sync_user_restaurants_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update Supabase auth metadata when user_restaurants changes
  UPDATE auth.users
  SET raw_app_metadata = raw_app_metadata || 
    jsonb_build_object(
      'assigned_restaurants', 
      (SELECT array_agg(restaurant_id) 
       FROM user_restaurants 
       WHERE user_id = NEW.user_id),
      'multi_restaurant_enabled',
      (SELECT COUNT(*) > 1 
       FROM user_restaurants 
       WHERE user_id = NEW.user_id),
      'updated_at', NOW()
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_user_restaurants_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_restaurants
FOR EACH ROW EXECUTE FUNCTION sync_user_restaurants_to_auth();
```

### 2. Update Auth Verify Endpoint
The `/api/v1/auth/verify` endpoint already handles multi-restaurant logic:
- Creates/updates user with subscription info
- Returns enabled features based on plan
- Syncs user_restaurants for Omega users

### 3. Update JWT Claims
Configure Supabase to include custom claims:

```sql
CREATE OR REPLACE FUNCTION custom_jwt_claims()
RETURNS jsonb AS $$
DECLARE
  restaurants jsonb;
BEGIN
  SELECT jsonb_agg(ur.restaurant_id)
  INTO restaurants
  FROM user_restaurants ur
  WHERE ur.user_id = auth.uid();

  RETURN jsonb_build_object(
    'role', auth.jwt()->>'role',
    'subscription_plan', auth.jwt()->'app_metadata'->>'subscription_plan',
    'restaurants', COALESCE(restaurants, '[]'::jsonb),
    'current_restaurant', auth.jwt()->'app_metadata'->>'current_restaurant_id'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

## Mobile App Integration

### 1. Auth Context Updates
The mobile app should read the metadata to:
- Enable restaurant switching UI for multi_restaurant_enabled users
- Show current restaurant context
- Filter features based on subscription_plan

### 2. Restaurant Switching
When switching restaurants, call:
```
POST /api/v1/users/switch-restaurant
{
  "restaurant_id": "new-restaurant-uuid"
}
```

This updates:
- User's current_restaurant_id in database
- Supabase auth metadata
- Returns updated user context

## Security Considerations

1. **Metadata Validation**: Always validate metadata server-side
2. **Restaurant Access**: Use TenantSecurity class to verify access
3. **Plan Features**: Gate features based on subscription_plan
4. **Audit Trail**: Log all restaurant switches

## Testing Checklist

- [ ] User can sign up with Omega plan on website
- [ ] Auth metadata includes all required fields
- [ ] JWT contains custom claims
- [ ] Restaurant switching updates metadata
- [ ] Multi-restaurant users see switching UI
- [ ] Features are properly gated by plan
- [ ] Tenant isolation works across restaurants