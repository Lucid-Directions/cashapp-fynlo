"""
Database configuration and models for Fynlo POS
PostgreSQL implementation matching frontend data requirements
"""

from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.elements import quoted_name # For GIN index
import uuid
from typing import Generator

from app.core.config import settings
from app.models.audit_log import AuditLog # Import the AuditLog model

# Database engine
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Database Models matching frontend expectations

class Platform(Base):
    """Multi-tenant platform for restaurant owners"""
    __tablename__ = "platforms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_email = Column(String(255), unique=True, nullable=False)
    subscription_tier = Column(String(50), default="basic")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Restaurant(Base):
    """Individual restaurant configuration"""
    __tablename__ = "restaurants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_id = Column(UUID(as_uuid=True), nullable=True)  # Multi-tenant support
    name = Column(String(255), nullable=False)
    address = Column(JSONB, nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    timezone = Column(String(50), default="UTC")
    business_hours = Column(JSONB, default={})
    settings = Column(JSONB, default={})
    tax_configuration = Column(JSONB, default={
        "vatEnabled": True,
        "vatRate": 20,
        "serviceTaxEnabled": True,
        "serviceTaxRate": 12.5
    })
    payment_methods = Column(JSONB, default={
        "qrCode": {"enabled": True, "feePercentage": 1.2},
        "cash": {"enabled": True, "requiresAuth": False},
        "card": {"enabled": True, "feePercentage": 2.9},
        "applePay": {"enabled": True, "feePercentage": 2.9},
        "giftCard": {"enabled": True, "requiresAuth": True}
    })
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    """Users with role-based access"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=True)  # Optional username field
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)  # platform_owner, restaurant_owner, manager, employee
    restaurant_id = Column(UUID(as_uuid=True), nullable=True)
    platform_id = Column(UUID(as_uuid=True), nullable=True)
    permissions = Column(JSONB, default={})
    pin_code = Column(String(6))  # For employee time clock
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Customer(Base):
    """Customer management with loyalty tracking"""
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    first_name = Column(String(100))
    last_name = Column(String(100))
    loyalty_points = Column(Integer, default=0)
    total_spent = Column(DECIMAL(10, 2), default=0.0)
    visit_count = Column(Integer, default=0)
    preferences = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Category(Base):
    """Menu categories"""
    __tablename__ = "categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(7), default="#00A651")  # Hex color
    icon = Column(String(50))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Product(Base):
    """Menu items/products"""
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    category_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(DECIMAL(10, 2), nullable=False)
    cost = Column(DECIMAL(10, 2), default=0.0)
    image_url = Column(String(500))
    barcode = Column(String(100))
    sku = Column(String(100))
    prep_time = Column(Integer, default=0)  # minutes
    dietary_info = Column(JSONB, default=[])  # ["vegetarian", "gluten-free", etc.]
    modifiers = Column(JSONB, default=[])
    is_active = Column(Boolean, default=True)
    stock_tracking = Column(Boolean, default=False)
    stock_quantity = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Order(Base):
    """Customer orders"""
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    order_number = Column(String(50), nullable=False)
    table_number = Column(String(20))
    order_type = Column(String(20), default="dine_in")  # dine_in, takeaway, delivery
    status = Column(String(20), default="pending")  # pending, confirmed, preparing, ready, completed, cancelled
    items = Column(JSONB, nullable=False)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    tax_amount = Column(DECIMAL(10, 2), default=0.0)
    service_charge = Column(DECIMAL(10, 2), default=0.0)
    discount_amount = Column(DECIMAL(10, 2), default=0.0)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    payment_status = Column(String(20), default="pending")
    special_instructions = Column(Text)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Payment(Base):
    """Payment transactions"""
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), nullable=False)
    payment_method = Column(String(50), nullable=False)  # qr_code, cash, card, apple_pay
    amount = Column(DECIMAL(10, 2), nullable=False)
    fee_amount = Column(DECIMAL(10, 2), default=0.0)
    net_amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, refunded
    external_id = Column(String(255))  # Stripe payment ID, etc.
    payment_metadata = Column(JSONB, default={})
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QRPayment(Base):
    """QR code payment tracking"""
    __tablename__ = "qr_payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), nullable=False)
    qr_code_data = Column(Text, nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(50), default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    fee_amount = Column(DECIMAL(10, 2), default=0.0)
    net_amount = Column(DECIMAL(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Section(Base):
    """Restaurant floor plan sections"""
    __tablename__ = "sections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(7), default="#00A651")  # Hex color
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Table(Base):
    """Restaurant tables"""
    __tablename__ = "tables"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey('sections.id'), nullable=False)
    name = Column(String(100), nullable=False)
    seats = Column(Integer, nullable=False, default=4)
    status = Column(String(20), default="available")  # available, occupied, reserved, cleaning
    server_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to User
    x_position = Column(Integer, default=0)
    y_position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    section = relationship("Section")

class PosSession(Base):
    """POS Session management"""
    __tablename__ = "pos_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    state = Column(String(50), default="opening_control")  # opening_control, opened, closing_control, closed
    config_id = Column(Integer, nullable=False)
    config_name = Column(String(255), nullable=False)
    start_at = Column(DateTime(timezone=True), server_default=func.now())
    stop_at = Column(DateTime(timezone=True), nullable=True)
    session_data = Column(JSONB, default={})  # Additional session configuration
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Database dependency
def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)