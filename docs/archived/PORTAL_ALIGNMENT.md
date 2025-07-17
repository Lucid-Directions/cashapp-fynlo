# 🌐 Portal Alignment Implementation Guide

## Overview

This document provides detailed implementation instructions for aligning the Fynlo web portal with the mobile app functionality. Every section is broken down into specific, actionable tasks with exact requirements.

**IMPORTANT**: This document clearly separates:
- 🏪 **RESTAURANT MANAGER DASHBOARD** features (Sections marked with 🏪)
- 👤 **PLATFORM OWNER DASHBOARD** features (Sections marked with 👤)

---

## ✅ What's Already Implemented in Mobile App

Based on the completed phases (1-8), the following are already working:

1. **Platform Owner Removed**: Platform owner features removed from mobile app (now web-only)
2. **Subscription System**: 3-tier plans (Alpha FREE, Beta £49, Omega £119) with 1% transaction fees
3. **Feature Gating**: Features locked based on subscription plan
4. **Dynamic Menus**: All menus loaded from API (no hardcoded items)
5. **Real Reports**: All analytics and reports use real API data
6. **Backend Platform API**: Platform endpoints ready at `/api/v1/platform/*`

---

## 📋 FEATURE OWNERSHIP SUMMARY

### 🏪 RESTAURANT MANAGER FEATURES (restaurant-specific data only):
1. **Dashboard** - Their restaurant's metrics
2. **POS** - Take orders for their restaurant
3. **Orders** - View/manage their orders
4. **Menu** - Manage their menu items
5. **Inventory** - Track their stock
6. **Staff** - Manage their employees
7. **Customers** - Their customer database
8. **Tables** - Their floor plan
9. **Analytics** - Their sales reports
10. **Settings** - Their business configuration
11. **Online Ordering** - Their delivery setup

### 👤 PLATFORM OWNER FEATURES (ALL restaurants data):
1. **Platform Dashboard** - Overview of ALL restaurants
2. **Restaurant Management** - Add/edit/suspend any restaurant
3. **Financial Management** - Platform revenue, commissions
4. **Platform Configuration** - Subscription plans, features
5. **Support** - Announcements, tickets for all restaurants

### ⚠️ NEVER MIX THESE TWO DASHBOARDS ⚠️
- Restaurant managers CANNOT see other restaurants' data
- Platform owners see AGGREGATED data from all restaurants
- These are TWO SEPARATE applications within the portal

---

## 🏗️ Architecture Requirements

### API Integration Setup

#### Step 1: Create API Configuration File
Create a new file `src/config/api.config.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'https://api.fynlo.co.uk',
  VERSION: 'v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const API_ENDPOINTS = {
  // Authentication
  AUTH_VERIFY: '/auth/verify',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  
  // Restaurant Management
  RESTAURANT_DETAILS: '/restaurants/:id',
  RESTAURANT_UPDATE: '/restaurants/:id',
  RESTAURANT_STATS: '/restaurants/:id/stats',
  
  // Menu Management
  MENU_LIST: '/restaurants/:id/menu',
  MENU_CATEGORY_CREATE: '/restaurants/:id/menu/categories',
  MENU_ITEM_CREATE: '/restaurants/:id/menu/items',
  MENU_ITEM_UPDATE: '/restaurants/:id/menu/items/:itemId',
  MENU_ITEM_DELETE: '/restaurants/:id/menu/items/:itemId',
  
  // Orders
  ORDERS_LIST: '/restaurants/:id/orders',
  ORDER_CREATE: '/restaurants/:id/orders',
  ORDER_UPDATE: '/restaurants/:id/orders/:orderId',
  ORDER_STATUS: '/restaurants/:id/orders/:orderId/status',
  
  // And more... (complete list below)
};
```

#### Step 2: Create Base API Service
Create `src/services/api/baseApi.ts`:

```typescript
import { API_CONFIG } from '@/config/api.config';

class BaseApiService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}/api/${API_CONFIG.VERSION}`;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiService = new BaseApiService();
```

---

## 🏪 RESTAURANT MANAGER DASHBOARD FEATURES 🏪

**WHO THIS IS FOR**: Restaurant owners and managers who run individual restaurants
**ACCESS**: Users login at portal.fynlo.co.uk with their restaurant credentials
**PURPOSE**: Web-based management of their restaurant operations

### Dashboard Overview Requirements

The restaurant manager dashboard must mirror ALL features available in the mobile app. Here's the complete feature list with implementation details:

### 1. Main Dashboard Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 1.1 Dashboard Metrics Component
Create `src/components/restaurant/dashboard/DashboardMetrics.tsx`:

```typescript
interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  lowStockItems: number;
  staffOnDuty: number;
  averageOrderValue: number;
  topSellingItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

// Component should display:
// - Real-time revenue counter (updates via WebSocket)
// - Order count with status breakdown
// - Staff currently clocked in
// - Inventory alerts
// - Mini chart of hourly sales
```

#### 1.2 Real-time Order Feed
Create `src/components/restaurant/dashboard/OrderFeed.tsx`:

```typescript
// Connect to WebSocket for live updates
const ws = new WebSocket(`wss://api.fynlo.co.uk/ws/restaurant/${restaurantId}`);

// Display orders in real-time with:
// - Order number and time
// - Customer name
// - Order total
// - Status with color coding
// - Quick action buttons (View, Print, Update Status)
```

### 2. POS (Point of Sale) Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 2.1 Menu Grid Component
Create `src/components/restaurant/pos/MenuGrid.tsx`:

```typescript
interface MenuGridProps {
  categories: Category[];
  onItemSelect: (item: MenuItem) => void;
}

// Requirements:
// - Display categories as tabs or sidebar
// - Show menu items in responsive grid (4 columns desktop, 2 tablet, 1 mobile)
// - Each item shows: Image, Name, Price, Modifiers indicator
// - Quick edit button for managers
// - Out of stock overlay
// - Search bar for quick item lookup
```

#### 2.2 Cart Component
Create `src/components/restaurant/pos/Cart.tsx`:

```typescript
interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: Modifier[];
  notes: string;
}

// Features:
// - Add/remove items
// - Quantity adjustment
// - Modifier selection
// - Special instructions
// - Price calculation with taxes
// - Discount application
// - Split bill functionality
```

#### 2.3 Payment Processing
Create `src/components/restaurant/pos/PaymentModal.tsx`:

```typescript
// Payment methods to support:
// - Cash (with change calculation)
// - Card (SumUp integration)
// - QR Code (display QR for customer scanning)
// - Split payment (multiple methods)

// Required features:
// - Payment method selection
// - Amount tendered input for cash
// - Tip addition
// - Receipt options (Print, Email, SMS, None)
// - Payment confirmation screen
```

### 3. Order Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 3.1 Order List Component
Create `src/components/restaurant/orders/OrderList.tsx`:

```typescript
// Display orders with:
// - Status filters (New, Preparing, Ready, Completed, Cancelled)
// - Time filters (Today, Yesterday, Last 7 days, Custom range)
// - Search by order number or customer
// - Bulk actions (Mark ready, Print receipts)

// Each order row shows:
// - Order #, Time, Customer, Items count, Total, Status
// - Expandable details on click
```

#### 3.2 Order Detail Modal
Create `src/components/restaurant/orders/OrderDetail.tsx`:

```typescript
// Full order information:
// - Customer details
// - Order items with modifiers
// - Special instructions
// - Payment method and status
// - Order timeline (created, confirmed, preparing, ready, completed)
// - Action buttons based on status
// - Print receipt option
// - Refund/void capabilities
```

### 4. Menu Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 4.1 Category Management
Create `src/components/restaurant/menu/CategoryManager.tsx`:

```typescript
interface Category {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  itemCount: number;
}

// Features:
// - Create/Edit/Delete categories
// - Drag and drop reordering
// - Enable/disable categories
// - Set category availability hours
// - Category image upload
```

#### 4.2 Menu Item Editor
Create `src/components/restaurant/menu/MenuItemEditor.tsx`:

```typescript
interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  modifierGroups: ModifierGroup[];
  allergens: string[];
  nutritionInfo: NutritionInfo;
  availability: {
    days: string[];
    startTime: string;
    endTime: string;
  };
  inventory: {
    trackStock: boolean;
    currentStock: number;
    lowStockAlert: number;
  };
}

// Full CRUD interface with:
// - Rich text description editor
// - Multiple image upload with primary selection
// - Price variations (sizes)
// - Modifier group assignment
// - Allergen selection
// - Nutritional information
// - Availability scheduling
// - Inventory tracking toggle
```

#### 4.3 Modifier Management
Create `src/components/restaurant/menu/ModifierManager.tsx`:

```typescript
interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

// Manage modifier groups:
// - Create groups (Size, Extras, Preparation, etc.)
// - Set selection rules
// - Add/remove modifiers
// - Set pricing for each modifier
// - Assign groups to menu items
```

### 5. Inventory Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 5.1 Inventory Dashboard
Create `src/components/restaurant/inventory/InventoryDashboard.tsx`:

```typescript
// Display:
// - Low stock alerts with reorder buttons
// - Stock value calculation
// - Category-wise inventory breakdown
// - Recent stock movements
// - Waste tracking summary
```

#### 5.2 Stock Management
Create `src/components/restaurant/inventory/StockManager.tsx`:

```typescript
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  costPerUnit: number;
  suppliers: Supplier[];
  lastRestocked: Date;
  expiryDate?: Date;
}

// Features:
// - Add/Edit inventory items
// - Stock adjustment (receive, waste, count)
// - Batch tracking with expiry dates
// - Supplier management
// - Purchase order creation
// - Stock movement history
// - Barcode scanning support (if available)
```

### 6. Staff Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 6.1 Staff List
Create `src/components/restaurant/staff/StaffList.tsx`:

```typescript
interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'manager' | 'server' | 'kitchen' | 'cashier';
  pin: string;
  permissions: Permission[];
  schedule: Schedule[];
  hourlyRate: number;
  status: 'active' | 'inactive';
}

// Display all staff with:
// - Role filters
// - Status indicators (on duty, scheduled, off)
// - Quick actions (Clock in/out, Edit, Deactivate)
// - Performance metrics
```

#### 6.2 Time Clock
Create `src/components/restaurant/staff/TimeClock.tsx`:

```typescript
// Features:
// - PIN-based clock in/out
// - Break management
// - Shift overview
// - Time adjustment requests
// - Manager override capabilities
```

#### 6.3 Schedule Manager
Create `src/components/restaurant/staff/ScheduleManager.tsx`:

```typescript
// Weekly/monthly calendar view with:
// - Drag and drop shift creation
// - Copy previous week
// - Shift templates
// - Staff availability tracking
// - Labor cost calculation
// - Schedule publishing
// - Shift swap requests
```

### 7. Customer Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 7.1 Customer Database
Create `src/components/restaurant/customers/CustomerList.tsx`:

```typescript
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastVisit: Date;
  notes: string;
  preferences: string[];
  allergens: string[];
  loyaltyPoints: number;
}

// Features:
// - Search and filter customers
// - View order history
// - Add notes and preferences
// - Track allergens
// - Loyalty program management
// - Export customer data
// - Send marketing communications
```

### 8. Table Management Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 8.1 Floor Plan Editor
Create `src/components/restaurant/tables/FloorPlanEditor.tsx`:

```typescript
interface Table {
  id: string;
  number: string;
  capacity: number;
  shape: 'square' | 'round' | 'rectangle';
  position: { x: number; y: number };
  size: { width: number; height: number };
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  currentOrder?: string;
}

// Interactive floor plan with:
// - Drag and drop table placement
// - Table shape and size customization
// - Section/zone creation
// - Real-time status updates
// - Reservation indicators
```

#### 8.2 Table Service Manager
Create `src/components/restaurant/tables/TableService.tsx`:

```typescript
// For each table show:
// - Current status with color coding
// - Seated time and duration
// - Order total
// - Server assigned
// - Quick actions (Seat, Clear, Reserve, Merge)
// - Order management directly from table view
```

### 9. Analytics & Reports Screen 🏪 (RESTAURANT MANAGER ONLY)

#### 9.1 Sales Analytics
Create `src/components/restaurant/analytics/SalesAnalytics.tsx`:

```typescript
// Display comprehensive analytics:
// - Revenue trends (daily, weekly, monthly, yearly)
// - Sales by category
// - Sales by payment method
// - Peak hours analysis
// - Average order value trends
// - Comparative analysis (vs last period)

// Interactive charts using Chart.js or similar:
// - Line charts for trends
// - Bar charts for comparisons
// - Pie charts for breakdowns
// - Heat maps for peak hours
```

#### 9.2 Report Generator
Create `src/components/restaurant/reports/ReportGenerator.tsx`:

```typescript
interface ReportConfig {
  type: 'sales' | 'inventory' | 'staff' | 'customers' | 'financial';
  dateRange: { start: Date; end: Date };
  format: 'pdf' | 'csv' | 'excel';
  includeCharts: boolean;
  emailTo?: string[];
}

// Features:
// - Predefined report templates
// - Custom report builder
// - Schedule automated reports
// - Export in multiple formats
// - Email delivery option
// - Report history
```

#### 9.3 Financial Reports
Create `src/components/restaurant/reports/FinancialReports.tsx`:

```typescript
// Generate reports for:
// - Daily cash reconciliation
// - Sales tax summary
// - Profit & loss statement
// - Product profitability
// - Labor cost analysis
// - Payment processing fees
// - Tip distribution
```

### 10. Settings & Configuration 🏪 (RESTAURANT MANAGER ONLY)

#### 10.1 Business Information
Create `src/components/restaurant/settings/BusinessInfo.tsx`:

```typescript
interface BusinessSettings {
  name: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  logo: string;
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  businessHours: {
    [key: string]: { open: string; close: string; isClosed: boolean };
  };
  timezone: string;
  currency: string;
  dateFormat: string;
}

// Editable form with:
// - Logo upload with preview
// - Operating hours by day
// - Holiday schedule
// - Contact information
// - Social media links
```

#### 10.2 Tax Configuration
Create `src/components/restaurant/settings/TaxSettings.tsx`:

```typescript
interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number;
  vatNumber: string;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  tipHandling: 'included' | 'separate' | 'optional';
  taxIncludedInPrice: boolean;
}

// Note: Some settings are platform-controlled
// Show locked indicator for platform-managed settings
// Only allow editing restaurant-specific tax settings
```

#### 10.3 Receipt Customization
Create `src/components/restaurant/settings/ReceiptSettings.tsx`:

```typescript
interface ReceiptSettings {
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showSocialMedia: boolean;
  includeVatBreakdown: boolean;
  includeServiceCharge: boolean;
  customMessage: string;
}

// Preview receipt while editing
// Support for multiple languages
// QR code inclusion options
```

#### 10.4 Integration Settings
Create `src/components/restaurant/settings/Integrations.tsx`:

```typescript
// Show available integrations:
// - Payment processors (read-only, platform managed)
// - Accounting software connections
// - Delivery platform integrations
// - Marketing tool connections
// - Reservation system sync
```

### 11. Online Ordering Configuration 🏪 (RESTAURANT MANAGER ONLY)

#### 11.1 Online Menu Setup
Create `src/components/restaurant/online/OnlineMenuSetup.tsx`:

```typescript
// Configure which items are available online
// Set online-specific pricing
// Manage delivery zones
// Set minimum order amounts
// Configure preparation times
// Holiday and special hours
```

#### 11.2 Delivery Settings
Create `src/components/restaurant/online/DeliverySettings.tsx`:

```typescript
interface DeliveryZone {
  name: string;
  postcodes: string[];
  deliveryFee: number;
  minimumOrder: number;
  estimatedTime: number;
}

// Manage delivery zones
// Set delivery fees
// Configure driver assignment
// Track delivery performance
```

---

## 👤 PLATFORM OWNER DASHBOARD FEATURES 👤

**⚠️ COMPLETELY SEPARATE FROM RESTAURANT MANAGER FEATURES ⚠️**

**WHO THIS IS FOR**: Fynlo platform administrators (you and your team)
**ACCESS**: Platform owners login with special admin credentials
**PURPOSE**: Oversee ALL restaurants, manage subscriptions, view platform analytics

**IMPORTANT**: Platform owners see ALL restaurants data, not just one restaurant

The platform owner dashboard should be simpler but comprehensive, focusing on oversight and management rather than operations.

### 1. Platform Overview Dashboard 👤 (PLATFORM OWNER ONLY)

#### 1.1 Key Metrics Component
Create `src/components/platform/dashboard/PlatformMetrics.tsx`:

```typescript
interface PlatformMetrics {
  totalRestaurants: number;
  activeRestaurants: number;
  totalRevenue: number;
  totalTransactions: number;
  averageRestaurantRevenue: number;
  newSignupsThisMonth: number;
  churnRate: number;
  platformHealth: {
    apiUptime: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

// Display in card format with:
// - Trend indicators (up/down from last period)
// - Mini sparkline charts
// - Click for detailed view
```

#### 1.2 Restaurant Overview Grid
Create `src/components/platform/dashboard/RestaurantGrid.tsx`:

```typescript
interface RestaurantSummary {
  id: string;
  name: string;
  logo: string;
  status: 'active' | 'inactive' | 'suspended';
  subscriptionPlan: 'alpha' | 'beta' | 'omega';
  monthlyRevenue: number;
  lastActivity: Date;
  healthScore: number;
}

// Grid or list view with:
// - Quick stats for each restaurant
// - Status indicators
// - Click to drill down into specific restaurant
// - Bulk actions (export, email)
```

### 2. Restaurant Management 👤 (PLATFORM OWNER ONLY)

#### 2.1 Detailed Restaurant View
Create `src/components/platform/restaurants/RestaurantDetail.tsx`:

```typescript
// When clicking into a restaurant, show:
// - Full business information
// - Subscription details and history
// - Revenue analytics
// - Transaction logs
// - Support tickets
// - Activity timeline
// - Quick actions (suspend, upgrade, contact)
```

#### 2.2 Restaurant Onboarding
Create `src/components/platform/restaurants/OnboardingWizard.tsx`:

```typescript
// Step-by-step wizard for new restaurants:
// 1. Business information
// 2. Subscription selection
// 3. Payment setup
// 4. Initial configuration
// 5. Training resources
// 6. Go-live checklist
```

### 3. Financial Management 👤 (PLATFORM OWNER ONLY)

#### 3.1 Revenue Dashboard
Create `src/components/platform/financial/RevenueDashboard.tsx`:

```typescript
// Comprehensive financial overview:
// - Total platform revenue
// - Revenue by subscription tier
// - Transaction fee income
// - Revenue trends and projections
// - Top performing restaurants
// - Payment processor fees
// - Net platform profit
```

#### 3.2 Commission Tracking
Create `src/components/platform/financial/CommissionTracker.tsx`:

```typescript
interface Commission {
  restaurantId: string;
  period: string;
  subscriptionFee: number;
  transactionFees: number;
  totalDue: number;
  status: 'pending' | 'collected' | 'overdue';
}

// Track all platform fees:
// - Monthly subscription charges
// - Transaction fee percentages
// - Payment status
// - Automated billing
// - Invoice generation
```

### 4. Platform Configuration 👤 (PLATFORM OWNER ONLY)

#### 4.1 Subscription Plan Management
Create `src/components/platform/config/SubscriptionPlans.tsx`:

```typescript
// Configure the three tiers:
// - Set pricing (currently £0, £49, £119)
// - Define feature access per tier
// - Set transaction fee rates (currently 1% for all)
// - Configure trial periods
// - Manage upgrade/downgrade rules
```

#### 4.2 Feature Flag Management
Create `src/components/platform/config/FeatureFlags.tsx`:

```typescript
interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabledForPlans: string[];
  enabledForRestaurants: string[];
  globalEnabled: boolean;
}

// Control feature rollout:
// - Enable/disable features globally
// - Plan-specific features
// - Restaurant-specific overrides
// - A/B testing configuration
```

### 5. Support & Communication 👤 (PLATFORM OWNER ONLY)

#### 5.1 Announcement System
Create `src/components/platform/support/Announcements.tsx`:

```typescript
// Send platform-wide announcements:
// - Create announcements with rich text
// - Target by plan or restaurant
// - Schedule announcements
// - Track read status
// - In-app and email delivery
```

#### 5.2 Support Ticket Overview
Create `src/components/platform/support/TicketOverview.tsx`:

```typescript
// Monitor all support requests:
// - Ticket queue by priority
// - Response time metrics
// - Common issue tracking
// - Direct messaging with restaurants
```

---

## 🚦 ROUTING & ACCESS CONTROL

### URL Structure
```typescript
// Restaurant Manager Routes (🏪)
/restaurant/dashboard         - Restaurant dashboard
/restaurant/pos              - POS screen
/restaurant/orders           - Orders management
/restaurant/menu             - Menu management
/restaurant/inventory        - Inventory
/restaurant/staff            - Staff management
/restaurant/customers        - Customer database
/restaurant/tables           - Table management
/restaurant/analytics        - Analytics & reports
/restaurant/settings         - Restaurant settings

// Platform Owner Routes (👤)
/platform/dashboard          - Platform overview
/platform/restaurants        - All restaurants management
/platform/financial          - Revenue & commissions
/platform/configuration      - Platform settings
/platform/support           - Support & announcements
```

### Access Control Implementation
```typescript
// In AuthContext.tsx
const getDefaultRoute = (user: User) => {
  if (user.is_platform_owner) {
    return '/platform/dashboard';  // Platform owners go here
  }
  return '/restaurant/dashboard';   // Restaurant managers go here
};

// Route Protection
const RestaurantRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.is_platform_owner) {
    return <Navigate to="/platform/dashboard" />;
  }
  return children;
};

const PlatformRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user?.is_platform_owner) {
    return <Navigate to="/restaurant/dashboard" />;
  }
  return children;
};
```

---

## 🔄 WebSocket Implementation

### Real-time Connection Setup
Create `src/services/websocket/WebSocketService.ts`:

```typescript
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private listeners: Map<string, Function[]> = new Map();

  connect(restaurantId: string) {
    const wsUrl = `wss://api.fynlo.co.uk/ws/restaurant/${restaurantId}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.authenticate();
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.notifyListeners(data.event, data.data);
    };
    
    this.ws.onclose = () => {
      setTimeout(() => this.connect(restaurantId), this.reconnectInterval);
    };
  }
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}

// Usage in components:
// wsService.on('order.created', (order) => {
//   updateOrderList(order);
//   showNotification(`New order #${order.number}`);
// });
```

### Events to Handle

```typescript
enum WebSocketEvents {
  // Orders
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  
  // Inventory
  STOCK_LOW = 'inventory.stock_low',
  STOCK_OUT = 'inventory.stock_out',
  
  // Staff
  STAFF_CLOCKED_IN = 'staff.clocked_in',
  STAFF_CLOCKED_OUT = 'staff.clocked_out',
  
  // Tables
  TABLE_SEATED = 'table.seated',
  TABLE_CLEARED = 'table.cleared',
  
  // System
  SYNC_REQUIRED = 'system.sync_required',
  ANNOUNCEMENT = 'system.announcement'
}
```

---

## 🔐 Authentication Flow Updates

### Update Auth Context
Modify `src/contexts/AuthContext.tsx`:

```typescript
const AuthContext = () => {
  const signIn = async (email: string, password: string) => {
    // 1. Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // 2. Verify with backend and get full user data
    const backendUser = await apiService.post('/auth/verify', {
      token: data.session.access_token
    });
    
    // 3. Store enhanced user data
    setUser({
      ...data.user,
      ...backendUser.data,
      restaurantId: backendUser.data.restaurant_id,
      restaurantName: backendUser.data.restaurant_name,
      permissions: backendUser.data.permissions
    });
  };
  
  // Similar updates for signUp
};
```

---

## 🚀 Migration Strategy

### Phase 1: Remove All Supabase Direct Queries
Search and replace ALL instances of direct Supabase database queries:

```typescript
// OLD - Remove all of these:
const { data } = await supabase
  .from('restaurants')
  .select('*')
  .eq('id', restaurantId);

// NEW - Replace with API calls:
const data = await apiService.get(`/restaurants/${restaurantId}`);
```

### Phase 2: Update All Data Fetching Hooks

```typescript
// Example: Update restaurant hook
const useRestaurant = (id: string) => {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => apiService.get(`/restaurants/${id}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### Phase 3: Update All Mutations

```typescript
// Example: Update menu item
const updateMenuItem = useMutation({
  mutationFn: ({ restaurantId, itemId, data }) => 
    apiService.put(`/restaurants/${restaurantId}/menu/items/${itemId}`, data),
  onSuccess: () => {
    queryClient.invalidateQueries(['menu', restaurantId]);
    toast.success('Menu item updated');
  },
});
```

---

## 📋 Complete API Endpoint List

Here's every endpoint the portal needs to implement, clearly separated by dashboard:

### 🔐 Authentication Endpoints (BOTH DASHBOARDS)
```
POST   /api/v1/auth/verify          - Verify Supabase token
POST   /api/v1/auth/register        - Register new restaurant
POST   /api/v1/auth/refresh         - Refresh session
GET    /api/v1/auth/me              - Get current user
```

### 🏪 Restaurant Manager Endpoints (RESTAURANT MANAGER ONLY)

#### Restaurant Info
```
GET    /api/v1/restaurants/:id               - Get their restaurant details
PUT    /api/v1/restaurants/:id               - Update their restaurant
GET    /api/v1/restaurants/:id/stats         - Get their restaurant statistics
```

#### Menu Management
```
GET    /api/v1/restaurants/:id/menu                      - Get full menu
POST   /api/v1/restaurants/:id/menu/categories          - Create category
PUT    /api/v1/restaurants/:id/menu/categories/:catId   - Update category
DELETE /api/v1/restaurants/:id/menu/categories/:catId   - Delete category
POST   /api/v1/restaurants/:id/menu/items               - Create item
PUT    /api/v1/restaurants/:id/menu/items/:itemId       - Update item
DELETE /api/v1/restaurants/:id/menu/items/:itemId       - Delete item
POST   /api/v1/restaurants/:id/menu/modifiers           - Create modifier group
GET    /api/v1/restaurants/:id/menu/export              - Export menu
POST   /api/v1/restaurants/:id/menu/import              - Import menu
```

#### Order Management
```
GET    /api/v1/restaurants/:id/orders                    - List orders
POST   /api/v1/restaurants/:id/orders                    - Create order
GET    /api/v1/restaurants/:id/orders/:orderId          - Get order details
PUT    /api/v1/restaurants/:id/orders/:orderId          - Update order
PUT    /api/v1/restaurants/:id/orders/:orderId/status   - Update status
POST   /api/v1/restaurants/:id/orders/:orderId/refund   - Process refund
GET    /api/v1/restaurants/:id/orders/export            - Export orders
```

#### Inventory Management
```
GET    /api/v1/restaurants/:id/inventory                 - List inventory
POST   /api/v1/restaurants/:id/inventory                 - Add item
PUT    /api/v1/restaurants/:id/inventory/:itemId        - Update item
POST   /api/v1/restaurants/:id/inventory/:itemId/adjust - Stock adjustment
GET    /api/v1/restaurants/:id/inventory/movements      - Stock movements
GET    /api/v1/restaurants/:id/inventory/alerts         - Low stock alerts
```

#### Staff Management
```
GET    /api/v1/restaurants/:id/staff                     - List staff
POST   /api/v1/restaurants/:id/staff                     - Add staff member
PUT    /api/v1/restaurants/:id/staff/:staffId           - Update staff
DELETE /api/v1/restaurants/:id/staff/:staffId           - Remove staff
POST   /api/v1/restaurants/:id/staff/:staffId/clock-in  - Clock in
POST   /api/v1/restaurants/:id/staff/:staffId/clock-out - Clock out
GET    /api/v1/restaurants/:id/staff/schedule           - Get schedule
POST   /api/v1/restaurants/:id/staff/schedule           - Update schedule
```

#### Customer Management
```
GET    /api/v1/restaurants/:id/customers                 - List customers
POST   /api/v1/restaurants/:id/customers                 - Add customer
PUT    /api/v1/restaurants/:id/customers/:customerId    - Update customer
GET    /api/v1/restaurants/:id/customers/:customerId/orders - Order history
POST   /api/v1/restaurants/:id/customers/import         - Import customers
GET    /api/v1/restaurants/:id/customers/export         - Export customers
```

#### Table Management
```
GET    /api/v1/restaurants/:id/tables                    - Get floor plan
PUT    /api/v1/restaurants/:id/tables                    - Update floor plan
PUT    /api/v1/restaurants/:id/tables/:tableId/status   - Update table status
POST   /api/v1/restaurants/:id/tables/:tableId/assign   - Assign order
POST   /api/v1/restaurants/:id/tables/merge             - Merge tables
```

#### Analytics & Reports
```
GET    /api/v1/restaurants/:id/analytics/sales          - Sales analytics
GET    /api/v1/restaurants/:id/analytics/products       - Product performance
GET    /api/v1/restaurants/:id/analytics/staff          - Staff performance
GET    /api/v1/restaurants/:id/analytics/customers      - Customer analytics
POST   /api/v1/restaurants/:id/reports/generate         - Generate report
GET    /api/v1/restaurants/:id/reports/list             - List saved reports
```

### 👤 Platform Owner Endpoints (PLATFORM OWNER ONLY)
```
GET    /api/v1/platform/overview                         - Platform metrics
GET    /api/v1/platform/restaurants                      - All restaurants
GET    /api/v1/platform/revenue                          - Revenue analytics
GET    /api/v1/platform/health                           - System health
PUT    /api/v1/platform/settings                         - Update settings
POST   /api/v1/platform/announcements                    - Create announcement
GET    /api/v1/platform/subscriptions                    - Subscription overview
PUT    /api/v1/platform/subscriptions/:planId           - Update plan
```

#### Settings Endpoints
```
GET    /api/v1/restaurants/:id/settings                  - Get all settings
PUT    /api/v1/restaurants/:id/settings/business         - Update business info
PUT    /api/v1/restaurants/:id/settings/tax             - Update tax settings
PUT    /api/v1/restaurants/:id/settings/receipt         - Update receipt
PUT    /api/v1/restaurants/:id/settings/online          - Online ordering
GET    /api/v1/restaurants/:id/settings/integrations    - List integrations
```

---

## 🧪 Testing Requirements

### Component Testing
For each component created:
1. Test all CRUD operations
2. Test error states
3. Test loading states
4. Test empty states
5. Test permission-based visibility

### Integration Testing
1. Test full user flows (signup → login → use feature)
2. Test data synchronization
3. Test WebSocket updates
4. Test offline handling
5. Test concurrent user actions

### E2E Testing Scenarios
1. Restaurant owner signs up and configures restaurant
2. Staff member takes order and processes payment
3. Manager views reports and exports data
4. Platform owner monitors all restaurants
5. Customer data flows from POS to reports

---

## 🎨 UI/UX Requirements

### Design Consistency
1. Use existing Shadcn UI components
2. Maintain current color scheme and branding
3. Ensure responsive design for all screen sizes
4. Follow accessibility guidelines (WCAG 2.1 AA)
5. Implement loading skeletons for all data fetching

### Navigation Structure
```
Restaurant Dashboard
├── Dashboard (Overview)
├── POS (Point of Sale)
├── Orders
│   ├── Active Orders
│   ├── Order History
│   └── Refunds
├── Menu
│   ├── Categories
│   ├── Items
│   └── Modifiers
├── Inventory
│   ├── Stock Levels
│   ├── Suppliers
│   └── Purchase Orders
├── Staff
│   ├── Team Members
│   ├── Time Clock
│   └── Schedule
├── Customers
│   ├── Database
│   └── Loyalty
├── Tables
│   ├── Floor Plan
│   └── Reservations
├── Analytics
│   ├── Sales
│   ├── Products
│   └── Staff
├── Reports
│   ├── Financial
│   ├── Operational
│   └── Custom
└── Settings
    ├── Business Info
    ├── Tax & Fees
    ├── Receipts
    ├── Online Ordering
    └── Integrations
```

---

## 🔒 Security Requirements

### API Security
1. All endpoints require authentication
2. Implement rate limiting per endpoint
3. Validate all inputs
4. Sanitize all outputs
5. Log all actions for audit trail

### Data Access Control
1. Restaurant users can only access their own data
2. Platform owners can access all data
3. Staff permissions based on role
4. Implement row-level security
5. Encrypt sensitive data

---

## 📈 Performance Requirements

### Page Load Times
- Dashboard: < 2 seconds
- POS Screen: < 1 second
- Reports: < 3 seconds
- All other pages: < 2 seconds

### Real-time Updates
- Order updates: < 500ms latency
- Inventory updates: < 1 second
- Dashboard metrics: < 2 seconds

### Optimization Strategies
1. Implement pagination for large datasets
2. Use virtual scrolling for long lists
3. Cache frequently accessed data
4. Lazy load components
5. Optimize images and assets

---

## 🚨 Error Handling

### API Error Handling
```typescript
// Standardize error handling across all API calls
try {
  const data = await apiService.get(endpoint);
  return data;
} catch (error) {
  if (error.status === 401) {
    // Redirect to login
  } else if (error.status === 403) {
    toast.error('You do not have permission to perform this action');
  } else if (error.status === 404) {
    toast.error('Resource not found');
  } else {
    toast.error('An unexpected error occurred. Please try again.');
  }
  console.error('API Error:', error);
}
```

### User-Friendly Error Messages
1. Network errors: "Connection lost. Please check your internet."
2. Validation errors: Specific field-level messages
3. Permission errors: "You don't have access to this feature."
4. Server errors: "Something went wrong. We're working on it."

---

## 📝 Documentation Requirements

### Code Documentation
1. Add JSDoc comments to all functions
2. Document component props with TypeScript
3. Include usage examples in complex components
4. Document all API integrations
5. Maintain README files for each major feature

### User Documentation
1. Create help tooltips for complex features
2. Add inline help text for forms
3. Include video tutorials for key workflows
4. Maintain FAQ section
5. Provide contact support options

---

**This document should be followed step-by-step to ensure complete alignment between the portal and mobile app. Each section contains specific implementation details that must be followed exactly.**

---

## 🎯 FINAL SUMMARY - WHO BUILDS WHAT

### 🏪 RESTAURANT MANAGER DASHBOARD
- **Users**: Individual restaurant owners/managers
- **Data Scope**: ONLY their own restaurant's data
- **Features**: All 11 sections listed above (POS, Orders, Menu, etc.)
- **URL Path**: `/restaurant/*`
- **Login**: Standard restaurant credentials
- **Example**: "Mexican Grill" owner logs in, sees ONLY Mexican Grill data

### 👤 PLATFORM OWNER DASHBOARD  
- **Users**: Fynlo administrators (you and your team)
- **Data Scope**: ALL restaurants aggregated
- **Features**: 5 platform management sections
- **URL Path**: `/platform/*`
- **Login**: Special platform owner credentials
- **Example**: You log in, see ALL 50 restaurants, total revenue, etc.

### ⚠️ CRITICAL IMPLEMENTATION NOTES
1. These are TWO SEPARATE applications in the portal
2. Restaurant managers NEVER see platform owner features
3. Platform owners have a DIFFERENT interface, not just "more access"
4. API calls must respect data boundaries (restaurant context)
5. WebSocket events must be filtered by restaurant
6. The portal already has auth working - focus on features

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Total Implementation Items**: 150+
**Clearly Separated**: Restaurant Manager (11 sections) vs Platform Owner (5 sections)