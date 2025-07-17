# Settings Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/navigation/SettingsNavigator.tsx` and related screens  
**Purpose**: Comprehensive configuration management for restaurant and platform  
**Status**: 🟢 Most complete screen with proper platform/restaurant separation  
**Production Ready**: 70%

## 1. Current State Analysis

### What's Implemented ✅
- Complete navigation structure
- Platform vs Restaurant settings separation
- Role-based access control
- Business settings management
- Tax configuration
- Theme selection (10 themes!)
- Profile management
- Receipt customization
- Platform-controlled sections with lock icons
- Settings persistence via Zustand

### What's Not Working ❌
- Some settings don't save to backend
- Platform settings can't be edited (by design, but no platform portal)
- Floor plan editor not implemented
- Printer setup incomplete
- Some toggle switches don't persist
- KDS (Kitchen Display) settings placeholder only

### Code References
```typescript
// SettingsNavigator.tsx - Main settings structure
const settingsScreens = [
  { name: 'Business', component: BusinessSettings },
  { name: 'Tax', component: TaxSettings },
  { name: 'Payment', component: PaymentSettings }, // Platform-controlled
  { name: 'Users', component: UserManagement },
  { name: 'Receipt', component: ReceiptSettings },
  { name: 'Display', component: DisplaySettings },
  { name: 'Notifications', component: NotificationSettings },
  { name: 'ServiceCharge', component: ServiceChargeSettings }, // Platform-controlled
  { name: 'FloorPlan', component: FloorPlanSettings },
  { name: 'MenuSettings', component: MenuSettings },
  { name: 'Printer', component: PrinterSettings },
  { name: 'Support', component: SupportSettings }
];
```

## 2. Data Flow Diagram

```
SettingsScreen
    ↓
useSettingsStore (Zustand)
    ↓
AsyncStorage (persistence)
    ↓
Some settings → Backend API
    ↓
Platform controls certain settings
    ↓
Restaurant controls others

Platform Flow:
Platform Portal → API
    ↓
Restaurant Settings (read-only)
    ↓
Lock icons show control
```

## 3. Every Function & Requirement

### Settings Categories

#### 1. Business Settings (Restaurant-controlled)
```typescript
// Business information management
- Restaurant name
- Address
- Contact details
- Operating hours
- Business registration
- Logo upload
- Social media links
```

#### 2. Tax Settings (Mixed control)
```typescript
// Platform sets structure, restaurant sets rates
Platform-controlled:
- Tax reporting requirements
- Compliance rules
- Service charge (12.5% fixed)

Restaurant-controlled:
- VAT rate
- Tax-exempt categories
- Custom tax rules
- Tax number
```

#### 3. Payment Settings (Platform-controlled)
```typescript
// All payment configuration is platform-level
- Payment methods available
- Processing fees (QR: 1.2%, Card: 2.9%)
- Settlement schedules
- Refund policies

// Shows informational message:
"Payment methods are configured by the platform administrator"
```

#### 4. User Management (Restaurant-controlled)
```typescript
// Staff and role management
- Add/edit/remove users
- Role assignment (Manager, Employee)
- Permissions configuration
- Access codes/PINs
- Shift schedules
- Performance tracking toggle
```

#### 5. Receipt Settings (Restaurant-controlled)
```typescript
// Receipt customization
- Header text
- Footer message
- Show/hide fields
- Logo placement
- Paper size
- Language selection
- Legal disclaimers
```

#### 6. Display Settings (User-controlled)
```typescript
// UI customization
- Theme selection (10 themes!)
- Language
- Currency format
- Date/time format
- Sound effects
- Animations
- Accessibility options
```

#### 7. Notification Settings (Mixed control)
```typescript
Platform notifications:
- System updates
- Compliance alerts
- Payment issues

Restaurant notifications:
- Low stock alerts
- Order notifications
- Staff alerts
- Customer feedback
```

### State Management
```typescript
// useSettingsStore.ts
interface SettingsStore {
  // Business Settings
  businessInfo: {
    name: string;
    address: Address;
    phone: string;
    email: string;
    registrationNumber: string;
    logo?: string;
  };
  
  // Operating Hours
  operatingHours: {
    [day: string]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
  };
  
  // Tax Settings
  taxSettings: {
    vatRate: number;
    taxExemptCategories: string[];
    includeTaxInPrice: boolean;
  };
  
  // Display Settings
  displaySettings: {
    theme: ThemeName;
    language: string;
    currency: string;
    dateFormat: string;
    soundEnabled: boolean;
  };
  
  // Notification Preferences
  notifications: {
    orderAlerts: boolean;
    stockAlerts: boolean;
    staffAlerts: boolean;
    marketingEmails: boolean;
  };
  
  // Actions
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;
  updateTaxSettings: (settings: Partial<TaxSettings>) => void;
  persistToBackend: () => Promise<void>;
}
```

## 4. Platform Connections

### Platform-Controlled Settings
```typescript
// These settings can only be changed by platform owners
interface PlatformSettings {
  payment: {
    service_charge_rate: 12.5; // Fixed
    payment_methods: PaymentMethod[];
    processing_fees: {
      qr_code: 1.2;
      card: 2.9;
      apple_pay: 2.9;
    };
  };
  compliance: {
    tax_reporting_required: boolean;
    data_retention_days: number;
    audit_log_enabled: boolean;
  };
  features: {
    inventory_enabled: boolean;
    loyalty_enabled: boolean;
    table_service_enabled: boolean;
    online_ordering_enabled: boolean;
  };
  subscription: {
    plan: 'alpha' | 'beta' | 'omega';
    features: string[];
    limits: {
      max_users: number;
      max_products: number;
      max_orders_per_month: number;
    };
  };
}
```

### Settings Sync
```typescript
// How settings propagate
Restaurant Changes → Backend → Other Devices
Platform Changes → All Restaurants → Immediate Effect

// WebSocket events for settings
ws.on('settings.updated', (data) => {
  if (data.scope === 'platform') {
    // Force reload platform settings
    showAlert('Platform settings updated');
  } else {
    // Merge restaurant settings
    settingsStore.merge(data.settings);
  }
});
```

## 5. Backend Requirements

### Settings API Endpoints
```python
# Restaurant Settings Management
GET /api/v1/settings/restaurant/{id}
Response: {
  business: BusinessSettings,
  tax: TaxSettings,
  operating_hours: OperatingHours,
  receipt: ReceiptSettings,
  notifications: NotificationPreferences
}

PUT /api/v1/settings/restaurant/{id}
Body: Partial<RestaurantSettings>
Validation: 
  - Check user has permission
  - Validate against schema
  - Don't allow platform-controlled fields

# Platform Settings (Read-only for restaurants)
GET /api/v1/settings/platform
Response: {
  payment: PaymentSettings,
  service_charge: ServiceChargeSettings,
  compliance: ComplianceSettings,
  features: FeatureFlags
}

# User Preferences
GET /api/v1/settings/user/{id}
PUT /api/v1/settings/user/{id}
Body: {
  theme: string,
  language: string,
  notifications: object
}
```

### Database Schema
```sql
-- Restaurant Settings
CREATE TABLE restaurant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) UNIQUE,
  business_info JSONB NOT NULL DEFAULT '{}',
  tax_settings JSONB NOT NULL DEFAULT '{}',
  operating_hours JSONB NOT NULL DEFAULT '{}',
  receipt_settings JSONB NOT NULL DEFAULT '{}',
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Platform Settings
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id UUID REFERENCES platforms(id) UNIQUE,
  payment_settings JSONB NOT NULL,
  service_charge_settings JSONB NOT NULL,
  compliance_settings JSONB NOT NULL,
  feature_flags JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) UNIQUE,
  theme VARCHAR(50) DEFAULT 'default',
  language VARCHAR(10) DEFAULT 'en',
  currency VARCHAR(3) DEFAULT 'GBP',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  notifications JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log for Settings Changes
CREATE TABLE settings_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50), -- 'restaurant', 'platform', 'user'
  entity_id UUID,
  changed_by UUID REFERENCES users(id),
  changes JSONB, -- Old vs new values
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. Current Issues

### Critical Issues
1. **Incomplete Backend Integration**
   ```typescript
   // Many settings save locally but not to backend
   const handleSave = async () => {
     // Only updates Zustand store
     settingsStore.updateBusinessInfo(formData);
     // Missing: await DatabaseService.updateSettings(formData);
   };
   ```

2. **Platform Settings Not Editable**
   - No platform owner portal exists
   - Settings are hardcoded
   - Can't actually change service charge or payment methods

3. **Missing Validations**
   ```typescript
   // Need validation for:
   - VAT rate limits (0-100%)
   - Phone number formats
   - Email validation
   - Operating hours logic
   ```

### UI/UX Issues
1. **Inconsistent Save Behavior**
   - Some screens auto-save
   - Others require "Save" button
   - No clear indication of saved state

2. **Missing Features**
   - Floor plan editor promised but not built
   - Printer setup incomplete
   - KDS settings placeholder only

3. **Navigation Confusion**
   - Deep nesting makes it hard to find settings
   - No search functionality
   - No quick access to common settings

## 7. Required Fixes

### Backend Integration (Priority 1)
```typescript
// services/SettingsService.ts
class SettingsService {
  async loadSettings(restaurantId: string): Promise<RestaurantSettings> {
    try {
      const response = await DatabaseService.apiRequest(
        `/api/v1/settings/restaurant/${restaurantId}`
      );
      
      // Update local store
      useSettingsStore.getState().loadFromBackend(response.data);
      
      return response.data;
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fall back to local storage
      return useSettingsStore.getState().getAll();
    }
  }
  
  async saveSettings(settings: Partial<RestaurantSettings>): Promise<void> {
    const restaurantId = AuthContext.getCurrentRestaurantId();
    
    try {
      await DatabaseService.apiRequest(
        `/api/v1/settings/restaurant/${restaurantId}`,
        {
          method: 'PUT',
          body: settings
        }
      );
      
      // Update local store
      useSettingsStore.getState().updateMultiple(settings);
      
      // Broadcast to other devices
      WebSocketService.emit('settings.updated', settings);
    } catch (error) {
      throw new Error('Failed to save settings');
    }
  }
  
  // Auto-save with debouncing
  private saveDebounced = debounce(this.saveSettings, 2000);
  
  autoSave(settings: Partial<RestaurantSettings>): void {
    // Update locally immediately
    useSettingsStore.getState().updateMultiple(settings);
    
    // Save to backend with delay
    this.saveDebounced(settings);
  }
}
```

### Platform Settings Portal (Priority 2)
```typescript
// New platform owner portal screens needed
interface PlatformPortal {
  screens: {
    'PaymentConfiguration': {
      // Edit payment methods
      // Set processing fees
      // Configure settlement
    };
    'ServiceChargeSettings': {
      // Set platform-wide service charge
      // Configure distribution
    };
    'SubscriptionManagement': {
      // Define subscription tiers
      // Set feature limits
      // Manage pricing
    };
    'ComplianceSettings': {
      // Tax reporting rules
      // Data retention
      // Audit requirements
    };
  };
}
```

### Validation Implementation (Priority 3)
```typescript
// utils/settingsValidation.ts
export const validateBusinessSettings = (settings: BusinessSettings): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Name validation
  if (!settings.name || settings.name.length < 2) {
    errors.push({
      field: 'name',
      message: 'Business name must be at least 2 characters'
    });
  }
  
  // Phone validation (UK format)
  const phoneRegex = /^(\+44|0)[1-9]\d{9,10}$/;
  if (!phoneRegex.test(settings.phone.replace(/\s/g, ''))) {
    errors.push({
      field: 'phone',
      message: 'Invalid UK phone number'
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(settings.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email address'
    });
  }
  
  // VAT number validation (if provided)
  if (settings.taxNumber && !validateVATNumber(settings.taxNumber)) {
    errors.push({
      field: 'taxNumber',
      message: 'Invalid VAT number format'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

### Floor Plan Editor (Priority 4)
```typescript
// components/FloorPlanEditor.tsx
interface FloorPlanEditor {
  tables: Table[];
  sections: Section[];
  
  // Drag and drop functionality
  onTableMove: (tableId: string, position: Point) => void;
  onTableResize: (tableId: string, size: Size) => void;
  onTableRotate: (tableId: string, rotation: number) => void;
  
  // Table management
  addTable: (type: TableType, position: Point) => void;
  removeTable: (tableId: string) => void;
  updateTableCapacity: (tableId: string, capacity: number) => void;
  
  // Section management
  createSection: (name: string, color: string) => void;
  assignTableToSection: (tableId: string, sectionId: string) => void;
  
  // Save/Load
  saveFloorPlan: () => Promise<void>;
  loadFloorPlan: () => Promise<FloorPlan>;
}
```

## 8. Testing Requirements

### Unit Tests
1. Settings validation rules
2. Permission checks
3. Data transformation
4. State persistence
5. Platform vs restaurant logic

### Integration Tests
1. Settings save to backend
2. Multi-device synchronization
3. Platform settings propagation
4. Offline settings changes
5. Conflict resolution

### User Acceptance Criteria
- [ ] All settings persist across app restarts
- [ ] Changes sync to other devices
- [ ] Platform settings show lock icons
- [ ] Validation prevents invalid data
- [ ] Auto-save works smoothly
- [ ] Search finds settings quickly
- [ ] Help text explains each setting

## 9. Platform Owner Portal Integration

### Platform Configuration Dashboard
```typescript
// Platform owner can configure all platform-wide settings
interface PlatformConfigDashboard {
  restaurants: {
    // Override any restaurant setting
    selectRestaurant: (id: string) => void;
    viewSettings: (restaurantId: string) => RestaurantSettings;
    overrideSettings: (restaurantId: string, settings: Partial<RestaurantSettings>) => void;
  };
  
  platformWide: {
    // Settings that apply to all restaurants
    paymentMethods: PaymentMethodConfig[];
    serviceCharge: ServiceChargeConfig;
    subscriptionTiers: SubscriptionTier[];
    complianceRules: ComplianceConfig;
  };
  
  deployment: {
    // Push settings to restaurants
    deployToAll: (settings: PlatformSettings) => void;
    deployToGroup: (groupId: string, settings: PlatformSettings) => void;
    scheduleDeployment: (settings: PlatformSettings, date: Date) => void;
  };
}
```

### Settings Analytics
```sql
-- Track settings usage and changes
SELECT 
  s.entity_type,
  s.entity_id,
  r.name as restaurant_name,
  COUNT(*) as change_count,
  jsonb_array_length(jsonb_object_keys(s.changes)) as fields_changed,
  s.changed_by,
  DATE_TRUNC('day', s.created_at) as change_date
FROM settings_audit_log s
LEFT JOIN restaurants r ON s.entity_id = r.id
WHERE s.created_at > NOW() - INTERVAL '30 days'
GROUP BY s.entity_type, s.entity_id, r.name, s.changed_by, change_date
ORDER BY change_count DESC;

-- Most changed settings
SELECT 
  jsonb_object_keys(changes) as setting_field,
  COUNT(*) as change_frequency
FROM settings_audit_log
WHERE entity_type = 'restaurant'
GROUP BY setting_field
ORDER BY change_frequency DESC
LIMIT 20;
```

## Next Steps

1. **Immediate**: Connect all settings to backend save
2. **Today**: Add validation to all input fields
3. **Tomorrow**: Implement settings search
4. **This Week**: Create platform settings API
5. **Next Week**: Build floor plan editor
6. **Future**: Platform owner portal

## Related Documentation
- See `useSettingsStore.ts` for state management
- See `12_PLATFORM_CONNECTIONS.md` for platform control details
- See `ThemeProvider.tsx` for theme system