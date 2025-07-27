# Fynlo POS Error-Free Onboarding Flow Architecture

## User Journey Overview

1. **Website Signup** → 2. **App Download** → 3. **App Login** → 4. **Onboarding** → 5. **Active POS**

## Critical Requirements

### 1. Handle Empty State Gracefully
- New users have NO restaurant data
- NO bank details
- NO menu items
- NO employees
- System must NOT throw errors for missing data

### 2. WebSocket Connection for Onboarding Users
- Special `restaurant_id = "onboarding"` for users without restaurants
- No WebSocket errors during onboarding
- Graceful transition after restaurant creation

## Implementation Architecture

### Backend Changes

#### 1. Auth Endpoint Enhancement (`/api/v1/auth/verify`)
```python
# Current response for users without restaurant
{
    "user": {
        "id": "...",
        "email": "...",
        "needs_onboarding": true,  # ADD THIS FLAG
        "subscription_plan": "omega",
        "subscription_status": "active",
        "enabled_features": [...],
        "onboarding_progress": {  # ADD THIS
            "current_step": 0,
            "completed_steps": [],
            "total_steps": 9
        }
    }
}
```

#### 2. WebSocket Connection Updates
- Already supports `restaurant_id = "onboarding"` for authentication
- Need to ensure all endpoints handle this gracefully

#### 3. API Endpoints Must Handle Missing Restaurant
```python
# Pattern for all endpoints
if not current_user.restaurant_id:
    if endpoint_requires_restaurant:
        return APIResponseHelper.error(
            message="Please complete onboarding to access this feature",
            code="ONBOARDING_REQUIRED",
            status_code=403
        )
    else:
        # Return empty/default data
        return APIResponseHelper.success(data=[])
```

### Frontend Changes

#### 1. App Navigator Enhancement
```typescript
// In AppNavigator.tsx
const AppNavigator = () => {
    const { user, isAuthenticated } = useAuth();
    const needsOnboarding = user?.needs_onboarding || !user?.restaurant_id;
    
    if (!isAuthenticated) {
        return <AuthNavigator />;
    }
    
    if (needsOnboarding) {
        return <OnboardingNavigator />;
    }
    
    return <MainNavigator />;
};
```

#### 2. WebSocket Connection Manager
```typescript
// In WebSocketService.ts
class WebSocketService {
    connect(user: User) {
        const restaurantId = user.restaurant_id || 'onboarding';
        const wsUrl = `${WS_BASE_URL}/ws/${restaurantId}?user_id=${user.id}&token=${token}`;
        
        // Connect with onboarding restaurant_id if no restaurant
        this.ws = new WebSocket(wsUrl);
    }
}
```

#### 3. Error Boundary for Missing Data
```typescript
// In DataService.ts
class DataService {
    async getMenuItems() {
        try {
            if (!this.user?.restaurant_id) {
                return []; // Return empty array, not error
            }
            return await api.get('/menu/items');
        } catch (error) {
            if (error.code === 'ONBOARDING_REQUIRED') {
                return [];
            }
            throw error;
        }
    }
}
```

## Onboarding Steps (9 Total)

1. **Restaurant Basic Info** ✓
2. **Contact Information** ✓
3. **Location Details** ✓
4. **Owner Information** ✓
5. **Business Hours** ✓
6. **Employee Setup** ✓
7. **Menu Creation** ✓
8. **Bank Details** (NEW)
9. **Review & Launch** ✓

### Step 8: Bank Details Integration
```typescript
// Add to ComprehensiveRestaurantOnboardingScreen.tsx
const renderStep8 = () => (
    <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Payment Details</Text>
        <Text style={styles.stepDescription}>
            Where should we send your earnings?
        </Text>
        
        <BankDetailsForm 
            onComplete={(bankDetails) => {
                setFormData(prev => ({ ...prev, bankDetails }));
                nextStep();
            }}
        />
    </View>
);
```

## Error Prevention Checklist

### 1. Backend
- [ ] All endpoints check for `restaurant_id` before accessing restaurant data
- [ ] Return appropriate empty responses instead of 404/500 errors
- [ ] WebSocket accepts "onboarding" as valid restaurant_id
- [ ] Auth endpoint includes `needs_onboarding` flag
- [ ] Database constraints allow NULL restaurant_id for new users

### 2. Frontend
- [ ] Check `user.restaurant_id` before any restaurant-specific API calls
- [ ] Show onboarding screen when `needs_onboarding === true`
- [ ] WebSocket connects with "onboarding" restaurant_id if none exists
- [ ] All data fetching functions return empty arrays/objects for onboarding users
- [ ] Navigation prevents access to main app until onboarding complete

### 3. State Management
- [ ] Persist onboarding progress in AsyncStorage
- [ ] Track completed steps
- [ ] Allow resuming interrupted onboarding
- [ ] Clear onboarding state after completion

## API Response Patterns

### For Onboarding Users (No Restaurant)
```javascript
// Menu Items
GET /api/v1/menu/items
Response: { data: [], message: "Complete onboarding to add menu items" }

// Orders
GET /api/v1/orders
Response: { data: [], message: "No orders yet" }

// Reports
GET /api/v1/reports/sales
Response: { data: null, message: "Complete onboarding to view reports" }
```

### After Restaurant Creation
```javascript
// All endpoints return normal data
GET /api/v1/menu/items
Response: { data: [...items] }
```

## Testing Scenarios

1. **New User Flow**
   - Sign up on website
   - Download app
   - Sign in → Should see onboarding
   - Complete all steps → Access main app

2. **Interrupted Onboarding**
   - Start onboarding
   - Close app at step 3
   - Reopen → Should resume at step 3

3. **API Error Handling**
   - Try accessing orders during onboarding
   - Should return empty data, not error

4. **WebSocket Connection**
   - Connect during onboarding
   - Should use "onboarding" restaurant_id
   - No connection errors

## Implementation Priority

1. **High Priority** (Prevents errors)
   - Auth endpoint `needs_onboarding` flag
   - Frontend onboarding detection
   - WebSocket "onboarding" support
   - API empty responses

2. **Medium Priority** (Improves UX)
   - Bank details step
   - Progress persistence
   - Resume functionality

3. **Low Priority** (Nice to have)
   - Onboarding animations
   - Skip options
   - Demo data option