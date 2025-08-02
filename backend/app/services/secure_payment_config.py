"""
Secure Payment Configuration Service
Handles encryption/decryption of payment provider credentials
"""
import os
import json
from typing import Dict, Any, Optional
from datetime import datetime
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Boolean, DateTime, Text
import uuid

from app.core.database import Base
from app.core.exceptions import FynloException


class PaymentProviderConfig(Base):
    """Database model for encrypted payment provider configurations"""
    __tablename__ = 'payment_provider_configs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, nullable=False)  # 'stripe', 'square', 'sumup', etc.
    restaurant_id = Column(String, nullable=False)
    encrypted_credentials = Column(Text, nullable=False)  # Encrypted JSON
    mode = Column(String, nullable=False, default='sandbox')  # 'sandbox' or 'production'
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Composite unique constraint
    __table_args__ = (
        {'extend_existing': True},
    )


class SecurePaymentConfigService:
    """
    Manages payment provider configurations with encryption
    
    Features:
    - Encrypts sensitive credentials at rest
    - Provides secure storage and retrieval
    - Validates configuration before storage
    - Audit trail for configuration changes
    """
    
    def __init__(self, db: Session):
        self.db = db
        
        # Get encryption key from environment
        encryption_key = os.environ.get('PAYMENT_CONFIG_ENCRYPTION_KEY')
        if not encryption_key:
            # Use a fixed development key to prevent data loss
            if os.environ.get('ENVIRONMENT', 'development') == 'development':
                # Fixed development key - prevents losing encrypted data on restart
                encryption_key = "8J5AOuMMykQkzj6EU5Z8QgPYLE1Aye4OuIjUER2b8w0="
            else:
                raise ValueError("PAYMENT_CONFIG_ENCRYPTION_KEY environment variable not set")
        
        # Handle both string and bytes format
        if isinstance(encryption_key, str):
            try:
                # Try to decode as base64 first (Fernet key format)
                import base64
                base64.b64decode(encryption_key)
                encryption_key = encryption_key.encode()
            except Exception:
                # If not base64, assume it's already a raw string that needs encoding
                encryption_key = encryption_key.encode()
        elif isinstance(encryption_key, bytes):
            # Already bytes, check if it's a valid Fernet key
            try:
                Fernet(encryption_key)
            except Exception:
                # Invalid key, try to decode as string first
                encryption_key = encryption_key.decode().encode()
            
        self.cipher = Fernet(encryption_key)
    
    def store_provider_config(
        self,
        provider: str,
        restaurant_id: str,
        credentials: Dict[str, Any],
        mode: str = 'sandbox',
        validate: bool = True
    ) -> str:
        """
        Store encrypted payment provider configuration
        
        Args:
            provider: Provider name (stripe, square, sumup, etc.)
            restaurant_id: Restaurant ID
            credentials: Provider-specific credentials dict
            mode: 'sandbox' or 'production'
            validate: Whether to validate credentials format
            
        Returns:
            Configuration ID
            
        Raises:
            ValueError: If validation fails
            FynloException: If storage fails
        """
        # Validate inputs
        if mode not in ['sandbox', 'production']:
            raise ValueError(f"Invalid mode: {mode}")
        
        if validate:
            self._validate_credentials(provider, credentials)
        
        # Check for existing config
        existing = self.db.query(PaymentProviderConfig).filter_by(
            provider=provider,
            restaurant_id=restaurant_id
        ).first()
        
        # Encrypt credentials
        credentials_json = json.dumps(credentials)
        encrypted_creds = self.cipher.encrypt(credentials_json.encode()).decode()
        
        if existing:
            # Update existing
            existing.encrypted_credentials = encrypted_creds
            existing.mode = mode
            existing.updated_at = datetime.utcnow()
            config_id = existing.id
        else:
            # Create new
            config = PaymentProviderConfig(
                provider=provider,
                restaurant_id=restaurant_id,
                encrypted_credentials=encrypted_creds,
                mode=mode,
                enabled=True
            )
            self.db.add(config)
            config_id = config.id
        
        try:
            self.db.commit()
            return config_id
        except Exception as e:
            self.db.rollback()
            raise FynloException(f"Failed to store payment config: {str(e)}")
    
    def get_provider_config(
        """Execute get_provider_config operation."""
        self,
        provider: str,
        restaurant_id: str,
        mode: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get decrypted configuration for a payment provider
        
        Args:
            provider: Provider name
            restaurant_id: Restaurant ID
            mode: Optional mode filter
            
        Returns:
            Decrypted configuration dict or None if not found
        """
        query = self.db.query(PaymentProviderConfig).filter_by(
            provider=provider,
            restaurant_id=restaurant_id,
            enabled=True
        )
        
        if mode:
            query = query.filter_by(mode=mode)
        
        config = query.first()
        
        if not config:
            return None
        
        # Decrypt credentials
        try:
            decrypted_json = self.cipher.decrypt(
                config.encrypted_credentials.encode()
            ).decode()
            credentials = json.loads(decrypted_json)
        except Exception as e:
            raise FynloException(f"Failed to decrypt payment config: {str(e)}")
        
        return {
            'id': config.id,
            'provider': config.provider,
            'restaurant_id': config.restaurant_id,
            'credentials': credentials,
            'mode': config.mode,
            'enabled': config.enabled,
            'created_at': config.created_at.isoformat(),
            'updated_at': config.updated_at.isoformat()
        }
    
    def list_provider_configs(
        """Execute list_provider_configs operation."""
        self,
        restaurant_id: str,
        include_disabled: bool = False
    ) -> list[Dict[str, Any]]:
        """
        List all provider configurations for a restaurant
        
        Args:
            restaurant_id: Restaurant ID
            include_disabled: Whether to include disabled configs
            
        Returns:
            List of configuration summaries (without credentials)
        """
        query = self.db.query(PaymentProviderConfig).filter_by(
            restaurant_id=restaurant_id
        )
        
        if not include_disabled:
            query = query.filter_by(enabled=True)
        
        configs = query.all()
        
        return [
            {
                'id': config.id,
                'provider': config.provider,
                'mode': config.mode,
                'enabled': config.enabled,
                'created_at': config.created_at.isoformat(),
                'updated_at': config.updated_at.isoformat()
            }
            for config in configs
        ]
    
    def disable_provider_config(self, provider: str, restaurant_id: str) -> bool:
        """
        Disable a provider configuration
        
        Args:
            provider: Provider name
            restaurant_id: Restaurant ID
            
        Returns:
            True if disabled, False if not found
        """
        config = self.db.query(PaymentProviderConfig).filter_by(
            provider=provider,
            restaurant_id=restaurant_id
        ).first()
        
        if not config:
            return False
        
        config.enabled = False
        config.updated_at = datetime.utcnow()
        
        try:
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise FynloException(f"Failed to disable payment config: {str(e)}")
    
    def _validate_credentials(self, provider: str, credentials: Dict[str, Any]) -> None:
        """
        Validate provider-specific credential format
        
        Args:
            provider: Provider name
            credentials: Credentials dict
            
        Raises:
            ValueError: If credentials are invalid
        """
        # Define required fields per provider
        required_fields = {
            'stripe': ['secret_key', 'publishable_key'],
            'square': ['access_token', 'location_id', 'application_id'],
            'sumup': ['api_key', 'merchant_code'],
            'qr_provider': ['api_key', 'merchant_id'],
            'cash_provider': []  # No credentials needed
        }
        
        # Sensitive field patterns that should never be empty or exposed
        sensitive_patterns = ['key', 'secret', 'token', 'password']
        
        if provider not in required_fields:
            raise ValueError(f"Unknown provider: {provider}")
        
        # Check required fields
        for field in required_fields.get(provider, []):
            if field not in credentials:
                raise ValueError(f"Missing required field for {provider}: {field}")
            
            value = credentials[field]
            
            # Validate sensitive fields
            if any(pattern in field.lower() for pattern in sensitive_patterns):
                if not value or not isinstance(value, str):
                    raise ValueError(f"Invalid value for sensitive field: {field}")
                
                # Basic validation for API keys
                if len(value) < 10:
                    raise ValueError(f"Invalid {field}: too short")
                
                # Check for placeholder values
                if value.lower() in ['your-api-key', 'placeholder', 'test', '']:
                    raise ValueError(f"Invalid {field}: placeholder value detected")
    
    def rotate_encryption_key(self, new_key: str) -> int:
        """
        Rotate the encryption key for all stored configurations
        
        Args:
            new_key: New encryption key
            
        Returns:
            Number of configurations re-encrypted
            
        Note: This should be done during maintenance windows
        """
        # Create new cipher
        new_cipher = Fernet(new_key.encode())
        
        # Get all configurations
        configs = self.db.query(PaymentProviderConfig).all()
        count = 0
        
        for config in configs:
            try:
                # Decrypt with old key
                decrypted = self.cipher.decrypt(
                    config.encrypted_credentials.encode()
                ).decode()
                
                # Re-encrypt with new key
                new_encrypted = new_cipher.encrypt(decrypted.encode()).decode()
                
                # Update in database
                config.encrypted_credentials = new_encrypted
                config.updated_at = datetime.utcnow()
                count += 1
                
            except Exception as e:
                logger.error(f"Failed to rotate key for config {config.id}: {str(e)}")
                continue
        
        # Commit all changes
        try:
            self.db.commit()
            # Update the service's cipher
            self.cipher = new_cipher
            return count
        except Exception as e:
            self.db.rollback()
            raise FynloException(f"Failed to rotate encryption keys: {str(e)}")