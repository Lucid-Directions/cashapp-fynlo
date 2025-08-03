# Import models from database.py to make them available through app.models
from app.core.database import (
    Base,
    Platform,
    Restaurant,
    User,
    UserRestaurant,
    Customer,
    Category,
    Product,
    Order,
    Payment,
    QRPayment,
    Section,
    Table,
    PosSession,
    InventoryItem,
    Recipe,
    InventoryLedgerEntry,
)

# Import models from audit_log.py
from .audit_log import AuditLog, AuditEventType, AuditEventStatus

# Import models from refund.py
from .refund import Refund, RefundLedger

# Import models from employee.py
from .employee import EmployeeProfile, Schedule, Shift, TimeEntry, PerformanceMetric

# Import models from reports.py
from .reports import (
    DailyReport,
    HourlyMetric,
    ProductPerformance,
    EmployeePerformance,
    FinancialSummary,
)

# Import models from stock_movement.py
from .stock_movement import (
    MovementType,
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    StockMovement,
    StockAlert,
    InventoryCount,
    InventoryCountItem,
)

# Import models from subscription.py (singular)
from .subscription import SubscriptionPlan, RestaurantSubscription, SubscriptionUsage

__all__ = [
    "Base",
    "Platform",
    "Restaurant",
    "User",
    "UserRestaurant",
    "Customer",
    "Category",
    "Product",
    "Order",
    "Payment",
    "QRPayment",
    "Section",
    "Table",
    "PosSession",
    "InventoryItem",
    "Recipe",
    "InventoryLedgerEntry",
    "AuditLog",
    "AuditEventType",
    "AuditEventStatus",
    "Refund",
    "RefundLedger",
    # Employee models
    "EmployeeProfile",
    "Schedule",
    "Shift",
    "TimeEntry",
    "PerformanceMetric",
    # Reports models
    "DailyReport",
    "HourlyMetric",
    "ProductPerformance",
    "EmployeePerformance",
    "FinancialSummary",
    # Stock movement models
    "MovementType",
    "Supplier",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "StockMovement",
    "StockAlert",
    "InventoryCount",
    "InventoryCountItem",
    # Subscription models
    "SubscriptionPlan",
    "RestaurantSubscription",
    "SubscriptionUsage",
]
