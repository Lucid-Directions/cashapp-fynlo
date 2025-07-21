"""
Supabase Authentication endpoints for Fynlo POS
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid
import logging

from app.core.database import get_db
from app.core.supabase import supabase_admin
from app.core.config import settings
from app.core.database import User, Restaurant
from app.schemas.auth import AuthVerifyResponse, RegisterRestaurantRequest
from app.core.feature_gate import get_plan_features

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_supabase_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Verify Supabase token and return user info with subscription details"""
    
    if not authorization:
        raise HTTPException(
            status_code=401, 
            detail="No authorization header provided"
        )
    
    # Extract token from "Bearer <token>" format
    token = authorization.replace("Bearer ", "")
    
    if not token or token == authorization:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format. Expected: Bearer <token>"
        )
    
    # Check if Supabase is configured
    if not supabase_admin:
        logger.error("Supabase admin client not initialized - checking environment")
        # Try to provide more specific error information
        import os
        has_url = bool(os.getenv("SUPABASE_URL"))
        has_key = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
        
        if not has_url or not has_key:
            missing = []
            if not has_url:
                missing.append("SUPABASE_URL")
            if not has_key:
                missing.append("SUPABASE_SERVICE_ROLE_KEY")
            logger.error(f"Missing environment variables: {', '.join(missing)}")
            raise HTTPException(
                status_code=503,
                detail="Authentication service not configured. Please contact support."
            )
        else:
            logger.error("Environment variables present but Supabase initialization failed")
            raise HTTPException(
                status_code=503,
                detail="Authentication service initialization error. Please try again later."
            )
    
    try:
        # Verify token with Supabase Admin API
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )
        
        # Find or create user in our database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            # First time login - create user
            # Check if this should be platform owner
            # For new users, platform owner role requires pre-configuration in the database
            # This prevents automatic platform owner creation from email alone
            is_platform_owner = False
            
            # New users default to restaurant_owner role
            # Platform owners must be manually configured by system administrators
            role = 'restaurant_owner'
            
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
            # Query restaurant with error handling for missing columns
            try:
                # Try to query all columns first
                restaurant = db.query(Restaurant).filter(
                    Restaurant.id == db_user.restaurant_id
                ).first()
                
                if restaurant:
                    # Convert to dict for consistent access
                    restaurant_dict = {
                        'id': restaurant.id,
                        'name': restaurant.name,
                        'platform_id': getattr(restaurant, 'platform_id', None),
                        'address': getattr(restaurant, 'address', {}),
                        'phone': getattr(restaurant, 'phone', None),
                        'email': getattr(restaurant, 'email', None),
                        'timezone': getattr(restaurant, 'timezone', 'UTC'),
                        'business_hours': getattr(restaurant, 'business_hours', {}),
                        'settings': getattr(restaurant, 'settings', {}),
                        'tax_configuration': getattr(restaurant, 'tax_configuration', {}),
                        'payment_methods': getattr(restaurant, 'payment_methods', {}),
                        'is_active': getattr(restaurant, 'is_active', True),
                        'created_at': getattr(restaurant, 'created_at', None),
                        'updated_at': getattr(restaurant, 'updated_at', None),
                        # Subscription fields with safe defaults
                        'subscription_plan': getattr(restaurant, 'subscription_plan', 'alpha'),
                        'subscription_status': getattr(restaurant, 'subscription_status', 'trial'),
                        'subscription_started_at': getattr(restaurant, 'subscription_started_at', None),
                        'subscription_expires_at': getattr(restaurant, 'subscription_expires_at', None),
                    }
                    restaurant = restaurant_dict
                else:
                    restaurant = None
                    
            except Exception as e:
                # If query fails due to missing columns, try minimal query
                logger.warning(f"Restaurant query failed, trying minimal query: {str(e)}")
                try:
                    from sqlalchemy import text
                    result = db.execute(text("""
                        SELECT id, name, is_active
                        FROM restaurants 
                        WHERE id = :restaurant_id
                    """), {"restaurant_id": str(db_user.restaurant_id)}).first()
                    
                    if result:
                        # Build minimal restaurant dict with defaults
                        restaurant = {
                            'id': result[0],
                            'name': result[1],
                            'is_active': result[2],
                            # Default values for missing fields
                            'subscription_plan': 'alpha',
                            'subscription_status': 'trial',
                            'subscription_started_at': None,
                            'subscription_expires_at': None,
                            'platform_id': None,
                            'address': {},
                            'phone': None,
                            'email': db_user.email,
                            'timezone': 'UTC',
                            'business_hours': {},
                            'settings': {},
                            'tax_configuration': {
                                "vatEnabled": True,
                                "vatRate": 20,
                                "serviceTaxEnabled": True,
                                "serviceTaxRate": 12.5
                            },
                            'payment_methods': {
                                "qrCode": {"enabled": True, "feePercentage": 1.2},
                                "cash": {"enabled": True, "requiresAuth": False},
                                "card": {"enabled": True, "feePercentage": 2.9},
                                "applePay": {"enabled": True, "feePercentage": 2.9},
                                "giftCard": {"enabled": True, "requiresAuth": True}
                            },
                            'created_at': None,
                            'updated_at': None
                        }
                    else:
                        restaurant = None
                except Exception as e2:
                    logger.error(f"Minimal restaurant query also failed: {str(e2)}")
                    restaurant = None
            
            if restaurant:
                # Sync subscription data from Supabase if available
                supabase_plan = supabase_user.user_metadata.get('subscription_plan')
                supabase_status = supabase_user.user_metadata.get('subscription_status')
                
                # Get current values with defaults from dict
                current_plan = restaurant.get('subscription_plan') if isinstance(restaurant, dict) else getattr(restaurant, 'subscription_plan', None)
                current_status = restaurant.get('subscription_status') if isinstance(restaurant, dict) else getattr(restaurant, 'subscription_status', None)
                
                # Update subscription data if needed
                needs_update = False
                update_data = {}
                
                if supabase_plan and supabase_plan != current_plan:
                    update_data['subscription_plan'] = supabase_plan
                    needs_update = True
                elif not current_plan:
                    update_data['subscription_plan'] = 'alpha'
                    needs_update = True
                
                if supabase_status and supabase_status != current_status:
                    update_data['subscription_status'] = supabase_status
                    needs_update = True
                elif not current_status:
                    update_data['subscription_status'] = 'trial'
                    needs_update = True
                
                if needs_update:
                    try:
                        db.query(Restaurant).filter(Restaurant.id == db_user.restaurant_id).update(update_data)
                        db.commit()
                        
                        # Update the local dict with new values
                        if isinstance(restaurant, dict):
                            restaurant.update(update_data)
                        else:
                            # Refresh ORM instance to get updated values
                            db.refresh(restaurant)
                    except Exception as e:
                        logger.warning(f"Could not update subscription data: {str(e)}")
                        # CRITICAL: Roll back failed transaction to avoid PendingRollbackError
                        db.rollback()
                        # Continue with existing data
                
                # Use potentially updated restaurant data
                if isinstance(restaurant, dict):
                    final_plan = restaurant.get('subscription_plan', 'alpha') or 'alpha'
                    final_status = restaurant.get('subscription_status', 'trial') or 'trial'
                    restaurant_id = restaurant['id']
                    restaurant_name = restaurant['name']
                else:
                    # For ORM instances, safely extract values to avoid re-queries
                    try:
                        # Extract all needed values at once to avoid multiple attribute accesses
                        restaurant_id = restaurant.id
                        restaurant_name = restaurant.name
                        # Use safe attribute access to avoid column-not-exist errors
                        final_plan = 'alpha'  # Default
                        final_status = 'trial'  # Default
                        
                        # Try to get actual values if columns exist
                        if hasattr(restaurant, 'subscription_plan'):
                            final_plan = restaurant.subscription_plan or 'alpha'
                        if hasattr(restaurant, 'subscription_status'):
                            final_status = restaurant.subscription_status or 'trial'
                    except Exception as e:
                        logger.warning(f"Error accessing restaurant attributes: {str(e)}")
                        # Fall back to safe defaults
                        restaurant_id = db_user.restaurant_id
                        restaurant_name = "Restaurant"
                        final_plan = 'alpha'
                        final_status = 'trial'
                
                response_data["user"]["restaurant_id"] = str(restaurant_id)
                response_data["user"]["restaurant_name"] = restaurant_name
                response_data["user"]["subscription_plan"] = final_plan
                response_data["user"]["subscription_status"] = final_status
                response_data["user"]["enabled_features"] = get_plan_features(final_plan)
        else:
            # User has no restaurant yet - check if we should create a default one
            if db_user.role == 'restaurant_owner':
                # Create a default restaurant for the user
                logger.info(f"Creating default restaurant for user with ID: {db_user.id}")
                default_restaurant = Restaurant(
                    id=uuid.uuid4(),
                    name=f"{db_user.first_name or 'My'} Restaurant",
                    email=db_user.email,
                    subscription_plan='alpha',
                    subscription_status='trial',
                    subscription_started_at=datetime.utcnow(),
                    is_active=True
                )
                db.add(default_restaurant)
                db_user.restaurant_id = default_restaurant.id
                db.commit()
                db.refresh(default_restaurant)
                
                response_data["user"]["restaurant_id"] = str(default_restaurant.id)
                response_data["user"]["restaurant_name"] = default_restaurant.name
                response_data["user"]["subscription_plan"] = 'alpha'
                response_data["user"]["subscription_status"] = 'trial'
                response_data["user"]["enabled_features"] = get_plan_features('alpha')
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        # Log error details securely (not to console in production)
        logger.error(f"Auth verification error: {type(e).__name__}: {str(e)}")
        
        # In development/testing, provide more details
        if settings.ENVIRONMENT in ["development", "testing", "local"]:
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
        
        # Check for specific Supabase errors
        if "invalid_grant" in str(e).lower():
            raise HTTPException(
                status_code=401,
                detail="Token has expired. Please sign in again."
            )
        elif "not found" in str(e).lower():
            raise HTTPException(
                status_code=401,
                detail="User not found. Please sign up first."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Authentication service error. Please try again later."
            )


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
        logger.error(f"Restaurant registration error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register restaurant")