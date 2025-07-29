# RLS (Row Level Security) Implementation Guide

## Overview

This implementation provides proper session variable isolation for Row Level Security (RLS) in PostgreSQL when using SQLAlchemy with connection pooling. It ensures that session variables (like `app.user_id` and `app.restaurant_id`) are properly isolated between different requests, preventing data leakage in a multi-tenant environment.

## Key Components

### 1. Database Configuration (`app/core/database.py`)

The database engine is configured with:
- `pool_reset_on_return='rollback'` - Ensures transactions are rolled back when connections return to pool
- Event listeners for connection lifecycle:
  - `checkout`: Sets session variables when connection is borrowed from pool
  - `checkin`: Resets all session variables when connection is returned to pool

### 2. RLS Context (`app/core/database.py`)

Thread-local storage that maintains RLS context for each request:

```python
# Set RLS context for current request
RLSContext.set(
    user_id="user-uuid",
    restaurant_id="restaurant-uuid",
    role="manager"
)

# Get current context
context = RLSContext.get()

# Clear context (happens automatically at request end)
RLSContext.clear()
```

### 3. RLS Middleware (`app/middleware/rls_middleware.py`)

Provides multiple ways to set RLS context:

#### As a Dependency:
```python
@router.get("/orders")
async def get_orders(
    db: Session = Depends(get_db),
    _rls: None = Depends(set_rls_context),  # Sets RLS automatically
    current_user: User = Depends(get_current_user)
):
    # All queries will be filtered by user's restaurant_id
    orders = db.query(Order).all()
```

#### As a Context Manager:
```python
from app.core.database import get_db_with_rls

# For background tasks or scripts
with get_db_with_rls(user_id="123", restaurant_id="456") as db:
    # All queries in this block have RLS context
    orders = db.query(Order).all()
```

#### As a Decorator:
```python
from app.middleware.rls_middleware import with_rls_context

@with_rls_context(restaurant_id="123")
async def process_daily_reports():
    # Function runs with specified RLS context
    pass
```

## Database Schema Requirements

To use RLS, you need to create policies in PostgreSQL:

```sql
-- Enable RLS on tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policies that use session variables
CREATE POLICY orders_restaurant_isolation ON orders
    FOR ALL
    TO application_role
    USING (restaurant_id = current_setting('app.restaurant_id', true)::uuid);

CREATE POLICY products_restaurant_isolation ON products
    FOR ALL
    TO application_role
    USING (restaurant_id = current_setting('app.restaurant_id', true)::uuid);

-- Grant necessary permissions
GRANT ALL ON orders TO application_role;
GRANT ALL ON products TO application_role;
```

## How It Works

1. **Request arrives** → FastAPI processes authentication
2. **User authenticated** → `get_current_user` returns user object
3. **RLS context set** → `set_rls_context` dependency stores user info in thread-local storage
4. **Database connection requested** → `get_db` provides a session
5. **Connection checked out from pool** → `checkout` event fires, sets PostgreSQL session variables
6. **Queries executed** → PostgreSQL RLS policies filter data based on session variables
7. **Request completes** → Connection returned to pool, `checkin` event resets all variables

## Security Guarantees

1. **Thread Isolation**: Each request has its own RLS context in thread-local storage
2. **Connection Reset**: All session variables are reset when connections return to pool
3. **Error Handling**: Context is cleared even if requests fail
4. **No Cross-Contamination**: Connection pooling doesn't leak session variables between requests

## Testing

Run the test suite to verify RLS isolation:

```bash
pytest tests/test_rls_isolation.py -v
```

The tests verify:
- Thread-local context isolation
- Session variable persistence during requests
- Proper cleanup after requests
- Concurrent request isolation
- Error handling and context cleanup

## Best Practices

1. **Always use the provided helpers** - Don't set session variables manually
2. **Use the dependency pattern** for API endpoints
3. **Use context managers** for background tasks
4. **Test your policies** - Ensure RLS policies are correctly filtering data
5. **Monitor performance** - RLS adds overhead; monitor query performance

## Troubleshooting

### Session variables not set
- Check that RLS context is set before database queries
- Verify event listeners are registered on engine
- Enable SQLAlchemy logging to see session variable commands

### Data leakage between requests
- Ensure `pool_reset_on_return='rollback'` is set
- Verify `RESET ALL` is called in checkin event
- Check thread-local storage is properly cleared

### Performance issues
- Consider connection pool size vs concurrent requests
- Monitor time spent setting/resetting session variables
- Optimize RLS policies to use indexes

## Migration Guide

To add RLS to existing endpoints:

1. Add the RLS dependency:
   ```python
   _rls: None = Depends(set_rls_context)
   ```

2. Ensure all queries go through authenticated sessions

3. Create and test PostgreSQL RLS policies

4. Monitor for any access issues or performance impacts