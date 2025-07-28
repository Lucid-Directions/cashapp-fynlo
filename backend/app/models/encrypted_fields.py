"""Encrypted field definitions for sensitive data models.

This module defines which fields should be encrypted in each model.
Import these types in your models to enable field-level encryption.
"""

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import UUID

from app.core.encryption import (
    EncryptedString,
    EncryptedJSON,
    SearchableEncryptedString
)


# User model encrypted fields
class EncryptedUserFields:
    """Encrypted field definitions for User model."""
    
    email = Column(
        SearchableEncryptedString(deterministic=True),
        unique=True,
        nullable=False,
        comment="Encrypted email for user authentication"
    )
    
    first_name = Column(
        EncryptedString,
        nullable=False,
        comment="Encrypted first name"
    )
    
    last_name = Column(
        EncryptedString,
        nullable=False,
        comment="Encrypted last name"
    )
    
    pin_code = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted PIN for employee time clock"
    )


# Customer model encrypted fields
class EncryptedCustomerFields:
    """Encrypted field definitions for Customer model."""
    
    email = Column(
        SearchableEncryptedString(deterministic=True),
        nullable=True,
        comment="Encrypted customer email"
    )
    
    phone = Column(
        SearchableEncryptedString(deterministic=True),
        nullable=True,
        comment="Encrypted customer phone"
    )
    
    first_name = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted customer first name"
    )
    
    last_name = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted customer last name"
    )


# Restaurant model encrypted fields
class EncryptedRestaurantFields:
    """Encrypted field definitions for Restaurant model."""
    
    phone = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted restaurant phone"
    )
    
    email = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted restaurant email"
    )
    
    address = Column(
        EncryptedJSON,
        nullable=False,
        comment="Encrypted restaurant address"
    )


# Platform model encrypted fields
class EncryptedPlatformFields:
    """Encrypted field definitions for Platform model."""
    
    owner_email = Column(
        SearchableEncryptedString(deterministic=True),
        unique=True,
        nullable=False,
        comment="Encrypted platform owner email"
    )


# Payment model encrypted fields
class EncryptedPaymentFields:
    """Encrypted field definitions for Payment model."""
    
    external_id = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted external payment provider ID"
    )
    
    payment_metadata = Column(
        EncryptedJSON,
        default={},
        comment="Encrypted payment metadata"
    )


# QRPayment model encrypted fields
class EncryptedQRPaymentFields:
    """Encrypted field definitions for QRPayment model."""
    
    qr_code_data = Column(
        EncryptedString,
        nullable=False,
        comment="Encrypted QR code payment data"
    )


# Order model encrypted fields
class EncryptedOrderFields:
    """Encrypted field definitions for Order model."""
    
    special_instructions = Column(
        EncryptedString,
        nullable=True,
        comment="Encrypted special instructions"
    )


# Migration helper
ENCRYPTION_FIELD_MAPPINGS = {
    "User": {
        "email": "string",
        "first_name": "string",
        "last_name": "string",
        "pin_code": "string"
    },
    "Customer": {
        "email": "string",
        "phone": "string",
        "first_name": "string",
        "last_name": "string"
    },
    "Restaurant": {
        "phone": "string",
        "email": "string",
        "address": "json"
    },
    "Platform": {
        "owner_email": "string"
    },
    "Payment": {
        "external_id": "string",
        "payment_metadata": "json"
    },
    "QRPayment": {
        "qr_code_data": "string"
    },
    "Order": {
        "special_instructions": "string"
    }
}