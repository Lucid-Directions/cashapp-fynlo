"""Encryption configuration and key management.

Handles encryption key rotation, multi-tenant keys, and
integration with key management services.
"""

import os
from datetime import datetime, timedelta
from typing import Dict, Optional

from pydantic import BaseSettings

from app.core.exceptions import FynloException


class EncryptionConfig(BaseSettings):
    """Encryption configuration settings."""
    
    # Master encryption key (from environment)
    ENCRYPTION_MASTER_KEY: str
    
    # Key rotation settings
    KEY_ROTATION_DAYS: int = 90
    KEY_VERSION: int = 1
    
    # Encryption algorithm settings
    ENCRYPTION_ALGORITHM: str = "AES-256-GCM"
    KEY_DERIVATION_ITERATIONS: int = 100000
    
    # Multi-tenant encryption
    TENANT_KEY_ISOLATION: bool = True
    
    # Key management service
    USE_KMS: bool = False
    KMS_PROVIDER: str = "aws"  # aws, azure, gcp, vault
    KMS_KEY_ID: Optional[str] = None
    
    class Config:
        env_prefix = ""


class KeyManager:
    """Manages encryption keys and rotation."""
    
    def __init__(self):
        """Initialize key manager."""
        self.config = EncryptionConfig()
        self._keys_cache: Dict[str, bytes] = {}
        self._rotation_check = None
    
    def get_master_key(self) -> bytes:
        """Get the master encryption key."""
        if not self.config.ENCRYPTION_MASTER_KEY:
            raise FynloException(
                "Encryption key not configured",
                status_code=500
            )
        
        return self.config.ENCRYPTION_MASTER_KEY.encode()
    
    def get_tenant_key(self, tenant_id: str) -> bytes:
        """Get tenant-specific encryption key.
        
        If tenant key isolation is enabled, derives a unique key
        for each tenant from the master key.
        """
        if not self.config.TENANT_KEY_ISOLATION:
            return self.get_master_key()
        
        # Check cache first
        if tenant_id in self._keys_cache:
            return self._keys_cache[tenant_id]
        
        # Derive tenant-specific key
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.backends import default_backend
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=f"fynlo-tenant-{tenant_id}".encode(),
            iterations=self.config.KEY_DERIVATION_ITERATIONS,
            backend=default_backend()
        )
        
        tenant_key = kdf.derive(self.get_master_key())
        self._keys_cache[tenant_id] = tenant_key
        
        return tenant_key
    
    def should_rotate_key(self) -> bool:
        """Check if key rotation is needed."""
        if not self._rotation_check:
            # In production, check key age from secure storage
            return False
        
        key_age = datetime.now() - self._rotation_check
        return key_age.days >= self.config.KEY_ROTATION_DAYS
    
    def rotate_master_key(self, new_key: str) -> None:
        """Rotate the master encryption key.
        
        This is a critical operation that requires:
        1. Decrypting all data with old key
        2. Re-encrypting with new key
        3. Updating key version
        """
        # This would trigger a background job to re-encrypt all data
        raise NotImplementedError(
            "Key rotation requires running the key rotation script"
        )
    
    def get_key_from_kms(self, key_id: str) -> bytes:
        """Retrieve encryption key from KMS."""
        if not self.config.USE_KMS:
            raise FynloException(
                "KMS not configured",
                status_code=500
            )
        
        if self.config.KMS_PROVIDER == "aws":
            return self._get_aws_kms_key(key_id)
        elif self.config.KMS_PROVIDER == "vault":
            return self._get_vault_key(key_id)
        else:
            raise FynloException(
                f"Unsupported KMS provider: {self.config.KMS_PROVIDER}",
                status_code=500
            )
    
    def _get_aws_kms_key(self, key_id: str) -> bytes:
        """Get key from AWS KMS."""
        # Implementation would use boto3
        raise NotImplementedError("AWS KMS integration")
    
    def _get_vault_key(self, key_id: str) -> bytes:
        """Get key from HashiCorp Vault."""
        # Implementation would use hvac client
        raise NotImplementedError("Vault integration")


# Singleton instance
key_manager = KeyManager()


# Encryption best practices configuration
ENCRYPTION_BEST_PRACTICES = {
    "pii_fields": {
        "retention_days": 730,  # 2 years
        "require_audit_log": True,
        "allow_export": False
    },
    "payment_fields": {
        "retention_days": 2555,  # 7 years for financial records
        "require_audit_log": True,
        "allow_export": False,
        "require_pci_compliance": True
    },
    "auth_fields": {
        "retention_days": 90,
        "require_audit_log": True,
        "allow_export": False,
        "auto_expire": True
    }
}


def validate_encryption_setup():
    """Validate that encryption is properly configured."""
    try:
        # Check master key exists
        key = key_manager.get_master_key()
        if len(key) < 32:
            return False, "Encryption key too short (minimum 32 bytes)"
        
        # Test encryption/decryption
        from app.core.encryption import encryption_manager
        test_data = "test_encryption_setup"
        encrypted = encryption_manager.encrypt(test_data)
        decrypted = encryption_manager.decrypt(encrypted)
        
        if decrypted != test_data:
            return False, "Encryption/decryption test failed"
        
        return True, "Encryption properly configured"
        
    except Exception as e:
        return False, f"Encryption setup error: {str(e)}"