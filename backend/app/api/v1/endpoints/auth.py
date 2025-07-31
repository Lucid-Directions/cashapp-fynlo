"""
Supabase Authentication endpoints for Fynlo POS
"""

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import Optional
from datetime import datetime
import uuid
import logging
from gotrue.errors import AuthApiError
from postgrest.exceptions import APIError as PostgrestAPIError

from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationException,
    FynloException,
    ResourceNotFoundException,
    ValidationException
)
from app.core.supabase import supabase_admin, get_admin_client
from app.core.config import settings
from app.core.database import User, Restaurant
from app.schemas.auth import AuthVerifyResponse, RegisterRestaurantRequest
from app.core.feature_gate import get_plan_features
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.middleware.rate_limit_middleware import limiter, AUTH_RATE

logger = logging.getLogger(__name__)
router = APIRouter()

# Ensure Supabase client is properly initialized
if not supabase_admin:
    logger.warning("Supabase admin client not initialized at module load time")
    # The client will be initialized on first request if needed


def ensure_uuid(value) -> uuid.UUID:
    """Convert string or UUID to UUID object, handling both types safely"""
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid UUID format: {value}")
        raise ValueError(f"Invalid UUID format: {value}")




@router.post("/verify", response_model=AuthVerifyResponse)
@limiter.limit(AUTH_RATE)
async def verify_supabase_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Verify Supabase token and return user info with subscription details"""
    
    if not authorization:
        raise AuthenticationException(message="No authorization header provided")
    
    # Extract token from "Bearer <token>" format
    token = authorization.replace("Bearer ", "")
    
    if not token or token == authorization:
        raise ValidationException(message="Invalid authorization format. Expected: Bearer <token>", field="authorization")
    
    # Get Supabase client (will initialize if needed)
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error("Supabase admin client not available")
        logger.error(f"SUPABASE_URL set: {bool(settings.SUPABASE_URL)}")
        logger.error(f"SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
        raise AuthenticationException(message="Authentication service temporarily unavailable. Please check backend configuration.")
    
    try:
        # Verify token with Supabase Admin API
        logger.info(f"Verifying token with Supabase (token length: {len(token)})")
        # Never log token content for security reasons
        
        # Log Supabase client state
        logger.info(f"Supabase client URL: {client.supabase_url}")
        
        user_response = client.auth.get_user(token)
        
        # Check if we got a valid response
        if not user_response:
            logger.error("Supabase returned None response for get_user")
            raise AuthenticationException(message="Authentication service returned invalid response")
        
        supabase_user = user_response.user
        
        if not supabase_user:
            logger.warning("Supabase returned no user for the provided token")
            raise ValidationException(message="Invalid or expired token", field="token")
        
        logger.info(f"Successfully verified Supabase user: {supabase_user.email}")
        
        # Find or create user in our database with proper error handling
        db_user = None
        try:
            # Use supabase_id for secure lookup
            db_user = db.query(User).filter(
                User.supabase_id == supabase_user.id
            ).first()
            
            if not db_user:
                # Check if user exists by email (for backward compatibility)
                db_user = db.query(User).filter(
                    User.email == supabase_user.email
                ).first()
                
                # If found by email but missing supabase_id, update it
                if db_user and not db_user.supabase_id:
                    db_user.supabase_id = supabase_user.id  # Use UUID object, not string
                    db.commit()
                    logger.info(f"Updated user {db_user.id} with Supabase ID: {supabase_user.id}")
        except SQLAlchemyError as e:
            logger.error(f"Database query error when finding user: {str(e)}")
            db.rollback()
            raise FynloException(message="Database error while retrieving user information", status_code=500)
        
        if not db_user:
            # First time login - create user with proper transaction handling
            logger.info(f"First time login for user: {supabase_user.email}")
            
            try:
                # Create new user with proper defaults
                # Safely access user_metadata with null check
                user_metadata = supabase_user.user_metadata or {}
                
                db_user = User(
                    id=uuid.uuid4(),
                    email=supabase_user.email,
                    username=supabase_user.email,  # Use email as username
                    supabase_id=supabase_user.id,  # Store the Supabase ID for secure lookups
                    first_name=user_metadata.get('first_name', ''),
                    last_name=user_metadata.get('last_name', ''),
                    role='restaurant_owner',  # Default role for new users
                    auth_provider='supabase',
                    is_active=True,
                    last_login=datetime.utcnow()
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)
                logger.info(f"Successfully created new user with ID: {db_user.id} and Supabase ID: {supabase_user.id}")
            except IntegrityError as e:
                logger.error(f"Integrity error creating user: {str(e)}")
                db.rollback()
                # Try to fetch the user again in case of race condition
                try:
                    db_user = db.query(User).filter(
                        User.supabase_id == supabase_user.id
                    ).first()
                    if not db_user:
                        # Also check by email
                        db_user = db.query(User).filter(
                            User.email == supabase_user.email
                        ).first()
                        if db_user and not db_user.supabase_id:
                            # Update the supabase_id if missing
                            try:
                                db_user.supabase_id = supabase_user.id  # Use UUID object, not string
                                db.commit()
                                logger.info(f"Updated user {db_user.id} with Supabase ID in retry path")
                            except SQLAlchemyError as update_error:
                                logger.error(f"Failed to update supabase_id in retry path: {str(update_error)}")
                                db.rollback()
                                # Continue with the user even if update fails
                    if not db_user:
                        raise FynloException(message="Failed to create user account. Please try again.", status_code=500)
                except SQLAlchemyError as retry_error:
                    logger.error(f"Failed to fetch user after IntegrityError: {str(retry_error)}")
                    db.rollback()
                    raise FynloException(message="Database error while creating user account", status_code=500)
            except SQLAlchemyError as e:
                logger.error(f"Database error creating user: {str(e)}")
                db.rollback()
                raise FynloException(message="Database error while creating user account", status_code=500)
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
                    # Safely access user_metadata with null check
                    user_metadata = supabase_user.user_metadata or {}
                    supabase_plan = user_metadata.get('subscription_plan')
                    supabase_status = user_metadata.get('subscription_status')
                    
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
            # User has no restaurant yet - they need to complete onboarding
            logger.info(f"User {db_user.id} has no restaurant - needs onboarding")
            
            # Get subscription plan from Supabase user metadata
            # Safely access user_metadata with null check
            user_metadata = supabase_user.user_metadata or {}
            subscription_plan = user_metadata.get('subscription_plan', 'alpha')
            subscription_status = user_metadata.get('subscription_status', 'trial')
            
            logger.info(f"User {db_user.id} has subscription plan: {subscription_plan} (status: {subscription_status})")
            
            # Return subscription info and features based on plan even without restaurant
            response_data["user"]["needs_onboarding"] = True
            response_data["user"]["subscription_plan"] = subscription_plan
            response_data["user"]["subscription_status"] = subscription_status
            response_data["user"]["enabled_features"] = get_plan_features(subscription_plan)
            
            # Add onboarding progress tracking
            response_data["user"]["onboarding_progress"] = {
                "current_step": 0,
                "completed_steps": [],
                "total_steps": 9,
                "resume_at_step": 1
            }
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except (AuthApiError, PostgrestAPIError) as e:
        # Handle Supabase authentication errors
        error_msg = str(e)
        logger.warning(f"Supabase AuthApiError: {error_msg}")
        logger.warning(f"Error type: {type(e).__name__}")
        
        # Create audit logger
        audit_logger = AuditLoggerService(db)
        
        # Get client info for audit
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Try to get more details from the error
        if hasattr(e, 'code'):
            logger.warning(f"Error code: {e.code}")
        if hasattr(e, 'message'):
            logger.warning(f"Error message: {e.message}")
        if hasattr(e, 'response'):
            logger.warning(f"Error response: {e.response}")
        
        error_msg_lower = error_msg.lower()
        if "invalid jwt" in error_msg_lower or "malformed" in error_msg_lower:
            # Log failed authentication attempt
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Invalid JWT token presented",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "invalid_jwt", "token_prefix": authorization[:20] + "..." if authorization else None},
                risk_score=70  # High risk - invalid token
            )
            raise AuthenticationException(message="Invalid authentication token")
        elif "expired" in error_msg_lower:
            # Log expired token attempt
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Expired JWT token presented",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "expired_token"},
                risk_score=30  # Low risk - just expired
            )
            raise AuthenticationException(message="Token has expired. Please sign in again.")
        elif "not found" in error_msg_lower:
            # Log user not found attempt
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Authentication attempt for non-existent user",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "user_not_found"},
                risk_score=50  # Medium risk
            )
            raise ResourceNotFoundException(resource="User", message="User not found. Please sign up first.")
        else:
            # Log unexpected auth errors with full details
            logger.error(f"Unexpected Supabase auth error: {type(e).__name__}: {str(e)}")
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Authentication failed with unexpected error",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "unexpected_auth_error", "error_type": type(e).__name__},
                risk_score=80  # High risk - unexpected error
            )
            raise AuthenticationException(message="Authentication failed. Please sign in again.")
    except Exception as e:
        # Check if this is actually an AuthApiError wrapped in another exception
        error_str = str(e)
        logger.error(f"Auth verification error - Type: {type(e).__name__}, Message: {error_str}")
        
        # Create audit logger for generic exceptions
        audit_logger = AuditLoggerService(db)
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Check for common Supabase error patterns in the exception message
        if "invalid jwt" in error_str.lower() or "jwt" in error_str.lower():
            logger.warning("Detected JWT error in generic exception, treating as auth error")
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="JWT error detected in generic exception",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "jwt_error_wrapped", "exception_type": type(e).__name__},
                risk_score=70
            )
            raise AuthenticationException(message="Invalid authentication token")
        elif "user not found" in error_str.lower():
            logger.warning("Detected user not found error in generic exception")
            await audit_logger.create_audit_log(
                event_type=AuditEventType.AUTHENTICATION,
                event_status=AuditEventStatus.FAILURE,
                action_performed="User not found error in generic exception",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "user_not_found_wrapped", "exception_type": type(e).__name__},
                risk_score=50
            )
            raise ResourceNotFoundException(resource="User", message="User not found. Please sign up first.")
        
        # Log the full exception type chain for debugging
        import traceback
        logger.error(f"Full exception details: {traceback.format_exc()}")
        
        # Check if it's a Supabase initialization error
        if "supabase" in error_str.lower() and ("missing" in error_str.lower() or "environment" in error_str.lower()):
            await audit_logger.create_audit_log(
                event_type=AuditEventType.SYSTEM_EVENT,
                event_status=AuditEventStatus.FAILURE,
                action_performed="Authentication service configuration error",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"error": "service_config_error", "exception_type": type(e).__name__},
                risk_score=90  # Very high risk - config error
            )
            raise AuthenticationException(message="Authentication service configuration error. Please contact support.")
        
        # Log generic authentication service error
        await audit_logger.create_audit_log(
            event_type=AuditEventType.AUTHENTICATION,
            event_status=AuditEventStatus.FAILURE,
            action_performed="Authentication service error",
            ip_address=client_ip,
            user_agent=user_agent,
            details={"error": "service_error", "exception_type": type(e).__name__, "message": error_str[:200]},
            risk_score=60
        )
        
        raise AuthenticationException(message="Authentication service error. Please try again later.")


@router.post("/register-restaurant")
@limiter.limit(AUTH_RATE)
async def register_restaurant(
    request: Request,
    data: RegisterRestaurantRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Register a new restaurant after Supabase signup"""
    
    if not authorization:
        raise AuthenticationException(message="No authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    # Get Supabase client (will initialize if needed)
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error("Supabase admin client not available")
        logger.error(f"SUPABASE_URL set: {bool(settings.SUPABASE_URL)}")
        logger.error(f"SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
        raise AuthenticationException(message="Authentication service temporarily unavailable. Please check backend configuration.")
    
    try:
        # Verify token
        user_response = client.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise AuthenticationException(message="Invalid token")
        
        # Get user from database by Supabase ID
        db_user = db.query(User).filter(
            User.supabase_id == supabase_user.id
        ).first()
        
        if not db_user:
            # Check by email for backward compatibility
            db_user = db.query(User).filter(
                User.email == supabase_user.email
            ).first()
            if db_user and not db_user.supabase_id:
                # Update the supabase_id if missing
                try:
                    db_user.supabase_id = supabase_user.id  # Use UUID object, not string
                    db.commit()
                    logger.info(f"Updated user {db_user.id} with Supabase ID during registration")
                except SQLAlchemyError as e:
                    logger.error(f"Failed to update user supabase_id during registration: {str(e)}")
                    db.rollback()
                    # Continue with registration even if update fails
        
        if not db_user:
            raise ResourceNotFoundException(resource="User")
        
        # Check if user already has a restaurant
        if db_user.restaurant_id:
            raise ValidationException(message="User already has a restaurant")
        
        # Get subscription info from Supabase user metadata or default to alpha
        # Safely access user_metadata with null check
        user_metadata = supabase_user.user_metadata or {}
        subscription_plan = user_metadata.get('subscription_plan', 'alpha')
        subscription_status = user_metadata.get('subscription_status', 'trial')
        
        # Create restaurant with proper error handling
        try:
            # Get default platform if user doesn't have one
            platform_id = str(db_user.platform_id) if db_user.platform_id else None
            if not platform_id:
                from app.core.database import Platform
                default_platform = db.query(Platform).filter(Platform.name == "Fynlo").first()
                if default_platform:
                    platform_id = str(default_platform.id)
                else:
                    # No platform found - this is a critical error
                    raise FynloException(message="No platform found. Please contact support.", status_code=500)
            
            # Create properly structured address
            address_data = {
                "street": data.address or "",
                "city": "",
                "state": "",
                "zipCode": "",
                "country": "UK"  # Default to UK
            }
            
            # Validate inputs
            from app.core.validation import (
                validate_model_jsonb_fields,
                validate_email,
                validate_phone,
                sanitize_string,
                ValidationError as ValidationErr
            )
            
            # Sanitize restaurant name
            sanitized_name = sanitize_string(data.restaurant_name, 255)
            if not sanitized_name:
                raise ValidationException(message="Restaurant name cannot be empty", field="name")
            
            # Validate phone if provided
            if data.phone and not validate_phone(data.phone):
                raise ValidationException(message="Invalid phone number format", field="phone")
            
            # Validate address structure
            try:
                validated_address = validate_model_jsonb_fields('restaurant', 'address', address_data)
            except ValidationErr as e:
                raise ValidationException(message=f"Invalid address format: {str(e)}")
            
            restaurant = Restaurant(
                id=uuid.uuid4(),
                platform_id=platform_id,
                name=sanitized_name,
                email=supabase_user.email,
                phone=data.phone,
                address=validated_address,
                timezone="Europe/London",  # Default timezone
                business_hours={
                    "monday": {"open": "09:00", "close": "22:00"},
                    "tuesday": {"open": "09:00", "close": "22:00"},
                    "wednesday": {"open": "09:00", "close": "22:00"},
                    "thursday": {"open": "09:00", "close": "22:00"},
                    "friday": {"open": "09:00", "close": "23:00"},
                    "saturday": {"open": "09:00", "close": "23:00"},
                    "sunday": {"open": "10:00", "close": "21:00"}
                },
                settings={
                    "currency": "GBP",
                    "date_format": "DD/MM/YYYY",
                    "time_format": "24h",
                    "allow_tips": True,
                    "auto_gratuity_percentage": 12.5,
                    "print_receipt_default": True
                },
                subscription_plan=subscription_plan,
                subscription_status=subscription_status,
                subscription_started_at=datetime.utcnow(),
                # Set default configurations
                tax_configuration={
                    "vat_rate": 0.20,
                    "included_in_price": True,
                    "tax_number": ""
                },
                payment_methods={
                    "cash": True,
                    "card": True,
                    "qr_code": True,
                    "apple_pay": True,
                    "google_pay": True
                },
                is_active=True
            )
            db.add(restaurant)
            
            # Link user to restaurant and update user state
            db_user.restaurant_id = restaurant.id
            db_user.needs_onboarding = False  # Mark onboarding as complete
            db_user.updated_at = datetime.utcnow()
            
            if db_user.role not in ['platform_owner', 'restaurant_owner']:
                db_user.role = 'restaurant_owner'
            
            db.commit()
            db.refresh(restaurant)
            db.refresh(db_user)
            
            # Import feature gates
            from app.core.feature_gate import get_plan_features
            
            return {
                "success": True,
                "restaurant_id": str(restaurant.id),
                "restaurant_name": restaurant.name,
                "subscription_plan": subscription_plan,
                "subscription_status": subscription_status,
                "enabled_features": get_plan_features(subscription_plan),
                "needs_onboarding": False,
                "message": "Restaurant registered successfully"
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error creating restaurant: {str(e)}")
            db.rollback()
            raise FynloException(message="Failed to register restaurant. Please try again.", status_code=500)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restaurant registration error: {str(e)}")
        db.rollback()
        raise FynloException(message="Failed to register restaurant", status_code=500)