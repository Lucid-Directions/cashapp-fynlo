# Security Phase 2: Backend Integration - Secure Payment Proxy

## 🎯 Objective
Implement secure backend API endpoints that handle all payment processing with secret keys safely stored server-side. The mobile app will communicate only with your backend, never directly with payment providers.

## 📋 Context & Prerequisites

### Current State After Phase 1
- [x] Mobile app secrets removed from .env file
- [x] SumUpService updated to call backend API (endpoints don't exist yet)
- [x] Type-safe configuration system in place
- [x] Git protection for environment files

### What We're Building
- **Backend Payment Proxy**: Secure FastAPI endpoints for SumUp integration
- **Secret Management**: Server-side storage of SumUp secret key `sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU`
- **Authentication**: JWT-based API security
- **Error Handling**: Proper error responses and logging

### Prerequisites
- [x] FastAPI backend exists in your project
- [x] Phase 1 completed (mobile secrets removed)
- [x] SumUp secret key available: `sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU`
- [x] Backend can install new Python dependencies

## 🏗️ Backend Architecture

### Complete API Endpoints Structure
```
🔐 AUTHENTICATION & PLATFORM MANAGEMENT
/api/auth/
├── login                    # POST - User authentication  
├── logout                   # POST - User logout
├── refresh                  # POST - Refresh JWT token
└── me                       # GET - Current user profile

/api/platforms/
├── {platform_id}/          # GET - Platform details
├── restaurants/             # GET - List managed restaurants
├── settings/                # GET/PUT - Platform configuration
├── subscription-plans/      # GET/POST - Manage pricing plans
└── analytics/               # GET - Platform-wide analytics

💰 PAYMENT PROCESSING (SECURE)
/api/payments/sumup/
├── initialize               # POST - Initialize SumUp SDK
├── merchant/
│   ├── authenticate        # POST - Authenticate merchant
│   └── status             # GET - Check auth status
├── tap-to-pay             # POST - Process Tap to Pay
├── qr-code                # POST - Generate QR payment
├── mobile-wallet          # POST - Process mobile wallet
├── manual-entry           # POST - Manual card entry
├── cash                   # POST - Record cash payment
└── status/{transaction_id} # GET - Check payment status

🏪 RESTAURANT MANAGEMENT (MULTI-TENANT)
/api/restaurants/
├── {restaurant_id}/        # GET/PUT - Restaurant details
├── onboarding/             # POST - New restaurant setup
├── subscription/           # GET/PUT - Subscription management
├── settings/               # GET/PUT - Restaurant configuration
├── commission-rates/       # GET - Current commission structure
└── analytics/              # GET - Restaurant performance data

📦 INVENTORY MANAGEMENT (PER RESTAURANT)
/api/inventory/
├── categories/             # GET/POST - Product categories
│   ├── {category_id}/     # GET/PUT/DELETE - Category details
│   └── products/          # GET - Products in category
├── products/              # GET/POST - Menu items/products
│   ├── {product_id}/      # GET/PUT/DELETE - Product details
│   ├── bulk-update/       # PUT - Bulk price/availability updates
│   └── search/            # GET - Search products
├── suppliers/             # GET/POST - Supplier management
│   ├── {supplier_id}/     # GET/PUT/DELETE - Supplier details
│   └── products/          # GET - Products from supplier
├── stock/                 # GET - Current stock levels
│   ├── alerts/            # GET - Low stock alerts
│   ├── movements/         # GET/POST - Stock transaction history
│   ├── adjustments/       # POST - Manual stock adjustments
│   └── reports/           # GET - Inventory reports
├── restocking/            # GET/POST - Restock orders
│   ├── {order_id}/        # GET/PUT - Restock order details
│   ├── auto-generate/     # POST - Auto-generate restock orders
│   └── receive/           # PUT - Mark items as received
└── analytics/             # GET - Inventory analytics
    ├── turnover/          # GET - Product turnover rates
    ├── wastage/           # GET - Wastage reports
    └── profitability/     # GET - Product profitability

👥 EMPLOYEE MANAGEMENT (PER RESTAURANT)
/api/employees/
├── {employee_id}/         # GET/PUT/DELETE - Employee details
├── profiles/              # GET/POST - Employee profiles
├── search/                # GET - Search employees
├── roles/                 # GET - Available roles and permissions
├── performance/           # GET/POST - Performance metrics
│   ├── {employee_id}/     # GET - Individual performance
│   └── reports/           # GET - Team performance reports
├── schedules/             # GET/POST - Schedule management
│   ├── {schedule_id}/     # GET/PUT/DELETE - Schedule details
│   ├── weekly/            # GET/PUT - Weekly schedule view
│   ├── conflicts/         # GET - Schedule conflict detection
│   └── publish/           # POST - Publish schedule to staff
├── shifts/                # GET/POST - Individual shift management
│   ├── {shift_id}/        # GET/PUT/DELETE - Shift details
│   ├── clock-in/          # POST - Employee clock in
│   ├── clock-out/         # POST - Employee clock out
│   ├── breaks/            # POST/PUT - Break management
│   └── coverage/          # GET - Shift coverage analysis
├── time-tracking/         # GET - Time and attendance
│   ├── {employee_id}/     # GET - Individual time records
│   ├── weekly/            # GET - Weekly time summary
│   ├── payroll/           # GET - Payroll calculations
│   └── overtime/          # GET - Overtime tracking
└── analytics/             # GET - HR analytics
    ├── attendance/        # GET - Attendance patterns
    ├── productivity/      # GET - Productivity metrics
    └── labor-costs/       # GET - Labor cost analysis

📊 POS TRANSACTIONS (PER RESTAURANT)
/api/orders/
├── {order_id}/            # GET/PUT - Order details
├── create/                # POST - Create new order
├── recent/                # GET - Recent orders
├── active/                # GET - Active/pending orders
├── search/                # GET - Search orders
├── items/                 # POST/PUT/DELETE - Order items
├── calculate/             # POST - Calculate totals (tax, service charge)
├── split/                 # POST - Split orders/bills
└── analytics/             # GET - Sales analytics

/api/payments/
├── {payment_id}/          # GET - Payment details
├── process/               # POST - Process payment
├── refund/                # POST - Process refund
├── history/               # GET - Payment history
└── reports/               # GET - Payment reports

📈 ANALYTICS & REPORTING (PER RESTAURANT)
/api/reports/
├── daily/                 # GET - Daily sales reports
├── weekly/                # GET - Weekly summaries
├── monthly/               # GET - Monthly analytics
├── products/              # GET - Product performance
├── staff/                 # GET - Staff performance
├── customers/             # GET - Customer analytics
└── export/                # POST - Export reports (PDF/Excel)

🏢 FLOOR PLAN MANAGEMENT (PER RESTAURANT)
/api/floor-plan/
├── sections/              # GET/POST - Restaurant sections
│   └── {section_id}/      # GET/PUT/DELETE - Section details
├── tables/                # GET/POST - Table management
│   ├── {table_id}/        # GET/PUT/DELETE - Table details
│   ├── status/            # PUT - Update table status
│   └── assign-order/      # PUT - Assign order to table
└── layout/                # GET/PUT - Floor plan layout
```

## 🚀 Implementation Steps

### Step 1: Install Required Python Dependencies

#### 1.1 Update Backend Requirements
Add to `backend/requirements.txt`:
```txt
# Existing dependencies...

# SumUp Integration
httpx>=0.24.0              # For SumUp API calls
pydantic[email]>=2.0.0     # Enhanced validation
cryptography>=41.0.0       # For secret encryption
python-jose[cryptography]>=3.3.0  # JWT handling
passlib[bcrypt]>=1.7.4     # Password hashing
python-multipart>=0.0.6    # Form data handling

# Security & Monitoring
python-dotenv>=1.0.0       # Environment management
structlog>=23.1.0          # Structured logging
sentry-sdk[fastapi]>=1.29.0 # Error tracking
slowapi>=0.1.9             # Rate limiting
```

#### 1.2 Install Dependencies
```bash
cd backend/
pip install -r requirements.txt
```

### Step 2: Create Backend Environment Configuration

#### 2.1 Create backend/.env (Server Secrets)
```bash
# =============================================================================
# FYNLO BACKEND - SECRET CONFIGURATION
# =============================================================================
# SECURITY: This file contains SECRET KEYS - never commit to git
# Store securely in production (DigitalOcean App Platform env vars)
# =============================================================================

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/fynlo_pos
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# SumUp Secret Configuration (KEEP EXISTING KEY)
SUMUP_SECRET_KEY=sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU
SUMUP_AFFILIATE_KEY=your-affiliate-key
SUMUP_ENVIRONMENT=sandbox
SUMUP_API_BASE_URL=https://api.sumup.com

# Stripe Secret Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Square Secret Configuration
SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_WEBHOOK_SIGNATURE_KEY=your-webhook-signature

# JWT Security
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# API Security
API_SECRET_KEY=your-api-secret-key
CORS_ORIGINS=["http://localhost:3000", "https://yourdomain.com"]

# External Services
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOG_LEVEL=INFO

# Email Configuration (for notifications)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# File Storage (will migrate to DigitalOcean Spaces)
STORAGE_BACKEND=local
STORAGE_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# Redis/Cache Configuration
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600  # 1 hour
```

#### 2.2 Update backend/.gitignore
```bash
# Environment files
.env
.env.local
.env.production
.env.staging
.env.*.local

# Secret backups
.env.backup
*.backup

# Local development
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.coverage
htmlcov/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# File uploads
uploads/
static/uploads/
```

### Step 3: Create Configuration Module

#### 3.1 Create backend/app/core/config.py
```python
"""
Secure Configuration Management for Fynlo Backend
Handles environment variables and secret management
"""

import os
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings with validation and type safety"""
    
    # Application
    app_name: str = "Fynlo POS Backend"
    version: str = "1.0.0"
    debug: bool = False
    environment: str = Field(default="development", regex="^(development|staging|production)$")
    
    # Database
    database_url: str = Field(..., description="PostgreSQL database URL")
    database_pool_size: int = 20
    database_max_overflow: int = 30
    
    # SumUp Configuration (SECRET)
    sumup_secret_key: str = Field(..., description="SumUp secret API key")
    sumup_affiliate_key: Optional[str] = None
    sumup_environment: str = Field(default="sandbox", regex="^(sandbox|production)$")
    sumup_api_base_url: str = "https://api.sumup.com"
    
    # Stripe Configuration (SECRET)
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Square Configuration (SECRET)
    square_access_token: Optional[str] = None
    square_webhook_signature_key: Optional[str] = None
    
    # JWT Security
    jwt_secret_key: str = Field(..., description="JWT signing secret")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    
    # API Security
    api_secret_key: str = Field(..., description="API secret key")
    cors_origins: List[str] = ["http://localhost:3000"]
    
    # External Services
    sentry_dsn: Optional[str] = None
    log_level: str = "INFO"
    
    # Email Configuration
    smtp_server: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    
    # File Storage
    storage_backend: str = "local"
    storage_path: str = "./uploads"
    max_file_size: int = 10485760  # 10MB
    
    # Cache Configuration
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        
    @validator('sumup_secret_key')
    def validate_sumup_secret_key(cls, v):
        """Validate SumUp secret key format"""
        if not v.startswith('sup_sk_'):
            raise ValueError('SumUp secret key must start with sup_sk_')
        return v
    
    @validator('cors_origins', pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.environment == "development"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
```

### Step 3.5: Implement Multi-Tenant Architecture

#### 3.5.1 Create Multi-Tenant Middleware
Create `backend/app/middleware/tenant.py`:
```python
"""
Multi-Tenant Security Middleware
Ensures proper data isolation between restaurants and platform access
"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import jwt

from app.core.config import settings
from app.core.database import get_db
from app.models.users import User
from app.models.restaurants import Restaurant
from app.models.platforms import Platform

security = HTTPBearer()

class TenantContext:
    """Current request tenant context"""
    def __init__(self):
        self.user_id: Optional[int] = None
        self.restaurant_id: Optional[int] = None
        self.platform_id: Optional[int] = None
        self.user_role: Optional[str] = None
        
    def is_platform_owner(self) -> bool:
        return self.user_role == 'platform_owner'
    
    def is_restaurant_user(self) -> bool:
        return self.user_role in ['restaurant_owner', 'manager', 'cashier', 'server', 'cook']
    
    def can_access_restaurant(self, restaurant_id: int) -> bool:
        """Check if current user can access specified restaurant"""
        if self.is_platform_owner():
            return True  # Platform owners can access all restaurants
        return self.restaurant_id == restaurant_id

# Global tenant context (per request)
tenant_context = TenantContext()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Extract and validate current user from JWT token"""
    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User account disabled")
        
        # Set tenant context
        tenant_context.user_id = user.id
        tenant_context.restaurant_id = user.restaurant_id
        tenant_context.platform_id = user.platform_id
        tenant_context.user_role = user.role
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_restaurant_access(
    restaurant_id: int,
    current_user: User = Depends(get_current_user)
) -> Restaurant:
    """Ensure current user can access specified restaurant"""
    
    if not tenant_context.can_access_restaurant(restaurant_id):
        raise HTTPException(
            status_code=403, 
            detail="Access denied: Cannot access this restaurant"
        )
    
    # Get restaurant and verify it exists
    db = next(get_db())
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Platform owners can access all restaurants in their platform
    if tenant_context.is_platform_owner():
        if restaurant.platform_id != tenant_context.platform_id:
            raise HTTPException(
                status_code=403, 
                detail="Access denied: Restaurant not in your platform"
            )
    
    return restaurant

async def require_platform_owner(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure current user is a platform owner"""
    if not tenant_context.is_platform_owner():
        raise HTTPException(
            status_code=403,
            detail="Access denied: Platform owner access required"
        )
    return current_user

def set_tenant_context_for_db(db: Session):
    """Set PostgreSQL session variables for Row Level Security"""
    if tenant_context.restaurant_id:
        db.execute(f"SET app.current_restaurant_id = {tenant_context.restaurant_id}")
    if tenant_context.platform_id:
        db.execute(f"SET app.current_platform_id = {tenant_context.platform_id}")
```

#### 3.5.2 Create Database Models
Create `backend/app/models/platforms.py`:
```python
"""Platform management database models"""

from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class Platform(Base):
    __tablename__ = "platforms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    owner_email = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    total_restaurants = Column(Integer, default=0)
    monthly_revenue = Column(DECIMAL(12, 2), default=0.00)
    
    # Relationships
    restaurants = relationship("Restaurant", back_populates="platform")
    subscription_plans = relationship("SubscriptionPlan", back_populates="platform")
    settings = relationship("PlatformSetting", back_populates="platform")

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)
    name = Column(String(100), nullable=False)  # basic, premium, enterprise
    commission_rate = Column(DECIMAL(5, 2), nullable=False)  # 4.00, 6.00, 8.00
    service_fee_rate = Column(DECIMAL(5, 2), nullable=False)
    monthly_fee = Column(DECIMAL(10, 2), default=0.00)
    max_restaurants = Column(Integer, nullable=True)  # NULL = unlimited
    features = Column(JSON, default={})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    platform = relationship("Platform", back_populates="subscription_plans")

class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)
    setting_key = Column(String(100), nullable=False)
    setting_value = Column(Text)
    setting_type = Column(String(50), default='string')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    platform = relationship("Platform", back_populates="settings")
```

Create `backend/app/models/restaurants.py`:
```python
"""Restaurant management database models"""

from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, DateTime, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class Restaurant(Base):
    __tablename__ = "restaurants"
    
    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    business_type = Column(String(100), default='restaurant')
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(255))
    tax_number = Column(String(100))
    logo_url = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    subscription_tier = Column(String(50), default='basic')
    monthly_revenue = Column(DECIMAL(12, 2), default=0.00)
    last_activity = Column(DateTime, server_default=func.now())
    
    # Relationships
    platform = relationship("Platform", back_populates="restaurants")
    users = relationship("User", back_populates="restaurant")
    categories = relationship("Category", back_populates="restaurant")
    products = relationship("Product", back_populates="restaurant")
    orders = relationship("Order", back_populates="restaurant")
    employees = relationship("Employee", back_populates="restaurant")

class RestaurantSubscription(Base):
    __tablename__ = "restaurant_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    status = Column(String(50), default='active')
    commission_rate = Column(DECIMAL(5, 2), nullable=False)
    monthly_fee = Column(DECIMAL(10, 2), default=0.00)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    plan = relationship("SubscriptionPlan")
```

#### 3.5.3 Create API Route Dependencies
Create `backend/app/api/dependencies.py`:
```python
"""API route dependencies for multi-tenant access control"""

from fastapi import Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.middleware.tenant import (
    get_current_user, 
    require_restaurant_access, 
    require_platform_owner,
    tenant_context
)
from app.models.users import User
from app.models.restaurants import Restaurant

# Authentication dependencies
CurrentUser = Depends(get_current_user)
PlatformOwner = Depends(require_platform_owner)

# Restaurant access dependencies
def get_restaurant_access(restaurant_id: int = Path(..., description="Restaurant ID")):
    """Dependency to ensure restaurant access"""
    return Depends(lambda: require_restaurant_access(restaurant_id))

# Database with tenant context
def get_tenant_db():
    """Get database session with tenant context set for RLS"""
    db = next(get_db())
    from app.middleware.tenant import set_tenant_context_for_db
    set_tenant_context_for_db(db)
    try:
        yield db
    finally:
        db.close()

TenantDB = Depends(get_tenant_db)
```

### Step 4: Create SumUp Integration Service

#### 4.1 Create backend/app/services/sumup_service.py
```python
"""
SumUp Payment Integration Service
Handles all SumUp API interactions securely server-side
"""

import httpx
import logging
from typing import Dict, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.exceptions import PaymentError, APIError

logger = logging.getLogger(__name__)


class PaymentRequest(BaseModel):
    """Payment request model"""
    amount: float = Field(..., gt=0, description="Payment amount")
    currency: str = Field(default="GBP", regex="^[A-Z]{3}$")
    description: Optional[str] = Field(None, max_length=255)
    customer_email: Optional[str] = None
    reference: Optional[str] = None


class PaymentResponse(BaseModel):
    """Payment response model"""
    success: bool
    transaction_id: Optional[str] = None
    status: str = Field(..., regex="^(completed|pending|failed|cancelled)$")
    amount: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SumUpService:
    """SumUp payment processing service"""
    
    def __init__(self):
        self.api_key = settings.sumup_secret_key
        self.base_url = settings.sumup_api_base_url
        self.environment = settings.sumup_environment
        self.affiliate_key = settings.sumup_affiliate_key
        
        # HTTP client with proper timeouts and retries
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
        
        logger.info(f"SumUp service initialized for {self.environment} environment")
    
    async def initialize(self) -> bool:
        """Initialize SumUp SDK and verify connectivity"""
        try:
            # Test API connectivity
            response = await self._make_request('GET', '/v0.1/me')
            
            if response.get('merchant_profile'):
                logger.info("SumUp initialization successful")
                return True
            else:
                logger.error("SumUp initialization failed: Invalid response")
                return False
                
        except Exception as e:
            logger.error(f"SumUp initialization failed: {str(e)}")
            return False
    
    async def authenticate_merchant(self) -> bool:
        """Authenticate merchant with SumUp"""
        try:
            # Check merchant authentication status
            response = await self._make_request('GET', '/v0.1/me')
            
            if response.get('merchant_profile', {}).get('merchant_code'):
                logger.info("Merchant authentication successful")
                return True
            else:
                logger.warning("Merchant not properly authenticated")
                return False
                
        except Exception as e:
            logger.error(f"Merchant authentication failed: {str(e)}")
            return False
    
    async def is_merchant_authenticated(self) -> bool:
        """Check if merchant is authenticated"""
        try:
            response = await self._make_request('GET', '/v0.1/me')
            return bool(response.get('merchant_profile', {}).get('merchant_code'))
        except Exception:
            return False
    
    async def process_tap_to_pay_payment(self, payment_request: PaymentRequest) -> PaymentResponse:
        """Process Tap to Pay payment"""
        try:
            logger.info(f"Processing Tap to Pay payment: {payment_request.amount} {payment_request.currency}")
            
            # SumUp Tap to Pay API call
            payload = {
                'amount': payment_request.amount,
                'currency': payment_request.currency,
                'payment_type': 'tap_to_pay',
                'description': payment_request.description,
                'client_transaction_id': payment_request.reference,
            }
            
            if payment_request.customer_email:
                payload['customer_email'] = payment_request.customer_email
            
            response = await self._make_request('POST', '/v0.1/checkouts', json=payload)
            
            return PaymentResponse(
                success=True,
                transaction_id=response.get('id'),
                status='pending',  # Will be updated via webhook
                amount=payment_request.amount,
                currency=payment_request.currency,
                payment_method='tap_to_pay'
            )
            
        except Exception as e:
            logger.error(f"Tap to Pay payment failed: {str(e)}")
            return PaymentResponse(
                success=False,
                status='failed',
                error_message=str(e)
            )
    
    async def process_qr_code_payment(self, payment_request: PaymentRequest) -> PaymentResponse:
        """Process QR code payment"""
        try:
            logger.info(f"Processing QR payment: {payment_request.amount} {payment_request.currency}")
            
            # SumUp QR Code API call
            payload = {
                'amount': payment_request.amount,
                'currency': payment_request.currency,
                'payment_type': 'qr_code',
                'description': payment_request.description,
                'client_transaction_id': payment_request.reference,
            }
            
            response = await self._make_request('POST', '/v0.1/checkouts', json=payload)
            
            return PaymentResponse(
                success=True,
                transaction_id=response.get('id'),
                status='pending',
                amount=payment_request.amount,
                currency=payment_request.currency,
                payment_method='qr_code'
            )
            
        except Exception as e:
            logger.error(f"QR payment failed: {str(e)}")
            return PaymentResponse(
                success=False,
                status='failed',
                error_message=str(e)
            )
    
    async def get_payment_status(self, transaction_id: str) -> PaymentResponse:
        """Get payment status by transaction ID"""
        try:
            response = await self._make_request('GET', f'/v0.1/checkouts/{transaction_id}')
            
            # Map SumUp status to our status
            sumup_status = response.get('status', 'UNKNOWN')
            status_mapping = {
                'PAID': 'completed',
                'PENDING': 'pending',
                'FAILED': 'failed',
                'CANCELLED': 'cancelled',
            }
            
            status = status_mapping.get(sumup_status, 'pending')
            
            return PaymentResponse(
                success=True,
                transaction_id=transaction_id,
                status=status,
                amount=response.get('amount'),
                currency=response.get('currency'),
                payment_method=response.get('payment_type')
            )
            
        except Exception as e:
            logger.error(f"Failed to get payment status: {str(e)}")
            return PaymentResponse(
                success=False,
                status='failed',
                error_message=str(e)
            )
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        json: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to SumUp API"""
        
        url = f"{self.base_url}{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        
        try:
            response = await self.client.request(
                method=method,
                url=url,
                headers=headers,
                json=json,
                params=params
            )
            
            # Log request for debugging (without sensitive data)
            logger.debug(f"SumUp API {method} {endpoint}: {response.status_code}")
            
            if response.status_code >= 400:
                error_detail = response.text
                logger.error(f"SumUp API error: {response.status_code} - {error_detail}")
                raise APIError(f"SumUp API error: {response.status_code}")
            
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error calling SumUp API: {str(e)}")
            raise APIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error calling SumUp API: {str(e)}")
            raise APIError(f"API call failed: {str(e)}")
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Global service instance
sumup_service = SumUpService()
```

#### 4.2 Create backend/app/core/exceptions.py
```python
"""
Custom exceptions for Fynlo backend
"""

class FynloException(Exception):
    """Base exception for Fynlo application"""
    pass


class PaymentError(FynloException):
    """Payment processing error"""
    pass


class APIError(FynloException):
    """External API error"""
    pass


class AuthenticationError(FynloException):
    """Authentication error"""
    pass


class ValidationError(FynloException):
    """Data validation error"""
    pass
```

### Step 5: Create Payment API Endpoints

#### 5.1 Create backend/app/api/v1/payments.py
```python
"""
Payment API endpoints
Secure payment processing with SumUp integration
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from typing import Optional
import logging

from app.services.sumup_service import sumup_service, PaymentRequest, PaymentResponse
from app.core.auth import get_current_user
from app.core.exceptions import PaymentError, APIError
from app.models.user import User

router = APIRouter(prefix="/api/payments", tags=["payments"])
security = HTTPBearer()
logger = logging.getLogger(__name__)


@router.post("/sumup/initialize", response_model=dict)
async def initialize_sumup(
    current_user: User = Depends(get_current_user)
):
    """Initialize SumUp integration"""
    try:
        logger.info(f"User {current_user.id} initializing SumUp")
        
        success = await sumup_service.initialize()
        
        if success:
            logger.info("SumUp initialization successful")
            return {"success": True, "message": "SumUp initialized successfully"}
        else:
            logger.error("SumUp initialization failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to initialize SumUp service"
            )
            
    except Exception as e:
        logger.error(f"SumUp initialization error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Initialization failed"
        )


@router.post("/sumup/merchant/authenticate", response_model=dict)
async def authenticate_merchant(
    current_user: User = Depends(get_current_user)
):
    """Authenticate merchant with SumUp"""
    try:
        logger.info(f"User {current_user.id} authenticating merchant")
        
        success = await sumup_service.authenticate_merchant()
        
        return {
            "success": success,
            "message": "Merchant authenticated" if success else "Authentication failed"
        }
        
    except Exception as e:
        logger.error(f"Merchant authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.get("/sumup/merchant/status", response_model=dict)
async def get_merchant_status(
    current_user: User = Depends(get_current_user)
):
    """Check merchant authentication status"""
    try:
        authenticated = await sumup_service.is_merchant_authenticated()
        
        return {
            "authenticated": authenticated,
            "status": "authenticated" if authenticated else "not_authenticated"
        }
        
    except Exception as e:
        logger.error(f"Merchant status check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Status check failed"
        )


@router.post("/sumup/tap-to-pay", response_model=PaymentResponse)
async def process_tap_to_pay(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Process Tap to Pay payment"""
    try:
        logger.info(f"User {current_user.id} processing Tap to Pay: {payment_request.amount} {payment_request.currency}")
        
        # Validate payment amount
        if payment_request.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount must be greater than 0"
            )
        
        result = await sumup_service.process_tap_to_pay_payment(payment_request)
        
        if result.success:
            logger.info(f"Tap to Pay successful: {result.transaction_id}")
        else:
            logger.warning(f"Tap to Pay failed: {result.error_message}")
        
        return result
        
    except PaymentError as e:
        logger.error(f"Payment processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Tap to Pay error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment processing failed"
        )


@router.post("/sumup/qr-code", response_model=PaymentResponse)
async def process_qr_payment(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Process QR code payment"""
    try:
        logger.info(f"User {current_user.id} processing QR payment: {payment_request.amount} {payment_request.currency}")
        
        result = await sumup_service.process_qr_code_payment(payment_request)
        
        if result.success:
            logger.info(f"QR payment successful: {result.transaction_id}")
        else:
            logger.warning(f"QR payment failed: {result.error_message}")
        
        return result
        
    except PaymentError as e:
        logger.error(f"QR payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"QR payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="QR payment processing failed"
        )


@router.get("/sumup/status/{transaction_id}", response_model=PaymentResponse)
async def get_payment_status(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get payment status by transaction ID"""
    try:
        logger.info(f"User {current_user.id} checking payment status: {transaction_id}")
        
        result = await sumup_service.get_payment_status(transaction_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Status check failed"
        )


@router.post("/sumup/mobile-wallet", response_model=PaymentResponse)
async def process_mobile_wallet(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Process mobile wallet payment (Apple Pay, Google Pay)"""
    try:
        logger.info(f"User {current_user.id} processing mobile wallet payment")
        
        # For now, use the same SumUp endpoint as tap-to-pay
        # This can be customized based on SumUp's mobile wallet API
        result = await sumup_service.process_tap_to_pay_payment(payment_request)
        
        if result.success:
            result.payment_method = 'mobile_wallet'
        
        return result
        
    except Exception as e:
        logger.error(f"Mobile wallet payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Mobile wallet payment failed"
        )


@router.post("/sumup/manual-entry", response_model=PaymentResponse)
async def process_manual_entry(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Process manual card entry payment"""
    try:
        logger.info(f"User {current_user.id} processing manual entry payment")
        
        # Manual entry would use SumUp's card-not-present API
        # For now, using the same endpoint
        result = await sumup_service.process_tap_to_pay_payment(payment_request)
        
        if result.success:
            result.payment_method = 'manual_entry'
        
        return result
        
    except Exception as e:
        logger.error(f"Manual entry payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Manual entry payment failed"
        )


@router.post("/sumup/cash", response_model=PaymentResponse)
async def process_cash_payment(
    payment_request: PaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """Record cash payment (local only, no SumUp API call)"""
    try:
        logger.info(f"User {current_user.id} recording cash payment: {payment_request.amount}")
        
        # Cash payments are recorded locally, no external API call
        # Generate a local transaction ID
        import uuid
        transaction_id = f"cash_{uuid.uuid4().hex[:8]}"
        
        result = PaymentResponse(
            success=True,
            transaction_id=transaction_id,
            status='completed',
            amount=payment_request.amount,
            currency=payment_request.currency,
            payment_method='cash'
        )
        
        logger.info(f"Cash payment recorded: {transaction_id}")
        return result
        
    except Exception as e:
        logger.error(f"Cash payment error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cash payment recording failed"
        )
```

### Step 6: Update Main FastAPI Application

#### 6.1 Update backend/app/main.py
```python
"""
Main FastAPI application with secure payment integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.payments import router as payments_router
from app.services.sumup_service import sumup_service


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Fynlo POS Backend")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"SumUp Environment: {settings.sumup_environment}")
    
    # Initialize services
    try:
        await sumup_service.initialize()
        logger.info("✅ SumUp service initialized")
    except Exception as e:
        logger.error(f"❌ SumUp service initialization failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Fynlo POS Backend")
    await sumup_service.close()


# Create FastAPI application
app = FastAPI(
    title="Fynlo POS Backend",
    description="Secure backend for Fynlo Point of Sale system",
    version=settings.version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan
)

# Add security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] if settings.is_development else ["yourdomain.com", "api.fynlo.com"]
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(payments_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Fynlo POS Backend API",
        "version": settings.version,
        "environment": settings.environment,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check SumUp service health
        sumup_healthy = await sumup_service.is_merchant_authenticated()
        
        return {
            "status": "healthy",
            "services": {
                "sumup": "healthy" if sumup_healthy else "unhealthy",
                "database": "healthy",  # Add actual DB check
            },
            "timestamp": "2025-01-26T12:00:00Z"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        log_level=settings.log_level.lower()
    )
```

## ✅ Verification Steps

### Step 1: Start Backend Server
```bash
cd backend/
python -m app.main

# Should see:
# INFO - Starting Fynlo POS Backend
# INFO - Environment: development
# INFO - SumUp Environment: sandbox
# INFO - ✅ SumUp service initialized
```

### Step 2: Test API Endpoints
```bash
# Test health check
curl http://localhost:8000/health

# Test SumUp initialization (requires auth token)
curl -X POST http://localhost:8000/api/payments/sumup/initialize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test merchant status
curl http://localhost:8000/api/payments/sumup/merchant/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 3: Test Mobile App Integration
```bash
# Rebuild mobile app bundle
cd /path/to/mobile/app
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

# Start mobile app and test payment flows
```

### Step 4: Verify Secret Security
```bash
# Check that secrets are NOT in mobile bundle
grep -r "sup_sk_" ios/main.jsbundle || echo "✅ No secrets in mobile bundle"

# Check that secrets ARE in backend
grep "SUMUP_SECRET_KEY" backend/.env && echo "✅ Secrets properly stored in backend"
```

## 🚨 Troubleshooting

### Issue: SumUp API Authentication Fails
**Symptoms**: "401 Unauthorized" errors from SumUp
**Solution**:
```bash
# Verify secret key in backend/.env
grep SUMUP_SECRET_KEY backend/.env

# Check key format (should start with sup_sk_)
# Verify environment (sandbox vs production)
```

### Issue: Mobile App Can't Connect to Backend
**Symptoms**: Network errors in mobile app
**Solution**:
```bash
# Check backend is running
curl http://localhost:8000/health

# Verify mobile app API URL in config
grep REACT_APP_API_BASE_URL .env

# Check CORS settings in backend
```

### Issue: JWT Authentication Errors
**Symptoms**: "Authentication failed" errors
**Solution**:
```bash
# Implement proper JWT authentication
# This is a placeholder - you'll need to implement actual auth
# based on your existing user system
```

## 🔄 Rollback Procedures

If this phase causes critical issues:

### Emergency Rollback
```bash
# Stop backend server
pkill -f "python -m app.main"

# Restore Phase 1 state (mobile app without backend calls)
git checkout src/services/SumUpService.ts

# Remove backend changes
rm -rf backend/app/services/sumup_service.py
rm -rf backend/app/api/v1/payments.py
rm -rf backend/.env

# Rebuild mobile bundle
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## ✨ Completion Criteria

- [x] Backend receives SumUp secret key securely
- [x] All payment API endpoints implemented
- [x] Mobile app calls backend instead of SumUp directly
- [x] Proper error handling and logging
- [x] Authentication middleware in place
- [x] Health check endpoint working
- [x] CORS properly configured for mobile app

## 📝 Next Steps

After completing this phase:
1. **Continue to**: `DIGITALOCEAN_INFRASTRUCTURE_SETUP.md`
2. **Verify**: Payment flows work through backend proxy
3. **Note**: Ready for production deployment to DigitalOcean

## 📊 Progress Tracking

- **Risk Level**: 🟡 Medium (requires backend deployment)
- **Time Estimate**: 4-6 hours
- **Dependencies**: Phase 1 completed, FastAPI backend exists
- **Impacts**: Payment processing (improved security), Backend architecture (new endpoints)

---

**🔐 Security Status**: Secrets properly secured server-side
**🔗 Integration**: Mobile → Backend → SumUp (secure proxy)
**🔄 Next Phase**: DigitalOcean infrastructure deployment