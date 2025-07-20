# Diagnostic Endpoints Security

## Overview
The diagnostic endpoints provide critical system information and must be properly secured. They are accessible only via:
1. Platform owner authentication
2. Diagnostic key (must be configured via environment variable)

## Configuration

### Required Environment Variable
```bash
DIAGNOSTIC_KEY=your-secure-random-key-here
```

**IMPORTANT**: 
- Never use a default or predictable key
- Generate a secure random key for production
- Keep the key secret and rotate it periodically

### Example Key Generation
```bash
# Generate a secure random key
openssl rand -hex 32

# Or using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Usage

### With Diagnostic Key
```bash
curl "https://api.example.com/api/v1/diagnostics/environment?diagnostic_key=YOUR_SECURE_KEY"
```

### With Platform Owner Token
```bash
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  "https://api.example.com/api/v1/diagnostics/environment"
```

## Available Endpoints

1. **Environment Check**: `/api/v1/diagnostics/environment`
   - Shows configuration status
   - Verifies environment variables

2. **Redis Test**: `/api/v1/diagnostics/redis-test`
   - Tests Redis connectivity
   - Shows connection details

3. **Supabase Test**: `/api/v1/diagnostics/supabase-test`
   - Verifies Supabase configuration
   - Tests authentication service

## Security Best Practices

1. **Never hardcode the diagnostic key**
2. **Always set DIAGNOSTIC_KEY in production**
3. **Use strong, random keys (minimum 32 characters)**
4. **Rotate keys periodically**
5. **Monitor access to diagnostic endpoints**
6. **Consider IP whitelisting for additional security**

## Deployment Checklist

- [ ] Set `DIAGNOSTIC_KEY` environment variable
- [ ] Verify key is not in source code
- [ ] Test endpoints with key authentication
- [ ] Document key in secure password manager
- [ ] Set up monitoring/alerting for diagnostic endpoint access