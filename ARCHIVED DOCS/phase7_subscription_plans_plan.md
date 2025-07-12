# Phase 7: Implement Subscription Plans Implementation Plan

**Date**: January 10, 2025  
**Estimated Duration**: 2 days  
**Priority**: HIGH  
**Status**: 🚀 STARTING NOW

## 🎯 Objective

Implement a complete subscription management system with multiple pricing tiers, feature gating, and billing integration. This will transform Fynlo from a demo app to a commercial SaaS platform ready for real customers.

## 📋 Pre-Phase Analysis

### Current Status After Phase 6
- ✅ Phase 1-6 completed and deployed
- ✅ 100% real data or proper empty states
- ✅ Production readiness at 75%
- ✅ App ready for real restaurant deployments
- ❌ No subscription management system
- ❌ No feature gating based on plans
- ❌ No billing integration

### Business Requirements
- **Multiple Subscription Tiers**: Basic, Professional, Enterprise
- **Feature Gating**: Limit features based on subscription level
- **Billing Integration**: Stripe for recurring payments
- **Upgrade/Downgrade**: Seamless plan changes
- **Trial Period**: Free trial for new restaurants
- **Usage Limits**: Orders per month, number of staff, etc.

## 🗓️ Implementation Timeline

### Day 1: Backend Infrastructure
**Morning (3-4 hours):**
- ✅ Create database schema for subscriptions
- ✅ Implement backend API endpoints
- ✅ Add subscription data models

**Afternoon (3-4 hours):**
- ✅ Create subscription service layer
- ✅ Implement feature gating middleware
- ✅ Set up basic Stripe integration

### Day 2: Frontend Integration & Testing
**Morning (3-4 hours):**
- ✅ Create subscription management screens
- ✅ Implement feature gating in mobile app
- ✅ Add billing/payment screens

**Afternoon (2-3 hours):**
- ✅ Test subscription flows
- ✅ Build production bundle
- ✅ Create pull request

## 📝 Detailed Task Breakdown

### Task 7.1: Backend Database Schema

#### 7.1.1: Create Subscription Tables Migration
**File**: `backend/alembic/versions/add_subscription_tables.py`

```sql
-- Subscription Plans Table
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    max_orders_per_month INTEGER,
    max_staff_accounts INTEGER,
    max_menu_items INTEGER,
    features JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Restaurant Subscriptions Table
CREATE TABLE restaurant_subscriptions (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id),
    plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL, -- active, trial, suspended, cancelled
    trial_end_date TIMESTAMP,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage Tracking Table
CREATE TABLE subscription_usage (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id),
    month_year VARCHAR(7) NOT NULL, -- Format: 2025-01
    orders_count INTEGER DEFAULT 0,
    staff_count INTEGER DEFAULT 0,
    menu_items_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(restaurant_id, month_year)
);
```

#### 7.1.2: Seed Default Subscription Plans
**File**: `backend/scripts/setup_subscription_plans.py`

```python
# Default subscription plans for Fynlo POS
SUBSCRIPTION_PLANS = [
    {
        'name': 'basic',
        'display_name': 'Basic Plan',
        'price_monthly': 29.99,
        'price_yearly': 299.99,  # 2 months free
        'max_orders_per_month': 500,
        'max_staff_accounts': 5,
        'max_menu_items': 50,
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'customer_support': 'email',
            'payment_processing': True,
            'inventory_management': False,
            'advanced_analytics': False,
            'multi_location': False,
            'api_access': False
        }
    },
    {
        'name': 'professional',
        'display_name': 'Professional Plan',
        'price_monthly': 59.99,
        'price_yearly': 599.99,
        'max_orders_per_month': 2000,
        'max_staff_accounts': 15,
        'max_menu_items': 200,
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'customer_support': 'priority',
            'payment_processing': True,
            'multi_location': False,
            'api_access': False
        }
    },
    {
        'name': 'enterprise',
        'display_name': 'Enterprise Plan',
        'price_monthly': 129.99,
        'price_yearly': 1299.99,
        'max_orders_per_month': None,  # Unlimited
        'max_staff_accounts': None,    # Unlimited
        'max_menu_items': None,        # Unlimited
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'multi_location': True,
            'api_access': True,
            'custom_integrations': True,
            'dedicated_support': True,
            'customer_support': 'phone'
        }
    }
]
```

### Task 7.2: Backend API Endpoints

#### 7.2.1: Subscription Management API
**File**: `backend/app/api/v1/subscriptions.py`

```python
@router.get("/plans")
async def get_subscription_plans():
    """Get all available subscription plans"""
    
@router.get("/current")
async def get_current_subscription(restaurant_id: int):
    """Get current subscription for restaurant"""
    
@router.post("/subscribe")
async def create_subscription(subscription_data: SubscriptionCreate):
    """Subscribe to a plan"""
    
@router.put("/change-plan")
async def change_subscription_plan(change_data: PlanChange):
    """Upgrade/downgrade subscription plan"""
    
@router.post("/cancel")
async def cancel_subscription(restaurant_id: int):
    """Cancel subscription"""
    
@router.get("/usage")
async def get_usage_statistics(restaurant_id: int):
    """Get current usage statistics"""
```

#### 7.2.2: Feature Gating Middleware
**File**: `backend/app/middleware/feature_gate.py`

```python
def require_feature(feature_name: str):
    """Decorator to gate features behind subscription plans"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            restaurant_id = get_restaurant_id_from_request()
            if not await has_feature(restaurant_id, feature_name):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Feature '{feature_name}' requires upgrade"
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage examples:
@require_feature('advanced_analytics')
async def get_advanced_report():
    pass

@require_feature('inventory_management') 
async def update_inventory():
    pass
```

### Task 7.3: Frontend Subscription Management

#### 7.3.1: Subscription Context
**File**: `src/context/SubscriptionContext.tsx`

```typescript
interface SubscriptionContextType {
  currentPlan: SubscriptionPlan | null;
  features: PlanFeatures;
  usage: UsageStatistics;
  isLoading: boolean;
  hasFeature: (feature: string) => boolean;
  isAtLimit: (limit: string) => boolean;
  upgradePlan: (planId: string) => Promise<void>;
  cancelPlan: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  // ... default values
});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};
```

#### 7.3.2: Subscription Settings Screen
**File**: `src/screens/settings/SubscriptionSettingsScreen.tsx`

Features:
- Current plan display with features
- Usage statistics (orders, staff, menu items)
- Upgrade/downgrade options
- Billing history
- Cancel subscription option

#### 7.3.3: Plan Upgrade Screen
**File**: `src/screens/settings/PlanUpgradeScreen.tsx`

Features:
- Compare all available plans
- Feature comparison table
- Pricing display (monthly/yearly)
- Stripe payment integration
- Immediate upgrade processing

#### 7.3.4: Feature Gate Component
**File**: `src/components/common/FeatureGate.tsx`

```typescript
interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}) => {
  const { hasFeature } = useSubscription();
  
  if (hasFeature(feature)) {
    return <>{children}</>;
  }
  
  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} />;
  }
  
  return <>{fallback}</>;
};
```

### Task 7.4: Feature Gating Implementation

#### 7.4.1: Reports Screen Gating
```typescript
// Basic reports available to all plans
<FeatureGate feature="basic_reports">
  <SalesReportCard />
  <OrdersReportCard />
</FeatureGate>

// Advanced analytics only for Professional/Enterprise
<FeatureGate feature="advanced_analytics">
  <AdvancedAnalyticsCard />
  <CustomerInsightsCard />
  <ProfitabilityReports />
</FeatureGate>
```

#### 7.4.2: Inventory Management Gating
```typescript
<FeatureGate feature="inventory_management">
  <InventoryScreen />
</FeatureGate>
```

#### 7.4.3: Staff Management Limits
```typescript
const { isAtLimit } = useSubscription();

const AddStaffButton = () => {
  const disabled = isAtLimit('staff_accounts');
  
  return (
    <TouchableOpacity 
      disabled={disabled}
      onPress={disabled ? showUpgradePrompt : addStaff}
    >
      <Text>Add Staff {disabled && '(Upgrade Required)'}</Text>
    </TouchableOpacity>
  );
};
```

### Task 7.5: Stripe Integration

#### 7.5.1: Backend Stripe Setup
**File**: `backend/app/services/stripe_service.py`

```python
class StripeService:
    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY
    
    async def create_customer(self, restaurant_data):
        """Create Stripe customer for restaurant"""
        
    async def create_subscription(self, customer_id, price_id):
        """Create subscription in Stripe"""
        
    async def change_subscription(self, subscription_id, new_price_id):
        """Change subscription plan"""
        
    async def cancel_subscription(self, subscription_id):
        """Cancel subscription"""
        
    async def handle_webhook(self, payload, signature):
        """Handle Stripe webhooks"""
```

#### 7.5.2: Frontend Stripe Integration
**File**: `src/services/PaymentService.ts`

```typescript
class PaymentService {
  async createSetupIntent(customerId: string): Promise<string> {
    // Create setup intent for saving payment method
  }
  
  async subscribeToplan(planId: string, paymentMethodId: string): Promise<void> {
    // Subscribe to plan with payment method
  }
  
  async updatePaymentMethod(paymentMethodId: string): Promise<void> {
    // Update default payment method
  }
}
```

## 🧪 Testing Strategy

### Backend Testing
- Unit tests for subscription service
- API endpoint testing
- Feature gating middleware testing
- Stripe webhook testing

### Frontend Testing
- Subscription context testing
- Feature gate component testing
- Payment flow testing
- Plan upgrade/downgrade testing

### Integration Testing
- End-to-end subscription flow
- Feature access based on plan
- Usage limit enforcement
- Billing cycle testing

## 🎯 Success Criteria

### Technical Goals
- ✅ Complete subscription database schema
- ✅ All API endpoints functional
- ✅ Feature gating working across app
- ✅ Stripe integration operational
- ✅ Usage tracking implemented

### Business Goals
- ✅ Multiple pricing tiers available
- ✅ Seamless upgrade/downgrade flow
- ✅ Usage limits enforced
- ✅ Professional billing experience
- ✅ Ready for real customer onboarding

### User Experience Goals
- ✅ Clear plan comparison
- ✅ Transparent usage tracking
- ✅ Smooth payment processing
- ✅ Helpful upgrade prompts
- ✅ No feature surprises

## 📊 Expected Impact

### Before Phase 7
- Demo app with no monetization
- All features available to everyone
- No customer management system
- Cannot generate revenue

### After Phase 7
- ✅ Commercial SaaS platform ready
- ✅ Multiple revenue streams
- ✅ Feature differentiation by plan
- ✅ Scalable business model
- ✅ Production readiness increases to ~85%

## 🔄 Next Phase Preview

**Phase 8: Backend Platform Preparation**
- Multi-restaurant backend architecture
- Platform owner management portal
- Restaurant onboarding automation
- Advanced analytics aggregation

---

**Implementation Notes:**
- Focus on core subscription functionality first
- Implement Stripe integration carefully (test mode)
- Ensure feature gates don't break existing functionality
- Test upgrade/downgrade flows thoroughly

**Ready to begin Phase 7 implementation!** 🚀