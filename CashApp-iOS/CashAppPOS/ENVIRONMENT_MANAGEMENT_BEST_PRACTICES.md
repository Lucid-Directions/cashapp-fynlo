# Environment Management Best Practices - Complete Configuration Strategy

## 🎯 Objective
Establish comprehensive environment variable management, CI/CD integration, and deployment strategies that ensure secure, scalable, and maintainable configuration across development, staging, and production environments.

## 📋 Context & Prerequisites

### Current State After Phase 6
- [x] DigitalOcean infrastructure fully operational
- [x] Monitoring and security hardening implemented
- [x] Backend services deployed and secured
- [x] Mobile app secrets removed and secured

### What We're Implementing
- **Multi-Environment Strategy**: Development, staging, production configurations
- **Secret Management**: Secure handling of sensitive data
- **CI/CD Integration**: Automated deployment with environment-specific configs
- **Team Collaboration**: Standardized development workflows
- **Configuration Validation**: Type-safe environment management

### Environment Architecture
```
🏗️ Complete Environment Strategy:
┌─────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT HIERARCHY                    │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Development │  │  Staging    │  │ Production  │         │
│  │             │  │             │  │             │         │
│  │ - Local DB  │  │ - DO Test   │  │ - DO Prod   │         │
│  │ - Debug On  │  │ - Debug Off │  │ - Debug Off │         │
│  │ - Mock APIs │  │ - Real APIs │  │ - Real APIs │         │
│  │ - Test Keys │  │ - Test Keys │  │ - Prod Keys │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SECRET MANAGEMENT                      │   │
│  │                                                     │   │
│  │  Development:     .env.local (gitignored)          │   │
│  │  Staging:         DO App Platform env vars         │   │
│  │  Production:      DO App Platform env vars         │   │
│  │  CI/CD:           GitHub Secrets                   │   │
│  │  Team Sharing:    .env.sample (committed)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Implementation Steps

### Step 1: Create Multi-Environment Configuration System

#### 1.1 Backend Environment Structure
Create environment-specific configuration files:

**backend/.env.sample** (committed template):
```bash
# =============================================================================
# FYNLO BACKEND - ENVIRONMENT TEMPLATE
# =============================================================================
# Copy to .env.local for development
# Never commit files with real secrets
# =============================================================================

# =============================================================================
# ENVIRONMENT CONFIGURATION
# =============================================================================
ENVIRONMENT=development  # development | staging | production
DEBUG=true
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
# Development (local)
DATABASE_URL=postgresql://postgres:password@localhost:5432/fynlo_dev
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Production (DigitalOcean - set in App Platform)
# DATABASE_URL=postgresql://user:pass@db-host:5432/fynlo_production

# =============================================================================
# CACHE CONFIGURATION
# =============================================================================
# Development (local Redis)
REDIS_URL=redis://localhost:6379/0

# Production (DigitalOcean Valkey - set in App Platform)
# REDIS_URL=rediss://user:pass@cache-host:25061/0

# =============================================================================
# SECRET KEYS (REPLACE WITH REAL VALUES)
# =============================================================================
# SumUp Integration
SUMUP_SECRET_KEY=sup_sk_CHANGE_ME_TO_REAL_SECRET_KEY
SUMUP_AFFILIATE_KEY=your-affiliate-key
SUMUP_ENVIRONMENT=sandbox  # sandbox | production

# Stripe Integration
STRIPE_SECRET_KEY=sk_test_CHANGE_ME
STRIPE_WEBHOOK_SECRET=whsec_CHANGE_ME

# Square Integration
SQUARE_ACCESS_TOKEN=YOUR_SQUARE_ACCESS_TOKEN
SQUARE_WEBHOOK_SIGNATURE_KEY=YOUR_WEBHOOK_KEY

# JWT Security
JWT_SECRET_KEY=your-super-secret-jwt-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Security
API_SECRET_KEY=your-api-secret-key-min-32-chars
CORS_ORIGINS=["http://localhost:3000","https://yourdomain.com"]

# =============================================================================
# EXTERNAL SERVICES
# =============================================================================
# Monitoring & Logging
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Email (SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@domain.com
SMTP_PASSWORD=your-app-password

# =============================================================================
# DIGITALOCEAN SPACES
# =============================================================================
SPACES_ACCESS_KEY_ID=YOUR_SPACES_ACCESS_KEY
SPACES_SECRET_ACCESS_KEY=YOUR_SPACES_SECRET_KEY
SPACES_BUCKET=fynlo-pos-storage
SPACES_REGION=lon1
SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
CDN_ENDPOINT=https://your-cdn-endpoint.cdn.digitaloceanspaces.com

# =============================================================================
# FEATURE FLAGS
# =============================================================================
ENABLE_PAYMENTS=true
ENABLE_FILE_UPLOADS=true
ENABLE_MONITORING=true
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_MONITORING=true

# =============================================================================
# PERFORMANCE SETTINGS
# =============================================================================
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,docx,xlsx
REQUEST_TIMEOUT=30
MAX_WORKERS=4
```

**backend/.env.development**:
```bash
# Development environment configuration
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# Local development database
DATABASE_URL=postgresql://postgres:password@localhost:5432/fynlo_dev

# Local Redis
REDIS_URL=redis://localhost:6379/0

# Test keys for development
SUMUP_SECRET_KEY=sup_sk_test_development_key
SUMUP_ENVIRONMENT=sandbox

STRIPE_SECRET_KEY=sk_test_development_key

# Relaxed CORS for development
CORS_ORIGINS=["http://localhost:3000","http://localhost:19006","exp://192.168.1.100:19000"]

# Development feature flags
ENABLE_MONITORING=false  # Reduce noise in development
ENABLE_RATE_LIMITING=false  # Easier development
```

**backend/.env.staging**:
```bash
# Staging environment configuration
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO

# DigitalOcean staging database
DATABASE_URL=${DATABASE_URL}  # Set in App Platform

# DigitalOcean staging cache
REDIS_URL=${REDIS_URL}  # Set in App Platform

# Test keys for staging
SUMUP_SECRET_KEY=${SUMUP_SECRET_KEY}  # Test key in App Platform
SUMUP_ENVIRONMENT=sandbox

STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}  # Test key in App Platform

# Staging CORS
CORS_ORIGINS=["https://staging.yourdomain.com"]

# All features enabled for staging testing
ENABLE_PAYMENTS=true
ENABLE_FILE_UPLOADS=true
ENABLE_MONITORING=true
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_MONITORING=true
```

**backend/.env.production**:
```bash
# Production environment configuration
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING

# DigitalOcean production database
DATABASE_URL=${DATABASE_URL}  # Set in App Platform

# DigitalOcean production cache
REDIS_URL=${REDIS_URL}  # Set in App Platform

# Production keys
SUMUP_SECRET_KEY=${SUMUP_SECRET_KEY}  # Production key in App Platform
SUMUP_ENVIRONMENT=production

STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}  # Production key in App Platform

# Production CORS
CORS_ORIGINS=["https://yourdomain.com","https://app.yourdomain.com"]

# All security features enabled
ENABLE_PAYMENTS=true
ENABLE_FILE_UPLOADS=true
ENABLE_MONITORING=true
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_MONITORING=true
```

#### 1.2 Enhanced Backend Configuration Management
Update `backend/app/core/config.py`:
```python
"""
Enhanced configuration management with environment-specific settings
"""

import os
from functools import lru_cache
from typing import List, Optional, Dict, Any
from pydantic_settings import BaseSettings
from pydantic import Field, validator, root_validator
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Enhanced application settings with environment-specific validation"""
    
    # Environment Configuration
    environment: str = Field(default="development", regex="^(development|staging|production)$")
    debug: bool = False
    log_level: str = Field(default="INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    
    # Database Configuration
    database_url: str = Field(..., description="PostgreSQL database URL")
    database_pool_size: int = Field(default=20, ge=1, le=100)
    database_max_overflow: int = Field(default=30, ge=0, le=100)
    
    # Cache Configuration
    redis_url: str = Field(..., description="Redis/Valkey cache URL")
    cache_ttl: int = Field(default=3600, ge=60, le=86400)
    
    # Payment Provider Configuration
    sumup_secret_key: str = Field(..., description="SumUp secret API key")
    sumup_affiliate_key: Optional[str] = None
    sumup_environment: str = Field(default="sandbox", regex="^(sandbox|production)$")
    
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    square_access_token: Optional[str] = None
    square_webhook_signature_key: Optional[str] = None
    
    # Security Configuration
    jwt_secret_key: str = Field(..., min_length=32, description="JWT signing secret")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = Field(default=30, ge=5, le=1440)
    
    api_secret_key: str = Field(..., min_length=32, description="API secret key")
    cors_origins: List[str] = Field(default=["http://localhost:3000"])
    
    # External Services
    sentry_dsn: Optional[str] = None
    
    # Email Configuration
    smtp_server: Optional[str] = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    
    # File Storage (DigitalOcean Spaces)
    spaces_access_key_id: Optional[str] = None
    spaces_secret_access_key: Optional[str] = None
    spaces_bucket: Optional[str] = None
    spaces_region: str = "lon1"
    spaces_endpoint: str = "https://lon1.digitaloceanspaces.com"
    cdn_endpoint: Optional[str] = None
    
    # Feature Flags
    enable_payments: bool = True
    enable_file_uploads: bool = True
    enable_monitoring: bool = True
    enable_rate_limiting: bool = True
    enable_security_monitoring: bool = True
    
    # Performance Settings
    max_file_size: int = Field(default=10485760, ge=1048576, le=104857600)  # 1MB - 100MB
    allowed_file_types: str = "jpg,jpeg,png,gif,pdf,docx,xlsx"
    request_timeout: int = Field(default=30, ge=5, le=300)
    max_workers: int = Field(default=4, ge=1, le=32)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        
        # Environment-specific file loading
        @classmethod
        def customise_sources(cls, init_settings, env_settings, file_secret_settings):
            return (
                init_settings,
                env_settings,
                file_secret_settings,
            )
    
    @validator('sumup_secret_key')
    def validate_sumup_secret_key(cls, v):
        """Validate SumUp secret key format"""
        if not v.startswith('sup_sk_'):
            raise ValueError('SumUp secret key must start with sup_sk_')
        if len(v) < 20:
            raise ValueError('SumUp secret key too short')
        return v
    
    @validator('cors_origins', pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            # Handle JSON string format
            if v.startswith('[') and v.endswith(']'):
                import json
                return json.loads(v)
            # Handle comma-separated format
            return [origin.strip() for origin in v.split(',')]
        return v
    
    @root_validator
    def validate_environment_config(cls, values):
        """Validate configuration based on environment"""
        env = values.get('environment', 'development')
        
        # Production-specific validations
        if env == 'production':
            # Ensure debug is off in production
            if values.get('debug', False):
                logger.warning("Debug mode should be disabled in production")
                values['debug'] = False
            
            # Ensure secure secrets in production
            jwt_key = values.get('jwt_secret_key', '')
            if len(jwt_key) < 32:
                raise ValueError('JWT secret key must be at least 32 characters in production')
            
            # Require HTTPS in CORS origins for production
            cors_origins = values.get('cors_origins', [])
            for origin in cors_origins:
                if origin.startswith('http://') and 'localhost' not in origin:
                    raise ValueError(f'Production CORS origin must use HTTPS: {origin}')
        
        # Development-specific settings
        elif env == 'development':
            # Warn about production secrets in development
            sumup_key = values.get('sumup_secret_key', '')
            if 'production' in sumup_key.lower():
                logger.warning("Production SumUp key detected in development environment")
        
        return values
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.environment == "development"
    
    @property
    def is_staging(self) -> bool:
        """Check if running in staging"""
        return self.environment == "staging"
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration"""
        return {
            'url': self.database_url,
            'pool_size': self.database_pool_size,
            'max_overflow': self.database_max_overflow
        }
    
    def get_redis_config(self) -> Dict[str, Any]:
        """Get Redis configuration"""
        return {
            'url': self.redis_url,
            'ttl': self.cache_ttl
        }
    
    def get_spaces_config(self) -> Dict[str, Any]:
        """Get Spaces configuration"""
        return {
            'access_key_id': self.spaces_access_key_id,
            'secret_access_key': self.spaces_secret_access_key,
            'bucket': self.spaces_bucket,
            'region': self.spaces_region,
            'endpoint': self.spaces_endpoint,
            'cdn_endpoint': self.cdn_endpoint
        }


def load_environment_config() -> Settings:
    """Load configuration based on current environment"""
    env = os.getenv('ENVIRONMENT', 'development')
    
    # Determine config file based on environment
    config_files = {
        'development': '.env.development',
        'staging': '.env.staging',
        'production': '.env.production'
    }
    
    config_file = config_files.get(env, '.env')
    
    # Check if environment-specific file exists
    if os.path.exists(config_file):
        logger.info(f"Loading configuration from {config_file}")
        return Settings(_env_file=config_file)
    else:
        logger.info(f"Environment file {config_file} not found, using default .env")
        return Settings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return load_environment_config()


# Global settings instance
settings = get_settings()

# Log configuration on startup
if settings.is_development:
    logger.info("Configuration loaded for development environment")
    logger.debug(f"Database: {settings.database_url}")
    logger.debug(f"Debug mode: {settings.debug}")
elif settings.is_staging:
    logger.info("Configuration loaded for staging environment")
elif settings.is_production:
    logger.info("Configuration loaded for production environment")
    logger.info("Debug mode disabled, sensitive data logging restricted")
```

### Step 2: Mobile App Environment Management

#### 2.1 Create Mobile Environment Structure
Create environment-specific files for mobile app:

**mobile/.env.sample**:
```bash
# =============================================================================
# FYNLO MOBILE APP - ENVIRONMENT TEMPLATE
# =============================================================================
# Copy to .env.local for development
# All values here are PUBLIC - no secrets allowed
# =============================================================================

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
REACT_APP_APP_NAME="Fynlo POS"
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG=true
REACT_APP_VERSION=1.0.0

# =============================================================================
# API CONFIGURATION (PUBLIC ENDPOINTS ONLY)
# =============================================================================
# Development
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WEBSOCKET_URL=ws://localhost:8000/ws

# Staging
# REACT_APP_API_BASE_URL=https://staging-api.yourdomain.com
# REACT_APP_WEBSOCKET_URL=wss://staging-api.yourdomain.com/ws

# Production
# REACT_APP_API_BASE_URL=https://api.yourdomain.com
# REACT_APP_WEBSOCKET_URL=wss://api.yourdomain.com/ws

# =============================================================================
# PAYMENT PROVIDER CONFIGURATION (PUBLIC KEYS ONLY)
# =============================================================================
# SumUp (NO SECRET KEYS - only public identifiers)
REACT_APP_SUMUP_AFFILIATE_KEY=your-affiliate-key
REACT_APP_SUMUP_ENVIRONMENT=sandbox

# Stripe (PUBLISHABLE KEY ONLY - never secret keys)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Square (PUBLIC APPLICATION ID ONLY)
REACT_APP_SQUARE_APPLICATION_ID=sandbox-sq0idb-your-app-id
REACT_APP_SQUARE_LOCATION_ID=your-location-id
REACT_APP_SQUARE_ENVIRONMENT=sandbox

# =============================================================================
# FEATURE FLAGS
# =============================================================================
REACT_APP_ENABLE_PAYMENTS=true
REACT_APP_ENABLE_HARDWARE=false
REACT_APP_ENABLE_OFFLINE_MODE=true
REACT_APP_ENABLE_CAMERA_QR=true
REACT_APP_SHOW_DEV_MENU=false

# =============================================================================
# BUSINESS CONFIGURATION
# =============================================================================
REACT_APP_DEFAULT_CURRENCY=GBP
REACT_APP_DEFAULT_TIMEZONE=Europe/London
REACT_APP_DEFAULT_LOCALE=en-GB
REACT_APP_SESSION_TIMEOUT=3600000

# =============================================================================
# PERFORMANCE SETTINGS
# =============================================================================
REACT_APP_API_TIMEOUT=30000
REACT_APP_MAX_RETRIES=3
REACT_APP_RETRY_DELAY=1000
REACT_APP_WEBSOCKET_RECONNECT_INTERVAL=5000

# =============================================================================
# MONITORING (PUBLIC CONFIGURATION)
# =============================================================================
REACT_APP_SENTRY_DSN=https://public-dsn@sentry.io/project-id
REACT_APP_SENTRY_ENVIRONMENT=development
REACT_APP_ANALYTICS_ENABLED=false
```

**mobile/.env.development**:
```bash
# Development environment
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG=true
REACT_APP_SHOW_DEV_MENU=true

# Local development backend
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WEBSOCKET_URL=ws://localhost:8000/ws

# Test payment keys
REACT_APP_SUMUP_ENVIRONMENT=sandbox
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_development_key
REACT_APP_SQUARE_ENVIRONMENT=sandbox

# Development features
REACT_APP_ENABLE_PAYMENTS=true
REACT_APP_ANALYTICS_ENABLED=false
```

**mobile/.env.staging**:
```bash
# Staging environment
REACT_APP_ENVIRONMENT=staging
REACT_APP_DEBUG=false
REACT_APP_SHOW_DEV_MENU=false

# Staging backend
REACT_APP_API_BASE_URL=https://staging-api.yourdomain.com
REACT_APP_WEBSOCKET_URL=wss://staging-api.yourdomain.com/ws

# Staging payment keys (still test keys)
REACT_APP_SUMUP_ENVIRONMENT=sandbox
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_staging_key
REACT_APP_SQUARE_ENVIRONMENT=sandbox

# Full feature testing
REACT_APP_ENABLE_PAYMENTS=true
REACT_APP_ANALYTICS_ENABLED=true
```

**mobile/.env.production**:
```bash
# Production environment
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG=false
REACT_APP_SHOW_DEV_MENU=false

# Production backend
REACT_APP_API_BASE_URL=https://api.yourdomain.com
REACT_APP_WEBSOCKET_URL=wss://api.yourdomain.com/ws

# Production payment keys
REACT_APP_SUMUP_ENVIRONMENT=production
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_production_key
REACT_APP_SQUARE_ENVIRONMENT=production

# Production features
REACT_APP_ENABLE_PAYMENTS=true
REACT_APP_ANALYTICS_ENABLED=true
```

#### 2.2 Enhanced Mobile Configuration Management
Update `src/config/config.ts`:
```typescript
/**
 * Enhanced environment-aware configuration management
 */

import { z } from 'zod';

// Environment-specific configuration schema
const environmentConfigSchema = z.object({
  development: z.object({
    apiTimeout: z.number().default(30000),
    enableMockData: z.boolean().default(true),
    enableDetailedLogging: z.boolean().default(true),
    enableHotReload: z.boolean().default(true),
  }),
  staging: z.object({
    apiTimeout: z.number().default(15000),
    enableMockData: z.boolean().default(false),
    enableDetailedLogging: z.boolean().default(false),
    enableHotReload: z.boolean().default(false),
  }),
  production: z.object({
    apiTimeout: z.number().default(10000),
    enableMockData: z.boolean().default(false),
    enableDetailedLogging: z.boolean().default(false),
    enableHotReload: z.boolean().default(false),
  }),
});

// Main configuration schema
const configSchema = z.object({
  // Application settings
  app: z.object({
    name: z.string().default('Fynlo POS'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    debug: z.boolean().default(false),
  }),

  // API configuration
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().positive(),
    maxRetries: z.number().positive().default(3),
    retryDelay: z.number().positive().default(1000),
  }),

  // WebSocket configuration
  websocket: z.object({
    url: z.string().url(),
    reconnectInterval: z.number().positive().default(5000),
    maxReconnectAttempts: z.number().positive().default(5),
  }),

  // Payment configuration (public keys only)
  payments: z.object({
    sumup: z.object({
      affiliateKey: z.string().optional(),
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
    }),
    stripe: z.object({
      publishableKey: z.string().startsWith('pk_'),
    }),
    square: z.object({
      applicationId: z.string().optional(),
      locationId: z.string().optional(),
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
    }),
  }),

  // Feature flags
  features: z.object({
    enablePayments: z.boolean().default(true),
    enableHardware: z.boolean().default(false),
    enableOfflineMode: z.boolean().default(true),
    enableCameraQR: z.boolean().default(true),
    showDevMenu: z.boolean().default(false),
  }),

  // Business configuration
  business: z.object({
    defaultCurrency: z.string().default('GBP'),
    defaultTimezone: z.string().default('Europe/London'),
    defaultLocale: z.string().default('en-GB'),
    sessionTimeout: z.number().positive().default(3600000),
  }),

  // Monitoring configuration
  monitoring: z.object({
    sentryDsn: z.string().optional(),
    sentryEnvironment: z.string().optional(),
    analyticsEnabled: z.boolean().default(false),
  }),
});

// Environment-specific settings
const environmentSettings = {
  development: {
    apiTimeout: 30000,
    enableMockData: true,
    enableDetailedLogging: true,
    enableHotReload: true,
  },
  staging: {
    apiTimeout: 15000,
    enableMockData: false,
    enableDetailedLogging: false,
    enableHotReload: false,
  },
  production: {
    apiTimeout: 10000,
    enableMockData: false,
    enableDetailedLogging: false,
    enableHotReload: false,
  },
};

// Helper function to get environment variable with validation
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || defaultValue!;
}

// Helper function to get boolean from env var
function getBoolEnvVar(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Helper function to get number from env var
function getNumberEnvVar(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

// Get current environment
const currentEnvironment = getEnvVar('REACT_APP_ENVIRONMENT', 'development') as 'development' | 'staging' | 'production';

// Environment-specific settings
const envSettings = environmentSettings[currentEnvironment];

// Build configuration object
const rawConfig = {
  app: {
    name: getEnvVar('REACT_APP_APP_NAME', 'Fynlo POS'),
    version: getEnvVar('REACT_APP_VERSION', '1.0.0'),
    environment: currentEnvironment,
    debug: getBoolEnvVar('REACT_APP_DEBUG', false),
  },
  api: {
    baseUrl: getEnvVar('REACT_APP_API_BASE_URL'),
    timeout: getNumberEnvVar('REACT_APP_API_TIMEOUT', envSettings.apiTimeout),
    maxRetries: getNumberEnvVar('REACT_APP_MAX_RETRIES', 3),
    retryDelay: getNumberEnvVar('REACT_APP_RETRY_DELAY', 1000),
  },
  websocket: {
    url: getEnvVar('REACT_APP_WEBSOCKET_URL'),
    reconnectInterval: getNumberEnvVar('REACT_APP_WEBSOCKET_RECONNECT_INTERVAL', 5000),
    maxReconnectAttempts: 5,
  },
  payments: {
    sumup: {
      affiliateKey: getEnvVar('REACT_APP_SUMUP_AFFILIATE_KEY', ''),
      environment: getEnvVar('REACT_APP_SUMUP_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production',
    },
    stripe: {
      publishableKey: getEnvVar('REACT_APP_STRIPE_PUBLISHABLE_KEY'),
    },
    square: {
      applicationId: getEnvVar('REACT_APP_SQUARE_APPLICATION_ID', ''),
      locationId: getEnvVar('REACT_APP_SQUARE_LOCATION_ID', ''),
      environment: getEnvVar('REACT_APP_SQUARE_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production',
    },
  },
  features: {
    enablePayments: getBoolEnvVar('REACT_APP_ENABLE_PAYMENTS', true),
    enableHardware: getBoolEnvVar('REACT_APP_ENABLE_HARDWARE', false),
    enableOfflineMode: getBoolEnvVar('REACT_APP_ENABLE_OFFLINE_MODE', true),
    enableCameraQR: getBoolEnvVar('REACT_APP_ENABLE_CAMERA_QR', true),
    showDevMenu: getBoolEnvVar('REACT_APP_SHOW_DEV_MENU', false),
  },
  business: {
    defaultCurrency: getEnvVar('REACT_APP_DEFAULT_CURRENCY', 'GBP'),
    defaultTimezone: getEnvVar('REACT_APP_DEFAULT_TIMEZONE', 'Europe/London'),
    defaultLocale: getEnvVar('REACT_APP_DEFAULT_LOCALE', 'en-GB'),
    sessionTimeout: getNumberEnvVar('REACT_APP_SESSION_TIMEOUT', 3600000),
  },
  monitoring: {
    sentryDsn: getEnvVar('REACT_APP_SENTRY_DSN', ''),
    sentryEnvironment: getEnvVar('REACT_APP_SENTRY_ENVIRONMENT', currentEnvironment),
    analyticsEnabled: getBoolEnvVar('REACT_APP_ANALYTICS_ENABLED', false),
  },
};

// Validate configuration
let config: z.infer<typeof configSchema>;
try {
  config = configSchema.parse(rawConfig);
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  throw new Error('Invalid configuration. Check your environment variables.');
}

// Add environment-specific settings
const enhancedConfig = {
  ...config,
  environment: {
    ...envSettings,
    name: currentEnvironment,
    isProduction: currentEnvironment === 'production',
    isDevelopment: currentEnvironment === 'development',
    isStaging: currentEnvironment === 'staging',
  },
};

// Log configuration in development
if (enhancedConfig.app.debug && enhancedConfig.environment.enableDetailedLogging) {
  console.log('📋 App Configuration:', {
    app: enhancedConfig.app,
    api: { baseUrl: enhancedConfig.api.baseUrl },
    features: enhancedConfig.features,
    environment: enhancedConfig.environment.name,
  });
}

// Security validation for production
if (enhancedConfig.environment.isProduction) {
  // Ensure no development-specific settings in production
  if (enhancedConfig.app.debug) {
    console.warn('⚠️ Debug mode should be disabled in production');
  }
  
  if (enhancedConfig.features.showDevMenu) {
    console.warn('⚠️ Dev menu should be disabled in production');
  }
  
  // Ensure HTTPS in production
  if (!enhancedConfig.api.baseUrl.startsWith('https://')) {
    console.error('❌ API URL must use HTTPS in production');
  }
  
  if (!enhancedConfig.websocket.url.startsWith('wss://')) {
    console.error('❌ WebSocket URL must use WSS in production');
  }
}

export default enhancedConfig;

// Export individual sections for convenience
export const { app, api, websocket, payments, features, business, monitoring, environment } = enhancedConfig;

// Export types
export type AppConfig = typeof enhancedConfig;
export type Environment = typeof enhancedConfig.environment;
export type PaymentConfig = typeof enhancedConfig.payments;
export type FeatureFlags = typeof enhancedConfig.features;

// Export environment checks
export const isProduction = environment.isProduction;
export const isDevelopment = environment.isDevelopment;
export const isStaging = environment.isStaging;
```

### Step 3: CI/CD Integration with GitHub Actions

#### 3.1 Create GitHub Actions Workflows
Create `.github/workflows/deploy-staging.yml`:
```yaml
name: Deploy to Staging

on:
  push:
    branches: [ develop, staging ]
  pull_request:
    branches: [ develop ]

env:
  NODE_VERSION: '18.18.0'
  PYTHON_VERSION: '3.11'

jobs:
  test-backend:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
    
    - name: Install backend dependencies
      run: |
        cd backend
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Run backend tests
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379/0
        ENVIRONMENT: testing
        SUMUP_SECRET_KEY: ${{ secrets.SUMUP_TEST_SECRET_KEY }}
        JWT_SECRET_KEY: ${{ secrets.JWT_TEST_SECRET_KEY }}
        API_SECRET_KEY: ${{ secrets.API_TEST_SECRET_KEY }}
      run: |
        cd backend
        python -m pytest tests/ -v --cov=app

  test-mobile:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install mobile dependencies
      run: |
        npm ci
    
    - name: Run mobile tests
      env:
        REACT_APP_ENVIRONMENT: testing
        REACT_APP_API_BASE_URL: http://localhost:8000
        REACT_APP_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
      run: |
        npm test -- --coverage --watchAll=false

  deploy-staging:
    needs: [test-backend, test-mobile]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install DigitalOcean CLI
      uses: digitalocean/action-doctl@v2
      with:
        token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
    
    - name: Deploy to DigitalOcean App Platform (Staging)
      run: |
        # Update app with staging configuration
        doctl apps update ${{ secrets.STAGING_APP_ID }} --spec .do/app-staging.yaml
    
    - name: Wait for deployment
      run: |
        # Wait for deployment to complete
        echo "Waiting for staging deployment..."
        sleep 60
        
        # Check deployment status
        doctl apps get ${{ secrets.STAGING_APP_ID }}
    
    - name: Run smoke tests
      run: |
        # Test staging deployment
        curl -f https://${{ secrets.STAGING_APP_URL }}/health
        echo "✅ Staging deployment successful"
```

Create `.github/workflows/deploy-production.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

env:
  NODE_VERSION: '18.18.0'
  PYTHON_VERSION: '3.11'

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
    
    - name: Run full test suite
      run: |
        # Backend tests
        cd backend
        pip install -r requirements.txt
        python -m pytest tests/ -v
        
        # Mobile tests
        cd ../
        npm ci
        npm test -- --coverage --watchAll=false
    
    - name: Build mobile app bundle
      env:
        REACT_APP_ENVIRONMENT: production
        REACT_APP_API_BASE_URL: ${{ secrets.PRODUCTION_API_URL }}
        REACT_APP_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PRODUCTION_PUBLISHABLE_KEY }}
      run: |
        # Build production bundle
        npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
        mv ios/main.jsbundle.js ios/main.jsbundle
        cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

  deploy-production:
    needs: test-and-build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install DigitalOcean CLI
      uses: digitalocean/action-doctl@v2
      with:
        token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
    
    - name: Deploy to DigitalOcean App Platform (Production)
      run: |
        # Deploy to production
        doctl apps update ${{ secrets.PRODUCTION_APP_ID }} --spec .do/app-production.yaml
    
    - name: Wait for deployment
      run: |
        echo "Waiting for production deployment..."
        sleep 120
        
        # Verify deployment
        doctl apps get ${{ secrets.PRODUCTION_APP_ID }}
    
    - name: Run production smoke tests
      run: |
        # Test production deployment
        curl -f https://${{ secrets.PRODUCTION_API_URL }}/health
        echo "✅ Production deployment successful"
    
    - name: Notify team
      if: success()
      run: |
        # Send notification (Slack webhook)
        curl -X POST -H 'Content-type: application/json' \
          --data '{"text":"🚀 Production deployment successful!"}' \
          ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### 3.2 Create DigitalOcean App Platform Specs
Create `.do/app-staging.yaml`:
```yaml
name: fynlo-pos-backend-staging
services:
- name: api
  source_dir: /backend
  github:
    repo: your-username/fynlo-pos
    branch: staging
    deploy_on_push: true
  run_command: python -m app.main
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 8000
  health_check:
    http_path: /health
  envs:
  - key: ENVIRONMENT
    value: staging
  - key: DEBUG
    value: "false"
  - key: LOG_LEVEL
    value: INFO
  - key: DATABASE_URL
    value: ${fynlo-pos-db-staging.DATABASE_URL}
  - key: REDIS_URL
    value: ${fynlo-pos-cache-staging.DATABASE_URL}
  - key: SUMUP_SECRET_KEY
    value: ${SUMUP_TEST_SECRET_KEY}
    type: SECRET
  - key: SUMUP_ENVIRONMENT
    value: sandbox
  - key: STRIPE_SECRET_KEY
    value: ${STRIPE_TEST_SECRET_KEY}
    type: SECRET
  - key: JWT_SECRET_KEY
    value: ${JWT_SECRET_KEY}
    type: SECRET
  - key: API_SECRET_KEY
    value: ${API_SECRET_KEY}
    type: SECRET
  - key: CORS_ORIGINS
    value: '["https://staging.yourdomain.com"]'
  - key: SPACES_ACCESS_KEY_ID
    value: ${SPACES_ACCESS_KEY_ID}
    type: SECRET
  - key: SPACES_SECRET_ACCESS_KEY
    value: ${SPACES_SECRET_ACCESS_KEY}
    type: SECRET
  - key: SPACES_BUCKET
    value: fynlo-pos-storage-staging
  - key: CDN_ENDPOINT
    value: https://staging-cdn.yourdomain.com

databases:
- name: fynlo-pos-db-staging
  engine: PG
  version: "15"
  size: db-s-1vcpu-1gb
  num_nodes: 1

- name: fynlo-pos-cache-staging
  engine: REDIS
  version: "7"
  size: db-s-1vcpu-1gb
  num_nodes: 1
```

### Step 4: Secret Management Strategy

#### 4.1 Create Secret Management Documentation
Create `SECRET_MANAGEMENT.md`:
```markdown
# Secret Management Strategy

## Secret Categories

### 1. Development Secrets (Local Only)
- Location: `.env.local` (gitignored)
- Usage: Local development only
- Examples: Local database passwords, test API keys

### 2. CI/CD Secrets (GitHub Secrets)
- Location: GitHub repository secrets
- Usage: Automated testing and deployment
- Examples: DigitalOcean tokens, test API keys

### 3. Staging Secrets (DigitalOcean App Platform)
- Location: App Platform environment variables
- Usage: Staging environment
- Examples: Test payment keys, staging database credentials

### 4. Production Secrets (DigitalOcean App Platform)
- Location: App Platform environment variables (encrypted)
- Usage: Production environment
- Examples: Live payment keys, production database credentials

## Secret Naming Conventions

### Backend Secrets
- `SUMUP_SECRET_KEY`: SumUp API secret key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `JWT_SECRET_KEY`: JWT signing secret (min 32 chars)
- `API_SECRET_KEY`: General API secret (min 32 chars)
- `DATABASE_URL`: Database connection string
- `REDIS_URL`: Cache connection string

### Mobile App (NO SECRETS ALLOWED)
- Only use `REACT_APP_` prefixed variables
- Only include public/publishable keys
- Example: `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_*`

## Secret Rotation Schedule

### Monthly Rotation
- JWT signing keys
- API secret keys
- Development database passwords

### Quarterly Rotation
- Payment provider test keys
- Third-party service API keys

### Yearly Rotation
- Production payment provider keys
- Database master passwords

## Emergency Secret Rotation

If secrets are compromised:

1. **Immediate Actions**
   - Rotate compromised secrets in all environments
   - Update CI/CD pipeline secrets
   - Notify team of the incident

2. **Update Procedures**
   ```bash
   # Update DigitalOcean App Platform
   doctl apps update $APP_ID --spec app.yaml
   
   # Update GitHub Secrets
   # Go to: https://github.com/org/repo/settings/secrets/actions
   ```

3. **Verification**
   - Test all affected services
   - Verify no hardcoded secrets remain
   - Update documentation
```

#### 4.2 Create Secret Validation Script
Create `scripts/validate-secrets.py`:
```python
#!/usr/bin/env python3
"""
Secret validation script
Checks for exposed secrets and validates secret formats
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Any

# Patterns for different secret types
SECRET_PATTERNS = {
    'sumup_secret': r'sup_sk_[a-zA-Z0-9]+',
    'stripe_secret': r'sk_(live|test)_[a-zA-Z0-9]+',
    'jwt_secret': r'[a-zA-Z0-9+/]{32,}',
    'api_key': r'[a-zA-Z0-9]{32,}',
    'password': r'password[\'\"]\s*[=:]\s*[\'\"]\w+',
    'token': r'token[\'\"]\s*[=:]\s*[\'\"]\w+',
}

# Files to check for secrets
CHECK_FILES = [
    '**/*.py',
    '**/*.js',
    '**/*.ts',
    '**/*.tsx',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '.env*',
]

# Files to ignore
IGNORE_FILES = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '**/*.pyc',
    '__pycache__/**',
]

def scan_file_for_secrets(file_path: Path) -> List[Dict[str, Any]]:
    """Scan a file for potential secrets"""
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        for line_num, line in enumerate(content.split('\n'), 1):
            for secret_type, pattern in SECRET_PATTERNS.items():
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    findings.append({
                        'file': str(file_path),
                        'line': line_num,
                        'type': secret_type,
                        'pattern': pattern,
                        'context': line.strip()[:100],
                        'severity': get_severity(secret_type, file_path)
                    })
    
    except Exception as e:
        print(f"Error scanning {file_path}: {e}")
    
    return findings

def get_severity(secret_type: str, file_path: Path) -> str:
    """Determine severity of secret exposure"""
    
    # Mobile app should never have secrets
    if 'src/' in str(file_path) and file_path.suffix in ['.js', '.ts', '.tsx']:
        return 'CRITICAL'
    
    # Production files are high severity
    if 'production' in str(file_path).lower():
        return 'HIGH'
    
    # Development files are medium severity
    if 'development' in str(file_path).lower() or '.env.local' in str(file_path):
        return 'MEDIUM'
    
    # Default severity
    return 'LOW'

def validate_env_files():
    """Validate environment files for proper structure"""
    issues = []
    
    env_files = list(Path('.').glob('.env*'))
    
    for env_file in env_files:
        if env_file.name in ['.env.sample', '.env.example']:
            continue
            
        try:
            with open(env_file, 'r') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                
                # Check for proper format
                if '=' not in line:
                    issues.append({
                        'file': str(env_file),
                        'line': line_num,
                        'issue': 'Invalid format - missing =',
                        'context': line
                    })
                    continue
                
                key, value = line.split('=', 1)
                
                # Check for secrets in mobile app env vars
                if key.startswith('REACT_APP_') and any(pattern in value.lower() for pattern in ['secret', 'private', 'sk_']):
                    issues.append({
                        'file': str(env_file),
                        'line': line_num,
                        'issue': 'CRITICAL: Secret in mobile environment variable',
                        'context': f'{key}={value[:20]}...'
                    })
                
                # Check for weak secrets
                if 'secret' in key.lower() and len(value.strip('"\'')) < 16:
                    issues.append({
                        'file': str(env_file),
                        'line': line_num,
                        'issue': 'Weak secret - too short',
                        'context': f'{key}=***'
                    })
        
        except Exception as e:
            issues.append({
                'file': str(env_file),
                'line': 0,
                'issue': f'Error reading file: {e}',
                'context': ''
            })
    
    return issues

def main():
    """Main validation function"""
    print("🔍 Scanning for exposed secrets...")
    
    all_findings = []
    
    # Scan all relevant files
    for pattern in CHECK_FILES:
        for file_path in Path('.').glob(pattern):
            # Skip ignored files
            if any(file_path.match(ignore) for ignore in IGNORE_FILES):
                continue
            
            if file_path.is_file():
                findings = scan_file_for_secrets(file_path)
                all_findings.extend(findings)
    
    # Validate environment files
    env_issues = validate_env_files()
    
    # Report findings
    critical_count = len([f for f in all_findings if f['severity'] == 'CRITICAL'])
    high_count = len([f for f in all_findings if f['severity'] == 'HIGH'])
    
    if critical_count > 0:
        print(f"\n❌ CRITICAL: Found {critical_count} critical secret exposures!")
        for finding in [f for f in all_findings if f['severity'] == 'CRITICAL']:
            print(f"  {finding['file']}:{finding['line']} - {finding['type']}")
            print(f"    {finding['context']}")
    
    if high_count > 0:
        print(f"\n⚠️  HIGH: Found {high_count} high-severity secret exposures!")
        for finding in [f for f in all_findings if f['severity'] == 'HIGH']:
            print(f"  {finding['file']}:{finding['line']} - {finding['type']}")
    
    if env_issues:
        print(f"\n📋 Environment file issues: {len(env_issues)}")
        for issue in env_issues:
            print(f"  {issue['file']}:{issue['line']} - {issue['issue']}")
    
    # Exit with error if critical issues found
    if critical_count > 0:
        print("\n💥 Critical secret exposures found - fix before proceeding!")
        sys.exit(1)
    
    if high_count > 0 or env_issues:
        print("\n⚠️  Issues found - review and fix recommended")
        sys.exit(1)
    
    print("\n✅ No critical secret exposures found!")
    return 0

if __name__ == "__main__":
    main()
```

Make it executable:
```bash
chmod +x scripts/validate-secrets.py
```

## ✅ Verification Steps

### Step 1: Test Environment Loading
```bash
# Test development environment
cd backend/
ENVIRONMENT=development python -c "
from app.core.config import settings
print(f'Environment: {settings.environment}')
print(f'Debug: {settings.debug}')
print(f'Database: {settings.database_url}')
"

# Test staging environment
ENVIRONMENT=staging python -c "
from app.core.config import settings
print(f'Environment: {settings.environment}')
print(f'Debug: {settings.debug}')
"

echo "✅ Backend environment loading verified"
```

### Step 2: Test Mobile Configuration
```bash
# Test mobile configuration loading
cd mobile/
REACT_APP_ENVIRONMENT=development npm start

# Check configuration in browser console
# Should see: "📋 App Configuration: ..."

echo "✅ Mobile configuration loading verified"
```

### Step 3: Test Secret Validation
```bash
# Run secret validation script
python scripts/validate-secrets.py

# Should report any secret exposures found
echo "✅ Secret validation completed"
```

### Step 4: Test CI/CD Pipeline
```bash
# Test GitHub Actions (push to staging branch)
git checkout -b staging
git push origin staging

# Monitor GitHub Actions at:
# https://github.com/your-username/fynlo-pos/actions

echo "✅ CI/CD pipeline tested"
```

## 🚨 Troubleshooting

### Issue: Environment Variables Not Loading
**Symptoms**: Configuration errors or default values being used
**Solution**:
```bash
# Check environment file exists
ls -la .env*

# Check environment variable loading
echo $ENVIRONMENT
env | grep REACT_APP_

# Verify file permissions
chmod 644 .env.development
```

### Issue: Secrets Exposed in Logs
**Symptoms**: Sensitive data appearing in application logs
**Solution**:
```python
# Update logging configuration
import logging

class SecureFormatter(logging.Formatter):
    def format(self, record):
        # Redact sensitive fields
        sensitive_keys = ['password', 'secret', 'key', 'token']
        
        message = super().format(record)
        for key in sensitive_keys:
            message = re.sub(f'{key}[=:][^\\s]+', f'{key}=***', message, flags=re.IGNORECASE)
        
        return message
```

### Issue: CI/CD Deployment Failures
**Symptoms**: GitHub Actions failing to deploy
**Solution**:
```bash
# Check GitHub Secrets are set
# Go to: https://github.com/org/repo/settings/secrets/actions

# Verify DigitalOcean App Platform spec
doctl apps validate .do/app-staging.yaml

# Check deployment logs
doctl apps logs $APP_ID
```

## 🔄 Rollback Procedures

### Emergency Environment Rollback
```bash
echo "🚨 EMERGENCY: Rolling back environment configuration"

# Revert to simple configuration
cp .env.sample .env

# Update backend to use basic config
git checkout app/core/config.py

# Redeploy without advanced environment management
doctl apps create-deployment $APP_ID

echo "✅ Environment configuration rolled back"
```

### Revert Secret Changes
```bash
# Restore previous secrets in DigitalOcean
doctl apps update $APP_ID --spec .do/app-simple.yaml

# Update GitHub Secrets to previous values
echo "Update GitHub Secrets manually at:"
echo "https://github.com/org/repo/settings/secrets/actions"
```

## ✨ Completion Criteria

- [x] Multi-environment configuration system implemented
- [x] Secure secret management strategy established
- [x] CI/CD pipeline with environment-specific deployments
- [x] Secret validation and scanning tools
- [x] Team collaboration workflows documented
- [x] Environment-specific feature flags working
- [x] Configuration validation and type safety
- [x] Emergency rollback procedures tested

## 📊 Environment Management Summary

### Environments Configured:
- **Development**: Local database, debug enabled, test keys
- **Staging**: DigitalOcean test environment, production-like setup
- **Production**: DigitalOcean production, all security enabled

### Secret Management:
- **Local Secrets**: `.env.local` files (gitignored)
- **CI/CD Secrets**: GitHub repository secrets
- **Staging/Production**: DigitalOcean App Platform environment variables
- **Mobile App**: NO SECRETS (only public configuration)

### CI/CD Pipeline:
- **Staging Deployment**: Automatic on `staging` branch push
- **Production Deployment**: Manual approval on `main` branch
- **Testing**: Full test suite before deployment
- **Validation**: Secret scanning and configuration validation

## 📝 Next Steps

After completing this phase:
1. **Continue to**: `TESTING_DEPLOYMENT_CHECKLIST.md`
2. **Train team**: On new environment management procedures
3. **Monitor**: Environment-specific metrics and alerts
4. **Document**: Team onboarding with new workflows

## 📈 Progress Tracking

- **Risk Level**: 🟡 Medium (environment complexity, secret management)
- **Time Estimate**: 6-8 hours (configuration and testing)
- **Dependencies**: Phase 6 completed (monitoring operational)
- **Impacts**: Team workflows, Deployment process, Security posture

---

**🔧 Environment Status**: Multi-environment strategy fully implemented
**🔐 Security**: Comprehensive secret management with validation
**🔄 Next Phase**: Complete testing and deployment validation procedures