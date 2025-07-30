"""
Platform administration endpoints for secure management
Only accessible by existing platform owners with proper authentication
"""
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid
import logging
import hmac
import hashlib
from app.core.database import get_db, User
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.responses import APIResponseHelper
from pydantic import BaseModel, EmailStr
from app.core.exceptions import AuthenticationException, BusinessLogicException, ResourceNotFoundException, ValidationException
logger = logging.getLogger(__name__)
router = APIRouter()

class GrantPlatformOwnerRequest(BaseModel):
    """Request to grant platform owner role"""
    user_email: EmailStr
    verification_code: str

class RevokePlatformOwnerRequest(BaseModel):
    """Request to revoke platform owner role"""
    user_email: EmailStr
    reason: str

def verify_platform_owner_access(current_user: User, verification_token: Optional[str]=Header(None)):
    """
    Verify that the current user is a platform owner with proper authentication
    """
    if current_user.role != 'platform_owner':
        raise AuthenticationException(message='Access denied: Platform owner role required', code='UNAUTHORIZED')
    if settings.PLATFORM_OWNER_SECRET_KEY and verification_token:
        expected_token = hmac.new(settings.PLATFORM_OWNER_SECRET_KEY.encode(), f"{current_user.id}:{datetime.utcnow().strftime('%Y-%m-%d')}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(verification_token, expected_token):
            logger.warning(f'Invalid platform owner verification token for user {current_user.id}')
            raise ValidationException(message="Invalid verification token")

@router.post('/grant-platform-owner')
async def grant_platform_owner_role(request: GrantPlatformOwnerRequest, db: Session=Depends(get_db), current_user: User=Depends(get_current_user), verification_token: Optional[str]=Header(None)):
    """
    Grant platform owner role to a user
    Requires: Current user must be platform owner with verification
    """
    verify_platform_owner_access(current_user, verification_token)
    if not request.verification_code or len(request.verification_code) < 6:
        raise ValidationException(message='Invalid verification code', code='BAD_REQUEST')
    target_user = db.query(User).filter(User.email == request.user_email).first()
    if not target_user:
        raise ResourceNotFoundException(message='User not found', code='NOT_FOUND', resource_type='user')
    if target_user.role == 'platform_owner':
        return APIResponseHelper.success(message='User already has platform owner role')
    target_user.role = 'platform_owner'
    target_user.updated_at = datetime.utcnow()
    logger.info(f'Platform owner role granted to {target_user.email} by {current_user.email}')
    db.commit()
    return APIResponseHelper.success(data={'user_id': str(target_user.id), 'email': target_user.email}, message='Platform owner role granted successfully')

@router.post('/revoke-platform-owner')
async def revoke_platform_owner_role(request: RevokePlatformOwnerRequest, db: Session=Depends(get_db), current_user: User=Depends(get_current_user), verification_token: Optional[str]=Header(None)):
    """
    Revoke platform owner role from a user
    Requires: Current user must be platform owner with verification
    """
    verify_platform_owner_access(current_user, verification_token)
    if request.user_email == current_user.email:
        raise BusinessLogicException(message='Cannot revoke your own platform owner role', code='OPERATION_NOT_ALLOWED')
    target_user = db.query(User).filter(User.email == request.user_email).first()
    if not target_user:
        raise ResourceNotFoundException(message='User not found', code='NOT_FOUND', resource_type='user')
    if target_user.role != 'platform_owner':
        return APIResponseHelper.success(message='User does not have platform owner role')
    platform_owner_count = db.query(User).filter(User.role == 'platform_owner').count()
    if platform_owner_count <= 1:
        raise BusinessLogicException(message='Cannot revoke: This would leave no platform owners in the system', code='OPERATION_NOT_ALLOWED')
    target_user.role = 'restaurant_owner'
    target_user.updated_at = datetime.utcnow()
    logger.info(f'Platform owner role revoked from {target_user.email} by {current_user.email}. Reason: {request.reason}')
    db.commit()
    return APIResponseHelper.success(data={'user_id': str(target_user.id), 'email': target_user.email}, message='Platform owner role revoked successfully')

@router.get('/platform-owners')
async def list_platform_owners(db: Session=Depends(get_db), current_user: User=Depends(get_current_user)):
    """
    List all platform owners
    Requires: Current user must be platform owner
    """
    if current_user.role != 'platform_owner':
        raise AuthenticationException(message='Access denied: Platform owner role required', code='UNAUTHORIZED')
    platform_owners = db.query(User).filter(User.role == 'platform_owner').all()
    return APIResponseHelper.success(data=[{'id': str(owner.id), 'email': owner.email, 'name': f'{owner.first_name} {owner.last_name}'.strip() or owner.email, 'created_at': owner.created_at.isoformat() if owner.created_at else None} for owner in platform_owners], message=f'Found {len(platform_owners)} platform owners')