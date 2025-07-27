# Manual Fix for "No restaurant associated with user" Error

## Problem
Your user account (arnaud@luciddirections.co.uk) doesn't have an associated restaurant, causing WebSocket connection failures.

## Temporary Solution
Until the debug endpoint is deployed, you can manually fix this by running SQL directly in the DigitalOcean database console:

1. Go to DigitalOcean Dashboard
2. Navigate to Databases → fynlo-pos-db
3. Click on "Console" tab
4. Run these SQL commands:

```sql
-- First, check if user exists and current restaurant_id
SELECT id, email, restaurant_id, role 
FROM users 
WHERE email = 'arnaud@luciddirections.co.uk';

-- Check if any restaurants exist
SELECT id, name FROM restaurants LIMIT 1;

-- If a restaurant exists, associate the user with it
-- Replace <user_id> and <restaurant_id> with actual values from above queries
UPDATE users 
SET restaurant_id = '<restaurant_id>' 
WHERE id = '<user_id>';
```

## Alternative: Create a test restaurant if none exists

```sql
-- Create a test restaurant
INSERT INTO restaurants (
    id, name, legal_name, address, city, postal_code,
    country, phone, email, vat_number, vat_rate,
    currency, timezone, is_active, created_at, updated_at
) VALUES (
    gen_random_uuid(), 
    'Fynlo Test Restaurant',
    'Fynlo Test Restaurant Ltd',
    '123 Test Street',
    'London',
    'SW1A 1AA',
    'UK',
    '+44 20 1234 5678',
    'test@fynlo.com',
    'GB123456789',
    20.0,
    'GBP',
    'Europe/London',
    true,
    NOW(),
    NOW()
) RETURNING id;

-- Then update the user with the new restaurant_id
UPDATE users 
SET restaurant_id = '<new_restaurant_id>' 
WHERE email = 'arnaud@luciddirections.co.uk';
```

## Expected Result
After running these commands:
1. WebSocket connections should work
2. You'll be able to access all POS features
3. Employee management will function properly

## Note
This is a temporary workaround. The proper solution is to implement restaurant association during the onboarding flow.