# Production Environment Variables for DigitalOcean Deployment

## Critical Environment Variables to Set in DigitalOcean App Platform

### 1. Database Configuration
```
DATABASE_URL=postgresql://db-postgresql-lon1-fynlo-pos-do-user-18745693-0.c.db.ondigitalocean.com:25060/db-postgresql-lon1-fynlo-pos?sslmode=require
```

### 2. Redis Configuration  
```
REDIS_URL=rediss://default:<PASSWORD>@redis-lon1-fynlo-do-user-18745693-0.c.db.ondigitalocean.com:25061
```

### 3. Supabase Configuration
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
```

### 4. SumUp Configuration (NEW - REQUIRED)
```
SUMUP_API_KEY=<YOUR_SUMUP_API_KEY_HERE>  # Get from SumUp dashboard
SUMUP_ENVIRONMENT=production
SUMUP_APP_ID=com.anonymous.cashapppos
SUMUP_MERCHANT_CODE=<YOUR_MERCHANT_CODE>  # Get from SumUp dashboard
```

### 5. Security Keys
```
SECRET_KEY=<GENERATE_NEW_64_CHAR_KEY>
JWT_SECRET_KEY=<GENERATE_NEW_64_CHAR_KEY>
```

### 6. Platform Configuration
```
PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk
```

### 7. Payment Providers (if using)
```
# Square (if enabled)
SQUARE_ACCESS_TOKEN=<YOUR_PRODUCTION_TOKEN>
SQUARE_LOCATION_ID=<YOUR_LOCATION_ID>
SQUARE_ENVIRONMENT=production

# Stripe (if enabled)
STRIPE_SECRET_KEY=sk_live_<YOUR_LIVE_KEY>
STRIPE_PUBLISHABLE_KEY=pk_live_<YOUR_LIVE_KEY>
```

### 8. Application Settings
```
ENVIRONMENT=production
LOG_LEVEL=INFO
ERROR_DETAIL_ENABLED=false
CORS_ORIGINS=https://fynlopos-9eg2c.ondigitalocean.app,<YOUR_MOBILE_APP_DOMAINS>
```

## How to Set These in DigitalOcean App Platform

1. **Navigate to your App** in DigitalOcean Dashboard
2. **Click on Settings** → **App-Level Environment Variables**
3. **Click "Edit"** to add/modify variables
4. **For each SECRET variable**:
   - Set `Type` to `SECRET`
   - Set `Scope` to `RUN_TIME` (or `RUN_AND_BUILD_TIME` for DATABASE_URL)
5. **Click "Save"**

## Security Notes

- **NEVER** commit these values to git
- **Generate new keys** for SECRET_KEY and JWT_SECRET_KEY using:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- **Rotate keys regularly** especially after any security incident
- **Use different keys** for staging and production environments

## Verification After Deployment

1. Check the `/api/v1/sumup/status` endpoint
2. Verify authentication is working
3. Test a payment flow in the mobile app
4. Monitor logs for any configuration errors