# 💾 Phase 3: Data Persistence Implementation

## Overview

Remove ALL mock data dependencies and connect every screen to real backend APIs. This phase ensures complete data persistence, making the app truly production-ready with real-time data synchronization.

**Duration**: 5 days  
**Priority**: HIGH  
**Dependencies**: Backend APIs operational, Auth integration complete  

## 🎯 Goals

1. Remove ALL mock data from DataService and DatabaseService
2. Connect every screen to real backend endpoints
3. Implement proper error handling and retry logic
4. Add offline support with data synchronization
5. Ensure all user actions persist to database
6. Remove feature flags for mock data

## 📍 Mock Data Locations to Fix

### DataService.ts Mock Fallbacks
- **Lines 480-556**: Mock customers fallback
- **Line 570**: Mock inventory fallback
- **Lines 603-607**: Mock employees fallback
- **Lines 705-928**: All report methods return mock data
- **Lines 962-1004**: Mock dashboard data

### DatabaseService.ts Mock Data
- **Lines 477-650**: Hardcoded inventory items
- **Lines 662-739**: Hardcoded employees
- **Lines 742-790**: Hardcoded schedule data
- **Lines 831-872**: Hardcoded analytics

## 🛠️ Implementation Tasks

### Task 1: Customer Management Integration (Day 1)
- [ ] Remove mock customers from DataService
- [ ] Implement real customer API calls
- [ ] Add customer CRUD operations
- [ ] Update CustomersScreen to use real data
- [ ] Add customer search and filtering

```typescript
// DataService.ts update
async getCustomers(): Promise<Customer[]> {
  try {
    const response = await api.get('/api/v1/customers');
    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error; // No fallback to mock data
  }
}

// Add CRUD operations
async createCustomer(customer: Partial<Customer>): Promise<Customer>
async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer>
async deleteCustomer(id: string): Promise<void>
async searchCustomers(query: string): Promise<Customer[]>
```

### Task 2: Inventory System Integration (Day 1)
- [ ] Remove mock inventory from DatabaseService
- [ ] Connect to real inventory endpoints
- [ ] Implement stock tracking
- [ ] Add low stock alerts
- [ ] Update InventoryScreen with real data

```typescript
// Real inventory implementation
interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  reorder_point: number;
  last_updated: string;
  supplier_id?: string;
}

async getInventory(): Promise<InventoryItem[]> {
  const response = await api.get('/api/v1/inventory');
  return response.data.data;
}

async updateStock(itemId: string, quantity: number): Promise<void>
async trackStockMovement(movement: StockMovement): Promise<void>
```

### Task 3: Employee Management Integration (Day 2)
- [ ] Remove mock employees from DatabaseService
- [ ] Implement real employee API
- [ ] Add employee CRUD operations
- [ ] Connect schedule management
- [ ] Update EmployeesScreen

```typescript
// Employee service updates
async getEmployees(): Promise<Employee[]> {
  const response = await api.get('/api/v1/employees');
  return response.data.data;
}

async createEmployee(employee: Partial<Employee>): Promise<Employee>
async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee>
async deleteEmployee(id: string): Promise<void>
async getEmployeeSchedule(id: string): Promise<Schedule>
async updateSchedule(schedule: Schedule): Promise<void>
```

### Task 4: Order Processing Integration (Day 2)
- [ ] Ensure orders save to backend
- [ ] Implement order status updates
- [ ] Add order history fetching
- [ ] Connect receipt generation
- [ ] Update OrdersScreen

```typescript
// Order processing
async createOrder(order: OrderRequest): Promise<Order> {
  const response = await api.post('/api/v1/orders', order);
  
  // Update local inventory
  await this.updateInventoryForOrder(order);
  
  // Send to kitchen display
  await this.notifyKitchen(response.data.data);
  
  return response.data.data;
}

async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>
async getOrderHistory(filters?: OrderFilters): Promise<Order[]>
```

### Task 5: Reports & Analytics Integration (Day 3)
- [ ] Remove ALL mock report data
- [ ] Connect sales reports to real data
- [ ] Implement financial reports
- [ ] Add staff performance reports
- [ ] Connect inventory reports

```typescript
// Reports implementation
async getSalesReport(dateRange: DateRange): Promise<SalesReport> {
  const response = await api.get('/api/v1/reports/sales', {
    params: { start_date: dateRange.start, end_date: dateRange.end }
  });
  return response.data.data;
}

async getFinancialReport(period: string): Promise<FinancialReport>
async getStaffReport(employeeId?: string): Promise<StaffReport>
async getInventoryReport(): Promise<InventoryReport>
async getCustomReport(params: CustomReportParams): Promise<any>
```

### Task 6: Settings Persistence (Day 3)
- [ ] Connect all settings to backend
- [ ] Remove local-only storage
- [ ] Implement settings sync
- [ ] Add settings versioning
- [ ] Update all settings screens

```typescript
// Settings service
async getSettings(restaurantId: string): Promise<Settings> {
  const response = await api.get(`/api/v1/settings/${restaurantId}`);
  return response.data.data;
}

async updateSettings(restaurantId: string, settings: Partial<Settings>): Promise<Settings>
async getSettingsHistory(restaurantId: string): Promise<SettingsVersion[]>
```

### Task 7: Real-time Updates (Day 4)
- [ ] Implement WebSocket connections
- [ ] Add real-time order updates
- [ ] Live inventory tracking
- [ ] Real-time analytics
- [ ] Multi-user synchronization

```typescript
// WebSocket implementation
class RealtimeService {
  connect(restaurantId: string): void
  subscribe(event: string, callback: Function): void
  
  // Event handlers
  onOrderCreated(callback: (order: Order) => void): void
  onOrderUpdated(callback: (order: Order) => void): void
  onInventoryChanged(callback: (item: InventoryItem) => void): void
  onSettingsUpdated(callback: (settings: Settings) => void): void
}
```

### Task 8: Offline Support (Day 4)
- [ ] Implement offline queue
- [ ] Add data synchronization
- [ ] Cache critical data
- [ ] Handle conflicts
- [ ] Show sync status

```typescript
// Offline support
class OfflineManager {
  async queueAction(action: OfflineAction): Promise<void>
  async syncWhenOnline(): Promise<void>
  async getCachedData<T>(key: string): Promise<T | null>
  async resolveConflicts(conflicts: Conflict[]): Promise<void>
}
```

### Task 9: Error Handling & Recovery (Day 5)
- [ ] Add comprehensive error handling
- [ ] Implement retry mechanisms
- [ ] Add user-friendly error messages
- [ ] Create fallback strategies
- [ ] Add error reporting

### Task 10: Migration & Cleanup (Day 5)
- [ ] Remove ALL mock data files
- [ ] Remove feature flags
- [ ] Clean up unused code
- [ ] Update documentation
- [ ] Final testing

## 🔍 Verification Checklist

### Data Integrity
- [ ] All screens show real data
- [ ] No mock data in codebase
- [ ] Data persists between sessions
- [ ] Multi-user sync works
- [ ] Offline mode functional

### API Integration
- [ ] All endpoints connected
- [ ] Proper error handling
- [ ] Retry logic works
- [ ] Auth headers included
- [ ] Response caching works

### Performance
- [ ] No UI blocking on API calls
- [ ] Smooth loading states
- [ ] Efficient data caching
- [ ] Minimal API calls
- [ ] Quick sync times

## 🚨 Critical Files to Update

### Remove Mock Data From
1. `src/services/DataService.ts` - Remove all fallbacks
2. `src/services/DatabaseService.ts` - Delete entire mock sections
3. `src/services/MockDataService.ts` - Delete entire file
4. `src/screens/auth/LoginScreen.tsx` - Remove mock user creation

### Update API Calls In
1. `src/screens/customers/CustomersScreen.tsx`
2. `src/screens/inventory/InventoryScreen.tsx`
3. `src/screens/employees/EmployeesScreen.tsx`
4. `src/screens/reports/*` - All report screens
5. `src/screens/settings/*` - All settings screens

## 📊 Success Metrics

- ✅ 0 references to mock data
- ✅ 100% API integration
- ✅ All actions persist to database
- ✅ Real-time sync working
- ✅ Offline support functional

## 🔧 API Endpoints Summary

```typescript
// Customer endpoints
GET    /api/v1/customers
POST   /api/v1/customers
PUT    /api/v1/customers/{id}
DELETE /api/v1/customers/{id}

// Inventory endpoints
GET    /api/v1/inventory
PUT    /api/v1/inventory/{id}
POST   /api/v1/inventory/movement

// Employee endpoints
GET    /api/v1/employees
POST   /api/v1/employees
PUT    /api/v1/employees/{id}
DELETE /api/v1/employees/{id}

// Order endpoints
POST   /api/v1/orders
GET    /api/v1/orders
PUT    /api/v1/orders/{id}/status

// Reports endpoints
GET    /api/v1/reports/sales
GET    /api/v1/reports/financial
GET    /api/v1/reports/staff
GET    /api/v1/reports/inventory

// Settings endpoints
GET    /api/v1/settings/{restaurantId}
PUT    /api/v1/settings/{restaurantId}
```

## 📅 Daily Milestones

- **Day 1**: Customers + Inventory integration ✅
- **Day 2**: Employees + Orders integration ✅
- **Day 3**: Reports + Settings persistence ✅
- **Day 4**: Real-time + Offline support ✅
- **Day 5**: Error handling + Cleanup ✅

## ⚠️ Common Pitfalls

1. **Forgetting to remove fallbacks** - Search for "mock" keyword
2. **Missing error boundaries** - Add to all data screens
3. **Not handling loading states** - Users need feedback
4. **Ignoring offline scenarios** - Critical for POS
5. **Poor error messages** - Be user-friendly

---

**Status**: Ready to Begin  
**Blockers**: None  
**Next Step**: Start with Customer Management Integration