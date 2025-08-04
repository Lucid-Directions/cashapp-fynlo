# Security Migration Guide - Backend Configuration

## 🚨 CRITICAL: Security Vulnerabilities Fixed in PR #522

This guide explains the breaking changes introduced to fix critical security vulnerabilities in the backend configuration system.

## What Changed

### 1. **Hardcoded Secrets Removed**
All hardcoded secrets have been removed from `.env` files and replaced with placeholder values.

### 2. **Environment Variable Validation**
The application now requires proper environment variables to be set and will fail to start if critical variables are missing or insecure.

### 3. **Production Security Validation**
Enhanced validation prevents the application from starting with insecure configurations in production.

## Migration Steps

### For Development

1. **Create Local Environment File**
   ```bash
   # Copy the example file
   cp .env.local.example .env.local
   
   # Edit with your actual values
   nano .env.local
   ```

2. **Set Required Variables**
   Your `.env.local` file must contain:
   ```bash
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/fynlo_pos_dev"
   
   # Redis
   REDIS_URL="redis://localhost:6379/0"
   
   # Security (generate a strong key!)
   SECRET_KEY="your-long-random-secret-key-at-least-32-characters"
   
   # Supabase
   SUPABASE_URL="https://your-project-id.supabase.co"
   SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   ```

3. **Generate Strong Secret Key**
   ```bash
   # Python method
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   
   # OpenSSL method
   openssl rand -base64 32
   ```

### For Production Deployment

1. **Set Environment Variables**
   ```bash
   # Required variables
   export DATABASE_URL="postgresql://prod:password@prod-server/db"
   export REDIS_URL="redis://prod-redis:6379/0"
   export SECRET_KEY="your-production-secret-key-32-plus-characters"
   export ENVIRONMENT="production"
   export DEBUG="false"
   export ERROR_DETAIL_ENABLED="false"
   export LOG_LEVEL="INFO"
   export CORS_ORIGINS="https://yourdomain.com,https://api.yourdomain.com"
   ```

2. **Payment Provider Configuration**
   ```bash
   # Stripe (live keys for production)
   export STRIPE_SECRET_KEY="sk_live_your_live_stripe_key"
   export STRIPE_PUBLISHABLE_KEY="pk_live_your_live_stripe_key"
   
   # SumUp (production environment)
   export SUMUP_ENVIRONMENT="production"
   export SUMUP_API_KEY="your_live_sumup_api_key"
   ```

3. **Platform Configuration**
   ```bash
   # Platform owner emails
   export PLATFORM_OWNER_EMAILS="admin@yourdomain.com,owner@yourdomain.com"
   ```

### For DigitalOcean App Platform

1. **Update App Spec**
   ```yaml
   name: fynlo-pos-backend
   services:
   - name: backend
     environment_slug: python
     source_dir: /backend
     envs:
     - key: DATABASE_URL
       scope: RUN_TIME
       type: SECRET
       value: "your-database-url"
     - key: REDIS_URL
       scope: RUN_TIME
       type: SECRET
       value: "your-redis-url"
     - key: SECRET_KEY
       scope: RUN_TIME
       type: SECRET
       value: "your-secret-key"
     - key: ENVIRONMENT
       scope: RUN_TIME
       value: "production"
     - key: DEBUG
       scope: RUN_TIME
       value: "false"
   ```

## Validation Rules

### Development Environment
- Must have DATABASE_URL, REDIS_URL, SECRET_KEY
- SECRET_KEY must be at least 32 characters
- No additional validation

### Production Environment
- All development rules plus:
- DEBUG must be false
- ERROR_DETAIL_ENABLED must be false
- CORS_ORIGINS cannot contain '*' wildcard
- SECRET_KEY cannot be development placeholder
- Payment provider keys cannot be test/placeholder values
- Supabase URLs cannot be placeholders

## Environment File Priority

The system loads environment files in this order:
1. `.env.local` (highest priority, git-ignored)
2. `.env.test` (when APP_ENV=test)
3. `.env` (default, safe for git)

## Security Best Practices

### ✅ DO
- Use `.env.local` for local development secrets
- Generate strong, unique SECRET_KEYs
- Use live payment provider keys in production
- Set proper CORS origins
- Use environment variables in deployment

### ❌ DON'T
- Commit `.env.local` files to git
- Use development/test keys in production
- Use wildcard '*' in CORS_ORIGINS for production
- Hardcode secrets in source code
- Use weak or default SECRET_KEYs

## Troubleshooting

### Application Won't Start

**Error**: `DATABASE_URL environment variable is required`
```bash
# Solution: Set the required environment variable
export DATABASE_URL="postgresql://user:pass@host:port/db"
```

**Error**: `SECRET_KEY must be at least 32 characters long`
```bash
# Solution: Generate a stronger key
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

**Error**: `Application startup aborted due to insecure production configuration`
```bash
# Solution: Fix production configuration issues
export DEBUG="false"
export ERROR_DETAIL_ENABLED="false"
export CORS_ORIGINS="https://yourdomain.com"  # No wildcards
```

### Testing Configuration

```bash
# Test configuration loading
python3 -c "
from app.core.config import settings
print(f'Environment: {settings.ENVIRONMENT}')
print(f'Database: {settings.DATABASE_URL[:20]}...')
print('✅ Configuration loaded successfully!')
"
```

## Breaking Changes Summary

1. **Required Environment Variables**: DATABASE_URL, REDIS_URL, SECRET_KEY are now mandatory
2. **Production Validation**: Strict security validation in production environment
3. **File Structure**: New `.env.local` file for local development
4. **Security**: All hardcoded secrets removed from repository

## Support

If you encounter issues during migration:
1. Check your environment variables are set correctly
2. Verify SECRET_KEY is at least 32 characters
3. Ensure production configuration follows security rules
4. Review the error messages for specific guidance