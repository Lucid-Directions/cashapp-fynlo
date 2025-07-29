# Production Configuration Validation Setup

## Issue #394 - HIGH Priority

### Current Status
After investigating the DigitalOcean App Platform configuration, I've confirmed that:
- ✅ Production validation code exists in `backend/app/core/config.py`
- ❌ `ENVIRONMENT` variable is NOT set in DigitalOcean
- ⚠️ Without `ENVIRONMENT=production`, validation checks are bypassed
- ✅ Most required secrets are already set (DEBUG, SECRET_KEY, etc.)
- ⚠️ Need to verify that DEBUG="false" and SUMUP_ENVIRONMENT="production"

### Required Actions

#### 1. Add Missing Environment Variable
The following environment variable MUST be added to DigitalOcean App Platform:

```
ENVIRONMENT=production
```

This will trigger the following validation checks on startup:
- DEBUG mode must be False
- ERROR_DETAIL_ENABLED must be False  
- CORS origins must not contain wildcards
- SECRET_KEY must not be default value
- Secret key must be >32 characters
- LOG_LEVEL should not be DEBUG
- Payment keys must be production keys

#### 2. Variables That Need Attention

Based on the validation code, these variables need to be set properly:

| Variable | Current Status | Required Action |
|----------|---------------|-----------------|
| `ENVIRONMENT` | ❌ Not set | Add: `production` |
| `ERROR_DETAIL_ENABLED` | ❌ Not set | Add: `false` |
| `CORS_ORIGINS` | ❌ Not set | Add: `https://app.fynlo.co.uk,https://fynlo.co.uk` |
| `LOG_LEVEL` | ❌ Not set | Add: `INFO` |

#### 3. Variables Already Set (Need Verification)

These are already set as secrets but their values need verification:
- `DEBUG` - Must be `false`
- `SECRET_KEY` - Must be strong and >32 chars
- `SUMUP_ENVIRONMENT` - Should be `production` not `sandbox`

### How to Apply These Changes

1. **Using DigitalOcean CLI:**
```bash
doctl apps update 04073e70-e799-4d27-873a-dadea0503858 --spec-file app-spec.yaml
```

2. **Using DigitalOcean Web Console:**
   - Go to Apps → fynlopos → Settings → App-Level Environment Variables
   - Add the missing variables listed above

3. **Using the MCP Tool:**
   - Use `mcp__digitalocean-mcp-local__apps-update` to add environment variables

### Impact

Once `ENVIRONMENT=production` is set:
- The app will refuse to start if any validation check fails
- This ensures secure configuration in production
- Prevents accidental deployment of insecure settings

### Testing

After adding the environment variables:
1. Monitor deployment logs for validation errors
2. If validation fails, the app will show clear error messages
3. Fix any reported issues before the app can start

### Priority

**HIGH** - Security validation is currently bypassed in production!