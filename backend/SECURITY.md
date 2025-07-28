# Fynlo POS Security Documentation

## Overview

This document outlines the security measures implemented in the Fynlo POS backend to protect against common vulnerabilities and ensure data isolation in our multi-tenant SaaS platform.

## Security Implementations

### 1. Multi-Tenant Isolation

**Implementation**: `app/middleware/tenant_isolation.py`

- **Restaurant Data Isolation**: All restaurant-specific data is filtered by `restaurant_id`
- **Tenant Validation Middleware**: Automatically validates restaurant access on all endpoints
- **Platform Owner Access**: Platform owners (Ryan and Arno) have full access when explicitly allowed
- **Query Filtering**: Database queries are automatically filtered by restaurant context

**Usage Example**:
```python
from app.middleware.tenant_isolation import tenant_isolation, validate_restaurant_access

# Decorator for endpoint protection
@tenant_isolation.require_restaurant_context()
async def get_orders(restaurant_id: UUID, current_user: User = Depends(get_current_user)):
    # Automatically validates restaurant access
    pass

# Dependency for validation
@router.get("/orders/{order_id}")
async def get_order(
    order_id: UUID,
    restaurant_id: UUID = Depends(validate_restaurant_access),
    current_user: User = Depends(get_current_user)
):
    # restaurant_id is validated
    pass
```

### 2. SQL Injection Prevention

**Implementation**: `app/core/security.py`

- **Enhanced Input Sanitization**: Comprehensive removal of SQL keywords and dangerous patterns
- **Parameterized Queries**: All database queries use SQLAlchemy ORM or parameterized statements
- **Validation Functions**: Multiple levels of input validation and sanitization

**Key Functions**:
- `sanitize_string()`: Removes SQL injection patterns, keywords, and dangerous characters
- `validate_sql_safe()`: Validates input and raises exception if dangerous patterns detected
- `sanitize_dict()`: Recursively sanitizes dictionary inputs
- `sanitize_filename()`: Prevents directory traversal attacks

**Usage Example**:
```python
from app.core.security import sanitize_string, validate_sql_safe

# Sanitize user input
clean_name = sanitize_string(user_input, max_length=255, strict=True)

# Validate SQL safety
validate_sql_safe(search_query, field_name="search")
```

### 3. Authentication & Authorization

**Implementation**: `app/core/auth.py`

- **JWT Token Security**: Tokens include user role and restaurant context
- **Role-Based Access Control (RBAC)**: Enforced at endpoint level
- **Supabase Integration**: Leverages Supabase for secure authentication
- **Token Expiration**: Configurable token lifetime with automatic expiration

**User Roles**:
- `platform_owner`: Full system access (Ryan and Arno only)
- `restaurant_owner`: Full access to their restaurant
- `manager`: Management functions within restaurant
- `employee`: Basic POS operations

### 4. Security Testing

**Test Suites**:
- `tests/security/test_sql_injection.py`: Comprehensive SQL injection tests
- `tests/security/test_multi_tenant_isolation.py`: Tenant isolation verification
- `tests/security/test_authentication.py`: Authentication flow testing

Run security tests:
```bash
pytest tests/security/ -v
```

## Critical Security Issues

### 1. Inventory System Multi-Tenancy (CRITICAL)

**Issue**: The inventory system (`InventoryItem`, `Recipe`, `InventoryLedgerEntry`) lacks `restaurant_id` fields, making inventory global across all restaurants.

**Impact**:
- Cross-restaurant inventory access
- Data leakage between competitors
- Inventory manipulation across tenants

**Temporary Mitigation**: Authentication is currently disabled on inventory endpoints to prevent exploitation.

**Required Fix**: Add `restaurant_id` to inventory models and implement proper filtering.

### 2. WebSocket Security

**Status**: Partially implemented

**Required Improvements**:
- Token refresh for long-lived connections
- Proper tenant isolation for real-time events
- Connection authentication validation

## Security Checklist for Developers

When developing new features:

- [ ] **Authentication**: Use `@Depends(get_current_user)` on all endpoints
- [ ] **Multi-Tenant**: Include `restaurant_id` validation using middleware
- [ ] **Input Validation**: Sanitize all user inputs using security functions
- [ ] **SQL Queries**: Use ORM or parameterized queries only
- [ ] **Error Handling**: Never expose internal details in error messages
- [ ] **Logging**: Log security events without exposing sensitive data
- [ ] **Testing**: Write security tests for new endpoints

## Environment-Specific Security

### Development
- Debug endpoints enabled (e.g., `/debug/associate-restaurant`)
- Detailed error messages for debugging
- CORS restrictions relaxed

### Production
- Debug endpoints disabled (automatic check)
- Generic error messages
- Strict CORS policy
- Rate limiting enforced
- HTTPS only

## Security Headers

Recommended security headers (configure in nginx/load balancer):
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## Incident Response

In case of security incident:

1. **Immediate**: Disable affected endpoints
2. **Assess**: Determine scope and impact
3. **Patch**: Deploy security fix
4. **Audit**: Check logs for exploitation
5. **Notify**: Inform affected users if required

## Regular Security Tasks

- [ ] Monthly: Review and update dependencies
- [ ] Quarterly: Security audit of new features
- [ ] Annually: Penetration testing
- [ ] Ongoing: Monitor security advisories

## Contact

For security concerns or vulnerability reports:
- Platform Owners: Ryan and Arno
- Email: security@fynlo.com (create dedicated security email)

---

**Last Updated**: 2025-07-28
**Version**: 1.0
