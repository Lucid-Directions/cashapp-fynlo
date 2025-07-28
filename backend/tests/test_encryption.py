"""Tests for field-level encryption system."""

import json
import os
import pytest
from unittest.mock import patch, MagicMock

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.encryption import (
    EncryptionManager,
    EncryptedString,
    EncryptedJSON,
    SearchableEncryptedString,
    encrypt_field,
    decrypt_field,
    _is_encrypted
)
from app.core.exceptions import FynloException


# Set test encryption key
os.environ["ENCRYPTION_MASTER_KEY"] = "test-key-for-unit-tests-only"

Base = declarative_base()


class TestModel(Base):
    """Test model with encrypted fields."""
    __tablename__ = "test_model"
    
    id = Column(Integer, primary_key=True)
    normal_field = Column(String)
    encrypted_field = Column(EncryptedString)
    encrypted_json = Column(EncryptedJSON)
    searchable_field = Column(SearchableEncryptedString(deterministic=True))


class TestEncryptionManager:
    """Test EncryptionManager functionality."""
    
    def setup_method(self):
        """Reset encryption manager for each test."""
        EncryptionManager._instance = None
        EncryptionManager._fernet = None
        self.manager = EncryptionManager()
    
    def test_singleton_pattern(self):
        """Test that EncryptionManager is a singleton."""
        manager2 = EncryptionManager()
        assert self.manager is manager2
    
    def test_encrypt_string(self):
        """Test encrypting a string value."""
        original = "sensitive data"
        encrypted = self.manager.encrypt(original)
        
        assert encrypted != original
        assert len(encrypted) > len(original)
        assert _is_encrypted(encrypted)
    
    def test_decrypt_string(self):
        """Test decrypting a string value."""
        original = "sensitive data"
        encrypted = self.manager.encrypt(original)
        decrypted = self.manager.decrypt(encrypted)
        
        assert decrypted == original
    
    def test_encrypt_decrypt_dict(self):
        """Test encrypting and decrypting dictionary."""
        original = {"key": "value", "number": 42}
        encrypted = self.manager.encrypt(original)
        decrypted = self.manager.decrypt(encrypted)
        
        assert decrypted == original
        assert isinstance(decrypted, dict)
    
    def test_encrypt_decrypt_list(self):
        """Test encrypting and decrypting list."""
        original = ["item1", "item2", 3]
        encrypted = self.manager.encrypt(original)
        decrypted = self.manager.decrypt(encrypted)
        
        assert decrypted == original
        assert isinstance(decrypted, list)
    
    def test_encrypt_none(self):
        """Test encrypting None value."""
        assert self.manager.encrypt(None) is None
    
    def test_decrypt_none(self):
        """Test decrypting None value."""
        assert self.manager.decrypt(None) is None
    
    def test_decrypt_invalid(self):
        """Test decrypting invalid data raises exception."""
        with pytest.raises(FynloException) as exc_info:
            self.manager.decrypt("invalid-encrypted-data")
        
        assert exc_info.value.status_code == 500
        assert "Failed to decrypt data" in str(exc_info.value)
    
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_encryption_key(self):
        """Test that missing encryption key raises exception."""
        EncryptionManager._instance = None
        EncryptionManager._fernet = None
        
        with pytest.raises(FynloException) as exc_info:
            EncryptionManager()
        
        assert "ENCRYPTION_MASTER_KEY not set" in str(exc_info.value)


class TestEncryptedTypes:
    """Test SQLAlchemy encrypted types."""
    
    def setup_method(self):
        """Set up test database."""
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.session = Session()
    
    def teardown_method(self):
        """Clean up test database."""
        self.session.close()
    
    def test_encrypted_string_field(self):
        """Test EncryptedString field type."""
        # Create record
        record = TestModel(
            normal_field="normal",
            encrypted_field="sensitive string"
        )
        self.session.add(record)
        self.session.commit()
        
        # Verify stored value is encrypted
        raw_query = self.session.execute(
            "SELECT encrypted_field FROM test_model WHERE id = :id",
            {"id": record.id}
        )
        raw_value = raw_query.scalar()
        assert raw_value != "sensitive string"
        assert _is_encrypted(raw_value)
        
        # Verify decrypted value through ORM
        fetched = self.session.query(TestModel).filter_by(id=record.id).first()
        assert fetched.encrypted_field == "sensitive string"
    
    def test_encrypted_json_field(self):
        """Test EncryptedJSON field type."""
        # Create record with JSON data
        json_data = {"user": "test", "settings": {"theme": "dark"}}
        record = TestModel(
            normal_field="normal",
            encrypted_json=json_data
        )
        self.session.add(record)
        self.session.commit()
        
        # Verify stored value is encrypted
        raw_query = self.session.execute(
            "SELECT encrypted_json FROM test_model WHERE id = :id",
            {"id": record.id}
        )
        raw_value = raw_query.scalar()
        assert raw_value != json.dumps(json_data)
        assert _is_encrypted(raw_value)
        
        # Verify decrypted value through ORM
        fetched = self.session.query(TestModel).filter_by(id=record.id).first()
        assert fetched.encrypted_json == json_data
    
    def test_searchable_encrypted_string(self):
        """Test SearchableEncryptedString with deterministic encryption."""
        # Create records
        record1 = TestModel(searchable_field="test@example.com")
        record2 = TestModel(searchable_field="test@example.com")
        record3 = TestModel(searchable_field="other@example.com")
        
        self.session.add_all([record1, record2, record3])
        self.session.commit()
        
        # Verify stored values include hash prefix
        raw_query = self.session.execute(
            "SELECT searchable_field FROM test_model"
        )
        raw_values = [row[0] for row in raw_query]
        
        # All values should be encrypted
        for value in raw_values:
            assert "@example.com" not in value
            assert "|" in value  # Hash separator
        
        # Verify same plaintext produces same hash prefix
        assert raw_values[0].split("|")[0] == raw_values[1].split("|")[0]
        assert raw_values[0].split("|")[0] != raw_values[2].split("|")[0]
        
        # Verify decryption works
        fetched = self.session.query(TestModel).all()
        assert fetched[0].searchable_field == "test@example.com"
        assert fetched[1].searchable_field == "test@example.com"
        assert fetched[2].searchable_field == "other@example.com"
    
    def test_null_values(self):
        """Test that null values remain null."""
        record = TestModel(
            normal_field="normal",
            encrypted_field=None,
            encrypted_json=None,
            searchable_field=None
        )
        self.session.add(record)
        self.session.commit()
        
        fetched = self.session.query(TestModel).filter_by(id=record.id).first()
        assert fetched.encrypted_field is None
        assert fetched.encrypted_json is None
        assert fetched.searchable_field is None


class TestEncryptionUtilities:
    """Test encryption utility functions."""
    
    def test_encrypt_field(self):
        """Test encrypt_field utility."""
        encrypted = encrypt_field("test data")
        assert _is_encrypted(encrypted)
        assert encrypted != "test data"
    
    def test_decrypt_field(self):
        """Test decrypt_field utility."""
        encrypted = encrypt_field("test data")
        decrypted = decrypt_field(encrypted)
        assert decrypted == "test data"
    
    def test_is_encrypted_valid(self):
        """Test _is_encrypted with valid encrypted data."""
        encrypted = encrypt_field("test")
        assert _is_encrypted(encrypted) is True
    
    def test_is_encrypted_invalid(self):
        """Test _is_encrypted with invalid data."""
        assert _is_encrypted("plain text") is False
        assert _is_encrypted("") is False
        assert _is_encrypted(None) is False
        assert _is_encrypted(123) is False
        assert _is_encrypted("short") is False


class TestEncryptionIntegration:
    """Integration tests for encryption in real scenarios."""
    
    def test_pii_encryption_scenario(self):
        """Test encrypting PII data."""
        # Simulate user data
        user_data = {
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+44 7700 900000"
        }
        
        # Encrypt each field
        encrypted_data = {}
        for field, value in user_data.items():
            encrypted_data[field] = encrypt_field(value)
        
        # Verify all fields are encrypted
        for field, encrypted in encrypted_data.items():
            assert encrypted != user_data[field]
            assert _is_encrypted(encrypted)
        
        # Verify decryption
        for field, encrypted in encrypted_data.items():
            decrypted = decrypt_field(encrypted)
            assert decrypted == user_data[field]
    
    def test_payment_data_encryption(self):
        """Test encrypting payment data."""
        payment_data = {
            "external_id": "pi_1234567890",
            "metadata": {
                "customer": "cus_123",
                "amount": 1000,
                "currency": "GBP"
            }
        }
        
        # Encrypt payment ID
        encrypted_id = encrypt_field(payment_data["external_id"])
        assert _is_encrypted(encrypted_id)
        
        # Encrypt metadata
        encrypted_metadata = encrypt_field(payment_data["metadata"])
        assert _is_encrypted(encrypted_metadata)
        
        # Decrypt and verify
        assert decrypt_field(encrypted_id) == payment_data["external_id"]
        assert decrypt_field(encrypted_metadata) == payment_data["metadata"]