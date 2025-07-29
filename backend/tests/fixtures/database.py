"""
Database fixtures for testing
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import uuid

from app.core.database import Base
from app.models import User, Restaurant, Order, Product, Category
from app.models.subscription import Subscription, SubscriptionPlan


@pytest.fixture(scope="function")
def test_db():
    """Create a test database session"""
    # Use in-memory SQLite for tests
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_restaurant(test_db):
    """Create a test restaurant"""
    restaurant = Restaurant(
        id=str(uuid.uuid4()),
        name="Test Restaurant",
        address="123 Test St",
        phone="+1234567890",
        email="test@restaurant.com",
        business_type="restaurant",
        cuisine_type="italian",
        currency="GBP",
        tax_rate=20.0,
        created_by="test_user",
        subscription_plan="beta"
    )
    test_db.add(restaurant)
    test_db.commit()
    test_db.refresh(restaurant)
    return restaurant


@pytest.fixture
def test_user(test_db, test_restaurant):
    """Create a test user"""
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        full_name="Test User",
        restaurant_id=test_restaurant.id,
        role="manager",
        is_active=True,
        subscription_plan="beta"
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def test_category(test_db, test_restaurant):
    """Create a test category"""
    category = Category(
        id=str(uuid.uuid4()),
        name="Test Category",
        restaurant_id=test_restaurant.id,
        display_order=1
    )
    test_db.add(category)
    test_db.commit()
    test_db.refresh(category)
    return category


@pytest.fixture
def test_product(test_db, test_restaurant, test_category):
    """Create a test product"""
    product = Product(
        id=str(uuid.uuid4()),
        name="Test Product",
        category_id=test_category.id,
        restaurant_id=test_restaurant.id,
        price=10.00,
        available=True,
        stock_quantity=100
    )
    test_db.add(product)
    test_db.commit()
    test_db.refresh(product)
    return product


@pytest.fixture
def test_order(test_db, test_restaurant, test_user):
    """Create a test order"""
    order = Order(
        id=str(uuid.uuid4()),
        restaurant_id=test_restaurant.id,
        created_by=test_user.id,
        status="pending",
        payment_status="pending",
        subtotal=10.00,
        tax_amount=2.00,
        total_amount=12.00,
        order_type="dine_in",
        table_number="1"
    )
    test_db.add(order)
    test_db.commit()
    test_db.refresh(order)
    return order


@pytest.fixture
def test_subscription_plan(test_db):
    """Create test subscription plans"""
    plans = [
        SubscriptionPlan(
            id="alpha",
            name="Alpha",
            price=29.99,
            max_orders=500,
            max_staff=5,
            max_menu_items=50,
            features=["basic_pos", "qr_ordering"]
        ),
        SubscriptionPlan(
            id="beta",
            name="Beta",
            price=59.99,
            max_orders=2000,
            max_staff=15,
            max_menu_items=200,
            features=["basic_pos", "qr_ordering", "inventory", "reports"]
        ),
        SubscriptionPlan(
            id="omega",
            name="Omega",
            price=129.99,
            max_orders=None,  # Unlimited
            max_staff=None,  # Unlimited
            max_menu_items=None,  # Unlimited
            features=["basic_pos", "qr_ordering", "inventory", "reports", "api_access", "multi_location"]
        )
    ]
    
    for plan in plans:
        test_db.add(plan)
    test_db.commit()
    
    return plans