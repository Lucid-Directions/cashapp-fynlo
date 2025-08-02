"""
Example endpoint showing proper RLS implementation
This file demonstrates how to use RLS session variable isolation
"""

<<<<<<< HEAD
from typing import List
from pydantic import BaseModel
=======
>>>>>>> origin/main
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db, Order, Product
from app.core.auth import get_current_user
from app.core.database import User
from app.middleware.rls_middleware import set_rls_context, get_rls_context
from app.core.responses import APIResponseHelper

router = APIRouter()

@router.get("/orders/with-rls")
async def get_orders_with_rls(
    db: Session = Depends(get_db),
    _rls: None = Depends(set_rls_context),  # This sets RLS context automatically
    current_user: User = Depends(get_current_user)
):
    """
    Example endpoint that uses RLS to filter orders by restaurant.
    The RLS context is automatically set based on the current user.
    """
    try:
        # Debug: Show current RLS context
        context = get_rls_context()
        
        # These queries will be automatically filtered by restaurant_id
        # if RLS policies are enabled in PostgreSQL
        orders = db.query(Order).filter(Order.restaurant_id == current_user.restaurant_id).all()
        
        # You can also check the session variables directly
        current_user_id = db.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
        current_restaurant_id = db.execute(text("SELECT current_setting('app.restaurant_id', true)")).scalar()
        
        return APIResponseHelper.success(
            data={
                "orders": [{"id": str(o.id), "total": float(o.total_amount)} for o in orders],
                "rls_context": {
                    "user_id": context.get('user_id'),
                    "restaurant_id": context.get('restaurant_id'),
                    "role": context.get('role')
                },
                "session_variables": {
                    "app.user_id": current_user_id,
                    "app.restaurant_id": current_restaurant_id
                }
            }
        )
    except Exception as e:
        return APIResponseHelper.error(f"Error fetching orders: {str(e)}")

@router.get("/products/count-by-restaurant")
async def count_products_by_restaurant(
    db: Session = Depends(get_db),
    _rls: None = Depends(set_rls_context),
    current_user: User = Depends(get_current_user)
):
    """
    Example showing how RLS ensures data isolation.
    Each user only sees their restaurant's product count.
    """
    # This query is automatically filtered by RLS
    product_count = db.query(Product).filter(
        Product.restaurant_id == current_user.restaurant_id
    ).count()
    
    return APIResponseHelper.success(
        data={
            "restaurant_id": str(current_user.restaurant_id),
            "product_count": product_count,
            "user_role": current_user.role
        }
    )

@router.post("/test-rls-isolation")
async def test_rls_isolation(
    db: Session = Depends(get_db),
    _rls: None = Depends(set_rls_context),
    current_user: User = Depends(get_current_user)
):
    """
    Test endpoint to verify RLS isolation is working correctly.
    This creates a test query and verifies session variables.
    """
    try:
        # Get current session variables
        session_info = db.execute(text("""
            SELECT 
                current_setting('app.user_id', true) as user_id,
                current_setting('app.restaurant_id', true) as restaurant_id,
                current_setting('app.user_role', true) as user_role,
                pg_backend_pid() as connection_pid
        """)).first()
        
        # Verify they match the current user
        assert session_info.user_id == str(current_user.id), "User ID mismatch"
        assert session_info.restaurant_id == str(current_user.restaurant_id), "Restaurant ID mismatch"
        assert session_info.user_role == current_user.role, "Role mismatch"
        
        return APIResponseHelper.success(
            data={
                "status": "RLS isolation verified",
                "session_variables": {
                    "user_id": session_info.user_id,
                    "restaurant_id": session_info.restaurant_id,
                    "role": session_info.user_role,
                    "connection_pid": session_info.connection_pid
                },
                "expected_values": {
                    "user_id": str(current_user.id),
                    "restaurant_id": str(current_user.restaurant_id),
                    "role": current_user.role
                }
            }
        )
    except AssertionError as e:
        return APIResponseHelper.error(f"RLS isolation check failed: {str(e)}", status_code=500)
    except Exception as e:
        return APIResponseHelper.error(f"Error testing RLS: {str(e)}", status_code=500)

# Example of using RLS in a background task
from app.middleware.rls_middleware import with_rls_context

@with_rls_context(restaurant_id="specific-restaurant-id")
async def process_restaurant_orders():
    """
    Background task that processes orders for a specific restaurant.
    The decorator ensures all database queries are filtered by restaurant.
    """
    db = SessionLocal()
    try:
        orders = db.query(Order).filter(Order.status == "pending").all()
        # Process orders...
        return len(orders)
    finally:
        db.close()