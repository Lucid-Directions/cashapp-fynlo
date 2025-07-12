# Menu API Timeout Analysis

## Problem Summary
The `/api/v1/menu/items` endpoint is timing out on DigitalOcean despite PR #248 being deployed which fixed the N+1 query issue.

## Root Cause Analysis

### 1. ✅ N+1 Query Issue (Fixed in PR #248)
- **Previous Issue**: For each product, a separate query was made to fetch category name
- **Fix Applied**: Now uses a join query and pre-fetches all categories in a single query
- **Status**: RESOLVED

### 2. ❌ Database Connection Pooling Not Configured
**Critical Issue Found**: The database engine is created without connection pooling parameters:

```python
# Current implementation (app/core/database.py:18)
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)
```

**Problem**: 
- No connection pooling configured
- No pool size limits
- No connection recycling
- No pre-ping to check stale connections

**Recommended Fix**:
```python
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,           # Number of connections to maintain
    max_overflow=10,        # Maximum overflow connections
    pool_recycle=3600,      # Recycle connections after 1 hour
    pool_pre_ping=True,     # Test connections before using
    pool_timeout=30         # Timeout for getting connection from pool
)
```

### 3. ⚠️ Missing Database Indexes (Partially Addressed)
**Current Indexes** (from migrations):
- `idx_products_restaurant_id` on `products.restaurant_id`
- `idx_products_category_id` on `products.category_id`
- `idx_products_restaurant_active` on `products(restaurant_id, is_active)`
- `idx_categories_restaurant_id` on `categories.restaurant_id`

**Potential Issue**: The join query might benefit from a composite index on `products(restaurant_id, category_id, is_active)` for optimal performance.

### 4. ⚠️ Redis Connection Pool Configuration
Redis is configured with `max_connections=20`, which might be insufficient under load.

### 5. ⚠️ Query Execution Analysis
The current query execution:
1. Filters products by restaurant_id and is_active
2. Optionally filters by category (requires additional query)
3. Joins with categories table
4. Orders by product name
5. Fetches ALL categories for the restaurant (even if filtering by one)

**Potential Optimization**: When filtering by category, the categories_dict fetch is unnecessary.

## Immediate Actions Required

### 1. Add Database Connection Pooling (CRITICAL)
```python
# Update app/core/database.py
from sqlalchemy.pool import QueuePool

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    pool_timeout=30
)
```

### 2. Add Logging to Diagnose Timeout
```python
# Add to menu.py endpoint
import time

@router.get("/items")
async def get_menu_items(...):
    start_time = time.time()
    
    # Log entry
    logger.info(f"Menu items request started - Restaurant: {restaurant_id}")
    
    # ... existing code ...
    
    # Log execution time
    execution_time = time.time() - start_time
    logger.info(f"Menu items request completed in {execution_time:.2f}s - Items: {len(menu_items)}")
    
    if execution_time > 5:  # Alert on slow queries
        logger.warning(f"SLOW QUERY: Menu items took {execution_time:.2f}s for restaurant {restaurant_id}")
```

### 3. Optimize Category Filtering
```python
# When filtering by specific category, don't fetch all categories
if category and category != 'All':
    category_obj = db.query(Category).filter(
        and_(Category.restaurant_id == restaurant_id, Category.name == category)
    ).first()
    if category_obj:
        query = query.filter(Product.category_id == category_obj.id)
        # Only fetch the specific category name
        categories_dict = {category_obj.id: category_obj.name}
else:
    # Fetch all categories only when needed
    categories_dict = {
        cat.id: cat.name 
        for cat in db.query(Category).filter(Category.restaurant_id == restaurant_id).all()
    }
```

### 4. Add Query Explain Plan
```python
# Temporary debug code to analyze query performance
from sqlalchemy import text

# Get query execution plan
explain_query = text(f"EXPLAIN ANALYZE {str(query.statement.compile(compile_kwargs={'literal_binds': True}))}")
result = db.execute(explain_query)
logger.info(f"Query plan: {result.fetchall()}")
```

## DigitalOcean Specific Considerations

1. **Health Check Timeout**: The health check might be timing out, causing DigitalOcean to mark the service as unhealthy
2. **Resource Limits**: Check if the app is hitting memory or CPU limits
3. **Network Latency**: Database connection might have high latency from app to managed database

## Testing Steps

1. **Local Testing**:
   ```bash
   # Test the endpoint locally with timing
   time curl http://localhost:8000/api/v1/menu/items
   ```

2. **Load Testing**:
   ```bash
   # Use Apache Bench to simulate concurrent requests
   ab -n 100 -c 10 http://localhost:8000/api/v1/menu/items
   ```

3. **Database Query Analysis**:
   ```sql
   -- Check table sizes
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE tablename IN ('products', 'categories')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   
   -- Check slow queries
   SELECT 
     query,
     mean_exec_time,
     calls
   FROM pg_stat_statements
   WHERE query LIKE '%products%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

## Recommended Deployment Fix

1. **Immediate Hotfix**: Add connection pooling to database.py
2. **Deploy**: Push the fix and trigger deployment
3. **Monitor**: Watch logs for execution times
4. **Scale**: If still timing out, consider scaling the database or app instances

## Alternative Solutions

1. **Implement Pagination**: Limit results to prevent large data transfers
2. **Use Database Views**: Create a materialized view for menu items
3. **Implement Read Replicas**: Use read replicas for query distribution
4. **Edge Caching**: Use DigitalOcean Spaces CDN for menu data

## Monitoring Commands

```bash
# Check DigitalOcean app logs
doctl apps logs <app-id> --type=runtime --follow

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis connections
redis-cli -u $REDIS_URL INFO clients
```