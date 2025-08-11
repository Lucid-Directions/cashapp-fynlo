"""
Orders Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import uuid
import logging

from app.core.database import get_db, Order, Product, Customer, User, Payment
from app.core.auth import get_current_user
from app.api.v1.endpoints.customers import (
    CustomerCreate as CustomerCreateSchema,
)  # Renamed to avoid conflict
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper
from app.core.exceptions import (
    ValidationException,
    AuthenticationException,
    FynloException,
)
from app.core.onboarding_helper import OnboardingHelper
from app.core.websocket import (
    websocket_manager,
    notify_order_created,
    notify_order_status_changed,
    notify_kitchen_update,
    WebSocketMessage,
    EventType,
)
from app.core.transaction_manager import transactional, transaction_manager
from app.schemas.refund_schemas import RefundRequestSchema, RefundResponseSchema
from app.api.v1.endpoints.customers import CustomerBasicInfo  # Import CustomerBasicInfo
from app.services.payment_factory import get_payment_provider  # Assuming you have this

# Or import specific providers if needed:
# from app.services.square_provider import SquareProvider
# from app.services.stripe_provider import StripeProvider
# from app.services.sumup_provider import SumUpProvider
from app.models.refund import Refund, RefundLedger  # SQLAlchemy models
from app.core.database import User as UserModel
from app.services.email_service import EmailService
from app.services.receipt_helper import send_receipt_with_logging, serialize_order_for_background  # Import the new EmailService
from decimal import Decimal  # Ensure Decimal is imported if used for amounts

logger = logging.getLogger(__name__)
router = APIRouter()
email_service = EmailService()  # Instantiate EmailService globally or per request


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
    customer_email: Optional[EmailStr] = None
    customer_name: Optional[str] = None  # Expecting "First Last"
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
    customer_id: Optional[str]  # Keep this for backward compatibility or internal use
    customer: Optional[CustomerBasicInfo] = None
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
    customer_name: Optional[str] = None
    created_at: datetime


def calculate_order_totals(
    items: List[OrderItem], tax_rate: float = 0.20, service_rate: float = 0.125
) -> dict:
    """Calculate order totals with tax and service charge"""
    subtotal = sum(item.total_price for item in items)
    tax_amount = subtotal * tax_rate
    service_charge = subtotal * service_rate
    total_amount = subtotal + tax_amount + service_charge

    return {
        "subtotal": round(subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "service_charge": round(service_charge, 2),
        "total_amount": round(total_amount, 2),
    }


def generate_order_number() -> str:
    """Generate unique order number"""
    return f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def verify_order_access(order, current_user):
    """Verify user has access to the order's restaurant"""
    if current_user.role != "platform_owner":
        user_restaurant_id = (
            current_user.current_restaurant_id or current_user.restaurant_id
        )
        if user_restaurant_id is None:
            raise AuthenticationException(
                message="Access denied: No restaurant assigned to user",
                error_code="ACCESS_DENIED",
            )
        if str(order.restaurant_id) != str(user_restaurant_id):
            raise AuthenticationException(
                message="Access denied: You can only access orders from your own restaurant",
                error_code="ACCESS_DENIED",
            )


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
    current_user: User = Depends(get_current_user),
):
    """Get orders with filtering options"""

    # Check if user needs onboarding (no restaurant)
    onboarding_response = OnboardingHelper.handle_onboarding_response(
        user=current_user, resource_type="orders", endpoint_requires_restaurant=True
    )
    if onboarding_response:
        return onboarding_response

    # Access control: Check user's role and restaurant access
    if current_user.role == "platform_owner":
        # Platform owners can access any restaurant
        if not restaurant_id:
            # If no restaurant specified, show all orders
            query = db.query(Order)
        else:
            query = db.query(Order).filter(Order.restaurant_id == restaurant_id)
    else:
        # Restaurant owners, managers, and employees can only access their own restaurant(s)
        user_restaurant_id = (
            current_user.current_restaurant_id or current_user.restaurant_id
        )
        if user_restaurant_id is None:
            raise AuthenticationException(
                message="Access denied: No restaurant assigned to user",
                error_code="ACCESS_DENIED",
            )
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity

            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="access",
                resource_type="orders",
                resource_id=None,
                db=db,
            )

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

    # Fetch customer information for the orders
    customer_ids = [order.customer_id for order in orders if order.customer_id]
    customers_map = {}
    if customer_ids:
        customers = (
            db.query(Customer.id, Customer.first_name, Customer.last_name)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )
        customers_map = {str(c.id): f"{c.first_name} {c.last_name}" for c in customers}

    # Fetch customer information for the orders
    customer_ids = [order.customer_id for order in orders if order.customer_id]
    customers_map = {}
    if customer_ids:
        customers = (
            db.query(Customer.id, Customer.first_name, Customer.last_name)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )
        customers_map = {str(c.id): f"{c.first_name} {c.last_name}" for c in customers}

    result = [
        OrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            table_number=order.table_number,
            status=order.status,
            total_amount=order.total_amount,
            item_count=len(order.items),
            customer_name=(
                customers_map.get(str(order.customer_id)) if order.customer_id else None
            ),
            created_at=order.created_at,
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
                "date_range": (
                    f"{date_from} to {date_to}" if date_from or date_to else None
                ),
            },
            "pagination": {"limit": limit, "offset": offset},
        },
    )


@router.get("/today", response_model=List[OrderSummary])
async def get_todays_orders(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    """Get today's orders for kitchen display and POS"""

    # Check if user needs onboarding (no restaurant)
    onboarding_response = OnboardingHelper.handle_onboarding_response(
        user=current_user, resource_type="orders", endpoint_requires_restaurant=True
    )
    if onboarding_response:
        return onboarding_response

    # Access control: Check user's role and restaurant access
    if current_user.role == "platform_owner":
        # Platform owners can access any restaurant
        if not restaurant_id:
            # Platform owner must specify which restaurant to view
            raise ValidationException(
                message="Restaurant ID is required for platform owners"
            )
    else:
        # Restaurant owners, managers, and employees can only access their own restaurant(s)
        user_restaurant_id = (
            current_user.current_restaurant_id or current_user.restaurant_id
        )
        if user_restaurant_id is None:
            raise AuthenticationException(
                message="Access denied: No restaurant assigned to user",
                error_code="ACCESS_DENIED",
            )
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity

            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="access",
                resource_type="orders",
                resource_id=None,
                db=db,
            )

    # Check cache first
    cache_key = f"orders:today:{restaurant_id}"
    cached_orders = await redis.get(cache_key)
    if cached_orders:
        return cached_orders

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    orders = (
        db.query(Order)
        .filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.created_at >= today_start,
                Order.created_at < today_end,
                Order.status.in_(["pending", "confirmed", "preparing", "ready"]),
            )
        )
        .order_by(desc(Order.created_at))
        .all()
    )

    # Fetch customer information for the orders
    customer_ids = [order.customer_id for order in orders if order.customer_id]
    customers_map = {}
    if customer_ids:
        customers = (
            db.query(Customer.id, Customer.first_name, Customer.last_name)
            .filter(Customer.id.in_(customer_ids))
            .all()
        )
        customers_map = {str(c.id): f"{c.first_name} {c.last_name}" for c in customers}

    result = [
        OrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            table_number=order.table_number,
            status=order.status,
            total_amount=order.total_amount,
            item_count=len(order.items),
            customer_name=(
                customers_map.get(str(order.customer_id)) if order.customer_id else None
            ),
            created_at=order.created_at,
        )
        for order in orders
    ]

    # Cache for 1 minute (frequent updates expected)
    # Note: Pydantic models in a list need to be converted to dicts for JSON serialization if not handled by redis client.
    # Assuming redis.set handles Pydantic models correctly or they are converted before caching.
    # For simplicity, if `result` is a list of Pydantic models, this might need adjustment:
    # cached_data = [r.dict() for r in result]
    # await redis.set(cache_key, cached_data, expire=60)
    # However, if `APIResponseHelper.success` handles this, then it might be fine.
    # Let's assume for now that the existing caching mechanism handles this.
    # If `cached_orders` returns a string that needs parsing, then the caching needs to be consistent.
    # The current `redis.set(cache_key, result, expire=60)` might store list of Pydantic objects directly.
    # Let's ensure it's JSON serializable if it's not already.

    # Convert result to list of dicts for caching if necessary, depends on redis client implementation
    # For now, assume `result` (list of Pydantic models) is directly cachable or APIResponseHelper handles it.

    await redis.set(
        cache_key, [r.dict() for r in result], expire=60
    )  # Explicitly convert to dicts for caching

    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} active orders for today",
        meta={
            "restaurant_id": restaurant_id,
            "date": today_start.date().isoformat(),
            "active_statuses": ["pending", "confirmed", "preparing", "ready"],
        },
    )


@router.post("/", response_model=OrderResponse)
@transactional(max_retries=3, retry_delay=0.1)
async def create_order(
    order_data: OrderCreate,
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    """Create a new order"""

    # Access control: Check user's role and restaurant access
    if current_user.role == "platform_owner":
        # Platform owners must specify which restaurant
        if not restaurant_id:
            raise ValidationException(
                message="Restaurant ID is required for platform owners"
            )
    else:
        # Restaurant owners, managers, and employees can only create orders for their own restaurant(s)
        user_restaurant_id = (
            current_user.current_restaurant_id or current_user.restaurant_id
        )
        if user_restaurant_id is None:
            raise AuthenticationException(
                message="Access denied: No restaurant assigned to user",
                error_code="ACCESS_DENIED",
            )
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity

            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="modify",
                resource_type="orders",
                resource_id=None,
                db=db,
            )

    customer_id_to_save = order_data.customer_id

    # Customer lookup/creation
    if not customer_id_to_save and order_data.customer_email:
        customer = (
            db.query(Customer)
            .filter(
                Customer.email == order_data.customer_email,
                Customer.restaurant_id == restaurant_id,
            )
            .first()
        )
        if customer:
            customer_id_to_save = str(customer.id)
        elif order_data.customer_name:  # Create customer if email and name provided
            first_name, *last_name_parts = order_data.customer_name.split(" ", 1)
            last_name = last_name_parts[0] if last_name_parts else ""

            new_customer_schema = CustomerCreateSchema(
                email=order_data.customer_email,
                phone=None,  # Assuming phone is not passed during order creation for now
                first_name=first_name,
                last_name=last_name,
                restaurant_id=restaurant_id,
            )
            # Directly create customer model instance
            # This assumes Customer model has a similar constructor or fields
            # Ideally, this would call a CRUD function like `crud.customer.create()`
            created_customer = Customer(
                **new_customer_schema.dict(),
                loyalty_points=0,
                total_spent=0.0,
                visit_count=0,
            )
            db.add(created_customer)
            db.flush()  # To get the ID
            db.refresh(created_customer)
            customer_id_to_save = str(created_customer.id)
            # Clear customer stats cache as a new customer is added
            await redis.delete(f"customer_stats:{restaurant_id}")

    # Validate products exist
    product_ids = [item.product_id for item in order_data.items]
    products = (
        db.query(Product)
        .filter(
            and_(
                Product.id.in_(product_ids),
                Product.restaurant_id == restaurant_id,
                Product.is_active == True,
            )
        )
        .all()
    )

    if len(products) != len(product_ids):
        raise ValidationException(message="One or more products not found")
    # Calculate totals
    totals = calculate_order_totals(order_data.items)

    try:
        # Check stock availability for tracked products
        for item in order_data.items:
            product = next(p for p in products if str(p.id) == item.product_id)
            if product.stock_tracking and product.stock_quantity < item.quantity:
                raise ValidationException(
                    message=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}, Required: {item.quantity}"
                )
        # Create order
        new_order = Order(
            restaurant_id=restaurant_id,
            customer_id=customer_id_to_save,  # Use the resolved customer_id
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
            created_by=str(current_user.id),
            customer_email=order_data.customer_email,
        )

        db.add(new_order)

        # Update stock quantities for tracked products (atomic with order creation)
        for item in order_data.items:
            product = next(p for p in products if str(p.id) == item.product_id)
            if product.stock_tracking:
                product.stock_quantity -= item.quantity
                db.add(product)  # Ensure product is tracked for updates

        # Flush to get the order ID before commit
        db.flush()
        db.refresh(new_order)

        # Cache order (part of transaction)
        await redis.cache_order(
            str(new_order.id),
            {
                "id": str(new_order.id),
                "order_number": new_order.order_number,
                "status": new_order.status,
                "total_amount": new_order.total_amount,
                "items": new_order.items,
            },
        )

        # Clear today's orders cache (part of transaction)
        await redis.delete(f"orders:today:{restaurant_id}")

        # Transaction will auto-commit at this point due to @transactional decorator

        # Post-transaction operations (these can fail without affecting DB consistency)
        try:
            # Broadcast order creation to WebSocket clients
            await notify_order_created(
                str(new_order.id),
                restaurant_id,
                {
                    "id": str(new_order.id),
                    "order_number": new_order.order_number,
                    "status": new_order.status,
                    "items": new_order.items,
                    "total_amount": new_order.total_amount,
                    "table_number": new_order.table_number,
                },
            )
        except Exception as ws_error:
            # Log WebSocket errors but don't fail the order creation
            logger.warning(
                f"WebSocket notification failed for order {new_order.id}: {ws_error}"
            )

    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Order creation failed: {e}")
        raise FynloException(message="Failed to create order")
    customer_info_response = None
    if new_order.customer_id:
        customer_model = (
            db.query(Customer).filter(Customer.id == new_order.customer_id).first()
        )
        if customer_model:
            customer_info_response = CustomerBasicInfo(
                id=str(customer_model.id),
                name=f"{customer_model.first_name} {customer_model.last_name}",
                email=customer_model.email,
            )

    return OrderResponse(
        id=str(new_order.id),
        restaurant_id=str(new_order.restaurant_id),
        customer_id=str(new_order.customer_id) if new_order.customer_id else None,
        customer=customer_info_response,
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
        updated_at=new_order.updated_at,
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
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
            status_code=404,
        )

    # Access control: Verify user has access to this order's restaurant
    verify_order_access(order, current_user)

    customer_info_response = None
    if order.customer_id:
        customer_model = (
            db.query(Customer).filter(Customer.id == order.customer_id).first()
        )
        if customer_model:
            customer_info_response = CustomerBasicInfo(
                id=str(customer_model.id),
                name=f"{customer_model.first_name} {customer_model.last_name}",
                email=customer_model.email,
            )

    return OrderResponse(
        id=str(order.id),
        restaurant_id=str(order.restaurant_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        customer=customer_info_response,
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
        updated_at=order.updated_at,
    )


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    """Update an order"""

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404,
        )

    # Access control: Verify user has access to this order's restaurant
    verify_order_access(order, current_user)

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
    await redis.cache_order(
        str(order.id),
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "total_amount": order.total_amount,
            "items": order.items,
        },
    )

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
            "table_number": order.table_number,
        },
        target_restaurant=restaurant_id,
    )
    await websocket_manager.broadcast_to_restaurant(restaurant_id, message)

    customer_info_response = None
    if order.customer_id:
        customer_model = (
            db.query(Customer).filter(Customer.id == order.customer_id).first()
        )
        if customer_model:
            customer_info_response = CustomerBasicInfo(
                id=str(customer_model.id),
                name=f"{customer_model.first_name} {customer_model.last_name}",
                email=customer_model.email,
            )

    return OrderResponse(
        id=str(order.id),
        restaurant_id=str(order.restaurant_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        customer=customer_info_response,
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
        updated_at=order.updated_at,
    )


@router.post("/{order_id}/confirm")
async def confirm_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    """
    Confirm order for kitchen preparation and apply recipe deductions.
    """
    from app.services.inventory_service import (
        apply_recipe_deductions_for_order,
    )  # Import here to avoid circular deps at module level

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404,
        )

    # Access control: Verify user has access to this order's restaurant
    verify_order_access(order, current_user)

    if order.status != "pending":
        raise FynloException(
            message=f"Order cannot be confirmed - current status: {order.status}",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"current_status": order.status, "required_status": "pending"},
            status_code=400,
        )

    order.status = "confirmed"
    order.updated_at = datetime.utcnow()
    # db.commit() # Will be committed after recipe deductions or by transactional decorator if used

    try:
        # Apply recipe deductions BEFORE final commit of order status
        # This assumes apply_recipe_deductions_for_order is synchronous or handled within the same DB transaction.
        # If it's async and involves external calls that shouldn't be part of this transaction,
        # this might need to be a background task triggered after successful order confirmation.
        # For now, direct call for simplicity, assuming it works within the same transaction context.

        deductions_result = await apply_recipe_deductions_for_order(
            db, order_id=order.id, websocket_manager=websocket_manager
        )

        logger.info(
            f"Recipe deductions applied for order {order.id}. {len(deductions_result)} items affected."
        )

        db.commit()  # Commit both order status update and inventory changes
    except Exception as e:
        db.rollback()  # Rollback order status change if deductions fail
        logger.error(
            f"Failed to apply recipe deductions for order {order.id}: {e}. Order status not confirmed."
        )
        raise FynloException(
            message=f"Failed to confirm order due to inventory processing error: {str(e)}"
        )
    # Update cache
    await redis.cache_order(
        str(order.id),
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status,
            "total_amount": order.total_amount,
            "items": order.items,
        },
    )

    # Broadcast to kitchen displays
    restaurant_id = str(order.restaurant_id)
    await redis.delete(f"orders:today:{restaurant_id}")

    # Send kitchen notification
    await notify_kitchen_update(
        str(order.id),
        restaurant_id,
        "new_order",
        {
            "order_id": str(order.id),
            "order_number": order.order_number,
            "status": "confirmed",
            "items": order.items,
            "table_number": order.table_number,
            "special_instructions": order.special_instructions,
        },
    )

    return APIResponseHelper.success(
        data={"order_id": str(order.id), "status": order.status},
        message=f"Order {order.order_number} confirmed for kitchen preparation",
    )


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis),
):
    """Cancel an order"""

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=404,
        )

    # Access control: Verify user has access to this order's restaurant
    verify_order_access(order, current_user)

    if order.status in ["completed", "cancelled"]:
        raise FynloException(
            message=f"Order cannot be cancelled - current status: {order.status}",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={
                "current_status": order.status,
                "invalid_statuses": ["completed", "cancelled"],
            },
            status_code=400,
        )

    # Capture original status for notification
    original_status = order.status
    order.status = "cancelled"
    order.updated_at = datetime.utcnow()

    # Add cancellation reason to special instructions
    if reason:
        order.special_instructions = (
            f"{order.special_instructions or ''}\nCancelled: {reason}".strip()
        )

    db.commit()

    # Clear caches
    restaurant_id = str(order.restaurant_id)
    await redis.delete(f"orders:today:{restaurant_id}")
    await redis.delete(f"order:{order_id}")

    # Broadcast cancellation
    await notify_order_status_changed(
        str(order.id),
        restaurant_id,
        original_status,
        "cancelled",
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": "cancelled",
            "reason": reason,
        },
    )

    return APIResponseHelper.success(
        data={"order_id": str(order.id), "status": order.status, "reason": reason},
        message=f"Order {order.order_number} cancelled successfully",
    )


@router.post("/{order_id}/refund", response_model=RefundResponseSchema)
async def refund_order(
    order_id: str,
    refund_data: RefundRequestSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),  # Ensure this User is the Pydantic model from auth
):
    """
    Process a full or partial refund for an order.
    Requires Manager role or above.
    """
    # Permission Check (FR-7)
    # Assuming current_user has a 'role' attribute. Adjust as per your User model.
    # It's better to use a dependency for role checks, e.g., Depends(RoleChecker(["Manager", "Admin"]))
    db_user = db.query(UserModel).filter(UserModel.id == current_user.id).first()
    if not db_user or db_user.role not in [
        "Manager",
        "Admin",
    ]:  # TODO: Confirm role names
        raise FynloException(
            message="Not authorized to perform refunds",
            status_code=status.HTTP_403_FORBIDDEN
        )

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise FynloException(
            message="Order not found",
            error_code=ErrorCodes.NOT_FOUND,
            details={"order_id": order_id},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Access control: Verify user has access to this order's restaurant
    verify_order_access(order, current_user)

    if order.status != "completed":  # (FR-1) - Or other statuses that allow refunds
        raise FynloException(
            message=f"Order status '{order.status}' does not allow refunds.",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"current_status": order.status, "required_status": "completed"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Determine refund amount and type
    is_full_refund = not refund_data.items or len(refund_data.items) == 0
    refund_amount: Decimal

    if is_full_refund:
        refund_amount = (
            refund_data.amount
            if refund_data.amount is not None
            else Decimal(str(order.total_amount))
        )
        if refund_amount != Decimal(str(order.total_amount)):
            # Potentially allow if less, but for now, full means full.
            raise FynloException(
                message="Full refund amount must match order total if items are not specified.",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
    else:  # Partial refund
        calculated_partial_amount = Decimal(0)
        # Validate items and calculate amount (simplified, needs actual product price lookup)
        for item_to_refund in refund_data.items:
            found_item = next(
                (
                    oi
                    for oi in order.items
                    if oi.get("product_id") == item_to_refund.line_id
                ),
                None,
            )  # Assuming line_id is product_id
            if not found_item:
                raise FynloException(
                    message=f"Item with line_id {item_to_refund.line_id} not found in order.",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            # This is a simplification. In reality, you'd use the item's price at the time of order.
            # And ensure you're not refunding more than ordered quantity.
            calculated_partial_amount += (
                Decimal(str(found_item.get("unit_price", 0))) * item_to_refund.qty
            )

        if (
            refund_data.amount is not None
            and refund_data.amount != calculated_partial_amount
        ):
            # If amount is provided for partial, it should match calculated or handle discrepancy
            logger.warning(
                f"Provided partial refund amount {refund_data.amount} differs from calculated {calculated_partial_amount}. Using provided amount."
            )
            refund_amount = refund_data.amount
        else:
            refund_amount = calculated_partial_amount

    if refund_amount <= 0:
        raise FynloException(
            message="Refund amount must be positive.",
            error_code=ErrorCodes.VALIDATION_ERROR,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # (FR-4) Backend routes to gateway adapter
    # Assuming order.payment_transaction_id and order.payment_provider exist
    payment_transaction_id = getattr(order, "payment_transaction_id", None)
    payment_provider_code = getattr(
        order, "payment_provider_code", None
    )  # e.g., 'sumup', 'square', 'cash'

    if not payment_transaction_id or not payment_provider_code:
        # For cash, we might not have a transaction_id in the same way.
        if payment_provider_code == "cash":
            logger.info(
                f"Processing cash refund for order {order_id} of amount {refund_amount}"
            )
            gateway_refund_id = f"CASH_REFUND_{uuid.uuid4()}"
            refund_status_message = "Cash refund processed internally."
        else:
            raise FynloException(
                message="Order payment details not found or provider not supported for direct refund.",
                error_code=ErrorCodes.PAYMENT_ERROR,
                status_code=status.HTTP_501_NOT_IMPLEMENTED,  # Or 400 if it's a data issue
            )
    else:
        try:
            payment_provider_service = get_payment_provider(payment_provider_code)
            # The refund method in provider service should handle actual API call
            # It might need more parameters like refund_data.items for partial refunds
            refund_result = await payment_provider_service.refund_payment(
                transaction_id=payment_transaction_id,
                amount_to_refund=float(refund_amount),  # Provider might expect float
                reason=refund_data.reason,
                # Pass item details if provider supports itemized refunds
                items_to_refund=[
                    {"line_id": i.line_id, "quantity": i.qty}
                    for i in refund_data.items or []
                ],
            )
            gateway_refund_id = refund_result.get("refund_id") or refund_result.get(
                "id"
            )
            refund_status_message = refund_result.get("status", "processed")
            if not refund_result.get(
                "success", True
            ):  # Assuming provider returns a success flag
                raise FynloException(
                    message=f"Gateway refund failed: {refund_result.get('error', 'Unknown error')}",
                    error_code=ErrorCodes.PAYMENT_GATEWAY_ERROR,
                    status_code=status.HTTP_502_BAD_GATEWAY,
                )
        except Exception as e:
            logger.error(
                f"Error processing refund with gateway {payment_provider_code} for order {order_id}: {e}"
            )
            raise FynloException(
                message=f"Gateway refund processing error: {str(e)}",
                error_code=ErrorCodes.PAYMENT_GATEWAY_ERROR,
                status_code=status.HTTP_502_BAD_GATEWAY,
            )

    # (FR-5) Create Refund record and Ledger entry (FR-8)
    # This should be in a transaction
    try:
        with transaction_manager(db_session=db):  # Using the new transaction manager
            new_refund = Refund(
                order_id=str(
                    order.id
                ),  # Assuming order.id is UUID, convert to string if schema expects string
                amount=refund_amount,
                reason=refund_data.reason,
                # gateway_refund_id=gateway_refund_id, # Add this field to Refund model if needed
                # status=refund_status_message # Add this field to Refund model
            )
            db.add(new_refund)
            db.flush()  # To get new_refund.id

            new_ledger_entry = RefundLedger(
                refund_id=new_refund.id,
                user_id=str(db_user.id),  # Assuming db_user.id is UUID
                device_id="server_initiated",  # TODO: Get actual deviceId if available from request headers or context
                action="refund_processed",
                # timestamp is server_default
            )
            db.add(new_ledger_entry)

            # (FR-5) Update order status or refunds array
            if is_full_refund:
                order.status = "refunded"  # Or a specific "fully_refunded" status
                # Disable further refunds (FR-X, implied from "disables further refunds")
                # This could be a flag on the order, or logic checking existing refunds
            else:
                # If your Order model has a JSONB 'refunds' field or similar:
                current_refunds = getattr(
                    order, "refund_details", []
                )  # Assuming 'refund_details' is JSONB field
                if not isinstance(current_refunds, list):
                    current_refunds = []
                current_refunds.append(
                    {
                        "refund_id": str(new_refund.id),
                        "amount": float(refund_amount),  # Store as float in JSON
                        "reason": refund_data.reason,
                        "items": [
                            {"line_id": i.line_id, "qty": i.qty}
                            for i in refund_data.items or []
                        ],
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
                setattr(order, "refund_details", current_refunds)
                order.status = "partially_refunded"  # Or keep 'completed' and rely on refund_details

            order.updated_at = datetime.utcnow()
            db.add(order)
            # db.commit() # Handled by transaction_manager
            db.refresh(new_refund)  # To get all fields like created_at

    except Exception as e:
        # db.rollback() # Handled by transaction_manager
        logger.error(
            f"Database error during refund processing for order {order_id}: {e}"
        )
        raise FynloException(
            message="Failed to save refund details.",
            error_code=ErrorCodes.DATABASE_ERROR,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # (FR-5) Emit orders.updated via WebSocket
    try:
        message_data = {
            "order_id": str(order.id),
            "new_status": order.status,
            "refund_details": {
                "refund_id": str(new_refund.id),
                "amount": float(refund_amount),
                "is_full": is_full_refund,
            },
        }
        event_type = EventType.ORDER_REFUNDED  # Define this in your EventType enum
        ws_message = WebSocketMessage(
            event_type=event_type,
            data=message_data,
            target_restaurant=str(order.restaurant_id),
        )
        await websocket_manager.broadcast_to_restaurant(
            str(order.restaurant_id), ws_message
        )
    except Exception as ws_error:
        logger.warning(
            f"WebSocket notification for refund failed for order {order.id}: {ws_error}"
        )

    # (FR-6) Customer receives e-mail receipt "Refund processed – £X.XX".
    customer_email = getattr(
        order, "customer_email", None
    )  # Assuming Order model has customer_email
    if not customer_email and order.customer_id:
        # Attempt to fetch customer email if not directly on order
        customer = (
            db.query(UserModel).filter(UserModel.id == order.customer_id).first()
        )  # Or Customer model
        if customer:
            customer_email = customer.email

    if customer_email:
        try:
            # Prepare a simple order-like object for the email template if needed
            # The EmailService expects an 'order' object with 'customer_email', 'order_number' (or 'number'), 'items', 'total_amount'
            # We have `order` (SQLAlchemy Order model) and `new_refund` (SQLAlchemy Refund model)
            # We need to ensure the `order` object passed to `send_receipt` has the fields the template expects.
            # The template uses: order.order_number, order.items, order.total_amount, order.subtotal, order.tax_amount, order.service_charge
            # The `order` object from `db.query(Order)` should have these.

            # The `amount` for the email service is the refund_amount
            email_service.send_receipt(
                order=order, type_="refund", amount=float(refund_amount)
            )
            logger.info(
                f"Refund receipt email initiated for order {order.id} to {customer_email}"
            )
        except Exception as email_exc:
            logger.error(
                f"Failed to send refund receipt email for order {order.id}: {email_exc}"
            )
            # Do not fail the refund if email sending fails, but log it.
    else:
        logger.info(
            f"No customer email found for order {order.id}, skipping refund receipt email."
        )

    return RefundResponseSchema(
        id=new_refund.id,
        order_id=str(order.id),
        amount=new_refund.amount,
        reason=new_refund.reason,
        status=refund_status_message,  # This should reflect the actual outcome
        gateway_refund_id=gateway_refund_id,
        created_at=new_refund.created_at.isoformat(),
    )


@router.post("/{order_id}/email_receipt")
async def send_email_receipt(
    order_id: str,
    background_tasks: BackgroundTasks,
    current_restaurant_id: Optional[str] = Query(
        None, description="Restaurant ID for multi-location owners"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send or resend email receipt for an order.
    This endpoint is called by the frontend after payment completion or for manual resending.
    """
    # Validate restaurant access for multi-tenant
    await TenantSecurity.validate_restaurant_access(
        current_user, current_restaurant_id or current_user.restaurant_id, db=db
    )
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Get the order
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id
        )
        .first()
    )
    
    if not order:
        raise ResourceNotFoundException(
            message=f"Order {order_id} not found"
        )
    
    # Check if order has been paid
    if order.payment_status != "completed":
        raise ValidationException(
            message="Cannot send receipt for unpaid order"
        )
    
    # Check if customer email exists
    if not order.customer_email:
        raise ValidationException(
            message="No customer email available for this order"
        )
    
    # Get the payment amount
    payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order_id,
            Payment.status == "completed"
        )
        .first()
    )
    
    if not payment:
        raise ValidationException(
            message="No completed payment found for this order"
        )
    
    # Send receipt asynchronously with proper session handling
    try:
        # Serialize order data for background task
        order_data = serialize_order_for_background(order)
        background_tasks.add_task(
            send_receipt_with_logging,
            order_dict=order_data,
            type_="sale",
            amount=float(payment.amount)
        )
        
        logger.info(f"Receipt email queued for order {order.id} to {order.customer_email}")
        
        return APIResponseHelper.success(
            data={
                "message": f"Receipt will be sent to {order.customer_email}",
                "order_id": str(order.id),
                "email": order.customer_email
            }
        )
    except Exception as e:
        logger.error(f"Failed to queue receipt email for order {order.id}: {str(e)}")
        raise FynloException(
            message="Failed to send receipt email",
            status_code=500
        )
