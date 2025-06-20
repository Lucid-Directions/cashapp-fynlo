"""
Restaurant Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

from app.core.database import get_db, Restaurant, Platform, User, Order, Customer
from app.api.v1.endpoints.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes

router = APIRouter()

# Pydantic models
class RestaurantCreate(BaseModel):
    name: str
    address: dict
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: str = "UTC"
    business_hours: dict = {}
    settings: dict = {}

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[dict] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    business_hours: Optional[dict] = None
    settings: Optional[dict] = None
    tax_configuration: Optional[dict] = None
    payment_methods: Optional[dict] = None
    is_active: Optional[bool] = None

class RestaurantResponse(BaseModel):
    id: str
    platform_id: Optional[str]
    name: str
    address: dict
    phone: Optional[str]
    email: Optional[str]
    timezone: str
    business_hours: dict
    settings: dict
    tax_configuration: dict
    payment_methods: dict
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

class RestaurantStats(BaseModel):
    restaurant_id: str
    name: str
    daily_revenue: float
    monthly_revenue: float
    total_orders: int
    active_customers: int
    average_order_value: float
    payment_method_breakdown: dict

class PlatformStats(BaseModel):
    total_restaurants: int
    active_restaurants: int
    total_revenue: float
    total_orders: int
    total_customers: int
    top_performing_restaurants: List[RestaurantStats]

@router.get("/", response_model=List[RestaurantResponse])
async def get_restaurants(
    platform_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get restaurants (for platform owners) or current restaurant (for restaurant users)"""
    
    # Platform owners can see all restaurants in their platform
    if current_user.role == "platform_owner":
        platform_id = platform_id or str(current_user.platform_id)
        query = db.query(Restaurant).filter(Restaurant.platform_id == platform_id)
        
        if active_only:
            query = query.filter(Restaurant.is_active == True)
        
        restaurants = query.order_by(Restaurant.name).all()
    
    # Restaurant users can only see their own restaurant
    else:
        restaurants = db.query(Restaurant).filter(
            Restaurant.id == current_user.restaurant_id
        ).all()
    
    result = [
        RestaurantResponse(
            id=str(restaurant.id),
            platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
            name=restaurant.name,
            address=restaurant.address,
            phone=restaurant.phone,
            email=restaurant.email,
            timezone=restaurant.timezone,
            business_hours=restaurant.business_hours,
            settings=restaurant.settings,
            tax_configuration=restaurant.tax_configuration,
            payment_methods=restaurant.payment_methods,
            is_active=restaurant.is_active,
            created_at=restaurant.created_at,
            updated_at=restaurant.updated_at
        )
        for restaurant in restaurants
    ]
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} restaurants",
        meta={
            "user_role": current_user.role,
            "platform_id": platform_id,
            "active_only": active_only
        }
    )

@router.get("/current", response_model=RestaurantResponse)
async def get_current_restaurant(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's restaurant"""
    
    if not current_user.restaurant_id:
        raise HTTPException(status_code=404, detail="No restaurant associated with user")
    
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == current_user.restaurant_id
    ).first()
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

@router.post("/", response_model=RestaurantResponse)
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    platform_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new restaurant (platform owners only)"""
    
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Only platform owners can create restaurants")
    
    # Use user's platform if not specified
    platform_id = platform_id or str(current_user.platform_id)
    
    # Verify platform exists
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    new_restaurant = Restaurant(
        platform_id=platform_id,
        name=restaurant_data.name,
        address=restaurant_data.address,
        phone=restaurant_data.phone,
        email=restaurant_data.email,
        timezone=restaurant_data.timezone,
        business_hours=restaurant_data.business_hours,
        settings=restaurant_data.settings
    )
    
    db.add(new_restaurant)
    db.commit()
    db.refresh(new_restaurant)
    
    return RestaurantResponse(
        id=str(new_restaurant.id),
        platform_id=str(new_restaurant.platform_id),
        name=new_restaurant.name,
        address=new_restaurant.address,
        phone=new_restaurant.phone,
        email=new_restaurant.email,
        timezone=new_restaurant.timezone,
        business_hours=new_restaurant.business_hours,
        settings=new_restaurant.settings,
        tax_configuration=new_restaurant.tax_configuration,
        payment_methods=new_restaurant.payment_methods,
        is_active=new_restaurant.is_active,
        created_at=new_restaurant.created_at,
        updated_at=new_restaurant.updated_at
    )

@router.put("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: str,
    restaurant_data: RestaurantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update restaurant settings"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check permissions
    if (current_user.role == "platform_owner" and 
        str(restaurant.platform_id) != str(current_user.platform_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if (current_user.role in ["restaurant_owner", "manager"] and 
        str(restaurant.id) != str(current_user.restaurant_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields if provided
    update_data = restaurant_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(restaurant, field, value)
    
    restaurant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(restaurant)
    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

@router.get("/{restaurant_id}/stats", response_model=RestaurantStats)
async def get_restaurant_stats(
    restaurant_id: str,
    days: int = Query(30, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get restaurant performance statistics"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check permissions
    if (current_user.role == "platform_owner" and 
        str(restaurant.platform_id) != str(current_user.platform_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if (current_user.role in ["restaurant_owner", "manager", "employee"] and 
        str(restaurant.id) != str(current_user.restaurant_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Date ranges
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = today_start - timedelta(days=days)
    
    # Daily revenue (today)
    daily_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Period revenue
    period_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Total orders in period
    total_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start
        )
    ).count()
    
    # Active customers (customers with orders in period)
    active_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start,
            Order.customer_id.isnot(None)
        )
    ).scalar() or 0
    
    # Average order value
    avg_order_value = (period_revenue / total_orders) if total_orders > 0 else 0
    
    # Payment method breakdown (last 30 days)
    payment_breakdown = {}
    # This would require a proper Payment table join - simplified for now
    payment_breakdown = {
        "qr_code": 0.45,
        "cash": 0.30,
        "card": 0.20,
        "apple_pay": 0.05
    }
    
    return RestaurantStats(
        restaurant_id=str(restaurant.id),
        name=restaurant.name,
        daily_revenue=float(daily_revenue),
        monthly_revenue=float(period_revenue),
        total_orders=total_orders,
        active_customers=active_customers,
        average_order_value=round(avg_order_value, 2),
        payment_method_breakdown=payment_breakdown
    )

@router.get("/platform/stats", response_model=PlatformStats)
async def get_platform_stats(
    platform_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get platform-wide statistics (platform owners only)"""
    
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owners only")
    
    platform_id = platform_id or str(current_user.platform_id)
    
    # Get all restaurants in platform
    restaurants = db.query(Restaurant).filter(Restaurant.platform_id == platform_id).all()
    restaurant_ids = [str(r.id) for r in restaurants]
    
    # Total and active restaurants
    total_restaurants = len(restaurants)
    active_restaurants = sum(1 for r in restaurants if r.is_active)
    
    # Get period for calculations (last 30 days)
    period_start = datetime.now() - timedelta(days=30)
    
    # Total revenue across all restaurants
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.created_at >= period_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Total orders
    total_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.created_at >= period_start
        )
    ).count()
    
    # Total customers
    total_customers = db.query(Customer).filter(
        Customer.restaurant_id.in_(restaurant_ids)
    ).count()
    
    # Top performing restaurants
    top_restaurants = []
    for restaurant in restaurants[:5]:  # Top 5
        restaurant_revenue = db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start,
                Order.status == "completed"
            )
        ).scalar() or 0
        
        restaurant_orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start
            )
        ).count()
        
        restaurant_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start,
                Order.customer_id.isnot(None)
            )
        ).scalar() or 0
        
        avg_order = (restaurant_revenue / restaurant_orders) if restaurant_orders > 0 else 0
        
        top_restaurants.append(RestaurantStats(
            restaurant_id=str(restaurant.id),
            name=restaurant.name,
            daily_revenue=float(restaurant_revenue / 30),  # Average daily
            monthly_revenue=float(restaurant_revenue),
            total_orders=restaurant_orders,
            active_customers=restaurant_customers,
            average_order_value=round(avg_order, 2),
            payment_method_breakdown={}
        ))
    
    # Sort by revenue
    top_restaurants.sort(key=lambda x: x.monthly_revenue, reverse=True)
    
    return PlatformStats(
        total_restaurants=total_restaurants,
        active_restaurants=active_restaurants,
        total_revenue=float(total_revenue),
        total_orders=total_orders,
        total_customers=total_customers,
        top_performing_restaurants=top_restaurants[:5]
    )

@router.get("/{restaurant_id}")
async def get_restaurant(
    restaurant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific restaurant details"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Check permissions
    if (current_user.role == "platform_owner" and 
        str(restaurant.platform_id) != str(current_user.platform_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if (current_user.role in ["restaurant_owner", "manager", "employee"] and 
        str(restaurant.id) != str(current_user.restaurant_id)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

# Floor Plan and Table Management Endpoints
class TableResponse(BaseModel):
    id: int
    name: str
    section_id: int
    section_name: str
    seats: int
    status: str  # 'available', 'occupied', 'reserved', 'cleaning'
    server_id: Optional[int] = None
    server_name: Optional[str] = None
    x_position: int = 0
    y_position: int = 0

class SectionResponse(BaseModel):
    id: int
    name: str
    restaurant_id: str
    color: str = "#00A651"
    is_active: bool = True

# Temporary floor plan storage (until database models are added)
floor_plan_data = {
    "sections": [
        {"id": 1, "name": "Main Dining", "restaurant_id": "", "color": "#00A651", "is_active": True},
        {"id": 2, "name": "Patio", "restaurant_id": "", "color": "#FFA500", "is_active": True},
        {"id": 3, "name": "Private Dining", "restaurant_id": "", "color": "#800080", "is_active": True}
    ],
    "tables": [
        {"id": 1, "name": "Table 1", "section_id": 1, "section_name": "Main Dining", "seats": 4, "status": "available", "server_id": None, "server_name": None, "x_position": 100, "y_position": 100},
        {"id": 2, "name": "Table 2", "section_id": 1, "section_name": "Main Dining", "seats": 2, "status": "occupied", "server_id": 1, "server_name": "John Doe", "x_position": 200, "y_position": 100},
        {"id": 3, "name": "Table 3", "section_id": 1, "section_name": "Main Dining", "seats": 6, "status": "reserved", "server_id": 2, "server_name": "Jane Smith", "x_position": 300, "y_position": 100},
        {"id": 4, "name": "Patio A", "section_id": 2, "section_name": "Patio", "seats": 4, "status": "available", "server_id": None, "server_name": None, "x_position": 150, "y_position": 300},
        {"id": 5, "name": "Patio B", "section_id": 2, "section_name": "Patio", "seats": 2, "status": "cleaning", "server_id": None, "server_name": None, "x_position": 250, "y_position": 300},
        {"id": 6, "name": "Private 1", "section_id": 3, "section_name": "Private Dining", "seats": 8, "status": "available", "server_id": None, "server_name": None, "x_position": 100, "y_position": 500}
    ]
}

@router.get("/floor-plan")
async def get_floor_plan(
    section_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get restaurant floor plan with tables and sections"""
    
    sections = floor_plan_data["sections"]
    tables = floor_plan_data["tables"]
    
    # Filter by section if specified
    if section_id:
        sections = [s for s in sections if s["id"] == section_id]
        tables = [t for t in tables if t["section_id"] == section_id]
    
    return APIResponseHelper.success(
        data={
            "sections": sections,
            "tables": tables
        },
        message=f"Retrieved floor plan with {len(sections)} sections and {len(tables)} tables"
    )

@router.get("/sections")
async def get_sections(
    current_user: User = Depends(get_current_user)
):
    """Get all restaurant sections"""
    
    sections = floor_plan_data["sections"]
    
    return APIResponseHelper.success(
        data=sections,
        message=f"Retrieved {len(sections)} sections"
    )

@router.put("/tables/{table_id}/status")
async def update_table_status(
    table_id: int,
    status: str,
    current_user: User = Depends(get_current_user)
):
    """Update table status"""
    
    # Validate status
    valid_statuses = ["available", "occupied", "reserved", "cleaning"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    # Find and update table
    table = None
    for t in floor_plan_data["tables"]:
        if t["id"] == table_id:
            table = t
            break
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    table["status"] = status
    
    return APIResponseHelper.success(
        data=table,
        message=f"Table {table['name']} status updated to {status}"
    )

@router.put("/tables/{table_id}/server")
async def update_table_server(
    table_id: int,
    server_id: Optional[int] = None,
    server_name: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Assign server to table"""
    
    # Find table
    table = None
    for t in floor_plan_data["tables"]:
        if t["id"] == table_id:
            table = t
            break
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    table["server_id"] = server_id
    table["server_name"] = server_name
    
    return APIResponseHelper.success(
        data=table,
        message=f"Table {table['name']} server updated"
    )
