"""
Supabase Authentication endpoints for Fynlo POS
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional
from datetime import datetime
import uuid
import logging
from gotrue.errors import AuthApiError
from postgrest.exceptions import APIError as PostgrestAPIError

from app.core.database import get_db
from app.core.supabase import supabase_admin, get_admin_client
from app.core.config import settings
from app.core.database import User, Restaurant
from app.schemas.auth import AuthVerifyResponse, RegisterRestaurantRequest
from app.core.feature_gate import get_plan_features

logger = logging.getLogger(__name__)
router = APIRouter()

# Ensure Supabase client is properly initialized
if not supabase_admin:
    logger.warning("Supabase admin client not initialized at module load time")
    # The client will be initialized on first request if needed




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
    
    # Get Supabase client (will initialize if needed)
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error("Supabase admin client not available")
        logger.error(f"SUPABASE_URL set: {bool(settings.SUPABASE_URL)}")
        logger.error(f"SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable. Please check backend configuration."
        )
    
    try:
        # Verify token with Supabase Admin API
        logger.info(f"Verifying token with Supabase (token length: {len(token)})")
        logger.info(f"Token preview: {token[:20]}...{token[-20:]}")
        
        # Log Supabase client state
        logger.info(f"Supabase client URL: {client.supabase_url}")
        
        user_response = client.auth.get_user(token)
        
        # Check if we got a valid response
        if not user_response:
            logger.error("Supabase returned None response for get_user")
            raise HTTPException(
                status_code=503,
                detail="Authentication service returned invalid response"
            )
        
        supabase_user = user_response.user
        
        if not supabase_user:
            logger.warning("Supabase returned no user for the provided token")
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )
        
        # Convert Supabase user ID to string once
        supabase_user_id = str(supabase_user.id)
        logger.info(f"Successfully verified Supabase user: {supabase_user.email}")
        
        # Find or create user in our database with proper error handling
        db_user = None
        try:
            # Find user by Supabase ID (the correct approach)
            db_user = db.query(User).filter(
                User.supabase_id == supabase_user_id
            ).first()
            
            if not db_user:
                # Check if user exists by email (for backward compatibility)
                db_user = db.query(User).filter(
                    User.email == supabase_user.email
                ).first()
                
                # If found by email but missing supabase_id, update it
                if db_user and not db_user.supabase_id:
                    db_user.supabase_id = supabase_user_id
                    db.commit()
                    logger.info(f"Updated user {db_user.id} with Supabase ID: {supabase_user_id}")
        except SQLAlchemyError as e:
            logger.error(f"Database query error when finding user: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Database error while retrieving user information"
            )
        
        if not db_user:
            # First time login - create user with proper transaction handling
            logger.info(f"First time login for user: {supabase_user.email}")
            
            try:
                # Create new user with proper defaults
                db_user = User(
                    id=uuid.uuid4(),
                    supabase_id=supabase_user_id,  # Set Supabase ID properly
                    email=supabase_user.email,
                    username=supabase_user.email,  # Use email as username for now
                    first_name=supabase_user.user_metadata.get('first_name', ''),
                    last_name=supabase_user.user_metadata.get('last_name', ''),
                    role='restaurant_owner',  # Default role for new users
                    auth_provider='supabase',
                    is_active=True,
                    last_login=datetime.utcnow()
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)
                logger.info(f"Successfully created new user with ID: {db_user.id} and Supabase ID: {supabase_user_id}")
            except IntegrityError as e:
                logger.error(f"Integrity error creating user: {str(e)}")
                db.rollback()
                # Try to fetch the user again in case of race condition
                try:
                    db_user = db.query(User).filter(
                        User.supabase_id == supabase_user_id
                    ).first()
                    if not db_user:
                        # Also check by email
                        db_user = db.query(User).filter(
                            User.email == supabase_user.email
                        ).first()
                        if db_user and not db_user.supabase_id:
                            # Update the supabase_id if missing
                            db_user.supabase_id = supabase_user_id
                            db.commit()
                    if not db_user:
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to create user account. Please try again."
                        )
                except SQLAlchemyError as retry_error:
                    logger.error(f"Failed to fetch user after IntegrityError: {str(retry_error)}")
                    db.rollback()
                    raise HTTPException(
                        status_code=500,
                        detail="Database error while creating user account"
                    )
            except SQLAlchemyError as e:
                logger.error(f"Database error creating user: {str(e)}")
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Database error while creating user account"
                )
        else:
            # Update last login
            try:
                db_user.last_login = datetime.utcnow()
                db.commit()
            except SQLAlchemyError as e:
                logger.error(f"Error updating last login: {str(e)}")
                db.rollback()
                # Non-critical error, continue
        
        # Build response with proper UUID to string conversion
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
            try:
                restaurant = db.query(Restaurant).filter(
                    Restaurant.id == db_user.restaurant_id
                ).first()
                
                if restaurant:
                    # Sync subscription data from Supabase if available
                    supabase_plan = supabase_user.user_metadata.get('subscription_plan')
                    supabase_status = supabase_user.user_metadata.get('subscription_status')
                    
                    # Update restaurant subscription info if needed
                    update_needed = False
                    
                    if supabase_plan and restaurant.subscription_plan != supabase_plan:
                        restaurant.subscription_plan = supabase_plan
                        update_needed = True
                    elif not restaurant.subscription_plan:
                        restaurant.subscription_plan = 'alpha'
                        update_needed = True
                    
                    if supabase_status and restaurant.subscription_status != supabase_status:
                        restaurant.subscription_status = supabase_status
                        update_needed = True
                    elif not restaurant.subscription_status:
                        restaurant.subscription_status = 'trial'
                        update_needed = True
                    
                    if update_needed:
                        try:
                            db.commit()
                        except SQLAlchemyError as e:
                            logger.error(f"Error updating restaurant subscription: {str(e)}")
                            db.rollback()
                    
                    # Add restaurant info to response with proper string conversion
                    response_data["user"]["restaurant_id"] = str(restaurant.id)
                    response_data["user"]["restaurant_name"] = restaurant.name
                    response_data["user"]["subscription_plan"] = restaurant.subscription_plan or 'alpha'
                    response_data["user"]["subscription_status"] = restaurant.subscription_status or 'trial'
                    response_data["user"]["enabled_features"] = get_plan_features(
                        restaurant.subscription_plan or 'alpha'
                    )
            except SQLAlchemyError as e:
                logger.error(f"Error retrieving restaurant info: {str(e)}")
                db.rollback()
                # Continue without restaurant info rather than failing
        else:
            # User has no restaurant yet - check if we should create a default one
            if db_user.role == 'restaurant_owner':
                # Create a default restaurant for the user with proper error handling
                logger.info(f"Creating default restaurant for user: {db_user.id}")
                try:
                    default_restaurant = Restaurant(
                        id=uuid.uuid4(),
                        name=f"{db_user.first_name or 'My'} Restaurant",
                        email=db_user.email,
                        address={},  # Empty JSONB field
                        subscription_plan='alpha',
                        subscription_status='trial',
                        subscription_started_at=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(default_restaurant)
                    db_user.restaurant_id = default_restaurant.id
                    db.commit()
                    db.refresh(default_restaurant)
                    
                    # Add to response with proper string conversion
                    response_data["user"]["restaurant_id"] = str(default_restaurant.id)
                    response_data["user"]["restaurant_name"] = default_restaurant.name
                    response_data["user"]["subscription_plan"] = 'alpha'
                    response_data["user"]["subscription_status"] = 'trial'
                    response_data["user"]["enabled_features"] = get_plan_features('alpha')
                    
                    logger.info(f"Successfully created default restaurant with ID: {default_restaurant.id}")
                except SQLAlchemyError as e:
                    logger.error(f"Error creating default restaurant: {str(e)}")
                    db.rollback()
                    # Continue without restaurant rather than failing
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except (AuthApiError, PostgrestAPIError) as e:
        # Handle Supabase authentication errors
        error_msg = str(e)
        logger.warning(f"Supabase AuthApiError: {error_msg}")
        logger.warning(f"Error type: {type(e).__name__}")
        
        # Try to get more details from the error
        if hasattr(e, 'code'):
            logger.warning(f"Error code: {e.code}")
        if hasattr(e, 'message'):
            logger.warning(f"Error message: {e.message}")
        if hasattr(e, 'response'):
            logger.warning(f"Error response: {e.response}")
        
        error_msg_lower = error_msg.lower()
        if "invalid jwt" in error_msg_lower or "malformed" in error_msg_lower:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        elif "expired" in error_msg_lower:
            raise HTTPException(
                status_code=401,
                detail="Token has expired. Please sign in again."
            )
        elif "not found" in error_msg_lower:
            raise HTTPException(
                status_code=401,
                detail="User not found. Please sign up first."
            )
        else:
            # Log unexpected auth errors with full details
            logger.error(f"Unexpected Supabase auth error: {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Authentication failed. Please sign in again."
            )
    except Exception as e:
        # Check if this is actually an AuthApiError wrapped in another exception
        error_str = str(e)
        logger.error(f"Auth verification error - Type: {type(e).__name__}, Message: {error_str}")
        
        # Check for common Supabase error patterns in the exception message
        if "invalid jwt" in error_str.lower() or "jwt" in error_str.lower():
            logger.warning("Detected JWT error in generic exception, treating as auth error")
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        elif "user not found" in error_str.lower():
            logger.warning("Detected user not found error in generic exception")
            raise HTTPException(
                status_code=401,
                detail="User not found. Please sign up first."
            )
        
        # Log the full exception type chain for debugging
        import traceback
        logger.error(f"Full exception details: {traceback.format_exc()}")
        
        # Check if it's a Supabase initialization error
        if "supabase" in error_str.lower() and ("missing" in error_str.lower() or "environment" in error_str.lower()):
            raise HTTPException(
                status_code=503,
                detail="Authentication service configuration error. Please contact support."
            )
        
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
    
    # Get Supabase client (will initialize if needed)
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error("Supabase admin client not available")
        logger.error(f"SUPABASE_URL set: {bool(settings.SUPABASE_URL)}")
        logger.error(f"SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable. Please check backend configuration."
        )
    
    try:
        # Verify token
        user_response = client.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Convert Supabase user ID to string once
        supabase_user_id = str(supabase_user.id)
        
        # Get user from database by Supabase ID
        db_user = db.query(User).filter(
            User.supabase_id == supabase_user_id
        ).first()
        
        if not db_user:
            # Check by email for backward compatibility
            db_user = db.query(User).filter(
                User.email == supabase_user.email
            ).first()
            if db_user and not db_user.supabase_id:
                # Update the supabase_id if missing
                db_user.supabase_id = supabase_user_id
                db.commit()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user already has a restaurant
        if db_user.restaurant_id:
            raise HTTPException(status_code=400, detail="User already has a restaurant")
        
        # Get subscription info from Supabase user metadata or default to alpha
        subscription_plan = supabase_user.user_metadata.get('subscription_plan', 'alpha')
        subscription_status = supabase_user.user_metadata.get('subscription_status', 'trial')
        
        # Create restaurant with proper error handling
        try:
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
            
            # Link user to restaurant
            db_user.restaurant_id = restaurant.id
            if db_user.role not in ['platform_owner', 'restaurant_owner']:
                db_user.role = 'restaurant_owner'
            
            db.commit()
            db.refresh(restaurant)
            
            return {
                "success": True,
                "restaurant_id": str(restaurant.id),
                "subscription_plan": subscription_plan,
                "subscription_status": subscription_status,
                "message": "Restaurant registered successfully"
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error creating restaurant: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to register restaurant. Please try again."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restaurant registration error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register restaurant")