"""
Configuration settings for Fynlo POS Backend
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional, List
from dotenv import load_dotenv

# Determine the environment and load the appropriate .env file
APP_ENV = os.getenv("APP_ENV", "development")
env_file_path = f".env.{APP_ENV}"

if os.path.exists(env_file_path):
    load_dotenv(dotenv_path=env_file_path)
else:
    # Fallback to default .env if environment-specific one is not found
    # This is useful for local setups that might still use a single .env
    # or if APP_ENV is not set and .env.development is missing.
    load_dotenv(dotenv_path=".env")

class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Fynlo POS"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"  # This will be overridden by .env file
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://fynlo_user:fynlo_password@localhost:5432/fynlo_pos"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: List[str] = ["http://localhost:3000"] # Default, will be overridden
    
    # Payment Processing
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Square Configuration
    SQUARE_APPLICATION_ID: Optional[str] = None
    SQUARE_ACCESS_TOKEN: Optional[str] = None
    SQUARE_LOCATION_ID: Optional[str] = None
    SQUARE_WEBHOOK_SIGNATURE_KEY: Optional[str] = None
    SQUARE_ENVIRONMENT: str = "sandbox" # "sandbox" or "production"
    
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

    # Logging and Error Handling
    LOG_LEVEL: str = "DEBUG"
    ERROR_DETAIL_ENABLED: bool = True
    
    # CORS
    PRODUCTION_ALLOWED_ORIGINS: list[str] = ["https://your-production-frontend.com"] # TODO: Update with actual frontend domain
    
    class Config:
        case_sensitive = True
        # env_file is now handled by load_dotenv above to allow dynamic selection
        # We still define it here so pydantic-settings knows about it,
        # but the actual loading is conditional.
        # If APP_ENV specific file isn't found, it can fallback to .env
        # or use defaults if .env is also missing.
        env_file = os.getenv("ENV_FILE_PATH", f".env.{APP_ENV}")
        extra = "ignore"  # Allow extra environment variables

# Initialize settings after potentially loading from a specific .env file
settings = Settings()

# If .env.{APP_ENV} was not found and .env was used,
# we might want to re-initialize settings if .env had different APP_ENV
# or ensure the Settings object reflects the intended APP_ENV.
# This logic ensures that 'ENVIRONMENT' setting is consistent with APP_ENV.
if settings.ENVIRONMENT != APP_ENV:
    # If ENVIRONMENT in the loaded .env file (e.g. a generic .env)
    # does not match the target APP_ENV, it means the specific .env.{APP_ENV}
    # was not loaded. We should prioritize APP_ENV.
    # Re-initialize with the correct env_file path for pydantic.
    # This is a bit of a workaround for pydantic-settings not having direct
    # dynamic env_file path based on another env var.

    # Check if the specific env file exists before trying to load it again
    # This prevents an error if neither .env.APP_ENV nor .env exist but APP_ENV is set
    _specific_env_file = f".env.{APP_ENV}"
    if os.path.exists(_specific_env_file):
      settings = Settings(_env_file=_specific_env_file)
    elif os.path.exists(".env"): # Fallback to .env if specific one not found
      settings = Settings(_env_file=".env")
    else: # If no .env files found, pydantic uses defaults or raises error for missing required fields
      settings = Settings()

    # Explicitly set ENVIRONMENT to match APP_ENV if it's still different
    # This ensures the application code can reliably use settings.ENVIRONMENT
    if settings.ENVIRONMENT != APP_ENV:
        settings.ENVIRONMENT = APP_ENV

# Ensure CORS_ORIGINS is parsed as a list if it's a comma-separated string in the .env file
if isinstance(settings.CORS_ORIGINS, str):
    settings.CORS_ORIGINS = [origin.strip() for origin in settings.CORS_ORIGINS.split(',')]
elif settings.CORS_ORIGINS is None: # Handle case where CORS_ORIGINS might not be set
    settings.CORS_ORIGINS = []

# --- Configuration Validation ---
def validate_production_settings(s: Settings):
    """
    Validates critical settings when ENVIRONMENT is 'production'.
    Raises ValueError if any insecure configuration is detected.
    """
    if s.ENVIRONMENT == "production":
        errors = []
        if s.DEBUG:
            errors.append("DEBUG mode must be disabled in production.")
        if s.ERROR_DETAIL_ENABLED:
            errors.append("ERROR_DETAIL_ENABLED must be false in production.")

        # Check CORS origins: must not be empty, contain '*', or overly permissive localhost entries
        if not s.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must be set in production and not be empty.")
        elif "*" in s.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must not contain '*' (wildcard) in production.")
        # Further checks for localhost might be too strict if there's a legitimate local admin interface on the server.
        # However, for typical web app frontends, localhost would be insecure.
        # Example:
        # if any("localhost" in origin or "127.0.0.1" in origin for origin in s.CORS_ORIGINS):
        #     errors.append("CORS_ORIGINS should not contain localhost or 127.0.0.1 in production.")

        # Check SECRET_KEY: must not be the default/example key
        default_keys = [
            "your-super-secret-key-change-in-production",
            "your-super-secret-key-for-development-only",
            "your-super-secret-key-change-in-production-use-long-random-string" # from .env.example
        ]
        if s.SECRET_KEY in default_keys:
            errors.append("A strong, unique SECRET_KEY must be set for production.")
        if len(s.SECRET_KEY) < 32: # Arbitrary length check for a reasonably strong key
             errors.append("SECRET_KEY appears too short. Ensure it is a long, random string.")

        if s.LOG_LEVEL.upper() == "DEBUG":
            errors.append("LOG_LEVEL should not be 'DEBUG' in production. Consider 'INFO' or 'WARNING'.")

        # Payment provider checks (ensure live keys are not placeholders if provider is configured)
        if s.STRIPE_SECRET_KEY and ("yourtestkey" in s.STRIPE_SECRET_KEY or "sk_test_" in s.STRIPE_SECRET_KEY):
            errors.append("Stripe secret key appears to be a test key. Use live keys in production.")
        if s.SUMUP_API_KEY and ("sumup_test_apikey" in s.SUMUP_API_KEY or s.SUMUP_ENVIRONMENT != "production"):
             errors.append("SumUp API key appears to be a test key or environment is not 'production'. Use live settings in production.")

        if errors:
            error_message = "CRITICAL CONFIGURATION ERRORS IN PRODUCTION ENV:\n" + "\n".join(
                f"- {err}" for err in errors
            )
            # In a real scenario, you might want to log this with high priority as well.
            # For now, raising an exception is the primary goal to prevent startup.
            print("\n" + "="*80)
            print(error_message)
            print("="*80 + "\n")
            raise ValueError(f"Application startup aborted due to insecure production configuration: {'; '.join(errors)}")

# Perform validation after settings are fully initialized
validate_production_settings(settings)

# print(f"Settings validated for {settings.ENVIRONMENT} environment.")
# print(f"Settings.SECRET_KEY: {settings.SECRET_KEY[:10]}...") # Print only a part for security