"""
Platform Configuration Models
Centralized settings managed by Fynlo platform
"""TODO: Add docstring."""

from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class PlatformConfiguration(Base):
    """
    Platform-wide configuration settings controlled by Fynlo
    These settings are read-only for restaurants
    """
    __tablename__ = "platform_configurations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(255), unique=True, nullable=False, index=True)
    config_value = Column(JSON, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    is_sensitive = Column(Boolean, default=False)
    validation_schema = Column(JSON)  # JSON schema for validation
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True))  # Admin user who made the change

    # Create indexes for performance
    __table_args__ = (
        Index('idx_platform_config_category_active', 'category', 'is_active'),
        Index('idx_platform_config_key_active', 'config_key', 'is_active'),
    )

    def __repr__(self):
        return f"<PlatformConfiguration(key='{self.config_key}', category='{self.category}')>"

class RestaurantOverride(Base):
    """
    Restaurant-specific overrides of platform settings (where allowed)
    These must comply with platform limits and validation rules
    """
    __tablename__ = "restaurant_overrides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    config_key = Column(String(255), nullable=False)
    override_value = Column(JSON, nullable=False)
    platform_limit = Column(JSON)  # The platform-defined limits for this override
    is_approved = Column(Boolean, default=True)  # For overrides requiring approval
    approved_by = Column(UUID(as_uuid=True))  # Admin who approved
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True))  # Restaurant user who created override

    # Ensure unique overrides per restaurant per setting
    __table_args__ = (
        Index('idx_restaurant_override_unique', 'restaurant_id', 'config_key', unique=True),
        Index('idx_restaurant_override_approval', 'is_approved', 'approved_at'),
    )

    def __repr__(self):
        return f"<RestaurantOverride(restaurant_id='{self.restaurant_id}', key='{self.config_key}')>"

class ConfigurationAudit(Base):
    """
    Audit trail for all configuration changes
    Tracks who changed what and when for compliance
    """
    __tablename__ = "configuration_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_type = Column(String(50), nullable=False)  # 'platform' or 'restaurant'
    config_key = Column(String(255), nullable=False)
    entity_id = Column(UUID(as_uuid=True))  # platform_config.id or restaurant.id
    old_value = Column(JSON)
    new_value = Column(JSON)
    change_reason = Column(Text)
    change_source = Column(String(100))  # 'admin_dashboard', 'api', 'migration', etc.
    changed_by = Column(UUID(as_uuid=True), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(Text)

    # Indexes for audit queries
    __table_args__ = (
        Index('idx_config_audit_type_key', 'config_type', 'config_key'),
        Index('idx_config_audit_entity', 'entity_id', 'changed_at'),
        Index('idx_config_audit_user_time', 'changed_by', 'changed_at'),
    )

    def __repr__(self):
        return f"<ConfigurationAudit(type='{self.config_type}', key='{self.config_key}', at='{self.changed_at}')>"

class PlatformFeatureFlag(Base):
    """
    Feature flags controlled at platform level
    Allows enabling/disabling features across restaurants
    """
    __tablename__ = "platform_feature_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_key = Column(String(255), unique=True, nullable=False, index=True)
    is_enabled = Column(Boolean, default=False)
    rollout_percentage = Column(Numeric(5, 2), default=0.0)  # 0.00 to 100.00
    target_restaurants = Column(JSON)  # Array of restaurant IDs for targeted rollout
    description = Column(Text)
    feature_category = Column(String(100))  # 'payment', 'analytics', 'ui', etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True))

    def __repr__(self):
        return f"<PlatformFeatureFlag(feature='{self.feature_key}', enabled={self.is_enabled})>"

# Default platform configurations
DEFAULT_PLATFORM_CONFIGS = [
    # Payment Processing Fees
    {
        'config_key': 'payment.fees.qr_code',
        'config_value': {'percentage': 1.2, 'fixed_fee': 0.0, 'currency': 'GBP'},
        'category': 'payment_fees',
        'description': 'QR code payment processing fee - Fynlo competitive advantage',
        'is_sensitive': False,
        'validation_schema': {
            'type': 'object',
            'properties': {
                'percentage': {'type': 'number', 'minimum': 0, 'maximum': 10},
                'fixed_fee': {'type': 'number', 'minimum': 0},
                'currency': {'type': 'string', 'enum': ['GBP', 'EUR', 'USD']}
            },
            'required': ['percentage', 'fixed_fee', 'currency']
        }
    },
    {
        'config_key': 'payment.fees.stripe',
        'config_value': {'percentage': 1.4, 'fixed_fee': 0.20, 'currency': 'GBP'},
        'category': 'payment_fees',
        'description': 'Stripe payment processing fee',
        'is_sensitive': False,
        'validation_schema': {
            'type': 'object',
            'properties': {
                'percentage': {'type': 'number', 'minimum': 0, 'maximum': 10},
                'fixed_fee': {'type': 'number', 'minimum': 0},
                'currency': {'type': 'string', 'enum': ['GBP', 'EUR', 'USD']}
            },
            'required': ['percentage', 'fixed_fee', 'currency']
        }
    },
    {
        'config_key': 'payment.fees.square',
        'config_value': {'percentage': 1.75, 'fixed_fee': 0.0, 'currency': 'GBP'},
        'category': 'payment_fees',
        'description': 'Square payment processing fee',
        'is_sensitive': False,
    },
    {
        'config_key': 'payment.fees.sumup',
        'config_value': {
            'high_volume': {'percentage': 0.69, 'monthly_fee': 19.0, 'threshold': 2714.0},
            'standard': {'percentage': 1.69, 'monthly_fee': 0.0},
            'currency': 'GBP'
        },
        'category': 'payment_fees',
        'description': 'SumUp payment processing fees with volume tiers',
        'is_sensitive': False,
    },
    {
        'config_key': 'payment.fees.cash',
        'config_value': {'percentage': 0.0, 'fixed_fee': 0.0, 'currency': 'GBP'},
        'category': 'payment_fees',
        'description': 'Cash payment processing (no fees)',
        'is_sensitive': False,
    },
    
    # Transaction Limits
    {
        'config_key': 'payment.limits.minimum_transaction',
        'config_value': {'amount': 0.01, 'currency': 'GBP'},
        'category': 'payment_limits',
        'description': 'Minimum transaction amount across all payment methods',
    },
    {
        'config_key': 'payment.limits.maximum_transaction',
        'config_value': {'amount': 50000.0, 'currency': 'GBP'},
        'category': 'payment_limits',
        'description': 'Maximum transaction amount across all payment methods',
    },
    {
        'config_key': 'payment.limits.daily_limit',
        'config_value': {'amount': 100000.0, 'currency': 'GBP'},
        'category': 'payment_limits',
        'description': 'Daily transaction limit per restaurant',
    },

    # Security Settings
    {
        'config_key': 'security.session_timeout',
        'config_value': {'minutes': 30},
        'category': 'security',
        'description': 'Session timeout for POS applications',
    },
    {
        'config_key': 'security.api_rate_limit',
        'config_value': {'requests_per_minute': 100, 'burst_limit': 200},
        'category': 'security',
        'description': 'API rate limiting configuration',
    },
    {
        'config_key': 'security.data_retention_days',
        'config_value': {'payment_logs': 2555, 'audit_logs': 2555, 'user_sessions': 90},  # 7 years
        'category': 'security',
        'description': 'Data retention periods for compliance',
    },

    # Feature Flags
    {
        'config_key': 'features.smart_routing_enabled',
        'config_value': {'enabled': True},
        'category': 'features',
        'description': 'Enable smart payment routing algorithms',
    },
    {
        'config_key': 'features.analytics_enabled',
        'config_value': {'enabled': True},
        'category': 'features',
        'description': 'Enable analytics and reporting features',
    },
    {
        'config_key': 'features.qr_payments_enabled',
        'config_value': {'enabled': True},
        'category': 'features',
        'description': 'Enable QR code payment functionality',
    },

    # Business Rules
    {
        'config_key': 'business.restaurant_limits.max_discount_percentage',
        'config_value': {'percentage': 50.0},
        'category': 'business_rules',
        'description': 'Maximum discount percentage restaurants can offer',
    },
    {
        'config_key': 'business.restaurant_limits.max_service_charge',
        'config_value': {'percentage': 20.0},
        'category': 'business_rules',
        'description': 'Maximum service charge restaurants can apply',
    },

    # Service Charge Configuration
    {
        'config_key': 'platform.service_charge.enabled',
        'config_value': {'value': True}, # Storing as a dict to match other config_value structures
        'category': 'service_charge',
        'description': 'Enable or disable platform-wide service charge.',
        'is_sensitive': False,
        'validation_schema': {'type': 'object', 'properties': {'value': {'type': 'boolean'}}}
    },
    {
        'config_key': 'platform.service_charge.rate',
        'config_value': {'value': 12.5}, # Storing as a dict
        'category': 'service_charge',
        'description': 'Service charge rate as a percentage (e.g., 12.5 for 12.5%).',
        'is_sensitive': False,
        'validation_schema': {'type': 'object', 'properties': {'value': {'type': 'number', 'minimum': 0, 'maximum': 100}}}
    },
    {
        'config_key': 'platform.service_charge.description',
        'config_value': {'value': 'Platform service charge'}, # Storing as a dict
        'category': 'service_charge',
        'description': 'Description for the service charge (e.g., for display on receipts).',
        'is_sensitive': False,
        'validation_schema': {'type': 'object', 'properties': {'value': {'type': 'string', 'maxLength': 255}}}
    },
    {
        'config_key': 'platform.service_charge.currency',
        'config_value': {'value': 'GBP'}, # Storing as a dict
        'category': 'service_charge',
        'description': 'Currency for the service charge.',
        'is_sensitive': False,
        'validation_schema': {'type': 'object', 'properties': {'value': {'type': 'string', 'enum': ['GBP', 'USD', 'EUR']}}}
    },
]

# Default feature flags
DEFAULT_FEATURE_FLAGS = [
    {
        'feature_key': 'payment_smart_routing',
        'is_enabled': True,
        'rollout_percentage': 100.0,
        'description': 'Smart payment provider routing',
        'feature_category': 'payment',
    },
    {
        'feature_key': 'analytics_dashboard',
        'is_enabled': True,
        'rollout_percentage': 100.0,
        'description': 'Analytics and reporting dashboard',
        'feature_category': 'analytics',
    },
    {
        'feature_key': 'qr_code_payments',
        'is_enabled': True,
        'rollout_percentage': 100.0,
        'description': 'QR code payment processing',
        'feature_category': 'payment',
    },
    {
        'feature_key': 'cash_payments',
        'is_enabled': True,
        'rollout_percentage': 100.0,
        'description': 'Cash payment handling',
        'feature_category': 'payment',
    },
    {
        'feature_key': 'demo_mode',
        'is_enabled': True,
        'rollout_percentage': 100.0,
        'description': 'Demo mode for investor presentations',
        'feature_category': 'system',
    },
]