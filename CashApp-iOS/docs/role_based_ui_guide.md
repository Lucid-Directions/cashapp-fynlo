# Mobile App Role-Based UI Guide

## Overview
This guide outlines the required changes to the Fynlo POS mobile app to support role-based UI and multi-restaurant management for Omega plan users.

## User Roles & Access Levels

### 1. Platform Owner
- **Access**: Full system access via web dashboard only
- **Mobile App**: No access (removed from mobile app)

### 2. Restaurant Owner
- **Access**: Can own and manage multiple restaurants (Omega plan only)
- **Features**: Full restaurant management, staff management, reports
- **Multi-Restaurant**: Can switch between owned restaurants

### 3. Manager
- **Access**: Single restaurant management
- **Features**: Staff schedules, inventory, reports (limited)
- **Restrictions**: Cannot modify restaurant settings

### 4. Employee (Cashier/Server)
- **Access**: Basic POS operations
- **Features**: Take orders, process payments, view own schedule
- **Restrictions**: No management features

## Required UI Changes

### 1. Restaurant Context Switcher
For Omega plan restaurant owners with multiple restaurants:

```typescript
// components/RestaurantSwitcher.tsx
import { useAuth } from '../contexts/AuthContext';

const RestaurantSwitcher = () => {
  const { user, switchRestaurant } = useAuth();
  
  // Only show for restaurant owners with multiple restaurants
  if (user.role !== 'restaurant_owner' || !user.multi_restaurant_enabled) {
    return null;
  }
  
  return (
    <Dropdown
      value={user.current_restaurant_id}
      options={user.assigned_restaurants}
      onChange={switchRestaurant}
      renderOption={(restaurant) => (
        <View>
          <Text>{restaurant.name}</Text>
          <Text style={styles.subtext}>{restaurant.address}</Text>
        </View>
      )}
    />
  );
};
```

### 2. Navigation Updates
Update MainNavigator.tsx to show/hide screens based on role:

```typescript
// navigation/MainNavigator.tsx
const getTabsForRole = (role: string, subscriptionPlan: string) => {
  const baseTabs = [
    { name: 'POS', component: POSScreen, icon: 'cash-register' },
    { name: 'Orders', component: OrdersScreen, icon: 'receipt' },
  ];
  
  if (role === 'employee') {
    return [
      ...baseTabs,
      { name: 'Schedule', component: MyScheduleScreen, icon: 'calendar' },
    ];
  }
  
  if (role === 'manager' || role === 'restaurant_owner') {
    const managerTabs = [
      ...baseTabs,
      { name: 'Staff', component: StaffScreen, icon: 'users' },
      { name: 'Inventory', component: InventoryScreen, icon: 'box' },
      { name: 'Reports', component: ReportsScreen, icon: 'chart-bar' },
    ];
    
    if (role === 'restaurant_owner') {
      managerTabs.push(
        { name: 'Settings', component: SettingsScreen, icon: 'cog' }
      );
    }
    
    return managerTabs;
  }
  
  return baseTabs;
};
```

### 3. Feature Gating by Plan
Gate features based on subscription plan:

```typescript
// hooks/useFeatureAccess.ts
export const useFeatureAccess = () => {
  const { user } = useAuth();
  
  const hasFeature = (feature: string): boolean => {
    const planFeatures = {
      alpha: ['pos', 'orders', 'basic_reports'],
      beta: ['pos', 'orders', 'inventory', 'staff', 'advanced_reports', 'customers'],
      omega: ['pos', 'orders', 'inventory', 'staff', 'advanced_reports', 'customers', 
              'multi_location', 'api_access', 'custom_branding']
    };
    
    const userFeatures = planFeatures[user.subscription_plan] || [];
    return userFeatures.includes(feature);
  };
  
  return { hasFeature };
};
```

### 4. Update Auth Context
Enhance AuthContext to handle multi-restaurant data:

```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  currentRestaurant: Restaurant | null;
  availableRestaurants: Restaurant[];
  switchRestaurant: (restaurantId: string) => Promise<void>;
  hasMultipleRestaurants: boolean;
  canAccessFeature: (feature: string) => boolean;
}

const AuthProvider: React.FC = ({ children }) => {
  const [currentRestaurantId, setCurrentRestaurantId] = useState<string | null>(null);
  
  const switchRestaurant = async (restaurantId: string) => {
    try {
      const response = await api.post('/api/v1/users/switch-restaurant', {
        restaurant_id: restaurantId
      });
      
      if (response.data.success) {
        setCurrentRestaurantId(restaurantId);
        // Update local storage
        await AsyncStorage.setItem('current_restaurant_id', restaurantId);
        // Refresh app data for new restaurant context
        await refreshAppData();
      }
    } catch (error) {
      console.error('Failed to switch restaurant:', error);
    }
  };
  
  const hasMultipleRestaurants = user?.assigned_restaurants?.length > 1;
  
  return (
    <AuthContext.Provider value={{
      user,
      currentRestaurant,
      availableRestaurants,
      switchRestaurant,
      hasMultipleRestaurants,
      canAccessFeature
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 5. Component Visibility Rules

#### Staff Management Screen
```typescript
// Only show for managers and owners
{(user.role === 'manager' || user.role === 'restaurant_owner') && (
  <StaffManagementSection />
)}
```

#### Restaurant Settings
```typescript
// Only show for restaurant owners
{user.role === 'restaurant_owner' && (
  <RestaurantSettingsSection />
)}
```

#### Financial Reports
```typescript
// Show different reports based on role
{user.role === 'restaurant_owner' && (
  <FinancialReportsSection showProfit={true} />
)}
{user.role === 'manager' && (
  <FinancialReportsSection showProfit={false} />
)}
```

### 6. API Request Updates
All API requests should include the current restaurant context:

```typescript
// services/api.ts
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add restaurant context to all requests
apiClient.interceptors.request.use(async (config) => {
  const currentRestaurantId = await AsyncStorage.getItem('current_restaurant_id');
  
  if (currentRestaurantId) {
    // Add as query parameter for GET requests
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        current_restaurant_id: currentRestaurantId
      };
    }
    // Add to body for POST/PUT requests
    else if (config.data) {
      config.data.current_restaurant_id = currentRestaurantId;
    }
  }
  
  return config;
});
```

## Testing Checklist

### Restaurant Owner (Omega Plan)
- [ ] Can see restaurant switcher in header
- [ ] Can switch between assigned restaurants
- [ ] All data updates when switching restaurants
- [ ] Can access all management features
- [ ] Can modify restaurant settings

### Manager
- [ ] Cannot see restaurant switcher
- [ ] Can access staff and inventory management
- [ ] Cannot modify restaurant settings
- [ ] Can view limited reports

### Employee
- [ ] Can only access POS and Orders
- [ ] Can view own schedule
- [ ] Cannot access any management features
- [ ] Cannot see financial data

### Feature Gating
- [ ] Alpha users see only basic features
- [ ] Beta users have inventory and staff access
- [ ] Omega users have multi-location support
- [ ] Locked features show upgrade prompt

## Security Considerations

1. **Client-Side Validation**: Always treat as a UX enhancement only
2. **Server-Side Enforcement**: All API endpoints must validate permissions
3. **Token Claims**: Include role and restaurant context in JWT
4. **Local Storage**: Store only non-sensitive data
5. **Deep Linking**: Validate access before navigation