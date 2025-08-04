"""
Configuration settings for Fynlo POS Backend
"""

import os
import logging
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

# DO NOT load environment files at module level - let Pydantic handle it
# This ensures validation runs on actual environment variables


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Fynlo POS"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"  # This will be overridden by .env file
    API_V1_STR: str = "/api/v1"
    BASE_URL: str = (
        "https://fynlopos-9eg2c.ondigitalocean.app"  # Production URL, override in dev
    )

    # Database - Must be set via environment variable in production
    DATABASE_URL: Optional[str] = None

    # Redis - Must be set via environment variable in production
    REDIS_URL: Optional[str] = None

    # Security
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: Optional[str] = None  # Will be parsed as list in validator

    # Supabase Authentication
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    # Platform owner emails - comma-separated list from environment
    PLATFORM_OWNER_EMAILS: Optional[str] = (
        None  # e.g., "ryan@fynlo.co.uk,arnaud@fynlo.co.uk"
    )
    # Platform owner verification - requires both email AND secret key
    PLATFORM_OWNER_SECRET_KEY: Optional[str] = None  # Set via environment variable
    PLATFORM_OWNER_REQUIRE_2FA: bool = True  # Require 2FA for platform owners

    # Payment Processing
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Square Configuration
    SQUARE_APPLICATION_ID: Optional[str] = None
    SQUARE_ACCESS_TOKEN: Optional[str] = None
    SQUARE_LOCATION_ID: Optional[str] = None
    SQUARE_WEBHOOK_SIGNATURE_KEY: Optional[str] = None
    SQUARE_ENVIRONMENT: str = "sandbox"  # "sandbox" or "production"

    # SumUp Integration (PHASE 3: Added for real payment processing)
    SUMUP_API_KEY: Optional[str] = None
    SUMUP_MERCHANT_CODE: Optional[str] = None
    SUMUP_AFFILIATE_KEY: Optional[str] = None
    SUMUP_ENVIRONMENT: str = "sandbox"  # sandbox | production

    # QR Payment Settings
    QR_PAYMENT_FEE_PERCENTAGE: float = 1.2  # Your competitive advantage
    DEFAULT_CARD_FEE_PERCENTAGE: float = 2.9

    # WebSocket
    WEBSOCKET_HOST: str = "localhost"
    WEBSOCKET_PORT: int = 8001

    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "uploads"
    ALLOWED_FILE_TYPES: str = "jpg,jpeg,png,gif,pdf,docx,xlsx"

    # DigitalOcean Spaces Configuration
    SPACES_ACCESS_KEY_ID: Optional[str] = None
    SPACES_SECRET_ACCESS_KEY: Optional[str] = None
    SPACES_BUCKET: str = "fynlo-pos-storage"
    SPACES_REGION: str = "lon1"
    SPACES_ENDPOINT: str = "https://lon1.digitaloceanspaces.com"
    CDN_ENDPOINT: Optional[str] = None
    ENABLE_SPACES_STORAGE: bool = False  # Feature flag for gradual rollout

    # Email Service Configuration - Resend
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "noreply@fynlo.co.uk"
    RESEND_FROM_NAME: str = "Fynlo POS"

    # DigitalOcean Monitoring Configuration
    DO_API_TOKEN: Optional[str] = None  # DigitalOcean personal access token
    DO_APP_ID: Optional[str] = None  # DigitalOcean app ID
    DESIRED_REPLICAS: int = 2  # Desired number of backend replicas

    # Logging and Error Handling
    LOG_LEVEL: str = "DEBUG"
    ERROR_DETAIL_ENABLED: bool = True

    # CORS
    PRODUCTION_ALLOWED_ORIGINS: list[str] = [
        "https://app.fynlo.co.uk",  # Main production domain (platform dashboard)
        "https://fynlo.co.uk",  # Main website
        "https://api.fynlo.co.uk",  # API domain (for Swagger UI)
        "https://fynlo.vercel.app",  # Vercel production deployment
        "http://localhost:3000",  # Local development
        "http://localhost:8080",  # Vite development server
        "http://localhost:8081",  # Alternative local port
    ]

    # Note: For Vercel preview deployments, we use regex pattern in CORSMiddleware
    # to dynamically handle preview URLs like https://fynlo-pr-123.vercel.app

    @field_validator("DEBUG", "ERROR_DETAIL_ENABLED", mode="before")
    @classmethod
    def parse_boolean(cls, v: Any) -> bool:
        """Parse boolean values from environment variables that might be strings"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            # Remove quotes if present and normalize
            v = v.strip().strip('"').strip("'").lower()
            if v in ("true", "1", "yes", "on"):
                return True
            elif v in ("false", "0", "no", "off", ""):
                return False
            else:
                raise ValueError(f"Invalid boolean value: {v}")
        return bool(v)

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: Any) -> str:
        """Validate DATABASE_URL environment variable is set"""
        if v is None:
            v = os.getenv("DATABASE_URL")
        if not v:
            raise ValueError(
                "DATABASE_URL environment variable is required. "
                "Set it in your environment or create a .env.local file with "
                "your database connection string."
            )
        return v

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def validate_redis_url(cls, v: Any) -> str:
        """Validate REDIS_URL environment variable is set"""
        if v is None:
            v = os.getenv("REDIS_URL")
        if not v:
            raise ValueError(
                "REDIS_URL environment variable is required. "
                "Set it in your environment or create a .env.local file with "
                "your Redis connection string."
            )
        return v

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: Any) -> str:
        """Validate SECRET_KEY environment variable is set"""
        if v is None:
            v = os.getenv("SECRET_KEY")
        if not v:
            raise ValueError(
                "SECRET_KEY environment variable is required. "
                "Generate a strong secret key and set it in your environment "
                "or .env.local file."
            )
        # Additional validation for weak keys
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long for security. "
                "Generate a stronger secret key."
            )
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> Optional[str]:
        """Just return the string value, parsing will happen in __init__"""
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        if not self.CORS_ORIGINS:
            return []

        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS

        # Parse string value
        v = self.CORS_ORIGINS

        # Try to parse as JSON first
        try:
            import json

            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(item) for item in parsed if item]
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

        # Fall back to comma-separated
        if "," in v:
            return [origin.strip() for origin in v.split(",") if origin.strip()]

        # Single value
        return [v.strip()] if v.strip() else []

    @property
    def platform_owner_emails_list(self) -> List[str]:
        """Get platform owner emails as a list"""
        if not self.PLATFORM_OWNER_EMAILS:
            return []

        # Parse comma-separated emails
        emails = [
            email.strip().lower()
            for email in self.PLATFORM_OWNER_EMAILS.split(",")
            if email.strip()
        ]
        return emails

    class Config:
        case_sensitive = True
        # Load environment files in order of preference:
        # 1. .env.local (for local overrides, git-ignored)
        # 2. .env.test (when APP_ENV=test)
        # 3. .env (default development config)
        # CRITICAL: Don't load .env files in production - use only OS env vars
        env_file = (
            None
            if os.getenv("ENVIRONMENT") == "production"
            else ".env.local"
            if os.path.exists(".env.local")
            else ".env.test"
            if os.getenv("APP_ENV") == "test"
            else ".env"
        )
        extra = "ignore"  # Allow extra environment variables


# Initialize settings - Pydantic will automatically load from .env if it exists
settings = Settings()


# --- Configuration Validation ---
def validate_production_settings(s: Settings):
    """
    Validates critical settings when ENVIRONMENT is 'production'.
    Raises ValueError if any insecure configuration is detected.
    """
    if s.ENVIRONMENT == "production":
        errors = []
        warnings = []

        # Critical security checks
        if s.DEBUG:
            errors.append("DEBUG mode must be disabled in production.")
        if s.ERROR_DETAIL_ENABLED:
            errors.append("ERROR_DETAIL_ENABLED must be false in production.")

        # Check CORS origins: must not be empty, contain '*', or overly permissive
        cors_list = s.cors_origins_list
        if not cors_list:
            errors.append("CORS_ORIGINS must be set in production and not be empty.")
        elif "*" in cors_list:
            errors.append("CORS_ORIGINS must not contain '*' (wildcard) in production.")

        # Check for localhost in production (warning, not error)
        if any("localhost" in origin or "127.0.0.1" in origin for origin in cors_list):
            warnings.append(
                "CORS_ORIGINS contains localhost/127.0.0.1 - ensure this is "
                "intentional in production."
            )

        # Check SECRET_KEY: must not be the default/example key
        insecure_keys = [
            "your-super-secret-key-change-in-production",
            "your-super-secret-key-for-development-only",
            "your-super-secret-key-change-in-production-use-long-random-string",
            "development-secret-key-do-not-use-in-production",
            "development-secret-key-do-not-use-in-production-change-me",
            "your-local-development-secret-key-make-it-long-and-random",
        ]
        if s.SECRET_KEY in insecure_keys:
            errors.append(
                "A strong, unique SECRET_KEY must be set for production. "
                "Current key appears to be a development placeholder."
            )
        if len(s.SECRET_KEY) < 32:
            errors.append(
                "SECRET_KEY must be at least 32 characters long for "
                "production security."
            )

        # Logging level check
        if s.LOG_LEVEL.upper() == "DEBUG":
            warnings.append(
                "LOG_LEVEL is 'DEBUG' in production. Consider 'INFO' or "
                "'WARNING' for better performance."
            )

        # Database security checks
        if s.DATABASE_URL and "localhost" in s.DATABASE_URL:
            warnings.append(
                "DATABASE_URL contains localhost - ensure this is correct "
                "for production."
            )
        if s.REDIS_URL and "localhost" in s.REDIS_URL:
            warnings.append(
                "REDIS_URL contains localhost - ensure this is correct for production."
            )

        # Payment provider validation
        if s.STRIPE_SECRET_KEY:
            if "sk_test_" in s.STRIPE_SECRET_KEY:
                errors.append(
                    "Stripe secret key appears to be a test key. "
                    "Use live keys in production."
                )
            elif any(
                placeholder in s.STRIPE_SECRET_KEY
                for placeholder in ["your-stripe", "placeholder", "development"]
            ):
                errors.append(
                    "Stripe secret key appears to be a placeholder. "
                    "Set a real Stripe key for production."
                )

        if s.SUMUP_API_KEY:
            if s.SUMUP_ENVIRONMENT not in ["production", "sandbox"]:
                errors.append(
                    "SumUp environment must be 'production' or 'sandbox' in deployment."
                )
            elif any(
                placeholder in s.SUMUP_API_KEY
                for placeholder in ["your-sumup", "placeholder", "sandbox"]
            ):
                errors.append(
                    "SumUp API key appears to be a placeholder. "
                    "Set a real SumUp key for production."
                )

        # Supabase validation
        if s.SUPABASE_URL and "your-project-id" in s.SUPABASE_URL:
            errors.append(
                "Supabase URL appears to be a placeholder. "
                "Set your real Supabase project URL."
            )
        if (
            s.SUPABASE_SERVICE_ROLE_KEY
            and "your-supabase" in s.SUPABASE_SERVICE_ROLE_KEY
        ):
            errors.append(
                "Supabase service role key appears to be a placeholder. "
                "Set your real Supabase key."
            )

        # Platform owner emails validation
        if s.PLATFORM_OWNER_EMAILS:
            owner_emails = s.platform_owner_emails_list
            if (
                "admin@fynlo.co.uk" in owner_emails
                or "your-email@example.com" in owner_emails
            ):
                warnings.append(
                    "Platform owner emails contain default/placeholder values. "
                    "Update with real admin emails."
                )

        # Log warnings
        if warnings:
            warning_message = "PRODUCTION CONFIGURATION WARNINGS:\n" + "\n".join(
                f"- {warn}" for warn in warnings
            )
            logger.warning("\n" + "=" * 80)
            logger.warning(warning_message)
            logger.warning("=" * 80 + "\n")

        # Fail on errors
        if errors:
            error_message = (
                "CRITICAL CONFIGURATION ERRORS IN PRODUCTION ENV:\n"
                + "\n".join(f"- {err}" for err in errors)
            )
            logger.error("\n" + "=" * 80)
            logger.error(error_message)
            logger.error("=" * 80 + "\n")
            raise ValueError(
                f"Application startup aborted due to insecure production "
                f"configuration: {'; '.join(errors)}"
            )


# Perform validation after settings are fully initialized
try:
    validate_production_settings(settings)
    logger.info(f"Configuration validated for {settings.ENVIRONMENT} environment")
except ValueError as e:
    logger.error(f"Configuration validation failed: {e}")
    raise
except Exception as e:
    logger.error(f"Unexpected error during configuration validation: {e}")
    raise ValueError(f"Configuration validation failed: {e}") from e
