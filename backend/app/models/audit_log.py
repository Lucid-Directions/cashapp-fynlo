from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLAlchemyEnum, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.sql import func
from sqlalchemy.sql.elements import quoted_name
from sqlalchemy.orm import relationship # Added for potential future use
import uuid
import enum

# Assuming Base is imported from app.core.database in practice,
# or defined in a way that it's accessible when models are loaded.
# For now, we'll assume Base will be available from app.core.database.Base
from app.core.database import Base


# Enum for Event Types
class AuditEventType(str, enum.Enum):
    # Authentication
    USER_LOGIN_SUCCESS = "USER_LOGIN_SUCCESS"
    USER_LOGIN_FAILURE = "USER_LOGIN_FAILURE"
    USER_LOGOUT = "USER_LOGOUT"
    USER_REGISTRATION_SUCCESS = "USER_REGISTRATION_SUCCESS"
    USER_REGISTRATION_FAILURE = "USER_REGISTRATION_FAILURE"
    PASSWORD_CHANGE_SUCCESS = "PASSWORD_CHANGE_SUCCESS"
    PASSWORD_CHANGE_FAILURE = "PASSWORD_CHANGE_FAILURE"
    TOKEN_BLACKLISTED = "TOKEN_BLACKLISTED"

    # Authorization
    ACCESS_GRANTED = "ACCESS_GRANTED"
    ACCESS_DENIED = "ACCESS_DENIED"
    PRIVILEGE_ESCALATION_ATTEMPT = "PRIVILEGE_ESCALATION_ATTEMPT"
    ROLE_CHANGE_SUCCESS = "ROLE_CHANGE_SUCCESS"
    ROLE_CHANGE_FAILURE = "ROLE_CHANGE_FAILURE"

    # Payment Security
    PAYMENT_INITIATED = "PAYMENT_INITIATED"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"
    PAYMENT_FAILURE = "PAYMENT_FAILURE"
    PAYMENT_FRAUD_DETECTED = "PAYMENT_FRAUD_DETECTED"
    REFUND_INITIATED = "REFUND_INITIATED"
    REFUND_SUCCESS = "REFUND_SUCCESS"
    REFUND_FAILURE = "REFUND_FAILURE"

    # Data Access
    SENSITIVE_DATA_ACCESSED = "SENSITIVE_DATA_ACCESSED"
    DATA_EXPORTED = "DATA_EXPORTED"
    DATA_DELETED = "DATA_DELETED"

    # Admin Actions
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    USER_ACTIVATED = "USER_ACTIVATED"
    USER_DEACTIVATED = "USER_DEACTIVATED"
    SYSTEM_CONFIG_CHANGED = "SYSTEM_CONFIG_CHANGED"
    SECURITY_SETTING_CHANGED = "SECURITY_SETTING_CHANGED"

    # General Security Events
    SUSPICIOUS_ACTIVITY_DETECTED = "SUSPICIOUS_ACTIVITY_DETECTED"

# Enum for Event Status
class AuditEventStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    PENDING = "PENDING"
    INFO = "INFO"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    event_type = Column(SQLAlchemyEnum(AuditEventType, name="audit_event_type_enum", create_type=True), nullable=False)
    event_status = Column(SQLAlchemyEnum(AuditEventStatus, name="audit_event_status_enum", create_type=True), nullable=False)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", name="fk_audit_log_user_id"), nullable=True)
    username_or_email = Column(String(255), nullable=True)

    ip_address = Column(INET, nullable=True)
    user_agent = Column(String(512), nullable=True)

    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(255), nullable=True)

    action_performed = Column(String(255), nullable=False)
    details = Column(JSONB, nullable=True)
    risk_score = Column(Integer, nullable=True)

    # Relationships
    # user = relationship("User", back_populates="audit_logs") # Example if User model had audit_logs relationship

    __table_args__ = (
        Index("ix_audit_logs_timestamp", "timestamp"),
        Index("ix_audit_logs_event_type", "event_type"),
        Index("ix_audit_logs_event_status", "event_status"),
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_ip_address", "ip_address"),
        Index("ix_audit_logs_resource_type_resource_id", "resource_type", "resource_id"),
        # For JSONB, a GIN index is often useful if querying specific keys within the details
        Index('ix_audit_logs_details_gin', quoted_name('details', quote=False), postgresql_using='gin'),
    )

    def __repr__(self):
        return f"<AuditLog(id={self.id}, event_type='{self.event_type.value}', user_id='{self.user_id}')>"
