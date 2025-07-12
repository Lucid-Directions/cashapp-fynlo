# Platform Settings Quick Reference

## Settings Control Matrix

### 🔴 Platform-Controlled (Fynlo)
*These settings are managed centrally and read-only for restaurants*

#### Payment & Fees
- ✅ QR Payment: 1.2% (your competitive advantage!)
- ✅ Stripe: 1.4% + 20p
- ✅ Square: 1.75%
- ✅ SumUp: 0.69% + £19/month
- ✅ Cash: 0% (no fees)
- ✅ Smart routing algorithms
- ✅ Provider API credentials
- ✅ Volume thresholds

#### Security & Compliance
- ✅ PCI compliance requirements
- ✅ Data retention policies
- ✅ API rate limits
- ✅ Encryption standards
- ✅ Audit logging

#### Features
- ✅ Available payment providers
- ✅ Smart routing enabled/disabled
- ✅ Analytics features
- ✅ System capabilities

### 🟢 Restaurant-Controlled
*These settings remain under restaurant control*

#### Business Operations
- ✅ Company information
- ✅ Operating hours
- ✅ Staff management
- ✅ Hardware configuration

#### Financial
- ✅ VAT rates
- ✅ Service charges
- ✅ Tipping policies
- ✅ Receipt customization

#### Customer Experience
- ✅ Which payment methods to accept
- ✅ Language preferences
- ✅ Display settings
- ✅ Menu and pricing

### 🟡 Hybrid Control
*Platform sets limits, restaurants customize within bounds*

#### Pricing
- Platform: Maximum discount (e.g., 50%)
- Restaurant: Actual discounts (0-50%)

#### Payment Methods
- Platform: Available methods & base fees
- Restaurant: Which to enable, auth requirements

## Implementation Checklist

### Phase 1: Backend (Week 1)
- [ ] Create platform_configurations table
- [ ] Build platform settings API
- [ ] Add validation service
- [ ] Implement audit logging

### Phase 2: Frontend (Week 2)
- [ ] Create usePlatformStore
- [ ] Update settings screens
- [ ] Add sync mechanism
- [ ] Implement validation UI

### Phase 3: Migration (Week 3)
- [ ] Move payment fees to platform
- [ ] Migrate security settings
- [ ] Update all restaurants
- [ ] Validate configurations

### Phase 4: Admin (Week 4)
- [ ] Build admin dashboard
- [ ] Add bulk management
- [ ] Create monitoring
- [ ] Document everything

## Key Files to Modify

### Backend
```
backend/
├── app/models/
│   ├── platform_config.py (NEW)
│   └── restaurant_override.py (NEW)
├── app/api/v1/endpoints/
│   ├── platform_settings.py (NEW)
│   └── restaurant_settings.py (UPDATE)
└── app/services/
    ├── platform_service.py (NEW)
    └── settings_validator.py (NEW)
```

### Frontend
```
CashApp-iOS/CashAppPOS/src/
├── store/
│   ├── usePlatformStore.ts (NEW)
│   └── useSettingsStore.ts (UPDATE)
├── services/
│   └── PlatformService.ts (NEW)
└── screens/settings/
    └── BusinessSettingsScreen.tsx (UPDATE)
```

## API Endpoints

### Platform Settings (Admin Only)
```
GET  /api/v1/platform/settings
PUT  /api/v1/platform/settings/{key}
GET  /api/v1/platform/settings/schema
POST /api/v1/platform/settings/bulk
```

### Restaurant Settings
```
GET  /api/v1/restaurants/{id}/settings
PUT  /api/v1/restaurants/{id}/settings/{key}
GET  /api/v1/restaurants/{id}/settings/effective
POST /api/v1/restaurants/{id}/settings/validate
```

### Sync Endpoints
```
GET  /api/v1/sync/platform-config
POST /api/v1/sync/validate-settings
GET  /api/v1/sync/pending-updates
```

## Critical Code Sections

### Payment Fee Calculation
```typescript
// BEFORE (Restaurant-controlled)
const qrFee = settings.paymentMethods.qrCode.feePercentage;

// AFTER (Platform-controlled)
const qrFee = platformSettings.fees.qrCode;
const effectiveFee = qrFee + restaurantMarkup; // if allowed
```

### Settings Validation
```typescript
// Validate restaurant override
if (key === 'discount.maximum') {
  const platformMax = platformSettings.limits.maxDiscount;
  if (value > platformMax) {
    throw new Error(`Cannot exceed platform limit of ${platformMax}%`);
  }
}
```

### Feature Flags
```typescript
// Check if feature is enabled
const qrEnabled = platformSettings.features.qrPayments && 
                  restaurantSettings.paymentMethods.qr.enabled;
```

## Testing Checklist

### Unit Tests
- [ ] Platform settings API
- [ ] Validation logic
- [ ] Settings merge function
- [ ] Audit logging

### Integration Tests
- [ ] Settings synchronization
- [ ] Restaurant overrides
- [ ] Offline functionality
- [ ] Migration scripts

### E2E Tests
- [ ] Settings update flow
- [ ] Payment with platform fees
- [ ] Admin management
- [ ] Restaurant experience

## Monitoring & Alerts

### Key Metrics
- Settings sync success rate
- Configuration update frequency
- Validation failure rate
- Platform fee compliance

### Alert Conditions
- Sync failure > 1%
- Unauthorized fee modification
- Configuration drift detected
- Platform settings unreachable

## Support & Troubleshooting

### Common Issues
1. **Settings not syncing**
   - Check network connectivity
   - Verify API credentials
   - Check sync timestamp

2. **Validation errors**
   - Review platform limits
   - Check override permissions
   - Verify data types

3. **Missing settings**
   - Force sync from platform
   - Clear local cache
   - Check feature flags

## Contact

- Technical Issues: tech@fynlo.com
- Business Questions: support@fynlo.com
- Emergency: +44 XXX XXXX