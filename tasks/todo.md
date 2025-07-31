# HTTPException to FynloException Migration Plan

## Issue: #437 - Migrate HTTPException to FynloException for consistent error handling

### Objective
Migrate 250 HTTPException instances across 21 files to use FynloException for:
- Consistent error handling
- Enhanced security (no information disclosure)
- Better error categorization and logging
- Compliance with Fynlo's error handling standards

### Current State Analysis
- **Total HTTPExceptions**: 250 instances
- **Files affected**: 21 files
- **Critical files**: auth.py (28), payments.py (40), payment_configurations.py (16)
- **Already migrated**: 33 files successfully using FynloException

### Migration Strategy

#### 1. Exception Mapping Guide
```python
# HTTPException -> FynloException Mapping
HTTPException(404, "Not found") -> ResourceNotFoundException(resource="Type", resource_id=id)
HTTPException(401, "Unauthorized") -> AuthenticationException(message="Auth failed")
HTTPException(403, "Forbidden") -> AuthorizationException(resource="Type", action="action")
HTTPException(400, "Bad request") -> ValidationException(field="field", message="Invalid")
HTTPException(409, "Conflict") -> ConflictException(resource="Type", message="Already exists")
HTTPException(500, "Server error") -> FynloException(message="Internal error", status_code=500)
HTTPException(400, "Payment failed") -> PaymentException(message="Payment error")
HTTPException(400, "Stock issue") -> InventoryException(message="Inventory error")
```

#### 2. File Priority Order
**Phase 1 - Critical Security/Financial (High Priority)**
- [ ] auth.py (28 occurrences) - Authentication security
- [ ] payments.py (40 occurrences) - Financial transactions
- [ ] secure_payments.py (1 occurrence) - Payment security
- [ ] payment_configurations.py (16 occurrences) - Payment config

**Phase 2 - Core Business Logic (Medium Priority)**
- [ ] orders.py (12 occurrences) - Order processing
- [ ] inventory.py (24 occurrences) - Stock management
- [ ] config.py (21 occurrences) - System configuration
- [ ] platform_settings.py (28 occurrences) - Platform config

**Phase 3 - Supporting Features (Lower Priority)**
- [ ] restaurants.py (13 occurrences)
- [ ] customers.py (10 occurrences)
- [ ] platform_admin.py (8 occurrences)
- [ ] admin.py (9 occurrences)
- [ ] recipes.py (9 occurrences)
- [ ] fees.py (7 occurrences)
- [ ] monitoring.py (4 occurrences)
- [ ] tips.py (3 occurrences)
- [ ] dashboard.py (3 occurrences)
- [ ] products_secure.py (3 occurrences)
- [ ] secure_payment_provider_management.py (2 occurrences)
- [ ] platform_settings_public.py (1 occurrence)
- [ ] restaurant_deletion.py (8 occurrences)

### Technical Implementation Details

#### Import Requirements
Every migrated file needs:
```python
from app.core.exceptions import (
    FynloException,
    AuthenticationException,
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException,
    ConflictException,
    BusinessLogicException,
    PaymentException,
    InventoryException,
    ServiceUnavailableError
)
```

#### Common Patterns to Migrate

**Pattern 1: Simple 404**
```python
# Before
raise HTTPException(status_code=404, detail="Order not found")

# After
raise ResourceNotFoundException(
    resource="Order",
    resource_id=order_id,
    message="Order not found"
)
```

**Pattern 2: Authentication Failure**
```python
# Before
raise HTTPException(status_code=401, detail="Invalid credentials")

# After
raise AuthenticationException(
    message="Invalid credentials",
    details={"method": "password"}
)
```

**Pattern 3: Validation Error**
```python
# Before
raise HTTPException(status_code=400, detail=f"Invalid amount: {amount}")

# After
raise ValidationException(
    field="amount",
    message=f"Invalid amount: {amount}",
    details={"provided": amount, "required": "positive number"}
)
```

**Pattern 4: Dynamic Error Messages**
```python
# Before
raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# After
raise FynloException(
    message="Database operation failed",
    status_code=500,
    details={"operation": "query", "error": str(e)}
)
```

### Migration Script Approach

1. **Automated Script Features**:
   - Parse Python AST to find HTTPException instances
   - Map status codes to appropriate FynloException subclasses
   - Preserve error messages and details
   - Update imports automatically
   - Create backup before modifying files
   - Generate migration report

2. **Manual Review Requirements**:
   - Verify business logic context for exception choice
   - Ensure sensitive information isn't exposed
   - Add appropriate resource types and IDs
   - Test error handling paths

### Testing Strategy

1. **Unit Tests**:
   - Verify each endpoint returns correct status codes
   - Check error message format
   - Ensure no information disclosure

2. **Integration Tests**:
   - Test error propagation through middleware
   - Verify logging captures correct exception types
   - Check API responses match expected format

3. **Security Tests**:
   - Run with ERROR_DETAIL_ENABLED=false
   - Verify no stack traces in production
   - Check for information disclosure

### Success Criteria

- [ ] All 250 HTTPException instances migrated
- [ ] All tests passing (pytest)
- [ ] Security audit passes (no information disclosure)
- [ ] Error responses maintain same HTTP status codes
- [ ] Consistent error format across all endpoints
- [ ] No performance regression
- [ ] Code review approved

### Rollback Plan

If issues arise:
1. Git revert the migration commits
2. Hotfix any critical issues
3. Re-run migration with fixes

### Post-Migration Tasks

1. Update API documentation with new error formats
2. Notify frontend team of any response changes
3. Monitor error logs for unexpected issues
4. Add pre-commit hook to prevent new HTTPExceptions

## Review Section

### Pre-Migration Checklist
- [ ] Backup current code state
- [ ] Review FynloException hierarchy
- [ ] Understand business context for each file
- [ ] Set up test environment

### Post-Migration Checklist
- [ ] All files migrated successfully
- [ ] Import statements updated
- [ ] Tests passing
- [ ] Security audit complete
- [ ] Documentation updated
- [ ] PR created with detailed description

### Notes
- FynloException provides better error categorization
- Maintains security by not exposing internal details
- Improves debugging with structured error data
- Enables better error monitoring and alerting