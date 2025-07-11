"""
Authentication middleware for Supabase integration
"""

from fastapi import Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.core.supabase import supabase_admin
from app.core.database import get_db
from app.core.database import User
from app.services.audit_logger import AuditLoggerService
from app.models.audit_log import AuditEventType, AuditEventStatus


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from Supabase token"""
    
    # Initialize audit logger
    audit_service = AuditLoggerService(db)
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    action_prefix = f"Access to {request.url.path}"
    
    if not authorization:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED,
            event_status=AuditEventStatus.FAILURE,
            action_performed=f"{action_prefix} denied: No authorization header",
            ip_address=ip_address,
            user_agent=user_agent,
            details={"reason": "Missing authorization header"},
            commit=True
        )
        raise HTTPException(
            status_code=401,
            detail="No authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify with Supabase
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            await audit_service.create_audit_log(
                event_type=AuditEventType.ACCESS_DENIED,
                event_status=AuditEventStatus.FAILURE,
                action_performed=f"{action_prefix} denied: Invalid token",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "Supabase returned no user", "token_prefix": token[:10] + "..."},
                commit=True
            )
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from our database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            await audit_service.create_audit_log(
                event_type=AuditEventType.ACCESS_DENIED,
                event_status=AuditEventStatus.FAILURE,
                action_performed=f"{action_prefix} denied: User not found in database",
                username_or_email=supabase_user.email,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "User exists in Supabase but not in local database", "supabase_id": str(supabase_user.id)},
                commit=True
            )
            raise HTTPException(status_code=401, detail="User not found in database")
        
        if not db_user.is_active:
            await audit_service.create_audit_log(
                event_type=AuditEventType.ACCESS_DENIED,
                event_status=AuditEventStatus.FAILURE,
                action_performed=f"{action_prefix} denied: User account inactive",
                user_id=db_user.id,
                username_or_email=db_user.email,
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "User account is deactivated"},
                commit=True
            )
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        # Log successful access
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_GRANTED,
            event_status=AuditEventStatus.SUCCESS,
            action_performed=f"{action_prefix} granted",
            user_id=db_user.id,
            username_or_email=db_user.email,
            restaurant_id=db_user.restaurant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            commit=True
        )
        
        return db_user
        
    except HTTPException:
        raise
    except Exception as e:
        await audit_service.create_audit_log(
            event_type=AuditEventType.ACCESS_DENIED,
            event_status=AuditEventStatus.FAILURE,
            action_performed=f"{action_prefix} denied: Authentication error",
            ip_address=ip_address,
            user_agent=user_agent,
            details={"error": str(e), "reason": "Unexpected error during authentication"},
            commit=True
        )
        print(f"Auth error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_platform_owner(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Ensure user is platform owner"""
    if current_user.role != 'platform_owner':
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Platform owner access required."
        )
    return current_user


async def get_restaurant_user(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """Ensure user has restaurant access"""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=403,
            detail="Restaurant access required"
        )
    return current_user


async def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication - returns user if authenticated, None otherwise.
    Used for endpoints that support both authenticated and anonymous access.
    """
    if not authorization:
        return None
    
    try:
        return await get_current_user(request, authorization, db)
    except HTTPException:
        return None


# Alias for consistency with platform API
get_current_platform_owner = get_platform_owner