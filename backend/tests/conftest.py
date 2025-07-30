"""
Test configuration for real end-to-end testing
NO MOCKS - Uses real services in test/sandbox mode
"""
import pytest
import asyncio
import os
import sys
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import event, text
from httpx import AsyncClient
import redis.asyncio as redis

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment
os.environ["APP_ENV"] = "test"

# Import after setting environment
from app.main import app
from app.core.database import Base
from app.core.config import settings
from app.core.database import Restaurant, User, Product, Category, Order
from app.api.v1.endpoints.auth_backup import create_access_token
from app.middleware.rate_limit_middleware import limiter
from datetime import datetime, timedelta
import uuid

# Initialize limiter for tests
app.state.limiter = limiter

# Verify we're using test database
assert ("test" in settings.DATABASE_URL or "memory" in settings.DATABASE_URL), "Test database URL must contain 'test' or use in-memory database to prevent accidental data loss"
assert settings.ENVIRONMENT == "test", "Environment must be set to 'test'"

# Configure pytest-asyncio
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Real PostgreSQL test database setup
@pytest.fixture(scope="session")
async def test_engine():
    """Create real PostgreSQL test database engine"""
    # Create test database engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    # Create all tables
    async with engine.begin() as conn:
        # Drop all tables first to ensure clean state
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session"""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()

# Real Redis client for testing
@pytest.fixture
async def redis_client():
    """Create real Redis client for testing"""
    client = await redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    
    # Clear test database
    await client.flushdb()
    
    yield client
    
    # Cleanup
    await client.flushdb()
    await client.close()

# Test data fixtures
@pytest.fixture
async def test_restaurant(db_session: AsyncSession) -> Restaurant:
    """Create a test restaurant"""
    restaurant = Restaurant(
        id=str(uuid.uuid4()),
        name="Test Restaurant",
        email="test@restaurant.com",
        phone="+447123456789",
        address="123 Test Street",
        city="London",
        postal_code="SW1A 1AA",
        country="UK",
        currency="GBP",
        timezone="Europe/London",
        business_hours={
            "monday": {"open": "09:00", "close": "22:00"},
            "tuesday": {"open": "09:00", "close": "22:00"},
            "wednesday": {"open": "09:00", "close": "22:00"},
            "thursday": {"open": "09:00", "close": "22:00"},
            "friday": {"open": "09:00", "close": "23:00"},
            "saturday": {"open": "10:00", "close": "23:00"},
            "sunday": {"open": "10:00", "close": "21:00"}
        },
        settings={
            "order_prefix": "ORD",
            "table_service_enabled": True,
            "takeaway_enabled": True,
            "delivery_enabled": False
        },
        is_active=True,
        created_at=datetime.utcnow()
    )
    
    db_session.add(restaurant)
    await db_session.commit()
    await db_session.refresh(restaurant)
    return restaurant

@pytest.fixture
async def test_user(db_session: AsyncSession, test_restaurant: Restaurant) -> User:
    """Create a test user"""
    user = User(
        id=str(uuid.uuid4()),
        email="test@user.com",
        full_name="Test User",
        role="manager",
        restaurant_id=test_restaurant.id,
        supabase_user_id=str(uuid.uuid4()),
        is_active=True,
        is_platform_owner=False,
        created_at=datetime.utcnow()
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
async def test_platform_owner(db_session: AsyncSession) -> User:
    """Create a test platform owner"""
    user = User(
        id=str(uuid.uuid4()),
        email=settings.PLATFORM_OWNER_EMAIL,
        full_name="Platform Owner",
        role="platform_owner",
        restaurant_id=None,
        supabase_user_id=str(uuid.uuid4()),
        is_active=True,
        is_platform_owner=True,
        created_at=datetime.utcnow()
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
async def test_category(db_session: AsyncSession, test_restaurant: Restaurant) -> Category:
    """Create a test category"""
    category = Category(
        id=str(uuid.uuid4()),
        restaurant_id=test_restaurant.id,
        name="Test Category",
        display_order=1,
        is_active=True,
        created_at=datetime.utcnow()
    )
    
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category

@pytest.fixture
async def test_product(db_session: AsyncSession, test_restaurant: Restaurant, test_category: Category) -> Product:
    """Create a test product"""
    product = Product(
        id=str(uuid.uuid4()),
        restaurant_id=test_restaurant.id,
        category_id=test_category.id,
        name="Test Product",
        description="A test product",
        price=10.99,
        display_order=1,
        is_available=True,
        created_at=datetime.utcnow()
    )
    
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

# Authentication fixtures
@pytest.fixture
async def auth_headers(test_user: User) -> dict:
    """Create authentication headers for test user"""
    access_token = create_access_token(
        data={
            "sub": test_user.email,
            "user_id": test_user.id,
            "restaurant_id": test_user.restaurant_id,
            "role": test_user.role
        },
        expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
async def platform_owner_headers(test_platform_owner: User) -> dict:
    """Create authentication headers for platform owner"""
    access_token = create_access_token(
        data={
            "sub": test_platform_owner.email,
            "user_id": test_platform_owner.id,
            "role": test_platform_owner.role,
            "is_platform_owner": True
        },
        expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

# HTTP client fixture
@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

# Database utilities
@pytest.fixture
async def clear_database(db_session: AsyncSession):
    """Clear all data from database tables"""
    # List tables in dependency order (reverse of foreign key dependencies)
    # Using a whitelist approach for security
    ALLOWED_TEST_TABLES = {
        "order_items",
        "orders", 
        "products",
        "categories",
        "users",
        "restaurants"
    }
    
    tables = [
        "order_items",
        "orders", 
        "products",
        "categories",
        "users",
        "restaurants"
    ]
    
    for table in tables:
        # Validate table name against whitelist
        if table not in ALLOWED_TEST_TABLES:
            raise ValueError(f"Table '{table}' is not in the allowed test tables list")
        # Use parameterized query for table names is not possible in SQL,
        # but we've validated against a whitelist, so this is safe
        await db_session.execute(text(f"DELETE FROM {table}"))
    
    await db_session.commit()

# Test utilities
@pytest.fixture
def make_order():
    """Factory to create test orders"""
    async def _make_order(
        db_session: AsyncSession,
        restaurant: Restaurant,
        user: User,
        status: str = "pending",
        total_amount: float = 50.00
    ) -> Order:
        order = Order(
            id=str(uuid.uuid4()),
            restaurant_id=restaurant.id,
            order_number=f"ORD-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            status=status,
            total_amount=total_amount,
            created_by=user.id,
            created_at=datetime.utcnow()
        )
        
        db_session.add(order)
        await db_session.commit()
        await db_session.refresh(order)
        return order
    
    return _make_order