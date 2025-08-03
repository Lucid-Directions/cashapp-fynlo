"""
Platform Settings Service
Manages centralized platform configurations and restaurant overrides
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from jsonschema import validate, ValidationError

from app.models.platform_config import (
    PlatformConfiguration,
    RestaurantOverride,
    ConfigurationAudit,
    PlatformFeatureFlag,
    DEFAULT_PLATFORM_CONFIGS,
    DEFAULT_FEATURE_FLAGS,
)

logger = logging.getLogger(__name__)


class PlatformSettingsService:
    """Service for managing platform-controlled settings"""

    def __init__(self, db: Session):
        self.db = db

    async def get_platform_setting(self, config_key: str) -> Optional[Dict[str, Any]]:
        """Get a specific platform setting by key"""
        setting = (
            self.db.query(PlatformConfiguration)
            .filter(
                and_(
                    PlatformConfiguration.config_key == config_key,
                    PlatformConfiguration.is_active == True,
                )
            )
            .first()
        )

        if not setting:
            return None

        return {
            "key": setting.config_key,
            "value": setting.config_value,
            "category": setting.category,
            "description": setting.description,
            "is_sensitive": setting.is_sensitive,
            "updated_at": (
                setting.updated_at.isoformat() if setting.updated_at else None
            ),
        }

    async def get_platform_settings(
        self, category: Optional[str] = None, include_sensitive: bool = False
    ) -> Dict[str, Any]:
        """Get all platform settings, optionally filtered by category"""

        query = self.db.query(PlatformConfiguration).filter(
            PlatformConfiguration.is_active == True
        )

        if category:
            query = query.filter(PlatformConfiguration.category == category)

        if not include_sensitive:
            query = query.filter(PlatformConfiguration.is_sensitive == False)

        settings = query.all()

        result = {}
        for setting in settings:
            result[setting.config_key] = {
                "value": setting.config_value,
                "category": setting.category,
                "description": setting.description,
                "is_sensitive": setting.is_sensitive,
                "updated_at": (
                    setting.updated_at.isoformat() if setting.updated_at else None
                ),
            }

        return result

    async def update_platform_setting(
        self,
        config_key: str,
        config_value: Any,
        updated_by: str,
        change_reason: Optional[str] = None,
        change_source: str = "api",
    ) -> bool:
        """Update a platform setting with audit trail"""

        # Get existing setting
        setting = (
            self.db.query(PlatformConfiguration)
            .filter(PlatformConfiguration.config_key == config_key)
            .first()
        )

        if not setting:
            logger.error(f"Platform setting '{config_key}' not found")
            return False

        # Validate against schema if defined
        if setting.validation_schema:
            try:
                validate(instance=config_value, schema=setting.validation_schema)
            except ValidationError as e:
                logger.error(f"Validation failed for {config_key}: {e}")
                raise ValueError(f"Invalid configuration value: {e.message}")

        # Store old value for audit
        old_value = setting.config_value

        # Update setting
        setting.config_value = config_value
        setting.updated_at = datetime.utcnow()
        setting.updated_by = updated_by

        # Create audit record
        audit = ConfigurationAudit(
            config_type="platform",
            config_key=config_key,
            entity_id=setting.id,
            old_value=old_value,
            new_value=config_value,
            change_reason=change_reason,
            change_source=change_source,
            changed_by=updated_by,
        )

        self.db.add(audit)
        self.db.commit()

        logger.info(f"Updated platform setting '{config_key}' by user {updated_by}")
        return True

    async def get_restaurant_effective_settings(
        self, restaurant_id: str, category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get effective settings for a restaurant (platform + overrides)"""

        # Get platform settings
        platform_settings = await self.get_platform_settings(category=category)

        # Get restaurant overrides
        query = self.db.query(RestaurantOverride).filter(
            and_(
                RestaurantOverride.restaurant_id == restaurant_id,
                RestaurantOverride.is_approved == True,
            )
        )

        overrides = query.all()

        # Merge settings
        effective_settings = {}

        # Start with platform settings
        for key, platform_config in platform_settings.items():
            effective_settings[key] = {
                "value": platform_config["value"],
                "source": "platform",
                "category": platform_config["category"],
                "description": platform_config["description"],
                "can_override": self._can_restaurant_override(key),
            }

        # Apply restaurant overrides
        for override in overrides:
            if override.config_key in effective_settings:
                effective_settings[override.config_key][
                    "value"
                ] = override.override_value
                effective_settings[override.config_key]["source"] = "restaurant"
                effective_settings[override.config_key]["override_id"] = str(
                    override.id
                )

        return effective_settings

    async def set_restaurant_override(
        self,
        restaurant_id: str,
        config_key: str,
        override_value: Any,
        created_by: str,
        requires_approval: bool = False,
    ) -> bool:
        """Set a restaurant override for a platform setting"""

        # Check if override is allowed
        if not self._can_restaurant_override(config_key):
            raise ValueError(f"Restaurant overrides not allowed for '{config_key}'")

        # Get platform setting to validate against limits
        platform_setting = await self.get_platform_setting(config_key)
        if not platform_setting:
            raise ValueError(f"Platform setting '{config_key}' not found")

        # Validate override against platform limits
        platform_limit = self._get_platform_limit(config_key)
        if not self._validate_override(config_key, override_value, platform_limit):
            raise ValueError(f"Override value exceeds platform limits")

        # Check for existing override
        existing = (
            self.db.query(RestaurantOverride)
            .filter(
                and_(
                    RestaurantOverride.restaurant_id == restaurant_id,
                    RestaurantOverride.config_key == config_key,
                )
            )
            .first()
        )

        if existing:
            # Update existing override
            old_value = existing.override_value
            existing.override_value = override_value
            existing.updated_at = datetime.utcnow()
            existing.is_approved = not requires_approval
            override_record = existing
        else:
            # Create new override
            override_record = RestaurantOverride(
                restaurant_id=restaurant_id,
                config_key=config_key,
                override_value=override_value,
                platform_limit=platform_limit,
                is_approved=not requires_approval,
                created_by=created_by,
            )
            self.db.add(override_record)
            old_value = None

        # Create audit record
        audit = ConfigurationAudit(
            config_type="restaurant",
            config_key=config_key,
            entity_id=restaurant_id,
            old_value=old_value,
            new_value=override_value,
            change_reason=f"Restaurant override for {config_key}",
            change_source="restaurant_api",
            changed_by=created_by,
        )

        self.db.add(audit)
        self.db.commit()

        logger.info(f"Set restaurant override for '{config_key}' by user {created_by}")
        return True

    async def get_feature_flags(
        self, restaurant_id: Optional[str] = None
    ) -> Dict[str, bool]:
        """Get feature flags, optionally for a specific restaurant"""

        flags = self.db.query(PlatformFeatureFlag).all()

        result = {}
        for flag in flags:
            is_enabled = flag.is_enabled

            # Check if restaurant is in targeted rollout
            if restaurant_id and flag.target_restaurants:
                if restaurant_id in flag.target_restaurants:
                    is_enabled = True
                elif flag.rollout_percentage < 100.0:
                    # Use restaurant ID for consistent rollout
                    import hashlib

                    hash_val = int(
                        hashlib.md5(
                            f"{flag.feature_key}:{restaurant_id}".encode()
                        ).hexdigest(),
                        16,
                    )
                    percentage = (hash_val % 100) + 1
                    is_enabled = percentage <= flag.rollout_percentage

            result[flag.feature_key] = is_enabled

        return result

    async def get_service_charge_config(self) -> Dict[str, Any]:
        """Get the consolidated service charge configuration."""
        config_keys = [
            "platform.service_charge.enabled",
            "platform.service_charge.rate",
            "platform.service_charge.description",
            "platform.service_charge.currency",
        ]

        settings = await self.get_platform_settings(category="service_charge")

        # Fallback to default values if a key is missing, to prevent TypeErrors
        # The default values are defined in DEFAULT_PLATFORM_CONFIGS in platform_config.py
        # This ensures that even if DB initialization failed or a key was somehow deleted,
        # we return a well-structured response.

        default_configs_map = {
            item["config_key"]: item["config_value"]["value"]
            for item in DEFAULT_PLATFORM_CONFIGS
            if item["config_key"] in config_keys
        }

        enabled = (
            settings.get("platform.service_charge.enabled", {})
            .get("value", {})
            .get("value", default_configs_map.get("platform.service_charge.enabled"))
        )
        rate = (
            settings.get("platform.service_charge.rate", {})
            .get("value", {})
            .get("value", default_configs_map.get("platform.service_charge.rate"))
        )
        description = (
            settings.get("platform.service_charge.description", {})
            .get("value", {})
            .get(
                "value", default_configs_map.get("platform.service_charge.description")
            )
        )
        currency = (
            settings.get("platform.service_charge.currency", {})
            .get("value", {})
            .get("value", default_configs_map.get("platform.service_charge.currency"))
        )

        # Ensure correct types, especially for boolean, as get() can return None
        if not isinstance(enabled, bool):
            enabled = default_configs_map.get(
                "platform.service_charge.enabled", False
            )  # Default to False if type is wrong

        return {
            "service_charge": {
                "enabled": enabled,
                "rate": rate,
                "description": description,
                "currency": currency,
            }
        }

    async def update_service_charge_config(
        self,
        config_data: Dict[str, Any],
        updated_by: str,
        change_reason: Optional[str] = None,
    ) -> bool:
        """Update service charge configuration settings."""
        # config_data is expected to be like:
        # {
        #   "enabled": true,
        #   "rate": 12.5,
        #   "description": "Platform service charge",
        #   "currency": "GBP"
        # }

        all_success = True
        for key, value in config_data.items():
            config_key = f"platform.service_charge.{key}"
            try:
                # Wrap the scalar value in a dictionary as per our storage convention
                success = await self.update_platform_setting(
                    config_key=config_key,
                    config_value={
                        "value": value
                    },  # Ensure value is stored in the {'value': ...} structure
                    updated_by=updated_by,
                    change_reason=change_reason or f"Update to service charge {key}",
                    change_source="service_charge_api",
                )
                if not success:
                    all_success = False
                    logger.warning(
                        f"Failed to update service charge setting: {config_key}"
                    )
            except (
                ValueError
            ) as e:  # Catch validation errors from update_platform_setting
                logger.error(f"Validation error updating {config_key}: {e}")
                all_success = False  # Consider it a failure for this key
                raise  # Re-raise to inform the caller (API endpoint) of the bad request
            except Exception as e:
                logger.error(f"Error updating service charge setting {config_key}: {e}")
                all_success = False

        return all_success

    async def update_feature_flag(
        self,
        feature_key: str,
        is_enabled: bool,
        rollout_percentage: Optional[float] = None,
        target_restaurants: Optional[List[str]] = None,
        updated_by: str = None,
    ) -> bool:
        """Update a feature flag"""

        flag = (
            self.db.query(PlatformFeatureFlag)
            .filter(PlatformFeatureFlag.feature_key == feature_key)
            .first()
        )

        if not flag:
            logger.error(f"Feature flag '{feature_key}' not found")
            return False

        flag.is_enabled = is_enabled
        if rollout_percentage is not None:
            flag.rollout_percentage = rollout_percentage
        if target_restaurants is not None:
            flag.target_restaurants = target_restaurants
        flag.updated_at = datetime.utcnow()

        self.db.commit()

        logger.info(f"Updated feature flag '{feature_key}' to {is_enabled}")
        return True

    async def get_payment_fees(self) -> Dict[str, Dict[str, Any]]:
        """Get all payment processing fees"""

        fee_settings = await self.get_platform_settings(category="payment_fees")

        fees = {}
        for key, config in fee_settings.items():
            provider = key.replace("payment.fees.", "")
            fees[provider] = config["value"]

        return fees

    async def calculate_effective_fee(
        self,
        payment_method: str,
        amount: float,
        restaurant_id: Optional[str] = None,
        monthly_volume: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Calculate effective fee for a payment method"""

        # Get platform fee configuration
        fee_config = await self.get_platform_setting(f"payment.fees.{payment_method}")
        if not fee_config:
            raise ValueError(
                f"No fee configuration for payment method '{payment_method}'"
            )

        fee_data = fee_config["value"]

        # Calculate base platform fee
        if payment_method == "sumup" and monthly_volume:
            # SumUp has volume-based pricing
            if monthly_volume >= fee_data.get("high_volume", {}).get("threshold", 2714):
                percentage = fee_data["high_volume"]["percentage"]
                monthly_fee = fee_data["high_volume"]["monthly_fee"]
                # Estimate monthly fee per transaction
                estimated_transactions = monthly_volume / (
                    amount or 50
                )  # Assume avg £50 transaction
                fee_per_transaction = monthly_fee / max(estimated_transactions, 1)
                total_fee = (amount * percentage / 100) + fee_per_transaction
            else:
                percentage = fee_data["standard"]["percentage"]
                total_fee = amount * percentage / 100
        else:
            # Standard percentage + fixed fee
            percentage = fee_data.get("percentage", 0)
            fixed_fee = fee_data.get("fixed_fee", 0)
            total_fee = (amount * percentage / 100) + fixed_fee

        # Check for restaurant markup (if allowed)
        restaurant_markup = 0.0
        if restaurant_id:
            effective_settings = await self.get_restaurant_effective_settings(
                restaurant_id, category="payment_fees"
            )
            markup_key = f"payment.markup.{payment_method}"
            if markup_key in effective_settings:
                restaurant_markup = effective_settings[markup_key]["value"].get(
                    "percentage", 0
                )

        effective_fee = total_fee + (amount * restaurant_markup / 100)

        return {
            "payment_method": payment_method,
            "amount": amount,
            "platform_fee": total_fee,
            "restaurant_markup": restaurant_markup,
            "effective_fee": effective_fee,
            "fee_percentage": (effective_fee / amount * 100) if amount > 0 else 0,
            "currency": fee_data.get("currency", "GBP"),
        }

    def _can_restaurant_override(self, config_key: str) -> bool:
        """Check if restaurants can override a specific platform setting"""

        # Settings that restaurants can override (with limits)
        allowed_overrides = [
            "payment.markup.*",  # Small markup on payment fees
            "business.discount.maximum",  # Within platform limits
            "ui.theme.*",  # UI customization
            "receipt.customization.*",  # Receipt templates
        ]

        # Payment fees and security settings cannot be overridden
        forbidden_overrides = [
            "payment.fees.*",
            "security.*",
            "compliance.*",
            "features.*",
        ]

        # Check forbidden first
        for pattern in forbidden_overrides:
            if self._matches_pattern(config_key, pattern):
                return False

        # Check allowed
        for pattern in allowed_overrides:
            if self._matches_pattern(config_key, pattern):
                return True

        return False

    def _matches_pattern(self, config_key: str, pattern: str) -> bool:
        """Check if config key matches a wildcard pattern"""
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return config_key.startswith(prefix)
        return config_key == pattern

    def _get_platform_limit(self, config_key: str) -> Optional[Dict[str, Any]]:
        """Get platform-defined limits for restaurant overrides"""

        limits = {
            "payment.markup.qr_code": {"max_percentage": 0.5},
            "payment.markup.stripe": {"max_percentage": 0.3},
            "payment.markup.square": {"max_percentage": 0.3},
            "business.discount.maximum": {"max_percentage": 50.0},
        }

        return limits.get(config_key)

    def _validate_override(
        self,
        config_key: str,
        override_value: Any,
        platform_limit: Optional[Dict[str, Any]],
    ) -> bool:
        """Validate restaurant override against platform limits"""

        if not platform_limit:
            return True

        if config_key.startswith("payment.markup."):
            max_percentage = platform_limit.get("max_percentage", 0)
            value_percentage = override_value.get("percentage", 0)
            return value_percentage <= max_percentage

        if config_key == "business.discount.maximum":
            max_percentage = platform_limit.get("max_percentage", 100)
            return override_value.get("percentage", 0) <= max_percentage

        return True

    async def initialize_default_settings(self) -> bool:
        """Initialize platform with default configurations"""

        try:
            # Add default platform configurations
            for config_data in DEFAULT_PLATFORM_CONFIGS:
                existing = (
                    self.db.query(PlatformConfiguration)
                    .filter(
                        PlatformConfiguration.config_key == config_data["config_key"]
                    )
                    .first()
                )

                if not existing:
                    config = PlatformConfiguration(**config_data)
                    self.db.add(config)

            # Add default feature flags
            for flag_data in DEFAULT_FEATURE_FLAGS:
                existing = (
                    self.db.query(PlatformFeatureFlag)
                    .filter(PlatformFeatureFlag.feature_key == flag_data["feature_key"])
                    .first()
                )

                if not existing:
                    flag = PlatformFeatureFlag(**flag_data)
                    self.db.add(flag)

            self.db.commit()
            logger.info("Default platform settings initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize default settings: {e}")
            self.db.rollback()
            return False

    async def get_audit_trail(
        self,
        config_key: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get configuration audit trail"""

        query = self.db.query(ConfigurationAudit).order_by(
            ConfigurationAudit.changed_at.desc()
        )

        if config_key:
            query = query.filter(ConfigurationAudit.config_key == config_key)

        if entity_id:
            query = query.filter(ConfigurationAudit.entity_id == entity_id)

        audit_records = query.limit(limit).all()

        result = []
        for record in audit_records:
            result.append(
                {
                    "id": str(record.id),
                    "config_type": record.config_type,
                    "config_key": record.config_key,
                    "entity_id": str(record.entity_id) if record.entity_id else None,
                    "old_value": record.old_value,
                    "new_value": record.new_value,
                    "change_reason": record.change_reason,
                    "change_source": record.change_source,
                    "changed_by": str(record.changed_by),
                    "changed_at": record.changed_at.isoformat(),
                    "ip_address": record.ip_address,
                    "user_agent": record.user_agent,
                }
            )

        return result
