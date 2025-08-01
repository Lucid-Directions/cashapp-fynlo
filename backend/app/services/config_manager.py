"""
Configuration Manager for Payment Providers
Centralized configuration management with environment support and validation
<<<<<<< HEAD
=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)


"""
import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from decimal import Decimal
import json
from pathlib import Path

logger = logging.getLogger(__name__)

class Environment(Enum):
    """Supported environments"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"

@dataclass
class ProviderConfig:
    """Configuration for a payment provider"""
    name: str
    enabled: bool = True
    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    environment: str = "production"
    webhook_url: Optional[str] = None
    timeout_seconds: int = 30
    retry_attempts: int = 3
    custom_settings: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RoutingConfig:
    """Smart routing configuration"""
    enabled: bool = True
    default_strategy: str = "balanced"
    volume_thresholds: Dict[str, Decimal] = field(default_factory=lambda: {
        "sumup_optimal": Decimal("2714"),
        "volume_discount": Decimal("10000"),
        "enterprise": Decimal("50000")
    })
    provider_weights: Dict[str, Dict[str, float]] = field(default_factory=dict)
    fallback_provider: str = "stripe"

@dataclass
class FeatureFlags:
    """Feature flags for payment system"""
    smart_routing_enabled: bool = True
    analytics_enabled: bool = True
    volume_tracking_enabled: bool = True
    qr_payments_enabled: bool = True
    cash_payments_enabled: bool = True
    auto_refunds_enabled: bool = False
    webhook_retries_enabled: bool = True
    cost_optimization_alerts: bool = True

@dataclass
class SecurityConfig:
    """Security configuration"""
    encrypt_api_keys: bool = True
    webhook_signature_validation: bool = True
    rate_limiting_enabled: bool = True
    max_requests_per_minute: int = 100
    allowed_origins: List[str] = field(default_factory=list)
    ssl_required: bool = True

class ConfigurationManager:
    """Central configuration manager for payment system"""
    
    def __init__(self, environment: Optional[Environment] = None):
        self.environment = environment or self._detect_environment()
        self.config_dir = Path(__file__).parent.parent.parent / "config"
        self.config_dir.mkdir(exist_ok=True)
        
        # Initialize configurations
        self.providers: Dict[str, ProviderConfig] = {}
        self.routing: RoutingConfig = RoutingConfig()
        self.features: FeatureFlags = FeatureFlags()
        self.security: SecurityConfig = SecurityConfig()
        
        # Load configurations
        self._load_configurations()
    
    def _detect_environment(self) -> Environment:
        """Detect current environment from environment variables"""
        env_name = os.getenv("FYNLO_ENV", "development").lower()
        try:
            return Environment(env_name)
        except ValueError:
            logger.warning(f"Unknown environment '{env_name}', defaulting to development")
            return Environment.DEVELOPMENT
    
    def _load_configurations(self):
        """Load configurations from files and environment variables"""
        # Load from JSON config files
        self._load_from_files()
        
        # Override with environment variables
        self._load_from_environment()
        
        # Validate configurations
        self._validate_configurations()
    
    def _load_from_files(self):
        """Load configurations from JSON files"""
        config_file = self.config_dir / f"payment_config_{self.environment.value}.json"
        
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    config_data = json.load(f)
                
                # Load provider configurations
                if "providers" in config_data:
                    for name, provider_data in config_data["providers"].items():
                        self.providers[name] = ProviderConfig(
                            name=name,
                            **provider_data
                        )
                
                # Load routing configuration
                if "routing" in config_data:
                    routing_data = config_data["routing"]
                    self.routing = RoutingConfig(
                        enabled=routing_data.get("enabled", True),
                        default_strategy=routing_data.get("default_strategy", "balanced"),
                        volume_thresholds={
                            k: Decimal(str(v)) 
                            for k, v in routing_data.get("volume_thresholds", {}).items()
                        },
                        provider_weights=routing_data.get("provider_weights", {}),
                        fallback_provider=routing_data.get("fallback_provider", "stripe")
                    )
                
                # Load feature flags
                if "features" in config_data:
                    feature_data = config_data["features"]
                    self.features = FeatureFlags(**feature_data)
                
                # Load security configuration
                if "security" in config_data:
                    security_data = config_data["security"]
                    self.security = SecurityConfig(**security_data)
                
                logger.info(f"Loaded configuration from {config_file}")
                
            except Exception as e:
                logger.error(f"Failed to load config from {config_file}: {e}")
        else:
            logger.info(f"No config file found at {config_file}, using defaults")
    
    def _load_from_environment(self):
        """Load and override configurations from environment variables"""
        
        # Provider configurations
        for provider_name in ["stripe", "square", "sumup"]:
            env_prefix = f"FYNLO_{provider_name.upper()}_"
            
            # Check if provider is configured
            api_key = os.getenv(f"{env_prefix}API_KEY")
            if api_key:
                if provider_name not in self.providers:
                    self.providers[provider_name] = ProviderConfig(name=provider_name)
                
                provider = self.providers[provider_name]
                provider.api_key = api_key
                provider.secret_key = os.getenv(f"{env_prefix}SECRET_KEY")
                provider.environment = os.getenv(f"{env_prefix}ENVIRONMENT", "production")
                provider.webhook_url = os.getenv(f"{env_prefix}WEBHOOK_URL")
                
                # Provider-specific settings
                if provider_name == "square":
                    provider.custom_settings["location_id"] = os.getenv(f"{env_prefix}LOCATION_ID")
                elif provider_name == "sumup":
                    provider.custom_settings["merchant_code"] = os.getenv(f"{env_prefix}MERCHANT_CODE")
        
        # Routing configuration overrides
        if os.getenv("FYNLO_ROUTING_ENABLED"):
            self.routing.enabled = os.getenv("FYNLO_ROUTING_ENABLED").lower() == "true"
        
        if os.getenv("FYNLO_ROUTING_STRATEGY"):
            self.routing.default_strategy = os.getenv("FYNLO_ROUTING_STRATEGY")
        
        if os.getenv("FYNLO_FALLBACK_PROVIDER"):
            self.routing.fallback_provider = os.getenv("FYNLO_FALLBACK_PROVIDER")
        
        # Feature flag overrides
        feature_mapping = {
            "FYNLO_SMART_ROUTING": "smart_routing_enabled",
            "FYNLO_ANALYTICS": "analytics_enabled",
            "FYNLO_VOLUME_TRACKING": "volume_tracking_enabled",
            "FYNLO_QR_PAYMENTS": "qr_payments_enabled",
            "FYNLO_CASH_PAYMENTS": "cash_payments_enabled",
            "FYNLO_AUTO_REFUNDS": "auto_refunds_enabled",
            "FYNLO_WEBHOOK_RETRIES": "webhook_retries_enabled",
            "FYNLO_COST_OPTIMIZATION_ALERTS": "cost_optimization_alerts"
        }
        
        for env_var, feature_attr in feature_mapping.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                setattr(self.features, feature_attr, env_value.lower() == "true")
        
        # Security configuration overrides
        security_mapping = {
            "FYNLO_ENCRYPT_API_KEYS": "encrypt_api_keys",
            "FYNLO_WEBHOOK_SIGNATURE_VALIDATION": "webhook_signature_validation",
            "FYNLO_RATE_LIMITING": "rate_limiting_enabled",
            "FYNLO_SSL_REQUIRED": "ssl_required"
        }
        
        for env_var, security_attr in security_mapping.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                setattr(self.security, security_attr, env_value.lower() == "true")
        
        if os.getenv("FYNLO_MAX_REQUESTS_PER_MINUTE"):
            self.security.max_requests_per_minute = int(os.getenv("FYNLO_MAX_REQUESTS_PER_MINUTE"))
        
        if os.getenv("FYNLO_ALLOWED_ORIGINS"):
            self.security.allowed_origins = os.getenv("FYNLO_ALLOWED_ORIGINS").split(",")
    
    def _validate_configurations(self):
        """Validate all configurations and log warnings for issues"""
        issues = []
        
        # Validate providers
        if not self.providers:
            issues.append("No payment providers configured")
        else:
            for name, provider in self.providers.items():
                if provider.enabled and not provider.api_key:
                    issues.append(f"Provider {name} is enabled but missing API key")
                
                if provider.name == "square" and not provider.custom_settings.get("location_id"):
                    issues.append(f"Square provider missing location_id")
                
                if provider.name == "sumup" and not provider.custom_settings.get("merchant_code"):
                    issues.append(f"SumUp provider missing merchant_code")
        
        # Validate routing
        if self.routing.enabled and self.routing.fallback_provider not in self.providers:
            issues.append(f"Fallback provider '{self.routing.fallback_provider}' not configured")
        
        # Validate feature dependencies
        if self.features.smart_routing_enabled and not self.routing.enabled:
            issues.append("Smart routing feature enabled but routing is disabled")
        
        if self.features.analytics_enabled and not self.features.volume_tracking_enabled:
            logger.warning("Analytics enabled without volume tracking may have limited functionality")
        
        # Log validation results
        if issues:
            for issue in issues:
                logger.warning(f"Configuration issue: {issue}")
        else:
            logger.info("All configurations validated successfully")
    
    def get_provider_config(self, provider_name: str) -> Optional[ProviderConfig]:
        """Get configuration for a specific provider"""
        return self.providers.get(provider_name.lower())
    
    def get_enabled_providers(self) -> List[str]:
        """Get list of enabled providers"""
        return [name for name, config in self.providers.items() if config.enabled]
    
    def is_feature_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled"""
        return getattr(self.features, feature_name, False)
    
    def get_routing_config(self) -> RoutingConfig:
        """Get routing configuration"""
        return self.routing
    
    def get_security_config(self) -> SecurityConfig:
        """Get security configuration"""
        return self.security
    
    def save_configuration(self, config_type: str = "all"):
        """Save current configuration to file"""
        config_file = self.config_dir / f"payment_config_{self.environment.value}.json"
        
        config_data = {}
        
        if config_type in ["all", "providers"]:
            config_data["providers"] = {
                name: {
                    "enabled": provider.enabled,
                    "environment": provider.environment,
                    "webhook_url": provider.webhook_url,
                    "timeout_seconds": provider.timeout_seconds,
                    "retry_attempts": provider.retry_attempts,
                    "custom_settings": provider.custom_settings
                }
                for name, provider in self.providers.items()
            }
        
        if config_type in ["all", "routing"]:
            config_data["routing"] = {
                "enabled": self.routing.enabled,
                "default_strategy": self.routing.default_strategy,
                "volume_thresholds": {k: str(v) for k, v in self.routing.volume_thresholds.items()},
                "provider_weights": self.routing.provider_weights,
                "fallback_provider": self.routing.fallback_provider
            }
        
        if config_type in ["all", "features"]:
            config_data["features"] = {
                "smart_routing_enabled": self.features.smart_routing_enabled,
                "analytics_enabled": self.features.analytics_enabled,
                "volume_tracking_enabled": self.features.volume_tracking_enabled,
                "qr_payments_enabled": self.features.qr_payments_enabled,
                "cash_payments_enabled": self.features.cash_payments_enabled,
                "auto_refunds_enabled": self.features.auto_refunds_enabled,
                "webhook_retries_enabled": self.features.webhook_retries_enabled,
                "cost_optimization_alerts": self.features.cost_optimization_alerts
            }
        
        if config_type in ["all", "security"]:
            config_data["security"] = {
                "encrypt_api_keys": self.security.encrypt_api_keys,
                "webhook_signature_validation": self.security.webhook_signature_validation,
                "rate_limiting_enabled": self.security.rate_limiting_enabled,
                "max_requests_per_minute": self.security.max_requests_per_minute,
                "allowed_origins": self.security.allowed_origins,
                "ssl_required": self.security.ssl_required
            }
        
        try:
            with open(config_file, 'w') as f:
                json.dump(config_data, f, indent=2, default=str)
            logger.info(f"Configuration saved to {config_file}")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            raise
    
    def update_provider_config(self, provider_name: str, **kwargs):
        """Update provider configuration"""
        if provider_name not in self.providers:
            self.providers[provider_name] = ProviderConfig(name=provider_name)
        
        provider = self.providers[provider_name]
        for key, value in kwargs.items():
            if hasattr(provider, key):
                setattr(provider, key, value)
            else:
                provider.custom_settings[key] = value
        
        logger.info(f"Updated configuration for provider {provider_name}")
    
    def update_feature_flag(self, feature_name: str, enabled: bool):
        """Update a feature flag"""
        if hasattr(self.features, feature_name):
            setattr(self.features, feature_name, enabled)
            logger.info(f"Updated feature flag {feature_name} to {enabled}")
        else:
            logger.warning(f"Unknown feature flag: {feature_name}")
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration"""
        return {
            "environment": self.environment.value,
            "providers": {
                name: {
                    "enabled": config.enabled,
                    "configured": bool(config.api_key),
                    "environment": config.environment
                }
                for name, config in self.providers.items()
            },
            "routing": {
                "enabled": self.routing.enabled,
                "strategy": self.routing.default_strategy,
                "fallback": self.routing.fallback_provider
            },
            "features": {
                "smart_routing": self.features.smart_routing_enabled,
                "analytics": self.features.analytics_enabled,
                "qr_payments": self.features.qr_payments_enabled,
                "cash_payments": self.features.cash_payments_enabled
            },
            "security": {
                "ssl_required": self.security.ssl_required,
                "rate_limiting": self.security.rate_limiting_enabled,
                "webhook_validation": self.security.webhook_signature_validation
            }
        }

# Global configuration manager instance
config_manager = ConfigurationManager()