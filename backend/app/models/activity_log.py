"""
Portal Activity Log model for audit trail


"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class PortalActivityLog(Base):
    """Model for tracking portal user activities"""
    
    __tablename__ = "portal_activity_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(JSONB, nullable=True, default={})
    ip_address = Column(String(45), nullable=True)  # Supports IPv4 and IPv6
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="activity_logs")
    restaurant = relationship("Restaurant", backref="activity_logs")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_activity_log_user_id', 'user_id'),
        Index('idx_activity_log_restaurant_id', 'restaurant_id'),
        Index('idx_activity_log_action', 'action'),
        Index('idx_activity_log_created_at', 'created_at'),
        Index('idx_activity_log_user_restaurant', 'user_id', 'restaurant_id'),
    )
    
    def __repr__(self):
        return f"<PortalActivityLog {self.action} by {self.user_id} at {self.created_at}>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "restaurant_id": str(self.restaurant_id) if self.restaurant_id else None,
            "action": self.action,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }