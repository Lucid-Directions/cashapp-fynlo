"""Field-level encryption for sensitive data.

Provides transparent encryption/decryption for database fields containing PII
and other sensitive information.
"""

import base64
import json
import os
from typing import Any, Optional, Union

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import TypeDecorator, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.core.config import settings
from app.core.exceptions import FynloException


class EncryptionManager:
    """Manages encryption keys and operations."""

    _instance = None
    _fernet = None

    def __new__(cls):
        """Singleton pattern for encryption manager."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize encryption manager."""
        if self._fernet is None:
            self._initialize_encryption()

    def _initialize_encryption(self):
        """Initialize Fernet encryption with key derivation."""
        # Get encryption key from environment or generate
        master_key = os.environ.get("ENCRYPTION_MASTER_KEY")
        if not master_key:
            # In production, this should come from a secure key management service
            raise FynloException(
                "ENCRYPTION_MASTER_KEY not set in environment",
                status_code=500
            )

        # Derive encryption key from master key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'fynlo-pos-salt',  # In production, use unique salt per tenant
            iterations=100000,
            backend=default_backend()
        )
        key = base64.urlsafe_b64encode(
            kdf.derive(master_key.encode())
        )
        self._fernet = Fernet(key)

    def encrypt(self, value: Union[str, dict, list]) -> str:
        """Encrypt a value."""
        if value is None:
            return None

        # Convert non-string values to JSON
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        elif not isinstance(value, str):
            value = str(value)

        # Encrypt and return base64 encoded string
        encrypted = self._fernet.encrypt(value.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt(self, encrypted_value: str) -> Union[str, dict, list]:
        """Decrypt a value."""
        if encrypted_value is None:
            return None

        try:
            # Decode from base64 and decrypt
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode())
            decrypted = self._fernet.decrypt(encrypted_bytes).decode()

            # Try to parse as JSON
            try:
                return json.loads(decrypted)
            except json.JSONDecodeError:
                return decrypted

        except Exception as e:
            # Log decryption failure but don't expose details
            raise FynloException(
                "Failed to decrypt data",
                status_code=500
            )


# Singleton instance
encryption_manager = EncryptionManager()


class EncryptedType(TypeDecorator):
    """SQLAlchemy type for encrypted fields."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Encrypt value before storing in database."""
        if value is None:
            return None
        return encryption_manager.encrypt(value)

    def process_result_value(self, value, dialect):
        """Decrypt value when loading from database."""
        if value is None:
            return None
        return encryption_manager.decrypt(value)


class EncryptedString(EncryptedType):
    """Encrypted string field."""

    def process_result_value(self, value, dialect):
        """Ensure result is always a string."""
        result = super().process_result_value(value, dialect)
        if result is not None and not isinstance(result, str):
            return str(result)
        return result


class EncryptedJSON(EncryptedType):
    """Encrypted JSON field."""

    impl = Text  # Store as text, not JSONB, since it's encrypted

    def process_result_value(self, value, dialect):
        """Ensure result is always a dict/list."""
        result = super().process_result_value(value, dialect)
        if result is not None and isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return {"_encrypted_error": "Invalid JSON"}
        return result


class SearchableEncryptedString(EncryptedString):
    """Encrypted string that supports deterministic encryption for searching.
    
    WARNING: Deterministic encryption is less secure than random encryption.
    Use only when searching is absolutely necessary.
    """

    def __init__(self, deterministic=True):
        """Initialize with deterministic flag."""
        super().__init__()
        self.deterministic = deterministic

    def process_bind_param(self, value, dialect):
        """Use deterministic encryption for searchable fields."""
        if value is None:
            return None
        
        if self.deterministic:
            # For deterministic encryption, we use a hash-based approach
            # This allows searching but reduces security
            # In production, consider using encrypted indexes instead
            hash_obj = hashes.Hash(hashes.SHA256(), backend=default_backend())
            hash_obj.update(value.encode())
            hash_obj.update(b'fynlo-deterministic')  # Add app-specific salt
            search_hash = base64.urlsafe_b64encode(
                hash_obj.finalize()[:16]
            ).decode()
            
            # Store both hash and encrypted value
            return f"{search_hash}|{encryption_manager.encrypt(value)}"
        else:
            return super().process_bind_param(value, dialect)

    def process_result_value(self, value, dialect):
        """Extract encrypted value from deterministic format."""
        if value is None:
            return None
            
        if self.deterministic and '|' in value:
            # Extract encrypted portion after the hash
            _, encrypted = value.split('|', 1)
            return encryption_manager.decrypt(encrypted)
        else:
            return super().process_result_value(value, dialect)


def encrypt_field(value: Any) -> Optional[str]:
    """Utility function to encrypt a field value."""
    return encryption_manager.encrypt(value)


def decrypt_field(encrypted_value: str) -> Any:
    """Utility function to decrypt a field value."""
    return encryption_manager.decrypt(encrypted_value)


def generate_encryption_key() -> str:
    """Generate a new encryption key for initial setup."""
    return Fernet.generate_key().decode()


# Utility functions for migration
def migrate_to_encrypted(
    db_session,
    model_class,
    field_mappings: dict
):
    """Migrate existing unencrypted data to encrypted format.
    
    Args:
        db_session: SQLAlchemy session
        model_class: The model class to migrate
        field_mappings: Dict of {field_name: encryption_type}
    """
    records = db_session.query(model_class).all()
    
    for record in records:
        for field_name, encryption_type in field_mappings.items():
            current_value = getattr(record, field_name)
            if current_value and not _is_encrypted(current_value):
                # Encrypt the value
                if encryption_type == "json":
                    encrypted = encryption_manager.encrypt(current_value)
                else:
                    encrypted = encryption_manager.encrypt(str(current_value))
                
                setattr(record, field_name, encrypted)
        
    db_session.commit()


def _is_encrypted(value: str) -> bool:
    """Check if a value is already encrypted."""
    if not value or not isinstance(value, str):
        return False
    
    # Check for base64 pattern and minimum length
    try:
        decoded = base64.urlsafe_b64decode(value.encode())
        # Fernet tokens have a specific format
        return len(decoded) > 50 and decoded.startswith(b'gAAAAA')
    except Exception:
        return False