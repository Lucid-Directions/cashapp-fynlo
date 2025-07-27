"""
Temporary auth fix that uses email instead of supabase_id
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
from app.schemas.auth import AuthVerifyResponse
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
    
    # Get Supabase client (will initialize if needed)
    client = supabase_admin or get_admin_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable."
        )
    
    try:
        # Verify token with Supabase Admin API
        user_response = client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )
        
        supabase_user = user_response.user
        logger.info(f"Successfully verified Supabase user: {supabase_user.email}")
        
        # Find or create user by EMAIL instead of supabase_id
        db_user = None
        try:
            db_user = db.query(User).filter(
                User.email == supabase_user.email
            ).first()
        except SQLAlchemyError as e:
            logger.error(f"Database query error: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Database error while retrieving user information"
            )
        
        if not db_user:
            # First time login - create user
            logger.info(f"First time login for user: {supabase_user.email}")
            
            try:
                # Create new user
                db_user = User(
                    id=uuid.uuid4(),
                    email=supabase_user.email,
                    username=supabase_user.email,  # Use email as username
                    first_name=supabase_user.user_metadata.get('first_name', ''),
                    last_name=supabase_user.user_metadata.get('last_name', ''),
                    role='restaurant_owner',  # Default role for new users
                    is_active=True,
                    last_login=datetime.utcnow()
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)
                logger.info(f"Successfully created new user with ID: {db_user.id}")
            except IntegrityError as e:
                logger.error(f"Integrity error creating user: {str(e)}")
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create user account"
                )
        else:
            # Update last login
            try:
                db_user.last_login = datetime.utcnow()
                db.commit()
            except SQLAlchemyError as e:
                logger.error(f"Error updating last login: {str(e)}")
                db.rollback()
        
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
            try:
                restaurant = db.query(Restaurant).filter(
                    Restaurant.id == db_user.restaurant_id
                ).first()
                
                if restaurant:
                    # Add default subscription info if missing
                    if not hasattr(restaurant, 'subscription_plan'):
                        subscription_plan = 'alpha'
                        subscription_status = 'trial'
                    else:
                        subscription_plan = restaurant.subscription_plan or 'alpha'
                        subscription_status = restaurant.subscription_status or 'trial'
                    
                    # Add restaurant info to response
                    response_data["user"]["restaurant_id"] = str(restaurant.id)
                    response_data["user"]["restaurant_name"] = restaurant.name
                    response_data["user"]["subscription_plan"] = subscription_plan
                    response_data["user"]["subscription_status"] = subscription_status
                    response_data["user"]["enabled_features"] = get_plan_features(subscription_plan)
            except SQLAlchemyError as e:
                logger.error(f"Error retrieving restaurant info: {str(e)}")
                db.rollback()
        else:
            # User has no restaurant yet - create a default one for restaurant owners
            if db_user.role == 'restaurant_owner':
                logger.info(f"Creating default restaurant for user: {db_user.id}")
                try:
                    default_restaurant = Restaurant(
                        id=uuid.uuid4(),
                        name=f"{db_user.first_name or 'My'} Restaurant",
                        email=db_user.email,
                        address={},  # Empty JSONB field
                        is_active=True
                    )
                    db.add(default_restaurant)
                    db_user.restaurant_id = default_restaurant.id
                    db.commit()
                    db.refresh(default_restaurant)
                    
                    # Add to response
                    response_data["user"]["restaurant_id"] = str(default_restaurant.id)
                    response_data["user"]["restaurant_name"] = default_restaurant.name
                    response_data["user"]["subscription_plan"] = 'alpha'
                    response_data["user"]["subscription_status"] = 'trial'
                    response_data["user"]["enabled_features"] = get_plan_features('alpha')
                    
                    logger.info(f"Successfully created default restaurant with ID: {default_restaurant.id}")
                except SQLAlchemyError as e:
                    logger.error(f"Error creating default restaurant: {str(e)}")
                    db.rollback()
        
        return response_data
        
    except HTTPException:
        raise
    except (AuthApiError, PostgrestAPIError) as e:
        logger.warning(f"Supabase AuthApiError: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed. Please sign in again."
        )
    except Exception as e:
        logger.error(f"Auth verification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Authentication service error"
        )