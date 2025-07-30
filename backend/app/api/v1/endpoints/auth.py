"""
Supabase Authentication endpoints for Fynlo POS
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
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
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.core.exceptions import AuthenticationException, BusinessLogicException, FynloException, ResourceNotFoundException, ValidationException
logger = logging.getLogger(__name__)
router = APIRouter()
if not supabase_admin:
    logger.warning('Supabase admin client not initialized at module load time')

def ensure_uuid(value) -> uuid.UUID:
    """Convert string or UUID to UUID object, handling both types safely"""
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError) as e:
        logger.error(f'Invalid UUID format: {value}')
        raise ValueError(f'Invalid UUID format: {value}')

@router.post('/verify', response_model=AuthVerifyResponse)
async def verify_supabase_user(request: Request, authorization: Optional[str]=Header(None), db: Session=Depends(get_db)):
    """Verify Supabase token and return user info with subscription details"""
    if not authorization:
        raise AuthenticationException(message="No authorization header provided")
    token = authorization.replace('Bearer ', '')
    if not token or token == authorization:
        raise AuthenticationException(message="Invalid authorization format. Expected: Bearer <token>")
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error('Supabase admin client not available')
        logger.error(f'SUPABASE_URL set: {bool(settings.SUPABASE_URL)}')
        logger.error(f'SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}')
        raise FynloException(message='Authentication service temporarily unavailable. Please check backend configuration.', code='INTERNAL_ERROR')
    try:
        logger.info(f'Verifying token with Supabase (token length: {len(token)})')
        logger.info(f'Supabase client URL: {client.supabase_url}')
        user_response = client.auth.get_user(token)
        if not user_response:
            logger.error('Supabase returned None response for get_user')
            raise FynloException(message='Authentication service returned invalid response', code='INTERNAL_ERROR')
        supabase_user = user_response.user
        if not supabase_user:
            logger.warning('Supabase returned no user for the provided token')
            raise AuthenticationException(message='Invalid or expired token', code='TOKEN_EXPIRED')
        logger.info(f'Successfully verified Supabase user: {supabase_user.email}')
        db_user = None
        try:
            db_user = db.query(User).filter(User.supabase_id == supabase_user.id).first()
            if not db_user:
                db_user = db.query(User).filter(User.email == supabase_user.email).first()
                if db_user and (not db_user.supabase_id):
                    db_user.supabase_id = supabase_user.id
                    db.commit()
                    logger.info(f'Updated user {db_user.id} with Supabase ID: {supabase_user.id}')
        except SQLAlchemyError as e:
            logger.error(f'Database query error when finding user: {str(e)}')
            db.rollback()
            raise FynloException(message='Database error while retrieving user information', code='INTERNAL_ERROR')
        if not db_user:
            logger.info(f'First time login for user: {supabase_user.email}')
            try:
                user_metadata = supabase_user.user_metadata or {}
                db_user = User(id=uuid.uuid4(), email=supabase_user.email, username=supabase_user.email, supabase_id=supabase_user.id, first_name=user_metadata.get('first_name', ''), last_name=user_metadata.get('last_name', ''), role='restaurant_owner', auth_provider='supabase', is_active=True, last_login=datetime.utcnow())
                db.add(db_user)
                db.commit()
                db.refresh(db_user)
                logger.info(f'Successfully created new user with ID: {db_user.id} and Supabase ID: {supabase_user.id}')
            except IntegrityError as e:
                logger.error(f'Integrity error creating user: {str(e)}')
                db.rollback()
                try:
                    db_user = db.query(User).filter(User.supabase_id == supabase_user.id).first()
                    if not db_user:
                        db_user = db.query(User).filter(User.email == supabase_user.email).first()
                        if db_user and (not db_user.supabase_id):
                            try:
                                db_user.supabase_id = supabase_user.id
                                db.commit()
                                logger.info(f'Updated user {db_user.id} with Supabase ID in retry path')
                            except SQLAlchemyError as update_error:
                                logger.error(f'Failed to update supabase_id in retry path: {str(update_error)}')
                                db.rollback()
                    if not db_user:
                        raise FynloException(message='Failed to create user account. Please try again.', code='INTERNAL_ERROR')
                except SQLAlchemyError as retry_error:
                    logger.error(f'Failed to fetch user after IntegrityError: {str(retry_error)}')
                    db.rollback()
                    raise FynloException(message='Database error while creating user account', code='INTERNAL_ERROR')
            except SQLAlchemyError as e:
                logger.error(f'Database error creating user: {str(e)}')
                db.rollback()
                raise FynloException(message='Database error while creating user account', code='INTERNAL_ERROR')
        else:
            try:
                db_user.last_login = datetime.utcnow()
                db.commit()
            except SQLAlchemyError as e:
                logger.error(f'Error updating last login: {str(e)}')
                db.rollback()
        response_data = {'user': {'id': str(db_user.id), 'email': db_user.email, 'name': f'{db_user.first_name} {db_user.last_name}'.strip() or db_user.email, 'is_platform_owner': db_user.role == 'platform_owner', 'role': db_user.role}}
        if db_user.restaurant_id:
            try:
                restaurant = db.query(Restaurant).filter(Restaurant.id == db_user.restaurant_id).first()
                if restaurant:
                    user_metadata = supabase_user.user_metadata or {}
                    supabase_plan = user_metadata.get('subscription_plan')
                    supabase_status = user_metadata.get('subscription_status')
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
                            logger.error(f'Error updating restaurant subscription: {str(e)}')
                            db.rollback()
                    response_data['user']['restaurant_id'] = str(restaurant.id)
                    response_data['user']['restaurant_name'] = restaurant.name
                    response_data['user']['subscription_plan'] = restaurant.subscription_plan or 'alpha'
                    response_data['user']['subscription_status'] = restaurant.subscription_status or 'trial'
                    response_data['user']['enabled_features'] = get_plan_features(restaurant.subscription_plan or 'alpha')
            except SQLAlchemyError as e:
                logger.error(f'Error retrieving restaurant info: {str(e)}')
                db.rollback()
        else:
            logger.info(f'User {db_user.id} has no restaurant - needs onboarding')
            user_metadata = supabase_user.user_metadata or {}
            subscription_plan = user_metadata.get('subscription_plan', 'alpha')
            subscription_status = user_metadata.get('subscription_status', 'trial')
            logger.info(f'User {db_user.id} has subscription plan: {subscription_plan} (status: {subscription_status})')
            response_data['user']['needs_onboarding'] = True
            response_data['user']['subscription_plan'] = subscription_plan
            response_data['user']['subscription_status'] = subscription_status
            response_data['user']['enabled_features'] = get_plan_features(subscription_plan)
            response_data['user']['onboarding_progress'] = {'current_step': 0, 'completed_steps': [], 'total_steps': 9, 'resume_at_step': 1}
        return response_data
    except HTTPException:
        raise
    except (AuthApiError, PostgrestAPIError) as e:
        error_msg = str(e)
        logger.warning(f'Supabase AuthApiError: {error_msg}')
        logger.warning(f'Error type: {type(e).__name__}')
        audit_logger = AuditLoggerService(db)
        client_ip = request.client.host if request.client else 'unknown'
        user_agent = request.headers.get('user-agent', 'unknown')
        if hasattr(e, 'code'):
            logger.warning(f'Error code: {e.code}')
        if hasattr(e, 'message'):
            logger.warning(f'Error message: {e.message}')
        if hasattr(e, 'response'):
            logger.warning(f'Error response: {e.response}')
        error_msg_lower = error_msg.lower()
        if 'invalid jwt' in error_msg_lower or 'malformed' in error_msg_lower:
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='Invalid JWT token presented', ip_address=client_ip, user_agent=user_agent, details={'error': 'invalid_jwt', 'token_prefix': authorization[:20] + '...' if authorization else None}, risk_score=70)
            raise AuthenticationException(message="Invalid authentication token")
        elif 'expired' in error_msg_lower:
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='Expired JWT token presented', ip_address=client_ip, user_agent=user_agent, details={'error': 'expired_token'}, risk_score=30)
            raise AuthenticationException(message='Token has expired. Please sign in again.', code='TOKEN_EXPIRED')
        elif 'not found' in error_msg_lower:
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='Authentication attempt for non-existent user', ip_address=client_ip, user_agent=user_agent, details={'error': 'user_not_found'}, risk_score=50)
            raise ResourceNotFoundException(message="User not found. Please sign up first.", resource_type="User")
        else:
            logger.error(f'Unexpected Supabase auth error: {type(e).__name__}: {str(e)}')
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='Authentication failed with unexpected error', ip_address=client_ip, user_agent=user_agent, details={'error': 'unexpected_auth_error', 'error_type': type(e).__name__}, risk_score=80)
            raise AuthenticationException(message='Authentication failed. Please sign in again.', code='INVALID_CREDENTIALS')
    except Exception as e:
        error_str = str(e)
        logger.error(f'Auth verification error - Type: {type(e).__name__}, Message: {error_str}')
        audit_logger = AuditLoggerService(db)
        client_ip = request.client.host if request.client else 'unknown'
        user_agent = request.headers.get('user-agent', 'unknown')
        if 'invalid jwt' in error_str.lower() or 'jwt' in error_str.lower():
            logger.warning('Detected JWT error in generic exception, treating as auth error')
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='JWT error detected in generic exception', ip_address=client_ip, user_agent=user_agent, details={'error': 'jwt_error_wrapped', 'exception_type': type(e).__name__}, risk_score=70)
            raise AuthenticationException(message="Invalid authentication token")
        elif 'user not found' in error_str.lower():
            logger.warning('Detected user not found error in generic exception')
            await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='User not found error in generic exception', ip_address=client_ip, user_agent=user_agent, details={'error': 'user_not_found_wrapped', 'exception_type': type(e).__name__}, risk_score=50)
            raise ResourceNotFoundException(message="User not found. Please sign up first.", resource_type="User")
        import traceback
        logger.error(f'Full exception details: {traceback.format_exc()}')
        if 'supabase' in error_str.lower() and ('missing' in error_str.lower() or 'environment' in error_str.lower()):
            await audit_logger.create_audit_log(event_type=AuditEventType.SYSTEM_EVENT, event_status=AuditEventStatus.FAILURE, action_performed='Authentication service configuration error', ip_address=client_ip, user_agent=user_agent, details={'error': 'service_config_error', 'exception_type': type(e).__name__}, risk_score=90)
            raise FynloException(message='Authentication service configuration error. Please contact support.', code='INTERNAL_ERROR')
        await audit_logger.create_audit_log(event_type=AuditEventType.AUTHENTICATION, event_status=AuditEventStatus.FAILURE, action_performed='Authentication service error', ip_address=client_ip, user_agent=user_agent, details={'error': 'service_error', 'exception_type': type(e).__name__, 'message': error_str[:200]}, risk_score=60)
        raise FynloException(message='Authentication service error. Please try again later.', code='INTERNAL_ERROR')

@router.post('/register-restaurant')
async def register_restaurant(data: RegisterRestaurantRequest, authorization: Optional[str]=Header(None), db: Session=Depends(get_db)):
    """Register a new restaurant after Supabase signup"""
    if not authorization:
        raise AuthenticationException(message="No authorization header")
    token = authorization.replace('Bearer ', '')
    client = supabase_admin or get_admin_client()
    if not client:
        logger.error('Supabase admin client not available')
        logger.error(f'SUPABASE_URL set: {bool(settings.SUPABASE_URL)}')
        logger.error(f'SUPABASE_SERVICE_ROLE_KEY set: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}')
        raise FynloException(message='Authentication service temporarily unavailable. Please check backend configuration.', code='INTERNAL_ERROR')
    try:
        user_response = client.auth.get_user(token)
        supabase_user = user_response.user
        if not supabase_user:
            raise AuthenticationException(message="Invalid token")
        db_user = db.query(User).filter(User.supabase_id == supabase_user.id).first()
        if not db_user:
            db_user = db.query(User).filter(User.email == supabase_user.email).first()
            if db_user and (not db_user.supabase_id):
                try:
                    db_user.supabase_id = supabase_user.id
                    db.commit()
                    logger.info(f'Updated user {db_user.id} with Supabase ID during registration')
                except SQLAlchemyError as e:
                    logger.error(f'Failed to update user supabase_id during registration: {str(e)}')
                    db.rollback()
        if not db_user:
            raise ResourceNotFoundException(message='User not found', code='NOT_FOUND', resource_type='user')
        if db_user.restaurant_id:
            raise ValidationException(message='User already has a restaurant', code='BAD_REQUEST')
        user_metadata = supabase_user.user_metadata or {}
        subscription_plan = user_metadata.get('subscription_plan', 'alpha')
        subscription_status = user_metadata.get('subscription_status', 'trial')
        try:
            platform_id = str(db_user.platform_id) if db_user.platform_id else None
            if not platform_id:
                from app.core.database import Platform
                default_platform = db.query(Platform).filter(Platform.name == 'Fynlo').first()
                if default_platform:
                    platform_id = str(default_platform.id)
                else:
                    raise FynloException(message='No platform found. Please contact support.', code='INTERNAL_ERROR')
            address_data = {'street': data.address or '', 'city': '', 'state': '', 'zipCode': '', 'country': 'UK'}
            from app.core.validation import validate_model_jsonb_fields, validate_email, validate_phone, sanitize_string, ValidationError as ValidationErr
            sanitized_name = sanitize_string(data.restaurant_name, 255)
            if not sanitized_name:
                raise BusinessLogicException(message='Restaurant name cannot be empty', code='OPERATION_NOT_ALLOWED')
            if data.phone and (not validate_phone(data.phone)):
                raise ValidationException(message='Invalid phone number format', code='BAD_REQUEST')
            try:
                validated_address = validate_model_jsonb_fields('restaurant', 'address', address_data)
            except ValidationErr as e:
                raise ValidationException(message='', code='BAD_REQUEST')
            restaurant = Restaurant(id=uuid.uuid4(), platform_id=platform_id, name=sanitized_name, email=supabase_user.email, phone=data.phone, address=validated_address, timezone='Europe/London', business_hours={'monday': {'open': '09:00', 'close': '22:00'}, 'tuesday': {'open': '09:00', 'close': '22:00'}, 'wednesday': {'open': '09:00', 'close': '22:00'}, 'thursday': {'open': '09:00', 'close': '22:00'}, 'friday': {'open': '09:00', 'close': '23:00'}, 'saturday': {'open': '09:00', 'close': '23:00'}, 'sunday': {'open': '10:00', 'close': '21:00'}}, settings={'currency': 'GBP', 'date_format': 'DD/MM/YYYY', 'time_format': '24h', 'allow_tips': True, 'auto_gratuity_percentage': 12.5, 'print_receipt_default': True}, subscription_plan=subscription_plan, subscription_status=subscription_status, subscription_started_at=datetime.utcnow(), tax_configuration={'vat_rate': 0.2, 'included_in_price': True, 'tax_number': ''}, payment_methods={'cash': True, 'card': True, 'qr_code': True, 'apple_pay': True, 'google_pay': True}, is_active=True)
            db.add(restaurant)
            db_user.restaurant_id = restaurant.id
            db_user.needs_onboarding = False
            db_user.updated_at = datetime.utcnow()
            if db_user.role not in ['platform_owner', 'restaurant_owner']:
                db_user.role = 'restaurant_owner'
            db.commit()
            db.refresh(restaurant)
            db.refresh(db_user)
            from app.core.feature_gate import get_plan_features
            return {'success': True, 'restaurant_id': str(restaurant.id), 'restaurant_name': restaurant.name, 'subscription_plan': subscription_plan, 'subscription_status': subscription_status, 'enabled_features': get_plan_features(subscription_plan), 'needs_onboarding': False, 'message': 'Restaurant registered successfully'}
        except SQLAlchemyError as e:
            logger.error(f'Database error creating restaurant: {str(e)}')
            db.rollback()
            raise FynloException(message='Failed to register restaurant. Please try again.', code='INTERNAL_ERROR')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Restaurant registration error: {str(e)}')
        db.rollback()
        raise FynloException(message='Failed to register restaurant', code='INTERNAL_ERROR')