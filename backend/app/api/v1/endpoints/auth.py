"""
Authentication endpoints for Fynlo POS
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.core.database import get_db, User
from app.core.config import settings
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper, iOSResponseHelper
from app.core.exceptions import (
    AuthenticationException,
    ValidationException,
    ConflictException,
    iOSErrorHelper
)

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic models
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "employee"
    restaurant_id: Optional[str] = None
    platform_id: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    restaurant_id: Optional[str] = None
    platform_id: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    restaurant_id: Optional[str] = None
    platform_id: Optional[str] = None
    is_active: bool

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate user with email and password
    
    This function is used by mobile endpoints for authentication.
    Returns the user if authentication succeeds, None if it fails.
    """
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    if not user.is_active:
        return None
    
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate user with email and password
    
    This function is used by mobile endpoints for authentication.
    Returns the user if authentication succeeds, None if it fails.
    """
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    if not user.is_active:
        return None
    
    return user

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
) -> Optional[User]:
    """Get current authenticated user (optional for some endpoints)"""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    # Check if token is blacklisted in Redis
    is_blacklisted = await redis.exists(f"blacklist:{credentials.credentials}")
    if is_blacklisted:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        return None
    
    return user

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
) -> User:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Check if token is blacklisted in Redis
    is_blacklisted = await redis.exists(f"blacklist:{credentials.credentials}")
    if is_blacklisted:
        raise iOSErrorHelper.token_expired()
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise AuthenticationException("User not found")
    
    if not user.is_active:
        raise AuthenticationException("Account is inactive")
    
    return user

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
) -> Optional[User]:
    """Get current authenticated user, returns None if not authenticated"""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    # Check if token is blacklisted in Redis
    try:
        is_blacklisted = await redis.exists(f"blacklist:{credentials.credentials}")
        if is_blacklisted:
            return None
    except:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        return None
    
    return user

@router.post("/login")
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
    redis: RedisClient = Depends(get_redis)
):
    """User login with standardized iOS response"""
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise iOSErrorHelper.invalid_credentials()
    
    if not user.is_active:
        raise AuthenticationException("Account is inactive")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    # Store session in Redis
    await redis.set_session(str(user.id), {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
        "platform_id": str(user.platform_id) if user.platform_id else None,
        "login_time": datetime.utcnow().isoformat()
    })
    
    user_response = {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None,
        "platform_id": str(user.platform_id) if user.platform_id else None,
        "is_active": user.is_active,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }
    
    return iOSResponseHelper.login_success(
        access_token=access_token,
        user_data=user_response
    )

@router.post("/register")
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """User registration with standardized response"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise ConflictException(
            message="Email already registered",
            conflicting_field="email"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        restaurant_id=user_data.restaurant_id,
        platform_id=user_data.platform_id
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    user_response = {
        "id": str(new_user.id),
        "email": new_user.email,
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "role": new_user.role,
        "restaurant_id": str(new_user.restaurant_id) if new_user.restaurant_id else None,
        "platform_id": str(new_user.platform_id) if new_user.platform_id else None,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat() if hasattr(new_user, 'created_at') else None
    }
    
    return APIResponseHelper.created(
        data=user_response,
        message="User registered successfully"
    )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """User logout with standardized response"""
    # Add token to blacklist
    await redis.set(f"blacklist:{credentials.credentials}", "1", expire=86400)  # 24 hours
    
    # Remove session
    await redis.delete_session(str(current_user.id))
    
    return iOSResponseHelper.logout_success()

@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information with standardized response"""
    user_data = {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "restaurant_id": str(current_user.restaurant_id) if current_user.restaurant_id else None,
        "platform_id": str(current_user.platform_id) if current_user.platform_id else None,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None
    }
    
    return APIResponseHelper.success(
        data=user_data,
        message="User information retrieved successfully"
    )