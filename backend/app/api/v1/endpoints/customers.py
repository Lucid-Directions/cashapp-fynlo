"""
Customer Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta

from app.core.database import get_db, Customer, Order
from app.api.v1.endpoints.auth import get_current_user, User
from app.core.redis_client import get_redis, RedisClient

router = APIRouter()

# Pydantic models
class CustomerCreate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: str
    last_name: str
    preferences: dict = {}

class CustomerUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    preferences: Optional[dict] = None

class CustomerResponse(BaseModel):
    id: str
    email: Optional[str]
    phone: Optional[str]
    first_name: str
    last_name: str
    loyalty_points: int
    total_spent: float
    visit_count: int
    preferences: dict
    created_at: datetime
    updated_at: Optional[datetime]
    last_visit: Optional[datetime]

class CustomerStats(BaseModel):
    total_customers: int
    new_this_month: int
    average_spend: float
    top_customers: List[CustomerResponse]

class LoyaltyTransaction(BaseModel):
    customer_id: str
    points: int
    transaction_type: str  # earned, redeemed, adjusted
    description: str
    order_id: Optional[str] = None

@router.get("/", response_model=List[CustomerResponse])
async def get_customers(
    restaurant_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get customers with search and pagination"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    query = db.query(Customer).filter(Customer.restaurant_id == restaurant_id)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.first_name.ilike(search_pattern),
                Customer.last_name.ilike(search_pattern),
                Customer.email.ilike(search_pattern),
                Customer.phone.ilike(search_pattern)
            )
        )
    
    customers = query.order_by(desc(Customer.total_spent)).offset(offset).limit(limit).all()
    
    # Get last visit dates
    customer_ids = [customer.id for customer in customers]
    last_visits = {}
    if customer_ids:
        last_visit_query = db.query(
            Customer.id,
            func.max(Order.created_at).label('last_visit')
        ).join(Order, Customer.id == Order.customer_id).filter(
            Customer.id.in_(customer_ids)
        ).group_by(Customer.id).all()
        
        last_visits = {str(cv.id): cv.last_visit for cv in last_visit_query}
    
    return [
        CustomerResponse(
            id=str(customer.id),
            email=customer.email,
            phone=customer.phone,
            first_name=customer.first_name,
            last_name=customer.last_name,
            loyalty_points=customer.loyalty_points,
            total_spent=customer.total_spent,
            visit_count=customer.visit_count,
            preferences=customer.preferences,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
            last_visit=last_visits.get(str(customer.id))
        )
        for customer in customers
    ]

@router.get("/stats", response_model=CustomerStats)
async def get_customer_stats(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get customer statistics"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"customer_stats:{restaurant_id}"
    cached_stats = await redis.get(cache_key)
    if cached_stats:
        return cached_stats
    
    # Total customers
    total_customers = db.query(Customer).filter(Customer.restaurant_id == restaurant_id).count()
    
    # New customers this month
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = db.query(Customer).filter(
        and_(
            Customer.restaurant_id == restaurant_id,
            Customer.created_at >= month_start
        )
    ).count()
    
    # Average spend
    avg_spend_result = db.query(func.avg(Customer.total_spent)).filter(
        Customer.restaurant_id == restaurant_id
    ).scalar()
    average_spend = float(avg_spend_result or 0)
    
    # Top 5 customers
    top_customers = db.query(Customer).filter(
        Customer.restaurant_id == restaurant_id
    ).order_by(desc(Customer.total_spent)).limit(5).all()
    
    result = CustomerStats(
        total_customers=total_customers,
        new_this_month=new_this_month,
        average_spend=round(average_spend, 2),
        top_customers=[
            CustomerResponse(
                id=str(customer.id),
                email=customer.email,
                phone=customer.phone,
                first_name=customer.first_name,
                last_name=customer.last_name,
                loyalty_points=customer.loyalty_points,
                total_spent=customer.total_spent,
                visit_count=customer.visit_count,
                preferences=customer.preferences,
                created_at=customer.created_at,
                updated_at=customer.updated_at,
                last_visit=None  # Not needed for stats
            )
            for customer in top_customers
        ]
    )
    
    # Cache for 5 minutes
    await redis.set(cache_key, result.dict(), expire=300)
    
    return result

@router.post("/", response_model=CustomerResponse)
async def create_customer(
    customer_data: CustomerCreate,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Create a new customer"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check if customer already exists (by email or phone)
    existing_customer = None
    if customer_data.email:
        existing_customer = db.query(Customer).filter(
            and_(
                Customer.restaurant_id == restaurant_id,
                Customer.email == customer_data.email
            )
        ).first()
    
    if not existing_customer and customer_data.phone:
        existing_customer = db.query(Customer).filter(
            and_(
                Customer.restaurant_id == restaurant_id,
                Customer.phone == customer_data.phone
            )
        ).first()
    
    if existing_customer:
        raise HTTPException(status_code=400, detail="Customer already exists")
    
    new_customer = Customer(
        restaurant_id=restaurant_id,
        email=customer_data.email,
        phone=customer_data.phone,
        first_name=customer_data.first_name,
        last_name=customer_data.last_name,
        preferences=customer_data.preferences
    )
    
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    
    # Clear customer stats cache
    await redis.delete(f"customer_stats:{restaurant_id}")
    
    return CustomerResponse(
        id=str(new_customer.id),
        email=new_customer.email,
        phone=new_customer.phone,
        first_name=new_customer.first_name,
        last_name=new_customer.last_name,
        loyalty_points=new_customer.loyalty_points,
        total_spent=new_customer.total_spent,
        visit_count=new_customer.visit_count,
        preferences=new_customer.preferences,
        created_at=new_customer.created_at,
        updated_at=new_customer.updated_at,
        last_visit=None
    )

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific customer"""
    
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get last visit
    last_order = db.query(Order).filter(
        Order.customer_id == customer_id
    ).order_by(desc(Order.created_at)).first()
    
    return CustomerResponse(
        id=str(customer.id),
        email=customer.email,
        phone=customer.phone,
        first_name=customer.first_name,
        last_name=customer.last_name,
        loyalty_points=customer.loyalty_points,
        total_spent=customer.total_spent,
        visit_count=customer.visit_count,
        preferences=customer.preferences,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
        last_visit=last_order.created_at if last_order else None
    )

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Update customer information"""
    
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Update fields if provided
    update_data = customer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)
    
    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)
    
    # Clear customer stats cache
    restaurant_id = str(customer.restaurant_id)
    await redis.delete(f"customer_stats:{restaurant_id}")
    
    return CustomerResponse(
        id=str(customer.id),
        email=customer.email,
        phone=customer.phone,
        first_name=customer.first_name,
        last_name=customer.last_name,
        loyalty_points=customer.loyalty_points,
        total_spent=customer.total_spent,
        visit_count=customer.visit_count,
        preferences=customer.preferences,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
        last_visit=None
    )

@router.post("/{customer_id}/loyalty", response_model=dict)
async def update_loyalty_points(
    customer_id: str,
    loyalty_data: LoyaltyTransaction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Update customer loyalty points"""
    
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Validate transaction
    if loyalty_data.transaction_type == "redeemed" and customer.loyalty_points < abs(loyalty_data.points):
        raise HTTPException(status_code=400, detail="Insufficient loyalty points")
    
    # Update points
    if loyalty_data.transaction_type == "earned":
        customer.loyalty_points += abs(loyalty_data.points)
    elif loyalty_data.transaction_type == "redeemed":
        customer.loyalty_points -= abs(loyalty_data.points)
    elif loyalty_data.transaction_type == "adjusted":
        customer.loyalty_points = abs(loyalty_data.points)
    
    customer.updated_at = datetime.utcnow()
    db.commit()
    
    # Clear customer stats cache
    restaurant_id = str(customer.restaurant_id)
    await redis.delete(f"customer_stats:{restaurant_id}")
    
    return {
        "message": f"Loyalty points {loyalty_data.transaction_type}",
        "new_balance": customer.loyalty_points,
        "transaction": {
            "type": loyalty_data.transaction_type,
            "points": loyalty_data.points,
            "description": loyalty_data.description
        }
    }

@router.get("/{customer_id}/orders")
async def get_customer_orders(
    customer_id: str,
    limit: int = Query(20, le=50),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get customer's order history"""
    
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    orders = db.query(Order).filter(
        Order.customer_id == customer_id
    ).order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    
    return [
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "total_amount": order.total_amount,
            "payment_status": order.payment_status,
            "created_at": order.created_at
        }
        for order in orders
    ]

@router.post("/search")
async def search_customers(
    search_data: dict,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Advanced customer search"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    query = db.query(Customer).filter(Customer.restaurant_id == restaurant_id)
    
    # Search by multiple criteria
    if "email" in search_data and search_data["email"]:
        query = query.filter(Customer.email.ilike(f"%{search_data['email']}%"))
    
    if "phone" in search_data and search_data["phone"]:
        query = query.filter(Customer.phone.ilike(f"%{search_data['phone']}%"))
    
    if "name" in search_data and search_data["name"]:
        name_pattern = f"%{search_data['name']}%"
        query = query.filter(
            or_(
                Customer.first_name.ilike(name_pattern),
                Customer.last_name.ilike(name_pattern)
            )
        )
    
    if "min_spent" in search_data and search_data["min_spent"]:
        query = query.filter(Customer.total_spent >= search_data["min_spent"])
    
    if "min_points" in search_data and search_data["min_points"]:
        query = query.filter(Customer.loyalty_points >= search_data["min_points"])
    
    customers = query.order_by(desc(Customer.total_spent)).limit(50).all()
    
    return [
        {
            "id": str(customer.id),
            "name": f"{customer.first_name} {customer.last_name}",
            "email": customer.email,
            "phone": customer.phone,
            "loyalty_points": customer.loyalty_points,
            "total_spent": customer.total_spent,
            "visit_count": customer.visit_count
        }
        for customer in customers
    ]