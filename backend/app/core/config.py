"""
Configuration settings for Fynlo POS Backend
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Fynlo POS"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://fynlo_user:fynlo_password@localhost:5432/fynlo_pos"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Payment Processing
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    
    # SumUp Integration (PHASE 3: Added for real payment processing)
    SUMUP_API_KEY: Optional[str] = None
    SUMUP_MERCHANT_CODE: Optional[str] = None  
    SUMUP_AFFILIATE_KEY: Optional[str] = None
    SUMUP_ENVIRONMENT: str = "sandbox"  # sandbox | production
    
    # QR Payment Settings
    QR_PAYMENT_FEE_PERCENTAGE: float = 1.2  # Your competitive advantage
    DEFAULT_CARD_FEE_PERCENTAGE: float = 2.9
    
    # WebSocket
    WEBSOCKET_HOST: str = "localhost"
    WEBSOCKET_PORT: int = 8001
    
    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "uploads"
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"  # Allow extra environment variables

settings = Settings()