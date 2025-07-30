"""
Authentication middleware for Supabase integration
"""
from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import logging
from app.core.supabase import supabase_admin
from app.core.database import get_db
from app.core.database import User
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus
from app.core.exceptions import ValidationException, AuthenticationException, FynloException
logger = logging.getLogger(__name__)

async def get_current_user(request: Request, authorization: Optional[str]=Header(None), db: Session=Depends(get_db)) -> User:
    """Get current user from Supabase token"""
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else 'unknown'
    user_agent = request.headers.get('user-agent', 'unknown')
    action_prefix = f'Access to {request.url.path}'
    if not authorization:
        await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE, action_performed=f'{action_prefix} denied: No authorization header', ip_address=ip_address, user_agent=user_agent, details={'reason': 'Missing authorization header'}, commit=True)
        raise AuthenticationException(message='Authentication required', error_code='MISSING_AUTH_HEADER')
    token = authorization.replace('Bearer ', '')
    try:
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        if not supabase_user:
            await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE, action_performed=f'{action_prefix} denied: Invalid token', ip_address=ip_address, user_agent=user_agent, details={'reason': 'Supabase returned no user', 'token_prefix': token[:10] + '...'}, commit=True)
            raise AuthenticationException(message='Authentication failed', error_code='INVALID_TOKEN')
        db_user = db.query(User).filter(User.supabase_id == str(supabase_user.id)).first()
        if not db_user:
            await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE, action_performed=f'{action_prefix} denied: User not found in database', username_or_email=supabase_user.email, ip_address=ip_address, user_agent=user_agent, details={'reason': 'User exists in Supabase but not in local database', 'supabase_id': str(supabase_user.id)}, commit=True)
            raise AuthenticationException(message='Authentication failed', error_code='AUTHENTICATION_FAILED')
        if not db_user.is_active:
            await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE, action_performed=f'{action_prefix} denied: User account inactive', user_id=db_user.id, username_or_email=db_user.email, ip_address=ip_address, user_agent=user_agent, details={'reason': 'User account is deactivated'}, commit=True)
            raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
        await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_GRANTED, event_status=AuditEventStatus.SUCCESS, action_performed=f'{action_prefix} granted', user_id=db_user.id, username_or_email=db_user.email, restaurant_id=db_user.restaurant_id, ip_address=ip_address, user_agent=user_agent, commit=True)
        return db_user

    except Exception as e:
        await audit_service.create_audit_log(event_type=AuditEventType.ACCESS_DENIED, event_status=AuditEventStatus.FAILURE, action_performed=f'{action_prefix} denied: Authentication error', ip_address=ip_address, user_agent=user_agent, details={'error': str(e), 'reason': 'Unexpected error during authentication'}, commit=True)
        print(f'Auth error: {str(e)}')
        raise AuthenticationException(message='Authentication failed', error_code='AUTHENTICATION_FAILED')

async def get_current_active_user(current_user: User=Depends(get_current_user)) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise ValidationException(message='Inactive user', error_code='BAD_REQUEST')
    return current_user

async def get_platform_owner(current_user: User=Depends(get_current_active_user)) -> User:
    """Ensure user is platform owner"""
    if current_user.role != 'platform_owner':
        raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
    return current_user

async def get_restaurant_user(current_user: User=Depends(get_current_active_user), db: Session=Depends(get_db)) -> User:
    """Ensure user has restaurant access"""
    if not current_user.restaurant_id:
        raise AuthenticationException(message='Access denied', error_code='ACCESS_DENIED')
    return current_user

async def get_current_user_optional(request: Request, authorization: Optional[str]=Header(None), db: Session=Depends(get_db)) -> Optional[User]:
    """
    Optional authentication - returns user if authenticated, None otherwise.
    Used for endpoints that support both authenticated and anonymous access.
    """
    if not authorization:
        return None
    try:
        return await get_current_user(request, authorization, db)
    except (AuthenticationException, ValidationException, FynloException):
        return None
get_current_platform_owner = get_platform_owner

async def verify_websocket_token(token: str, user_id: str, db: Session) -> Optional[User]:
    """
    Verify WebSocket authentication token
    Returns User if valid, None otherwise
    """
    try:
        if not supabase_admin:
            logger.error('Supabase admin client not initialized')
            return None
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        if not supabase_user:
            logger.warning('Invalid token - no user returned from Supabase')
            return None
        db_user = db.query(User).filter(User.supabase_id == str(supabase_user.id)).first()
        if not db_user:
            logger.warning(f'User not found in database for Supabase ID: {supabase_user.id}')
            return None
        if not db_user.is_active:
            logger.warning(f'User is not active: {db_user.id}')
            return None
        if str(db_user.id) != str(user_id):
            logger.error(f'User ID mismatch - potential security violation: {db_user.id} != {user_id}')
            return None
        return db_user
    except Exception as e:
        logger.error(f'WebSocket token verification error: {str(e)}')
        return None