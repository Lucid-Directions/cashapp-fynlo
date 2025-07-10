"""
Supabase Authentication endpoints for Fynlo POS
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.supabase import supabase_admin
from app.core.config import settings
from app.core.database import User, Restaurant
from app.schemas.auth import AuthVerifyResponse, RegisterRestaurantRequest

router = APIRouter()


def get_plan_features(plan: str) -> list[str]:
    """Get enabled features for a subscription plan"""
    features = {
        'alpha': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports'
        ],
        'beta': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports',
            'inventory_management',
            'staff_management',
            'advanced_reports',
            'table_management',
            'customer_database'
        ],
        'omega': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports',
            'inventory_management',
            'staff_management',
            'advanced_reports',
            'table_management',
            'customer_database',
            'multi_location',
            'api_access',
            'custom_branding',
            'priority_support',
            'advanced_analytics',
            'unlimited_staff'
        ]
    }
    return features.get(plan, features['alpha'])


@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_supabase_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Verify Supabase token and return user info with subscription details"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    # Extract token from "Bearer <token>" format
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify token with Supabase Admin API
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Find or create user in our database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            # First time login - create user
            # Check if this should be platform owner
            is_platform_owner = (supabase_user.email == settings.PLATFORM_OWNER_EMAIL)
            
            # Determine role based on email or default to restaurant_owner
            role = 'platform_owner' if is_platform_owner else 'restaurant_owner'
            
            db_user = User(
                id=uuid.uuid4(),
                supabase_id=str(supabase_user.id),
                email=supabase_user.email,
                first_name=supabase_user.user_metadata.get('first_name', ''),
                last_name=supabase_user.user_metadata.get('last_name', ''),
                role=role,
                auth_provider='supabase',
                is_active=True,
                last_login=datetime.utcnow()
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        else:
            # Update last login
            db_user.last_login = datetime.utcnow()
            db.commit()
        
        # Build response
        response_data = {
            "user": {
                "id": str(db_user.id),
                "email": db_user.email,
                "name": f"{db_user.first_name} {db_user.last_name}".strip() or db_user.email,
                "is_platform_owner": db_user.role == 'platform_owner',
                "role": db_user.role
            }
        }
        
        # Add restaurant info if user has one
        if db_user.restaurant_id:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == db_user.restaurant_id
            ).first()
            
            if restaurant:
                # Sync subscription data from Supabase if available
                supabase_plan = supabase_user.user_metadata.get('subscription_plan')
                supabase_status = supabase_user.user_metadata.get('subscription_status')
                
                # Get current values with defaults
                current_plan = getattr(restaurant, 'subscription_plan', None)
                current_status = getattr(restaurant, 'subscription_status', None)
                
                if supabase_plan and supabase_plan != current_plan:
                    restaurant.subscription_plan = supabase_plan
                    db.commit()
                elif not current_plan:
                    # Set default if null
                    restaurant.subscription_plan = 'alpha'
                    db.commit()
                
                if supabase_status and supabase_status != current_status:
                    restaurant.subscription_status = supabase_status
                    db.commit()
                elif not current_status:
                    # Set default if null
                    restaurant.subscription_status = 'trial'
                    db.commit()
                
                response_data["user"]["restaurant_id"] = str(restaurant.id)
                response_data["user"]["restaurant_name"] = restaurant.name
                response_data["user"]["subscription_plan"] = getattr(restaurant, 'subscription_plan', 'alpha') or 'alpha'
                response_data["user"]["subscription_status"] = getattr(restaurant, 'subscription_status', 'trial') or 'trial'
                response_data["user"]["enabled_features"] = get_plan_features(
                    getattr(restaurant, 'subscription_plan', 'alpha') or 'alpha'
                )
        
        return response_data
        
    except Exception as e:
        print(f"Auth verification error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register-restaurant")
async def register_restaurant(
    data: RegisterRestaurantRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Register a new restaurant after Supabase signup"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify token
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user already has a restaurant
        if db_user.restaurant_id:
            raise HTTPException(status_code=400, detail="User already has a restaurant")
        
        # Get subscription info from Supabase user metadata or default to alpha
        subscription_plan = supabase_user.user_metadata.get('subscription_plan', 'alpha')
        subscription_status = supabase_user.user_metadata.get('subscription_status', 'trial')
        
        # Create restaurant
        restaurant = Restaurant(
            id=uuid.uuid4(),
            name=data.restaurant_name,
            email=supabase_user.email,
            phone=data.phone,
            address={"street": data.address} if data.address else {},
            subscription_plan=subscription_plan,
            subscription_status=subscription_status,
            subscription_started_at=datetime.utcnow(),
            is_active=True
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        
        # Link user to restaurant
        db_user.restaurant_id = restaurant.id
        if db_user.role not in ['platform_owner', 'restaurant_owner']:
            db_user.role = 'restaurant_owner'
        db.commit()
        
        return {
            "success": True,
            "restaurant_id": str(restaurant.id),
            "subscription_plan": subscription_plan,
            "subscription_status": subscription_status,
            "message": "Restaurant registered successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Restaurant registration error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register restaurant")