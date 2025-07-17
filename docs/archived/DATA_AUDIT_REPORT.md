# Fynlo POS Data Audit Report
## Phase 1: Static vs Dynamic Data Classification

### Executive Summary
This audit identifies all data types in the Fynlo POS system and classifies them as:
- **Static Mock Data** (TO REMOVE): Hardcoded displays that prevent real data flow
- **Dynamic Test Data** (TO MIGRATE): Test data needed for feature validation
- **Real Client Data** (TO PRESERVE): Actual Mexican restaurant menu and configuration

### 1. STATIC MOCK DATA (TO REMOVE)

#### 1.1 Hardcoded Success Messages
- Payment processing always returns `true` (MockDataService.ts:182)
- No actual payment provider integration
- Success messages don't reflect real transaction status

#### 1.2 Static Report Templates
- Daily sales report with fixed values (MockDataService.ts:229-282)
- Hardcoded hourly breakdown (lines 252-262)
- Static staff performance data (lines 275-280)
- Pre-defined payment method distributions

#### 1.3 Mock Authentication
- Demo accounts hardcoded in MockDataService.ts:19-23
- No real user validation
- Static role assignments

#### 1.4 Simulated Hardware Operations
- Mock receipt printing (lines 349-360)
- Fake cash drawer operations (lines 362-365)
- Simulated barcode scanning (lines 367-372)

### 2. DYNAMIC TEST DATA (TO MIGRATE TO DATABASE)

#### 2.1 Test Employees (NEEDED FOR TESTING)
```typescript
// Current static references (lines 275-280):
- Sarah Johnson (24 orders, £1045.60 sales)
- Mike Chen (21 orders, £967.25 sales)
- Emma Davis (19 orders, £834.90 sales)
- Tom Wilson (23 orders, £999.75 sales)
```

**Migration Strategy**: Create real employee records in database with:
- Proper role assignments (cashier, manager, cook, server)
- Login credentials
- Schedule assignments
- Performance tracking

#### 2.2 Restaurant Floor Plan (DYNAMIC DATA)
```typescript
// Tables configuration (lines 187-205):
- Main Floor: 5 tables (T1-T5)
- Patio: 3 tables (P1-P3)
- Bar: 4 seats (B1-B4)
```

**Migration Strategy**: Store in database with:
- Table status tracking
- Real-time occupancy
- Order associations

#### 2.3 Test Inventory Items
Currently no inventory tracking in MockDataService, but needed for:
- Stock level management
- Reorder alerts
- Ingredient tracking for menu items
- Waste management

**Migration Strategy**: Create inventory records linked to menu items

#### 2.4 Sample Schedules
Not present in current mock data but needed for:
- Rota system testing
- Shift management
- Employee availability

### 3. REAL CLIENT DATA (MUST PRESERVE)

#### 3.1 Mexican Restaurant Menu (lines 47-96)
**CRITICAL**: This is REAL CLIENT DATA for the pilot restaurant

**Categories**:
1. Snacks (5 items)
2. Tacos (14 items)
3. Special Tacos (3 items)
4. Burritos (3 items)
5. Sides & Salsas (5 items)
6. Drinks (6 items)

**Total**: 36 menu items with authentic descriptions and prices

#### 3.2 Product Details to Preserve
- Exact names (e.g., "Carnitas", "Cochinita", "Barbacoa de Res")
- Authentic descriptions
- Current pricing structure
- Category assignments
- Availability flags

### 4. PAYMENT INTEGRATION ISSUES

#### 4.1 Current State
- MockDataService.processPayment() returns true immediately
- No real payment provider connection
- No transaction recording

#### 4.2 Real Integration Points Found
- Backend has SumUp credentials in .env:
  ```
  SUMUP_API_KEY=sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU
  SUMUP_MERCHANT_CODE=M4EM2GKE
  SUMUP_AFFILIATE_KEY=sup_afk_8OlK0ooUnu0MxvmKx6Beapf4L0ekSCe9
  SUMUP_ENVIRONMENT=sandbox
  ```
- PaymentScreen.tsx shows SumUp disabled (line 116)
- Payment gets stuck because no real backend connection

### 5. DATABASE SEED DATA REQUIREMENTS

#### 5.1 Platform Level
```sql
-- Test platform owner
INSERT INTO users (email, name, role) VALUES 
('platform@fynlo.com', 'Platform Admin', 'platform_owner');

-- Test platform configuration
INSERT INTO platform_config (key, value) VALUES
('service_charge_rate', '12.5'),
('qr_payment_fee', '1.2'),
('card_payment_fee', '2.9');
```

#### 5.2 Restaurant Level
```sql
-- Test restaurant
INSERT INTO restaurants (name, slug, platform_id) VALUES
('Fynlo Mexican Restaurant', 'fynlo-mexican', 1);

-- Test employees
INSERT INTO users (email, name, role, restaurant_id) VALUES
('sarah@fynlo.com', 'Sarah Johnson', 'cashier', 1),
('mike@fynlo.com', 'Mike Chen', 'cook', 1),
('emma@fynlo.com', 'Emma Davis', 'server', 1),
('tom@fynlo.com', 'Tom Wilson', 'manager', 1);

-- Preserve all 36 menu items (REAL DATA)
-- Categories and products from MockDataService lines 47-96
```

#### 5.3 Dynamic Test Data
```sql
-- Sample schedules (1 week)
-- Sample inventory items (20-30 items)
-- Test orders for reporting (last 30 days)
-- Table configurations
```

### 6. IMMEDIATE ACTIONS REQUIRED

1. **Fix Payment Integration**:
   - Connect PaymentScreen to real backend
   - Enable SumUp provider
   - Remove mock payment simulation

2. **Database Connection**:
   - Backend shows PostgreSQL configured but not connected
   - DATABASE_URL in .env needs real database
   - Currently using localhost placeholder

3. **Remove Static Displays**:
   - Replace hardcoded reports with real queries
   - Remove static success messages
   - Implement real authentication

4. **Preserve Client Data**:
   - Migrate Mexican menu to database
   - Maintain exact pricing and descriptions
   - Keep category structure

### 7. FILES TO MODIFY

#### High Priority (Payment Fix)
1. `PaymentScreen.tsx` - Enable SumUp (line 116)
2. `MockDataService.ts` - Remove processPayment mock
3. Backend payment endpoints - Implement real SumUp integration

#### Static Data Removal
1. `MockDataService.ts` - Remove getDailySalesReport (lines 229-282)
2. `MockDataService.ts` - Remove static auth (lines 17-39)
3. Various screens using MockDataService for display

#### Database Migration
1. Create migration scripts for test data
2. Implement real API endpoints
3. Update DataService.ts to use real backend

### 8. NEXT STEPS

1. **Immediate**: Fix SumUp payment integration
2. **Phase 2**: Set up DigitalOcean database
3. **Phase 3**: Migrate dynamic test data
4. **Phase 4**: Remove all static displays
5. **Phase 5**: Test complete data flow

This audit provides the foundation for transitioning from demo mode to a production-ready staging environment with real data flow.