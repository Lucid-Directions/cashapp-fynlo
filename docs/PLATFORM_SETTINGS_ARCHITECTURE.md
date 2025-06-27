# Platform Settings Architecture

## Overview

This document outlines the architectural changes to implement a proper multi-tenant settings hierarchy for the Fynlo POS system. The goal is to separate platform-controlled settings (managed by Fynlo) from restaurant-controlled settings (managed by individual restaurant owners).

## Current Issues

1. **Payment Processing Fees**: Currently controlled at the restaurant level, allowing restaurants to modify their own processing rates
2. **Compliance Settings**: Security and compliance configurations are decentralized
3. **Feature Management**: No centralized control over platform features and capabilities
4. **Revenue Control**: Platform cannot enforce consistent pricing and fee structures

## Proposed Architecture

### Three-Tier Settings Hierarchy

```
┌─────────────────────────────────┐
│   Platform Settings (Fynlo)     │  ← Controlled by Fynlo
├─────────────────────────────────┤
│   Restaurant Settings           │  ← Controlled by Restaurant
├─────────────────────────────────┤
│   User Preferences              │  ← Controlled by Individual Users
└─────────────────────────────────┘
```

### Platform-Controlled Settings

These settings are managed centrally by Fynlo and are read-only for restaurants:

#### 1. Payment Processing & Fees
- Base processing rates for all payment methods
  - QR Payment: 1.2% (competitive advantage)
  - Stripe: 1.4% + 20p
  - Square: 1.75%
  - SumUp: 0.69% + £19/month (high volume)
- Payment provider API credentials
- Smart routing algorithms and thresholds
- Transaction limits (min/max)
- Settlement schedules

#### 2. System & Security
- API rate limits
- Data retention policies
- Encryption requirements
- PCI compliance settings
- Audit logging configuration
- Webhook configurations

#### 3. Platform Features
- Available payment providers
- Feature flags (smart routing, analytics, etc.)
- Integration capabilities
- System update schedules
- Platform-wide promotions

### Restaurant-Controlled Settings

These settings remain under individual restaurant control:

#### 1. Business Operations
- Business information (name, address, contact)
- Operating hours and holidays
- Staff management and permissions
- Receipt customization (within templates)
- Language and localization preferences

#### 2. Financial Settings
- Tax rates and configurations (VAT, service charges)
- Currency preferences (within platform support)
- Invoice settings
- Cash management preferences

#### 3. Customer Experience
- Which payment methods to accept (from platform options)
- Tipping policies
- Customer-facing display settings
- Menu and pricing
- Loyalty program participation

### Hybrid Settings

Platform sets defaults and limits, restaurants customize within bounds:

#### 1. Payment Method Configuration
- **Platform**: Sets available methods, base fees, technical requirements
- **Restaurant**: Chooses which to enable, can add markup (with limits)

#### 2. Pricing & Discounts
- **Platform**: Sets maximum discount percentages, promotion rules
- **Restaurant**: Creates specific discounts within allowed ranges

## Implementation Details

### Backend Architecture

#### 1. Database Schema

```sql
-- Platform configurations table
CREATE TABLE platform_configurations (
    id UUID PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    category VARCHAR(100) NOT NULL,
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Restaurant overrides table
CREATE TABLE restaurant_overrides (
    id UUID PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id),
    config_key VARCHAR(255) NOT NULL,
    override_value JSONB NOT NULL,
    platform_limit JSONB,
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(restaurant_id, config_key)
);

-- Configuration audit log
CREATE TABLE configuration_audit (
    id UUID PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL, -- 'platform' or 'restaurant'
    config_key VARCHAR(255) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. API Endpoints

**Platform Settings (Admin Only)**
- `GET /api/v1/platform/settings` - Get all platform settings
- `PUT /api/v1/platform/settings/{key}` - Update specific setting
- `GET /api/v1/platform/settings/schema` - Get settings schema and validation rules

**Restaurant Settings**
- `GET /api/v1/restaurants/{id}/settings` - Get merged settings (platform + overrides)
- `PUT /api/v1/restaurants/{id}/settings/{key}` - Update restaurant override
- `GET /api/v1/restaurants/{id}/settings/effective` - Get effective configuration

**Configuration Sync**
- `GET /api/v1/sync/platform-config` - Mobile app sync endpoint
- `POST /api/v1/sync/validate-settings` - Validate restaurant settings against platform

### Frontend Architecture

#### 1. Settings Stores

```typescript
// Platform Settings Store (Read-only for restaurants)
interface PlatformSettingsStore {
  settings: PlatformConfiguration;
  lastSync: Date;
  syncStatus: 'synced' | 'syncing' | 'error';
  
  fetchPlatformSettings(): Promise<void>;
  subscribeToUpdates(): void;
  getEffectiveFee(method: string): number;
}

// Restaurant Settings Store
interface RestaurantSettingsStore {
  settings: RestaurantConfiguration;
  overrides: RestaurantOverrides;
  
  updateSetting(key: string, value: any): Promise<void>;
  validateAgainstPlatform(key: string, value: any): boolean;
}
```

#### 2. UI Components

- **Settings Screen Updates**: Add "Platform Managed" badges
- **Effective Rate Display**: Show base rate + restaurant markup
- **Validation Feedback**: Real-time validation against platform limits
- **Override Request Flow**: For special cases requiring platform approval

## Migration Strategy

### Phase 1: Backend Infrastructure (Week 1)
1. Create platform settings database schema
2. Implement platform settings API endpoints
3. Add configuration validation service
4. Create audit logging for changes

### Phase 2: Frontend Integration (Week 2)
1. Create platform settings store
2. Update restaurant settings screens
3. Implement settings synchronization
4. Add validation UI components

### Phase 3: Data Migration (Week 3)
1. Migrate existing fee configurations to platform
2. Set default platform configurations
3. Create restaurant override records
4. Validate all settings post-migration

### Phase 4: Admin Dashboard (Week 4)
1. Create platform admin interface
2. Add bulk configuration management
3. Implement override approval workflow
4. Add analytics and reporting

## Security Considerations

1. **Access Control**: Platform settings require admin authentication
2. **Audit Trail**: All configuration changes are logged
3. **Encryption**: Sensitive settings (API keys) are encrypted at rest
4. **Validation**: All restaurant overrides validated against platform rules
5. **Rate Limiting**: Configuration sync endpoints are rate-limited

## Benefits

### For Fynlo (Platform)
- **Revenue Control**: Direct control over payment processing fees
- **Consistency**: Uniform compliance across all restaurants
- **Scalability**: Easy to onboard new providers globally
- **Analytics**: Centralized view of platform performance

### For Restaurants
- **Simplicity**: No complex fee management
- **Compliance**: Automatic adherence to standards
- **Transparency**: Clear cost structure
- **Support**: Platform handles provider relationships

## Future Enhancements

1. **A/B Testing**: Test different fee structures
2. **Dynamic Pricing**: Time-based or volume-based fee adjustments
3. **Regional Settings**: Different configurations by region
4. **White-Label Support**: Custom branding per restaurant chain
5. **Advanced Analytics**: Fee optimization recommendations

## Conclusion

This architecture provides a clear separation of concerns between platform and restaurant settings while maintaining flexibility for restaurant operations. It ensures Fynlo maintains control over revenue-critical settings while giving restaurants the autonomy they need for day-to-day operations.