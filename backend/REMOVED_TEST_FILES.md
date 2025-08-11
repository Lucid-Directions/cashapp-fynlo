# Removed Test Files - Security Remediation

## Overview
On 2025-01-11, several test and development files were removed from the backend directory due to CORS wildcard security vulnerabilities.

## Files Removed
The following files were removed as they contained insecure CORS configurations with wildcard origins (`allow_origins=["*"]`):

1. `backend/minimal_app.py` - Test application with CORS wildcard
2. `backend/minimal_server.py` - Minimal server implementation with CORS wildcard
3. `backend/simple_main.py` - Simplified main application with CORS wildcard
4. `backend/app/simple_main.py` - Alternative simple main with CORS wildcard
5. `backend/test_server.py` - Test server with CORS wildcard

## Files Retained
The following files were retained as they use secure CORS configurations:
- `backend/app/main_minimal.py` - Uses secure origins list
- `backend/app/main_simple.py` - Uses secure origins list

## Why These Files Were Removed

### Security Risk
These files contained CORS configurations that allowed all origins (`allow_origins=["*"]`), which is a significant security vulnerability that could enable:
- Cross-site request forgery (CSRF) attacks
- Unauthorized API access from any domain
- Data exfiltration to malicious domains
- Exposure of authentication credentials

### Not Used in Production
These were test/development files that were not part of the production deployment and were creating confusion about which files should be used.

## What Developers Should Use Instead

### For Development and Testing
Use the main application with appropriate environment variables:

```bash
# For development
cd backend
source venv/bin/activate
ENVIRONMENT=development uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### For Testing Specific Configurations
If you need a minimal setup for testing:
1. Use `app/main_minimal.py` or `app/main_simple.py` which have secure CORS configurations
2. Or use the main application (`app/main:app`) with environment variables

### Environment Variables for CORS
Configure CORS properly using environment variables in `.env`:
```
CORS_ORIGINS=["https://your-frontend-domain.com", "https://another-allowed-domain.com"]
ENVIRONMENT=development  # or production
```

For local development, the application automatically adds localhost origins when `ENVIRONMENT=development`.

## Security Best Practices

1. **Never use wildcard CORS origins** (`*`) in any environment
2. **Explicitly list allowed origins** in your configuration
3. **Use environment-specific configurations** for development vs production
4. **Regularly audit** your CORS configurations

## References
- Issue #593: CORS Security Vulnerability Remediation
- PR #592: Fix CORS wildcard vulnerability in backend files

## Contact
For questions about this change or assistance with development setup, please contact the security team or refer to the main README.md for proper development environment setup.