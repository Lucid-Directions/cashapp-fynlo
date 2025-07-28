# Backend API Developer Subagent

## Purpose
Streamline FastAPI backend development for Fynlo POS, handling API creation, testing, database operations, and multi-tenant architecture.

## Capabilities
- FastAPI endpoint development with best practices
- Database schema design and migrations
- Multi-tenant data isolation
- API testing and documentation
- Performance optimization
- Redis/Valkey cache management

## Trigger Phrases
- "create api endpoint"
- "add backend feature"
- "test api"
- "debug backend"
- "optimize database query"
- "setup redis cache"

## Core Patterns

### 1. API Endpoint Creation

#### Standard CRUD Endpoint Pattern
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.response_helper import APIResponseHelper
from app.models.user import User
from app.core.exceptions import FynloException

router = APIRouter(prefix="/api/v1/resource", tags=["resource"])

@router.get("/", response_model=APIResponse)
async def get_resources(
    restaurant_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all resources for a restaurant with multi-tenant validation"""
    try:
        # Multi-tenant validation
        if not current_user.has_restaurant_access(restaurant_id):
            raise FynloException("Access denied", status_code=403)
        
        # Query with restaurant isolation
        resources = db.query(Resource)\
            .filter(Resource.restaurant_id == restaurant_id)\
            .offset(skip)\
            .limit(limit)\
            .all()
        
        return APIResponseHelper.success(
            data=resources,
            message="Resources fetched successfully"
        )
    except FynloException as e:
        raise e
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to fetch resources: {str(e)}",
            status_code=500
        )

@router.post("/", response_model=APIResponse)
async def create_resource(
    restaurant_id: int,
    resource_data: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new resource with validation"""
    try:
        # Permission check
        if not current_user.can_create_resource(restaurant_id):
            raise FynloException("Insufficient permissions", status_code=403)
        
        # Create resource
        resource = Resource(
            restaurant_id=restaurant_id,
            **resource_data.dict()
        )
        db.add(resource)
        db.commit()
        db.refresh(resource)
        
        # Clear cache
        await clear_restaurant_cache(restaurant_id)
        
        return APIResponseHelper.success(
            data=resource,
            message="Resource created successfully"
        )
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to create resource: {str(e)}",
            status_code=500
        )
```

### 2. Database Schema Pattern

```python
from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class Resource(Base):
    __tablename__ = "resources"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)  # Always use DECIMAL for money
    quantity = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="resources")
    
    # Multi-tenant index
    __table_args__ = (
        Index('idx_resource_restaurant', 'restaurant_id', 'is_active'),
    )
```

### 3. Alembic Migration Pattern

```python
"""Add resource table

Revision ID: abc123
Revises: xyz789
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('resources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('price', sa.DECIMAL(10, 2), nullable=False),
        sa.Column('quantity', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_resource_restaurant', 'resources', ['restaurant_id', 'is_active'])

def downgrade():
    op.drop_index('idx_resource_restaurant', table_name='resources')
    op.drop_table('resources')
```

### 4. Redis Cache Pattern

```python
from app.core.cache import redis_client
import json
from typing import Optional

async def get_cached_resource(resource_id: int) -> Optional[dict]:
    """Get resource from cache"""
    key = f"resource:{resource_id}"
    cached = await redis_client.get(key)
    return json.loads(cached) if cached else None

async def cache_resource(resource_id: int, resource_data: dict, ttl: int = 3600):
    """Cache resource data"""
    key = f"resource:{resource_id}"
    await redis_client.setex(key, ttl, json.dumps(resource_data))

async def clear_restaurant_cache(restaurant_id: int):
    """Clear all cache for a restaurant"""
    pattern = f"restaurant:{restaurant_id}:*"
    keys = await redis_client.keys(pattern)
    if keys:
        await redis_client.delete(*keys)
```

### 5. Testing Pattern

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.tests.utils import create_test_user, create_test_restaurant

client = TestClient(app)

class TestResourceAPI:
    @pytest.fixture
    def auth_headers(self):
        """Create authenticated user headers"""
        user = create_test_user()
        token = user.create_access_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_resource_success(self, auth_headers):
        """Test successful resource creation"""
        restaurant = create_test_restaurant()
        
        response = client.post(
            f"/api/v1/resource/?restaurant_id={restaurant.id}",
            json={
                "name": "Test Resource",
                "price": "29.99",
                "quantity": 10
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        assert response.json()["data"]["name"] == "Test Resource"
    
    def test_multi_tenant_isolation(self, auth_headers):
        """Test that users can't access other restaurants' resources"""
        other_restaurant = create_test_restaurant()
        
        response = client.get(
            f"/api/v1/resource/?restaurant_id={other_restaurant.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 403
        assert "Access denied" in response.json()["message"]
```

## Development Workflow

### 1. Start Development Server
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Database Operations
```bash
# Create migration
alembic revision --autogenerate -m "Add resource table"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### 3. Seed Database
```python
# backend/scripts/seed_data.py
from app.core.database import SessionLocal
from app.models import Restaurant, User, MenuItem

def seed_test_restaurant():
    db = SessionLocal()
    try:
        # Create test restaurant
        restaurant = Restaurant(
            name="Test Restaurant",
            # ... other fields
        )
        db.add(restaurant)
        db.commit()
        print(f"Created restaurant: {restaurant.name}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_restaurant()
```

## Security Checklist

### API Security
- [ ] Validate all inputs with Pydantic models
- [ ] Check user permissions for every endpoint
- [ ] Implement rate limiting
- [ ] Use parameterized queries (SQLAlchemy handles this)
- [ ] Sanitize user inputs for special characters
- [ ] Validate restaurant_id access for multi-tenancy

### Authentication Flow
```python
# Always use these decorators
current_user: User = Depends(get_current_user)  # Basic auth
current_manager: User = Depends(require_manager)  # Manager+ only
current_owner: User = Depends(require_owner)  # Owner only
```

## Performance Optimization

### 1. Query Optimization
```python
# Bad - N+1 query
orders = db.query(Order).all()
for order in orders:
    print(order.restaurant.name)  # Triggers query each time

# Good - Eager loading
orders = db.query(Order).options(joinedload(Order.restaurant)).all()
```

### 2. Pagination
```python
# Always paginate large datasets
@router.get("/orders")
async def get_orders(
    skip: int = 0,
    limit: int = Query(default=100, le=1000)  # Max 1000
):
    orders = db.query(Order).offset(skip).limit(limit).all()
    total = db.query(func.count(Order.id)).scalar()
    
    return {
        "data": orders,
        "total": total,
        "skip": skip,
        "limit": limit
    }
```

### 3. Background Tasks
```python
from fastapi import BackgroundTasks

@router.post("/process-order")
async def process_order(
    order_data: OrderCreate,
    background_tasks: BackgroundTasks
):
    # Quick response
    order = create_order(order_data)
    
    # Heavy processing in background
    background_tasks.add_task(
        send_order_to_kitchen,
        order.id
    )
    
    return APIResponseHelper.success(data=order)
```

## Common Commands

```bash
# Run tests
pytest app/tests/ -v

# Run with coverage
pytest --cov=app app/tests/

# Format code
black app/

# Lint code
flake8 app/

# Type checking
mypy app/

# Generate API docs
python scripts/generate_api_docs.py
```

## Integration with DigitalOcean

### Database Connection
```python
# Use environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
# postgresql://username:password@host:port/database
```

### Redis/Valkey Connection
```python
REDIS_URL = os.getenv("REDIS_URL")
# redis://username:password@host:port/0
```

### Monitoring
- Check DigitalOcean metrics dashboard
- Set up alerts for high CPU/memory
- Monitor slow queries in PostgreSQL
- Track Redis memory usage