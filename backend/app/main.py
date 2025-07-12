"""
Fynlo POS Backend API
Clean FastAPI implementation for hardware-free restaurant management
Version: 2.1.0 - Portal alignment with optional PDF exports
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, get_db, User
from app.api.v1.api import api_router
from app.api.mobile.endpoints import router as mobile_router
from app.core.redis_client import init_redis, close_redis
from app.core.websocket import websocket_manager
from app.core.exceptions import register_exception_handlers
from app.middleware.rate_limit_middleware import init_fastapi_limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.responses import APIResponseHelper
from app.core.mobile_middleware import (
    MobileCompatibilityMiddleware,
    MobileDataOptimizationMiddleware
)
from app.middleware.version_middleware import APIVersionMiddleware
from app.middleware.security_headers_middleware import SecurityHeadersMiddleware # Added import
from app.core.auth import get_current_user
from datetime import datetime

# Configure logging
# Logging level will be set by Uvicorn based on settings.LOG_LEVEL
# logging.basicConfig(level=settings.LOG_LEVEL.upper()) # Not needed if uvicorn handles it
logger = logging.getLogger(__name__)

# Apply logging filters for production
# This should be done after basic logging config but before the app starts handling requests.
# Note: Uvicorn sets up its own handlers. This filter will apply to log records
# processed by the application's loggers. For Uvicorn's access logs,
# different configuration might be needed if they also contain sensitive data.
from app.core.logging_filters import setup_logging_filters
if settings.ENVIRONMENT == "production" or not settings.ERROR_DETAIL_ENABLED:
    # We call this early, but it depends on `settings` being initialized.
    # Logging needs to be configured before this call if it relies on basicConfig.
    # If Uvicorn manages basicConfig, this should be fine.
    setup_logging_filters()


security = HTTPBearer()

# TEMPORARY: Remove lifespan function for deployment
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Initialize application on startup - DISABLED FOR DEPLOYMENT"""
#     logger.info(f"🚀 Fynlo POS Backend starting in {settings.ENVIRONMENT} mode...")
#     yield
#     logger.info("✅ Cleanup complete")

app = FastAPI(
    title=settings.APP_NAME,
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    # lifespan=lifespan,  # DISABLED FOR DEPLOYMENT
    debug=settings.DEBUG  # Set FastAPI debug mode from settings
)

# CORS middleware for React Native frontend and Supabase
if settings.ENVIRONMENT == "production":
    allowed_origins = settings.PRODUCTION_ALLOWED_ORIGINS
else:
    # Use CORS_ORIGINS from settings for development, fallback to permissive
    allowed_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]

# Add Supabase domains to allowed origins
supabase_origins = [
    "https://*.supabase.co",
    "https://*.supabase.io"
]

# Add specific Supabase URL if configured
if settings.SUPABASE_URL:
    supabase_origins.append(settings.SUPABASE_URL)

# Combine all allowed origins
if isinstance(allowed_origins, list):
    allowed_origins = allowed_origins + supabase_origins
else:
    allowed_origins = [allowed_origins] + supabase_origins

# Ensure unique origins
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"], # Can be restricted further if needed e.g. ["GET", "POST", "PUT", "DELETE"]
    allow_headers=["*"], # Can be restricted further e.g. ["Content-Type", "Authorization"]
)

# TEMPORARY: Disable complex middleware for deployment
# Add API version middleware for backward compatibility (FIRST in middleware stack)
# app.add_middleware(APIVersionMiddleware)

# Add Security Headers Middleware (after CORS and Versioning, before others)
# app.add_middleware(SecurityHeadersMiddleware)

# Add mobile compatibility middleware
# app.add_middleware(MobileCompatibilityMiddleware, enable_cors=True, enable_port_redirect=True)
# app.add_middleware(MobileDataOptimizationMiddleware)

# Add SlowAPI middleware (for rate limiting) - TEMPORARILY DISABLED
# app.add_middleware(SlowAPIMiddleware)

# Register standardized exception handlers
# register_exception_handlers(app) # General handlers

# Add specific handler for rate limit exceeded
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Include mobile-optimized routes (both prefixed and Odoo-style)
app.include_router(mobile_router, prefix="/api/mobile", tags=["mobile"])
app.include_router(mobile_router, prefix="", tags=["mobile-compatibility"])  # For Odoo-style endpoints

# WebSocket routes are handled through the websocket router in api.py

@app.get("/")
async def root():
    """Health check endpoint with standardized response"""
    return APIResponseHelper.success(
        data={
            "service": "Fynlo POS Backend API",
            "version": "1.0.0",
            "status": "healthy",
            "api_version": "v1",
            "backward_compatible": True
        },
        message="Fynlo POS API is running"
    )

@app.get("/health")
async def health_check():
    """Ultra-fast health check for DigitalOcean deployment - NO EXTERNAL CHECKS"""
    
    # CRITICAL FIX: Return immediately without any DB/Redis checks to avoid Error 524 timeouts
    # This endpoint is called every 10 seconds by DigitalOcean - it MUST be instant
    return {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/version")
async def api_version_info():
    """API version information endpoint"""
    return APIResponseHelper.success(
        data={
            "current_version": "v1",
            "supported_versions": ["v1"],
            "backward_compatible": True,
            "version_middleware_enabled": True,
            "websocket_path_normalization": True,
            "documentation": {
                "versioned_endpoints": "/api/v1/{resource}",
                "unversioned_fallback": "/api/{resource} → /api/v1/{resource}",
                "websocket_paths": {
                    "/ws/{id}": "/api/v1/websocket/ws/{id}",
                    "/websocket/{id}": "/api/v1/websocket/ws/{id}"
                }
            }
        },
        message="API version information"
    )

# TEMPORARY: Add essential endpoints for iOS app
@app.post("/api/v1/auth/login")
async def login(request: dict):
    """Authentication endpoint with mock data"""
    email = request.get("email", "").lower()
    password = request.get("password", "")
    
    # SIMPLIFIED: One working restaurant owner credential
    mock_credentials = {
        "restaurant@fynlopos.com": "restaurant123"
    }
    
    if email in mock_credentials and mock_credentials[email] == password:
        # Return successful authentication
        return APIResponseHelper.success(
            data={
                "access_token": "mock_token_12345",
                "token_type": "bearer",
                "user": {
                    "id": "user_123",
                    "email": email,
                    "role": "platform_owner" if "platform" in email else "restaurant_owner",
                    "firstName": "Test",
                    "lastName": "User"
                }
            },
            message="Authentication successful"
        )
    else:
        return APIResponseHelper.error(
            message="Invalid credentials",
            status_code=401
        )

@app.get("/api/v1/menu/items")
async def get_menu_items():
    """Get menu items - Returns Chucho restaurant menu"""
    # Chucho menu data embedded to avoid import issues with emojis
    CHUCHO_MENU_ITEMS = [
        # SNACKS
        {"name": "Nachos", "price": 5.00, "category": "Snacks", "description": "Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander", "available": True, "emoji": "🌮"},
        {"name": "Quesadillas", "price": 5.50, "category": "Snacks", "description": "Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander", "available": True, "emoji": "🧀"},
        {"name": "Chorizo Quesadilla", "price": 5.50, "category": "Snacks", "description": "Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander", "available": True, "emoji": "🌶️"},
        {"name": "Chicken Quesadilla", "price": 5.50, "category": "Snacks", "description": "Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander", "available": True, "emoji": "🍗"},
        {"name": "Tostada", "price": 6.50, "category": "Snacks", "description": "Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta", "available": True, "emoji": "🌮"},
        # TACOS
        {"name": "Carnitas", "price": 3.50, "category": "Tacos", "description": "Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander", "available": True, "emoji": "🐖"},
        {"name": "Cochinita", "price": 3.50, "category": "Tacos", "description": "Marinated pulled pork served with pickle red onion", "available": True, "emoji": "🍖"},
        {"name": "Barbacoa de Res", "price": 3.50, "category": "Tacos", "description": "Juicy pulled beef topped with onion, guacamole & coriander", "available": True, "emoji": "🥩"},
        {"name": "Chorizo", "price": 3.50, "category": "Tacos", "description": "Grilled chorizo with black beans, onions, salsa, coriander & guacamole", "available": True, "emoji": "🌭"},
        {"name": "Rellena", "price": 3.50, "category": "Tacos", "description": "Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion", "available": True, "emoji": "🍖"},
        {"name": "Chicken Fajita", "price": 3.50, "category": "Tacos", "description": "Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander", "available": True, "emoji": "🐔"},
        {"name": "Haggis", "price": 3.50, "category": "Tacos", "description": "Haggis with beans, onion & chilli. Topped with coriander and pickled red onion", "available": True, "emoji": "🏴󐁧󐁢󐁳󐁣󐁴󐁿"},
        {"name": "Pescado", "price": 3.50, "category": "Tacos", "description": "Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa", "available": True, "emoji": "🐟"},
        {"name": "Dorados", "price": 3.50, "category": "Tacos", "description": "Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta", "available": True, "emoji": "🌮"},
        {"name": "Dorados Papa", "price": 3.50, "category": "Tacos", "description": "Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta", "available": True, "emoji": "🥔"},
        {"name": "Nopal", "price": 3.50, "category": "Tacos", "description": "Cactus, black beans & onion, topped with tomato salsa and crumbled feta", "available": True, "emoji": "🌵"},
        {"name": "Frijol", "price": 3.50, "category": "Tacos", "description": "Black beans with fried plantain served with tomato salsa, feta & coriander", "available": True, "emoji": "🫘"},
        {"name": "Verde", "price": 3.50, "category": "Tacos", "description": "Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta", "available": True, "emoji": "🥒"},
        {"name": "Fajita", "price": 3.50, "category": "Tacos", "description": "Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander", "available": True, "emoji": "🍄"},
        # SPECIAL TACOS
        {"name": "Carne Asada", "price": 4.50, "category": "Special Tacos", "description": "Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander", "available": True, "emoji": "🥩"},
        {"name": "Camaron", "price": 4.50, "category": "Special Tacos", "description": "Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole", "available": True, "emoji": "🦐"},
        {"name": "Pulpos", "price": 4.50, "category": "Special Tacos", "description": "Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander", "available": True, "emoji": "🐙"},
        # BURRITOS
        {"name": "Regular Burrito", "price": 8.00, "category": "Burritos", "description": "Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander", "available": True, "emoji": "🌯"},
        {"name": "Special Burrito", "price": 10.00, "category": "Burritos", "description": "Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander", "available": True, "emoji": "🌯"},
        {"name": "Add Mozzarella", "price": 1.00, "category": "Burritos", "description": "Add extra cheese to any burrito", "available": True, "emoji": "🧀"},
        # SIDES
        {"name": "Skinny Fries", "price": 3.50, "category": "Sides", "description": "Thin cut fries", "available": True, "emoji": "🍟"},
        {"name": "Pico de gallo", "price": 0.00, "category": "Sides", "description": "Diced tomato, onion and chilli - FREE", "available": True, "emoji": "🍅"},
        {"name": "Green Chili", "price": 0.00, "category": "Sides", "description": "Homemade green chili salsa - HOT! - FREE", "available": True, "emoji": "🌶️"},
        {"name": "Pineapple Habanero", "price": 0.00, "category": "Sides", "description": "Pineapple sauce with habanero chili - HOT! - FREE", "available": True, "emoji": "🍍"},
        {"name": "Scotch Bonnet", "price": 0.00, "category": "Sides", "description": "Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE", "available": True, "emoji": "🔥"},
        # DRINKS
        {"name": "Pink Paloma", "price": 3.75, "category": "Drinks", "description": "An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine", "available": True, "emoji": "🍹"},
        {"name": "Coco-Nought", "price": 3.75, "category": "Drinks", "description": "Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!", "available": True, "emoji": "🥥"},
        {"name": "Corona", "price": 3.80, "category": "Drinks", "description": "Mexican beer", "available": True, "emoji": "🍺"},
        {"name": "Modelo", "price": 4.00, "category": "Drinks", "description": "Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml", "available": True, "emoji": "🍺"},
        {"name": "Pacifico", "price": 4.00, "category": "Drinks", "description": "Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml", "available": True, "emoji": "🍺"},
        {"name": "Dos Equis", "price": 4.00, "category": "Drinks", "description": "Two X's. German brewing heritage with the spirit of Mexican traditions. 355ml", "available": True, "emoji": "🍺"}
    ]
    
    # Transform to match frontend format
    menu_items = []
    for idx, item in enumerate(CHUCHO_MENU_ITEMS):
        menu_items.append({
            "id": idx + 1,
            "name": item["name"],
            "price": item["price"],
            "category": item["category"],
            "description": item["description"],
            "icon": "restaurant",  # Default icon
            "emoji": item.get("emoji", "🍴"),  # Include emoji
            "available": item["available"]
        })
    
    return APIResponseHelper.success(
        data=menu_items,
        message="Menu items retrieved"
    )

@app.get("/api/v1/menu/categories")
async def get_menu_categories():
    """Get menu categories - Returns Chucho restaurant categories"""
    # Chucho categories embedded to avoid import issues
    CHUCHO_CATEGORIES = [
        {"name": "Snacks", "color": "#FF6B6B", "icon": "restaurant", "sort_order": 1},
        {"name": "Tacos", "color": "#4ECDC4", "icon": "restaurant", "sort_order": 2},
        {"name": "Special Tacos", "color": "#45B7D1", "icon": "star", "sort_order": 3},
        {"name": "Burritos", "color": "#96CEB4", "icon": "restaurant-menu", "sort_order": 4},
        {"name": "Sides", "color": "#FECA57", "icon": "restaurant", "sort_order": 5},
        {"name": "Drinks", "color": "#FF9FF3", "icon": "local-drink", "sort_order": 6}
    ]
    
    # Transform to match frontend format
    categories = []
    for cat in CHUCHO_CATEGORIES:
        categories.append({
            "id": cat["sort_order"],
            "name": cat["name"],
            "description": f"{cat['name']} items",
            "icon": cat["icon"],
            "color": cat["color"],
            "active": True
        })
    
    return APIResponseHelper.success(
        data=categories,
        message="Menu categories retrieved"
    )

def format_employee_response(employee):
    """Format employee with all required fields"""
    from datetime import datetime
    
    return {
        "id": employee.id,
        "name": f"{getattr(employee, 'first_name', '')} {getattr(employee, 'last_name', '')}".strip() or employee.email,
        "email": employee.email,
        "role": employee.role,
        "hourlyRate": float(getattr(employee, 'hourly_rate', 0) or 0),
        "totalSales": float(getattr(employee, 'total_sales', 0) or 0),
        "performanceScore": float(getattr(employee, 'performance_score', 0) or 0),
        "isActive": getattr(employee, 'is_active', True),
        "hireDate": employee.hire_date.isoformat() if hasattr(employee, 'hire_date') and employee.hire_date else datetime.now().isoformat(),
        "startDate": employee.start_date.isoformat() if hasattr(employee, 'start_date') and employee.start_date else datetime.now().isoformat(),
        "phone": getattr(employee, 'phone', '') or '',
        "totalOrders": int(getattr(employee, 'total_orders', 0) or 0),
        "avgOrderValue": float(getattr(employee, 'avg_order_value', 0) or 0),
        "hoursWorked": float(getattr(employee, 'hours_worked', 0) or 0)
    }

@app.get("/api/v1/employees")
async def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employees"""
    from datetime import datetime, timedelta
    
    # Try to get real employees from database
    try:
        employees = db.query(User).filter(
            User.restaurant_id == current_user.restaurant_id,
            User.is_active == True
        ).all()
        
        if employees:
            return APIResponseHelper.success(
                data=[format_employee_response(emp) for emp in employees],
                message=f"Retrieved {len(employees)} employees"
            )
    except Exception as e:
        print(f"Error fetching employees: {str(e)}")
    
    # Fallback to mock data if no real data
    base_date = datetime.now() - timedelta(days=365)
    
    return APIResponseHelper.success(
        data=[
            {
                "id": 1,
                "name": "John Manager",
                "email": "john@restaurant.com",
                "role": "manager",
                "hourlyRate": 25.00,
                "totalSales": 15420.50,
                "performanceScore": 9.2,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=730)).isoformat(),  # 2 years ago
                "startDate": (base_date - timedelta(days=730)).isoformat(),
                "phone": "+44 7700 900100",
                "totalOrders": 342,
                "avgOrderValue": 45.03,
                "hoursWorked": 1680
            },
            {
                "id": 2,
                "name": "Sarah Cashier", 
                "email": "sarah@restaurant.com",
                "role": "cashier",
                "hourlyRate": 15.50,
                "totalSales": 8750.25,
                "performanceScore": 8.8,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=365)).isoformat(),  # 1 year ago
                "startDate": (base_date - timedelta(days=365)).isoformat(),
                "phone": "+44 7700 900101",
                "totalOrders": 256,
                "avgOrderValue": 34.18,
                "hoursWorked": 1120
            },
            {
                "id": 3,
                "name": "Mike Server",
                "email": "mike@restaurant.com",
                "role": "server",
                "hourlyRate": 12.50,
                "totalSales": 6230.15,
                "performanceScore": 8.5,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=180)).isoformat(),  # 6 months ago
                "startDate": (base_date - timedelta(days=180)).isoformat(),
                "phone": "+44 7700 900102",
                "totalOrders": 198,
                "avgOrderValue": 31.47,
                "hoursWorked": 560
            }
        ],
        message="Employees retrieved"
    )

@app.get("/api/v1/platform/settings/service-charge")
async def get_service_charge():
    """Get platform service charge settings"""
    return APIResponseHelper.success(
        data={
            "enabled": True,
            "rate": 0.125,  # 12.5%
            "description": "Platform service charge",
            "lastUpdated": "2025-01-08T16:30:00Z"
        },
        message="Service charge settings retrieved"
    )

@app.get("/api/v1/orders")
async def get_orders():
    """Get recent orders"""
    from datetime import datetime, timedelta
    import random
    
    # Generate mock orders
    orders = []
    statuses = ["completed", "in_progress", "pending"]
    
    for i in range(20):
        order_time = datetime.now() - timedelta(minutes=random.randint(0, 1440))
        orders.append({
            "id": f"ORD{1000 + i}",
            "orderNumber": 1000 + i,
            "customerName": f"Customer {i + 1}",
            "items": [
                {"name": "Nachos", "quantity": 1, "price": 5.00},
                {"name": "Tacos", "quantity": 2, "price": 3.50}
            ],
            "total": 12.00 + (i * 2.5),
            "status": random.choice(statuses),
            "createdAt": order_time.isoformat(),
            "completedAt": (order_time + timedelta(minutes=15)).isoformat() if random.choice(statuses) == "completed" else None
        })
    
    return APIResponseHelper.success(
        data=orders,
        message="Orders retrieved"
    )

@app.get("/api/v1/customers")
async def get_customers():
    """Get customers"""
    customers = [
        {
            "id": "CUST001",
            "name": "John Smith",
            "email": "john@example.com",
            "phone": "+44 7700 900001",
            "totalOrders": 25,
            "totalSpent": 312.50,
            "lastVisit": "2025-01-08"
        },
        {
            "id": "CUST002",
            "name": "Sarah Johnson",
            "email": "sarah@example.com",
            "phone": "+44 7700 900002",
            "totalOrders": 18,
            "totalSpent": 245.00,
            "lastVisit": "2025-01-07"
        }
    ]
    
    return APIResponseHelper.success(
        data=customers,
        message="Customers retrieved"
    )

@app.get("/api/v1/inventory")
async def get_inventory():
    """Get inventory items"""
    inventory = [
        {
            "id": "INV001",
            "name": "Tortilla Chips",
            "category": "Dry Goods",
            "currentStock": 50,
            "unit": "bags",
            "reorderLevel": 20,
            "lastRestocked": "2025-01-05"
        },
        {
            "id": "INV002",
            "name": "Black Beans",
            "category": "Canned Goods",
            "currentStock": 30,
            "unit": "cans",
            "reorderLevel": 15,
            "lastRestocked": "2025-01-03"
        }
    ]
    
    return APIResponseHelper.success(
        data=inventory,
        message="Inventory retrieved"
    )

@app.get("/api/v1/analytics/dashboard/mobile")
async def get_analytics_dashboard():
    """Get analytics dashboard for mobile"""
    return APIResponseHelper.success(
        data={
            "revenue": {
                "today": 2847.50,
                "yesterday": 3156.80,
                "thisWeek": 18432.75,
                "lastWeek": 19875.20,
                "thisMonth": 67890.50,
                "lastMonth": 71234.80
            },
            "orders": {
                "today": 42,
                "yesterday": 48,
                "thisWeek": 287,
                "lastWeek": 312,
                "averageOrderValue": 67.80
            },
            "topItems": [
                {"name": "Nachos", "quantity": 156, "revenue": 780.00},
                {"name": "Carnitas Tacos", "quantity": 134, "revenue": 469.00},
                {"name": "Quesadillas", "quantity": 98, "revenue": 539.00}
            ],
            "hourlyBreakdown": [],
            "paymentMethods": {
                "card": {"count": 178, "percentage": 62},
                "cash": {"count": 65, "percentage": 23},
                "applePay": {"count": 44, "percentage": 15}
            },
            "staffPerformance": [
                {"name": "John Manager", "orders": 89, "revenue": 5234.50},
                {"name": "Sarah Cashier", "orders": 76, "revenue": 4567.80}
            ]
        },
        message="Analytics dashboard data retrieved"
    )

@app.get("/api/v1/schedule/week")
async def get_week_schedule():
    """Get weekly schedule"""
    from datetime import datetime, timedelta
    
    # Generate a mock weekly schedule
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    
    schedule_data = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for i, day in enumerate(days):
        date = week_start + timedelta(days=i)
        schedule_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "day": day,
            "shifts": [
                {
                    "employeeId": 1,
                    "employeeName": "John Manager",
                    "startTime": "09:00",
                    "endTime": "17:00",
                    "role": "manager"
                },
                {
                    "employeeId": 2,
                    "employeeName": "Sarah Cashier",
                    "startTime": "10:00",
                    "endTime": "18:00",
                    "role": "cashier"
                }
            ]
        })
    
    return APIResponseHelper.success(
        data=schedule_data,
        message="Weekly schedule retrieved"
    )

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))  # Use DigitalOcean's PORT env var
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )