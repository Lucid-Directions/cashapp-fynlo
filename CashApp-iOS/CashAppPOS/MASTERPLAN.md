# Master Plan: Fynlo POS Production-Ready Multi-Tenant Deployment

## Overview
**Problem Identified**: 
- SumUp payments stuck on "processing" due to demo mode and lack of real database
- Static mock data preventing real data flow
- Need dynamic test data (employees, inventory) to validate all features

**Key Distinction**:
- ❌ **Remove**: Static/hardcoded mock displays
- ✅ **Migrate**: Dynamic test data to real database (employees, inventory)
- 🔒 **Preserve**: Mexican restaurant menu (REAL CLIENT DATA)

## Current Status
**Branch**: `back/payment-provider-architecture`
**Main Issue**: Payment processing stuck due to demo mode operation
**Solution**: Create staging environment with real database and dynamic data

## Phase 1: Data Audit & Classification (2 hours)
### 1.1 Identify Data Types
- [ ] **Static Mock Data** (TO REMOVE):
  - Hardcoded UI displays
  - Fake screenshots/images
  - Static report templates
  - Hardcoded success messages

- [ ] **Dynamic Test Data** (TO MIGRATE):
  - Test employees (Sarah, Mike, Emma, etc.)
  - Test inventory items
  - Sample schedules
  - Test orders for reporting

- [ ] **Real Client Data** (TO PRESERVE):
  - Mexican restaurant menu (Tacos, Burritos, etc.)
  - Menu prices
  - Product descriptions
  - Category structure

### 1.2 Create Database Seed Data
- [ ] Convert MockDataService employees → database seed
- [ ] Convert mock inventory → database records
- [ ] Maintain relationships (employees ↔ schedules ↔ shifts)
- [ ] Ensure sufficient test data for all features

## Phase 2: Database Infrastructure (3-4 hours)
### 2.1 DigitalOcean Database Setup
- [ ] Create managed PostgreSQL database
- [ ] Implement multi-tenant schema
- [ ] Set up proper isolation

### 2.2 Seed Data Migration Script
```python
# Example structure for seed data
- Create test platform: "Fynlo Platform"
- Create test restaurant: "Fynlo Mexican Restaurant"
- Create test employees:
  - Manager: Demo Manager
  - Cashiers: Sarah Johnson, Tom Wilson
  - Cooks: Mike Chen, Anna Garcia
  - Servers: Emma Davis
- Create inventory items with real tracking
- Create sample schedules for testing
- Preserve ALL menu items (real client data)
```

### 2.3 Data Relationships
- [ ] Employees linked to restaurant
- [ ] Inventory linked to products
- [ ] Schedules linked to employees
- [ ] Orders can reference real employees

## Phase 3: Remove Static Mock Data (2-3 hours)
### 3.1 UI Components
- [ ] Remove any hardcoded employee lists
- [ ] Remove static inventory displays
- [ ] Remove fake report screenshots
- [ ] Remove hardcoded success screens

### 3.2 Replace with Dynamic Data
- [ ] Employee lists → Pull from database
- [ ] Inventory displays → Real-time from database
- [ ] Reports → Generate from actual data
- [ ] Order history → Real database records

## Phase 4: Backend API Implementation (4 hours)
### 4.1 Core APIs with Test Data
- [ ] `/api/employees/` - Returns seeded test employees
- [ ] `/api/inventory/` - Returns seeded inventory data
- [ ] `/api/schedules/` - Returns test schedules
- [ ] `/api/products/` - Returns REAL menu items

### 4.2 Feature Testing APIs
- [ ] Rota system - Works with test employees
- [ ] Employee editing - Can modify test employees
- [ ] Inventory tracking - Updates test inventory
- [ ] Order processing - Creates real orders

### 4.3 Payment Integration
- [ ] Connect SumUp to real order flow
- [ ] Save payment records to database
- [ ] Link payments to test employees

## Phase 5: Frontend Integration (3 hours)
### 5.1 Dynamic Data Loading
- [ ] EmployeeManagementScreen - Load from database
- [ ] InventoryScreen - Real-time inventory levels
- [ ] ScheduleScreen - Database-driven schedules
- [ ] MenuScreen - Keep existing (real client data)

### 5.2 Remove Static Displays
- [ ] No more hardcoded employee cards
- [ ] No static inventory tables
- [ ] No fake analytics charts
- [ ] Real data or loading states only

## Phase 6: Feature Validation (2 hours)
### 6.1 Test Each Feature with Seed Data
- [ ] **Rota System**:
  - View schedules for test employees
  - Edit shifts
  - Check conflicts

- [ ] **Employee Management**:
  - Edit test employee details
  - Change roles
  - Update schedules

- [ ] **Inventory Management**:
  - Track stock levels
  - Update quantities
  - Generate restock alerts

- [ ] **Order Processing**:
  - Create orders with real menu items
  - Assign to test employees
  - Process payments

- [ ] **Reports**:
  - Generate from test data
  - Show real calculations
  - No static templates

### 6.2 Payment Flow Testing
- [ ] Select real menu items
- [ ] Process with SumUp
- [ ] Save to database
- [ ] Appear in reports

## Phase 7: Data Flow Verification (2 hours)
### 7.1 Complete Workflows
- [ ] Platform owner sees test restaurant with real data
- [ ] Restaurant owner manages test employees
- [ ] Test employee processes real order
- [ ] Order saves with actual data
- [ ] Reports show real metrics

### 7.2 No Static Data Points
- [ ] Every screen pulls from database
- [ ] No hardcoded success messages
- [ ] Real-time updates
- [ ] Proper loading states

## Phase 8: Staging Environment (2 hours)
### 8.1 Deploy Complete Stack
- [ ] Database with seed data
- [ ] Backend with all APIs
- [ ] Frontend pulling real data
- [ ] Monitoring enabled

### 8.2 Final Testing
- [ ] All features work with test data
- [ ] SumUp payments complete
- [ ] Reports show accurate data
- [ ] Multi-tenant isolation verified

## Success Criteria
- [ ] ✅ Test employees in database (not hardcoded)
- [ ] ✅ Test inventory tracking real changes
- [ ] ✅ Real menu items preserved (client data)
- [ ] ✅ All features testable with seed data
- [ ] ✅ No static mock displays
- [ ] ✅ SumUp payments complete successfully
- [ ] ✅ Reports generated from real data

## Seed Data Requirements
### Minimum Test Data Needed:
- **Platform**: 1 test platform owner
- **Restaurant**: 1 test restaurant (Mexican)
- **Employees**: 6 test employees (various roles)
- **Inventory**: 20-30 items for testing
- **Schedules**: 1 week of test schedules
- **Menu**: KEEP EXISTING (real client data)

### Demo Mode (Separate)
- [ ] Maintain MockDataService for investor demos
- [ ] Clear "DEMO MODE" indicator
- [ ] Completely separate from production

## Important Notes
1. **Mexican Menu = REAL DATA** - Do not modify
2. **Test Employees = Necessary** - For feature testing
3. **Static Displays = Remove** - No hardcoded screens
4. **Dynamic Data = Implement** - Everything from database

## Quick Commands Reference

### Bundle Deployment (if changes don't appear)
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Start Backend
```bash
cd backend/
python -m app.main
```

### Database Connection
```bash
# Will be updated after DigitalOcean setup
export DATABASE_URL=postgresql://user:password@localhost:5432/fynlo_pos
```

## Progress Tracking
- [ ] Phase 1: Data Audit & Classification
- [ ] Phase 2: Database Infrastructure
- [ ] Phase 3: Remove Static Mock Data
- [ ] Phase 4: Backend API Implementation
- [ ] Phase 5: Frontend Integration
- [ ] Phase 6: Feature Validation
- [ ] Phase 7: Data Flow Verification
- [ ] Phase 8: Staging Environment

This approach ensures we can test all features while removing static mock data and establishing real data flows.

## Next Immediate Step
Start with Phase 1.1 - Audit MockDataService.ts to identify what data needs to be migrated vs removed.