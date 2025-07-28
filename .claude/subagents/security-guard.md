# Multi-tenant Security Guard Subagent

## Purpose
Enforce security best practices and multi-tenant data isolation for Fynlo POS, preventing data leaks and ensuring compliance with RBAC.

## Capabilities
- Multi-tenant data isolation validation
- Role-based access control (RBAC) enforcement
- Input sanitization and validation
- SQL injection prevention
- Authentication flow verification
- Security vulnerability scanning
- Penetration testing scenarios

## Trigger Phrases
- "check security"
- "validate multi-tenant"
- "test rbac"
- "security audit"
- "check data isolation"
- "validate permissions"

## Security Architecture

### 1. Multi-tenant Hierarchy
```
Platform (Fynlo)
  └── Restaurant (e.g., Chucho's Tacos)
      └── Users (Owners, Managers, Employees)
          └── Resources (Orders, Menu, Inventory)
```

### 2. Role Permissions Matrix

| Role | Platform Admin | Restaurant Owner | Manager | Employee |
|------|----------------|------------------|---------|----------|
| View All Restaurants | ✅ | ❌ | ❌ | ❌ |
| Manage Restaurant Settings | ✅ | ✅ | ❌ | ❌ |
| Manage Employees | ✅ | ✅ | ✅ | ❌ |
| Process Orders | ✅ | ✅ | ✅ | ✅ |
| View Reports | ✅ | ✅ | ✅ | ❌ |
| Manage Inventory | ✅ | ✅ | ✅ | ❌ |
| Handle Refunds | ✅ | ✅ | ✅ | ❌ |

## Security Validation Patterns

### 1. Multi-tenant Data Isolation

```python
# SECURE: Always filter by restaurant_id
@router.get("/orders")
async def get_orders(
    restaurant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate access
    if not current_user.has_restaurant_access(restaurant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Filter by restaurant
    orders = db.query(Order)\
        .filter(Order.restaurant_id == restaurant_id)\
        .all()
    
    return orders

# INSECURE: Missing restaurant filter
@router.get("/orders")
async def get_all_orders(db: Session = Depends(get_db)):
    # ❌ SECURITY VIOLATION: Can see all restaurants' orders
    return db.query(Order).all()
```

### 2. RBAC Implementation

```python
# Permission decorators
def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Required role: {allowed_roles}"
            )
        return current_user
    return role_checker

# Usage
@router.post("/restaurant/settings")
async def update_settings(
    restaurant_id: int,
    settings: RestaurantSettings,
    current_user: User = Depends(require_role(["platform_owner", "restaurant_owner"]))
):
    # Only owners can update settings
    pass
```

### 3. Input Sanitization

```python
import re
from typing import Optional

class SecurityValidator:
    # Dangerous characters to sanitize
    DANGEROUS_CHARS = ['<', '>', '"', "'", '(', ')', ';', '&', '+', '`', '|', '\\', '*']
    
    @staticmethod
    def sanitize_input(value: str) -> str:
        """Remove dangerous characters from user input"""
        if not value:
            return value
        
        # Escape special characters
        for char in SecurityValidator.DANGEROUS_CHARS:
            value = value.replace(char, '')
        
        # Remove SQL keywords
        sql_keywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'SELECT', 'UNION']
        for keyword in sql_keywords:
            value = re.sub(rf'\b{keyword}\b', '', value, flags=re.IGNORECASE)
        
        return value.strip()
    
    @staticmethod
    def validate_restaurant_id(restaurant_id: int, user: User) -> bool:
        """Validate user has access to restaurant"""
        if user.role == "platform_owner":
            return True
        
        return user.restaurant_id == restaurant_id
```

### 4. Authentication Token Validation

```python
from app.core.supabase_client import supabase

async def verify_supabase_token(token: str) -> dict:
    """Verify Supabase JWT token"""
    try:
        # Verify with Supabase
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if user exists in our database
        db_user = db.query(User).filter(User.supabase_id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Verify subscription is active
        if not db_user.subscription_active:
            raise HTTPException(status_code=402, detail="Subscription required")
        
        return db_user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")
```

## Security Testing Scenarios

### 1. Multi-tenant Isolation Test

```python
import pytest
from app.tests.utils import create_test_restaurants, create_test_users

def test_restaurant_isolation():
    """Test that restaurants cannot access each other's data"""
    # Create two restaurants
    restaurant_a = create_test_restaurant("Restaurant A")
    restaurant_b = create_test_restaurant("Restaurant B")
    
    # Create users for each
    user_a = create_test_user(restaurant_a.id, role="manager")
    user_b = create_test_user(restaurant_b.id, role="manager")
    
    # User A tries to access Restaurant B's orders
    response = client.get(
        f"/api/v1/orders?restaurant_id={restaurant_b.id}",
        headers={"Authorization": f"Bearer {user_a.token}"}
    )
    
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]
```

### 2. RBAC Permission Test

```python
def test_role_based_access():
    """Test role-based access control"""
    restaurant = create_test_restaurant()
    
    # Create users with different roles
    owner = create_test_user(restaurant.id, role="restaurant_owner")
    manager = create_test_user(restaurant.id, role="manager")
    employee = create_test_user(restaurant.id, role="employee")
    
    # Test restaurant settings endpoint (owner only)
    settings_endpoint = f"/api/v1/restaurant/{restaurant.id}/settings"
    
    # Owner should succeed
    response = client.put(settings_endpoint, 
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {owner.token}"}
    )
    assert response.status_code == 200
    
    # Manager should fail
    response = client.put(settings_endpoint,
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {manager.token}"}
    )
    assert response.status_code == 403
    
    # Employee should fail
    response = client.put(settings_endpoint,
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {employee.token}"}
    )
    assert response.status_code == 403
```

### 3. SQL Injection Test

```python
def test_sql_injection_prevention():
    """Test SQL injection prevention"""
    malicious_inputs = [
        "'; DROP TABLE orders; --",
        "1' OR '1'='1",
        "admin'--",
        "1' UNION SELECT * FROM users--"
    ]
    
    for payload in malicious_inputs:
        response = client.get(
            f"/api/v1/search?q={payload}",
            headers=auth_headers
        )
        
        # Should not cause error, just return empty/sanitized results
        assert response.status_code == 200
        assert "error" not in response.json()
```

## Security Audit Checklist

### Pre-deployment Security Review

- [ ] **Authentication**
  - [ ] All endpoints require authentication
  - [ ] Supabase tokens properly validated
  - [ ] Session expiration implemented
  - [ ] No hardcoded credentials

- [ ] **Multi-tenancy**
  - [ ] All queries filter by restaurant_id
  - [ ] Cross-tenant access prevented
  - [ ] Restaurant isolation tested

- [ ] **RBAC**
  - [ ] Roles properly defined
  - [ ] Permissions matrix implemented
  - [ ] Role checks on sensitive endpoints

- [ ] **Input Validation**
  - [ ] All inputs sanitized
  - [ ] SQL injection prevention
  - [ ] XSS prevention
  - [ ] File upload restrictions

- [ ] **API Security**
  - [ ] Rate limiting implemented
  - [ ] CORS properly configured
  - [ ] HTTPS enforced
  - [ ] API versioning

- [ ] **Data Protection**
  - [ ] PII encrypted at rest
  - [ ] Secure password hashing
  - [ ] No sensitive data in logs
  - [ ] Secure payment handling

## Common Security Vulnerabilities

### 1. Missing Restaurant Filter
```python
# ❌ VULNERABLE
orders = db.query(Order).filter(Order.id == order_id).first()

# ✅ SECURE
orders = db.query(Order)\
    .filter(Order.id == order_id)\
    .filter(Order.restaurant_id == current_user.restaurant_id)\
    .first()
```

### 2. Insufficient Permission Check
```python
# ❌ VULNERABLE
if current_user:
    # Any authenticated user can access

# ✅ SECURE
if current_user and current_user.role in ["restaurant_owner", "manager"]:
    # Only authorized roles
```

### 3. Direct Object Reference
```python
# ❌ VULNERABLE
@router.get("/order/{order_id}")
async def get_order(order_id: int):
    return db.query(Order).get(order_id)

# ✅ SECURE
@router.get("/order/{order_id}")
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order)\
        .filter(Order.id == order_id)\
        .filter(Order.restaurant_id == current_user.restaurant_id)\
        .first()
    
    if not order:
        raise HTTPException(404, "Order not found")
    
    return order
```

## Security Monitoring

### Real-time Alerts
```python
# Log suspicious activity
async def log_security_event(
    event_type: str,
    user_id: int,
    details: dict
):
    await redis_client.lpush(
        "security_events",
        json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "details": details
        })
    )

# Monitor for:
# - Multiple failed login attempts
# - Cross-tenant access attempts
# - Unusual API usage patterns
# - SQL injection attempts
```

## Emergency Response

### Security Breach Protocol
1. **Immediate Actions**
   - Revoke compromised tokens
   - Block suspicious IPs
   - Enable read-only mode

2. **Investigation**
   - Review access logs
   - Identify affected data
   - Trace attack vector

3. **Remediation**
   - Patch vulnerability
   - Reset affected credentials
   - Notify affected users

4. **Prevention**
   - Update security rules
   - Enhance monitoring
   - Security training