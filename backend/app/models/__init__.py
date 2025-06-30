# Import models from database.py to make them available through app.models
from app.core.database import ( # Assuming Base is defined here
    Base,
    Platform,
    Restaurant, # Imported from core.database
    User,
    Customer,
    Category,
    Product,
    Order,
    Payment,
    QRPayment,
    Section,
    Table,
    PosSession
)

# Import models from local files
# from .restaurants import Restaurant # Removed local import
from .employees import Employee
from .audit_log import (
    AuditLog,
    AuditEventType,
    AuditEventStatus
)
# Add other local model imports here e.g.
# from .inventory import InventoryItem
# from .schedules import Schedule

__all__ = [
    "Base",
    "Platform",
    "Restaurant", # Now refers to core.database.Restaurant
    "Employee",   # Added Employee model
    "User",
    "Customer",
    "Category",
    "Product",
    "Order",
    "Payment",
    "QRPayment",
    "Section",
    "Table",
    "PosSession",
    "AuditLog",
    "AuditEventType",
    "AuditEventStatus"
    # Add InventoryItem and Schedule to __all__ when they are created
]
