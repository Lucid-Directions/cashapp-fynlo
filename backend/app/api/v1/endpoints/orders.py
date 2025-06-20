"""
Orders Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db, Order, Product
from app.api.v1.endpoints.auth import get_current_user, User
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.websocket import (
    websocket_manager, 
    notify_order_created, 
    notify_order_status_changed, 
    notify_kitchen_update,
    WebSocketMessage,
    EventType
)

router = APIRouter()

# Pydantic models
class OrderItem(BaseModel):
    product_id: str
    quantity: int
    unit_price: float
    total_price: float
    modifiers: List[dict] = []
    special_instructions: Optional[str] = None

class OrderCreate(BaseModel):
    customer_id: Optional[str] = None
    table_number: Optional[str] = None
    order_type: str = "dine_in"  # dine_in, takeaway, delivery
    items: List[OrderItem]
    special_instructions: Optional[str] = None

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    table_number: Optional[str] = None
    items: Optional[List[OrderItem]] = None
    special_instructions: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    restaurant_id: str
    customer_id: Optional[str]
    order_number: str
    table_number: Optional[str]
    order_type: str
    status: str
    items: List[OrderItem]
    subtotal: float
    tax_amount: float
    service_charge: float
    discount_amount: float
    total_amount: float
    payment_status: str
    special_instructions: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]

class OrderSummary(BaseModel):
    id: str
    order_number: str
    table_number: Optional[str]
    status: str
    total_amount: float
    item_count: int
    created_at: datetime

def calculate_order_totals(items: List[OrderItem], tax_rate: float = 0.20, service_rate: float = 0.125) -> dict:
    """Calculate order totals with tax and service charge"""
    subtotal = sum(item.total_price for item in items)
    tax_amount = subtotal * tax_rate
    service_charge = subtotal * service_rate
    total_amount = subtotal + tax_amount + service_charge
    
    return {
        "subtotal": round(subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "service_charge": round(service_charge, 2),
        "total_amount": round(total_amount, 2)
    }

def generate_order_number() -> str:
    """Generate unique order number"""
    return f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

@router.get("/", response_model=List[OrderSummary])
async def get_orders(
    restaurant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get orders with filtering options"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    query = db.query(Order).filter(Order.restaurant_id == restaurant_id)
    
    if status:
        query = query.filter(Order.status == status)
    
    if order_type:
        query = query.filter(Order.order_type == order_type)
    
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    
    orders = query.order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    
    result = [
        OrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            table_number=order.table_number,
            status=order.status,
            total_amount=order.total_amount,
            item_count=len(order.items),
            created_at=order.created_at
        )
        for order in orders
    ]
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} orders",
        meta={
            "total_count": len(result),
            "filters": {
                "status": status,
                "order_type": order_type,
                "date_range": f"{date_from} to {date_to}" if date_from or date_to else None
            },
            "pagination": {"limit": limit, "offset": offset}
        }
    )

@router.get("/today", response_model=List[OrderSummary])
async def get_todays_orders(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get today's orders for kitchen display and POS"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"orders:today:{restaurant_id}"
    cached_orders = await redis.get(cache_key)
    if cached_orders:
        return cached_orders
    
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    orders = db.query(Order).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start,
            Order.created_at < today_end,
            Order.status.in_(["pending", "confirmed", "preparing", "ready"])
        )
    ).order_by(desc(Order.created_at)).all()
    
    result = [
        OrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            table_number=order.table_number,
            status=order.status,
            total_amount=order.total_amount,
            item_count=len(order.items),
            created_at=order.created_at
        )
        for order in orders
    ]
    
    # Cache for 1 minute (frequent updates expected)
    await redis.set(cache_key, result, expire=60)
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} active orders for today",
        meta={
            "restaurant_id": restaurant_id,
            "date": today_start.date().isoformat(),
            "active_statuses": ["pending", "confirmed", "preparing", "ready"]
        }
    )

@router.post("/", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Create a new order"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Validate products exist
    product_ids = [item.product_id for item in order_data.items]
    products = db.query(Product).filter(
        and_(
            Product.id.in_(product_ids),
            Product.restaurant_id == restaurant_id,
            Product.is_active == True
        )
    ).all()
    
    if len(products) != len(product_ids):
        raise HTTPException(status_code=400, detail="One or more products not found")
    
    # Calculate totals
    totals = calculate_order_totals(order_data.items)
    
    # Create order
    new_order = Order(
        restaurant_id=restaurant_id,
        customer_id=order_data.customer_id,
        order_number=generate_order_number(),
        table_number=order_data.table_number,
        order_type=order_data.order_type,
        status="pending",
        items=[item.dict() for item in order_data.items],
        subtotal=totals["subtotal"],
        tax_amount=totals["tax_amount"],
        service_charge=totals["service_charge"],
        discount_amount=0.0,
        total_amount=totals["total_amount"],
        payment_status="pending",
        special_instructions=order_data.special_instructions,
        created_by=str(current_user.id)
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Cache order
    await redis.cache_order(str(new_order.id), {
        "id": str(new_order.id),
        "order_number": new_order.order_number,
        "status": new_order.status,
        "total_amount": new_order.total_amount,
        "items": new_order.items
    })
    
    # Clear today's orders cache
    await redis.delete(f"orders:today:{restaurant_id}")
    
    # Broadcast order creation to WebSocket clients
    await notify_order_created(str(new_order.id), restaurant_id, {
        "id": str(new_order.id),
        "order_number": new_order.order_number,
        "status": new_order.status,
        "items": new_order.items,
        "total_amount": new_order.total_amount,
        "table_number": new_order.table_number
    })
    
    return OrderResponse(
        id=str(new_order.id),
        restaurant_id=str(new_order.restaurant_id),
        customer_id=str(new_order.customer_id) if new_order.customer_id else None,
        order_number=new_order.order_number,
        table_number=new_order.table_number,
        order_type=new_order.order_type,
        status=new_order.status,
        items=[OrderItem(**item) for item in new_order.items],
        subtotal=new_order.subtotal,
        tax_amount=new_order.tax_amount,
        service_charge=new_order.service_charge,
        discount_amount=new_order.discount_amount,
        total_amount=new_order.total_amount,
        payment_status=new_order.payment_status,
        special_instructions=new_order.special_instructions,
        created_by=str(new_order.created_by),
        created_at=new_order.created_at,
        updated_at=new_order.updated_at
    )

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get a specific order"""
    
    # Check cache first
    cached_order = await redis.get_cached_order(order_id)
    if cached_order:
        # Get full order from database for complete response
        pass
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404
        )
    
    return OrderResponse(
        id=str(order.id),
        restaurant_id=str(order.restaurant_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        order_number=order.order_number,
        table_number=order.table_number,
        order_type=order.order_type,
        status=order.status,
        items=[OrderItem(**item) for item in order.items],
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        service_charge=order.service_charge,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        payment_status=order.payment_status,
        special_instructions=order.special_instructions,
        created_by=str(order.created_by),
        created_at=order.created_at,
        updated_at=order.updated_at
    )

@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Update an order"""
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404
        )
    
    # Update fields if provided
    update_data = order_data.dict(exclude_unset=True)
    
    # If updating items, recalculate totals
    if "items" in update_data and update_data["items"]:
        items = [OrderItem(**item) for item in update_data["items"]]
        totals = calculate_order_totals(items)
        update_data.update(totals)
        update_data["items"] = [item.dict() for item in items]
    
    for field, value in update_data.items():
        setattr(order, field, value)
    
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    
    # Update cache
    await redis.cache_order(str(order.id), {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total_amount": order.total_amount,
        "items": order.items
    })
    
    # Clear today's orders cache
    restaurant_id = str(order.restaurant_id)
    await redis.delete(f"orders:today:{restaurant_id}")
    
    # Broadcast order update via WebSocket
    message = WebSocketMessage(
        event_type=EventType.ORDER_STATUS_CHANGED,
        data={
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "action": "updated",
            "items": order.items,
            "total_amount": order.total_amount,
            "table_number": order.table_number
        },
        target_restaurant=restaurant_id
    )
    await websocket_manager.broadcast_to_restaurant(restaurant_id, message)
    
    return OrderResponse(
        id=str(order.id),
        restaurant_id=str(order.restaurant_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        order_number=order.order_number,
        table_number=order.table_number,
        order_type=order.order_type,
        status=order.status,
        items=[OrderItem(**item) for item in order.items],
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        service_charge=order.service_charge,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        payment_status=order.payment_status,
        special_instructions=order.special_instructions,
        created_by=str(order.created_by),
        created_at=order.created_at,
        updated_at=order.updated_at
    )

@router.post("/{order_id}/confirm")
async def confirm_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Confirm order for kitchen preparation"""
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404
        )
    
    if order.status != "pending":
        raise FynloException(
            message=f"Order cannot be confirmed - current status: {order.status}",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"current_status": order.status, "required_status": "pending"},
            status_code=400
        )
    
    order.status = "confirmed"
    order.updated_at = datetime.utcnow()
    db.commit()
    
    # Update cache
    await redis.cache_order(str(order.id), {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "total_amount": order.total_amount,
        "items": order.items
    })
    
    # Broadcast to kitchen displays
    restaurant_id = str(order.restaurant_id)
    await redis.delete(f"orders:today:{restaurant_id}")
    
    # Send kitchen notification
    await notify_kitchen_update(str(order.id), restaurant_id, "new_order", {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "status": "confirmed",
        "items": order.items,
        "table_number": order.table_number,
        "special_instructions": order.special_instructions
    })
    
    return APIResponseHelper.success(
        data={"order_id": str(order.id), "status": order.status},
        message=f"Order {order.order_number} confirmed for kitchen preparation"
    )

@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Cancel an order"""
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404
        )
    
    if order.status in ["completed", "cancelled"]:
        raise FynloException(
            message=f"Order cannot be cancelled - current status: {order.status}",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"current_status": order.status, "invalid_statuses": ["completed", "cancelled"]},
            status_code=400
        )
    
    # Capture original status for notification
    original_status = order.status
    order.status = "cancelled"
    order.updated_at = datetime.utcnow()
    
    # Add cancellation reason to special instructions
    if reason:
        order.special_instructions = f"{order.special_instructions or ''}\nCancelled: {reason}".strip()
    
    db.commit()
    
    # Clear caches
    restaurant_id = str(order.restaurant_id)
    await redis.delete(f"orders:today:{restaurant_id}")
    await redis.delete(f"order:{order_id}")
    
    # Broadcast cancellation
    await notify_order_status_changed(str(order.id), restaurant_id, original_status, "cancelled", {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": "cancelled",
        "reason": reason
    })
    
    return APIResponseHelper.success(
        data={"order_id": str(order.id), "status": order.status, "reason": reason},
        message=f"Order {order.order_number} cancelled successfully"
    )