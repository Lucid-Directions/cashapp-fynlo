# Fynlo POS Migration Plan: Supabase to DigitalOcean Consolidation

**Date**: January 2025  
**Status**: Planning Phase  
**Objective**: Consolidate business data in DigitalOcean while maintaining Supabase for authentication

## 🎯 Migration Overview

### Current State
- **Supabase**: 32 unused business tables + authentication (working)
- **DigitalOcean**: Active business data (restaurants, orders, menu) 
- **Issue**: Duplicate schemas, unused features, wrong demo data

### Target State
- **Supabase**: Authentication only (users, roles, subscriptions)
- **DigitalOcean**: All business data + new loyalty features
- **Result**: Single source of truth, better performance, cleaner architecture

## 📊 Data Migration Matrix

| Supabase Table | DigitalOcean Equivalent | Action | Priority |
|----------------|------------------------|---------|----------|
| **auth.users** | Keep in Supabase | ✅ No change | - |
| **user_subscriptions** | Keep in Supabase | ✅ No change | - |
| **user_roles** | Keep in Supabase | ✅ No change | - |
| **restaurants** | restaurants (exists) | 🗑️ Delete from Supabase | HIGH |
| **menu_items** | products (exists) | 🗑️ Delete from Supabase | HIGH |
| **menu_categories** | categories (exists) | 🗑️ Delete from Supabase | HIGH |
| **orders** | orders (exists) | 🗑️ Delete from Supabase | HIGH |
| **loyalty_programs** | - | 📦 Migrate to DO | MEDIUM |
| **loyalty_customer_data** | - | 📦 Migrate to DO | MEDIUM |
| **loyalty_transactions** | - | 📦 Migrate to DO | MEDIUM |
| **qr_campaigns** | - | 📦 Migrate to DO | LOW |
| **platform_settings** | - | 📦 Migrate to DO | HIGH |

## 🔧 Phase 1: Immediate Fixes (Day 1-2)

### 1.1 Fix Chucho Menu Data

```bash
# Step 1: Connect to backend
cd backend
source venv/bin/activate

# Step 2: Clear wrong data (if any)
python3 clear_demo_menu.py

# Step 3: Seed correct Chucho menu
python3 seed_chucho_menu.py

# Step 4: Verify data
python3 verify_menu_data.py
```

### 1.2 Clean Supabase Demo Data

```sql
-- Remove demo restaurant data from Supabase
DELETE FROM menu_items WHERE restaurant_id IN (
  SELECT id FROM restaurants WHERE name = 'Demo Restaurant'
);
DELETE FROM restaurants WHERE name = 'Demo Restaurant';
```

### 1.3 Enable Platform Features in Mobile

```typescript
// In src/config/features.ts
export const FEATURE_FLAGS = {
  PLATFORM_OWNER_ENABLED: true, // Change from false
  LOYALTY_ENABLED: false, // Keep disabled for now
  TABLE_MANAGEMENT_ENABLED: false
};
```

## 🔄 Phase 2: Schema Consolidation (Day 3-7)

### 2.1 Create Missing Tables in DigitalOcean

```sql
-- Platform configuration table
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform analytics aggregation
CREATE TABLE platform_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    active_restaurants INTEGER DEFAULT 0,
    new_restaurants INTEGER DEFAULT 0,
    platform_commission DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Loyalty programs (simplified from Supabase design)
CREATE TABLE loyalty_programs (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    program_type VARCHAR(50) DEFAULT 'points', -- points, visits, amount
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer loyalty data
CREATE TABLE customer_loyalty (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    points_balance INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    visits_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'bronze', -- bronze, silver, gold, platinum
    last_visit TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, customer_email)
);

-- Loyalty transactions
CREATE TABLE loyalty_transactions (
    id SERIAL PRIMARY KEY,
    customer_loyalty_id INTEGER REFERENCES customer_loyalty(id),
    order_id INTEGER REFERENCES orders(id),
    transaction_type VARCHAR(50), -- earned, redeemed, expired, bonus
    points_amount INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Migrate Platform Settings

```python
# migrate_platform_settings.py
import json
from supabase import create_client
from sqlalchemy import create_engine

def migrate_platform_settings():
    # Get Supabase data
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    settings = supabase.table('platform_settings').select('*').execute()
    
    # Insert into DigitalOcean
    engine = create_engine(DATABASE_URL)
    for setting in settings.data:
        engine.execute(
            "INSERT INTO platform_settings (key, value, description) "
            "VALUES (%s, %s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (setting['setting_key'], json.dumps(setting['setting_value']), None)
        )
```

## 🏗️ Phase 3: Backend API Updates (Week 2)

### 3.1 New Platform Owner Endpoints

```python
# app/api/v1/platform/__init__.py
from fastapi import APIRouter
from .overview import router as overview_router
from .restaurants import router as restaurants_router
from .analytics import router as analytics_router
from .settings import router as settings_router

router = APIRouter(prefix="/platform", tags=["platform"])
router.include_router(overview_router)
router.include_router(restaurants_router)
router.include_router(analytics_router)
router.include_router(settings_router)
```

### 3.2 Platform Overview Endpoint

```python
# app/api/v1/platform/overview.py
@router.get("/overview")
async def get_platform_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_platform_owner:
        raise HTTPException(403, "Platform owner access required")
    
    # Get platform metrics
    total_restaurants = db.query(Restaurant).count()
    active_restaurants = db.query(Restaurant).filter(Restaurant.is_active == True).count()
    
    today = datetime.now().date()
    todays_revenue = db.query(func.sum(Order.total_amount)).filter(
        func.date(Order.created_at) == today
    ).scalar() or 0
    
    active_orders = db.query(Order).filter(
        Order.status.in_(['pending', 'confirmed', 'preparing'])
    ).count()
    
    return {
        "total_restaurants": total_restaurants,
        "active_restaurants": active_restaurants,
        "todays_revenue": float(todays_revenue),
        "active_orders": active_orders,
        "platform_health": {
            "api_status": "operational",
            "websocket_status": "operational",
            "database_status": "operational"
        }
    }
```

## 📱 Phase 4: Mobile App Platform Features (Week 2-3)

### 4.1 Create Platform Navigator

```typescript
// src/navigation/PlatformNavigator.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import RestaurantListScreen from '../screens/platform/RestaurantListScreen';
import PlatformAnalyticsScreen from '../screens/platform/PlatformAnalyticsScreen';
import PlatformSettingsScreen from '../screens/platform/PlatformSettingsScreen';

const Stack = createStackNavigator();

export default function PlatformNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="PlatformDashboard" 
        component={PlatformDashboardScreen}
        options={{ title: 'Platform Overview' }}
      />
      <Stack.Screen 
        name="RestaurantList" 
        component={RestaurantListScreen}
        options={{ title: 'Manage Restaurants' }}
      />
      <Stack.Screen 
        name="PlatformAnalytics" 
        component={PlatformAnalyticsScreen}
        options={{ title: 'Platform Analytics' }}
      />
      <Stack.Screen 
        name="PlatformSettings" 
        component={PlatformSettingsScreen}
        options={{ title: 'Platform Settings' }}
      />
    </Stack.Navigator>
  );
}
```

### 4.2 Platform Dashboard Screen

```typescript
// src/screens/platform/PlatformDashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { DataService } from '../../services/DataService';

export default function PlatformDashboardScreen({ navigation }) {
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadMetrics = async () => {
    try {
      const data = await DataService.getPlatformOverview();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load platform metrics:', error);
    }
  };
  
  useEffect(() => {
    loadMetrics();
  }, []);
  
  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadMetrics} />
      }
    >
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Title>Total Restaurants</Title>
          <Paragraph>{metrics?.total_restaurants || 0}</Paragraph>
          <Paragraph>{metrics?.active_restaurants || 0} Active</Paragraph>
        </Card.Content>
      </Card>
      
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Title>Today's Platform Revenue</Title>
          <Paragraph>£{metrics?.todays_revenue?.toFixed(2) || '0.00'}</Paragraph>
        </Card.Content>
      </Card>
      
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Title>Active Orders</Title>
          <Paragraph>{metrics?.active_orders || 0} orders in progress</Paragraph>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
```

## 🧪 Phase 5: Testing & Validation (Week 3)

### 5.1 Data Validation Checklist

- [ ] Chucho menu displays correctly in mobile app
- [ ] Platform owners can log in and see dashboard
- [ ] Restaurant managers see only their data
- [ ] Orders flow correctly through the system
- [ ] WebSocket updates work for platform events
- [ ] No data leakage between tenants

### 5.2 Performance Testing

```python
# test_platform_performance.py
import asyncio
import aiohttp
import time

async def test_platform_endpoints():
    endpoints = [
        '/api/v1/platform/overview',
        '/api/v1/platform/restaurants',
        '/api/v1/platform/analytics'
    ]
    
    async with aiohttp.ClientSession() as session:
        for endpoint in endpoints:
            start = time.time()
            async with session.get(f"{BASE_URL}{endpoint}", headers=headers) as resp:
                await resp.json()
            duration = time.time() - start
            print(f"{endpoint}: {duration:.3f}s")
            assert duration < 0.5, f"{endpoint} too slow"
```

## 🚦 Phase 6: Cleanup & Documentation (Week 4)

### 6.1 Remove Unused Supabase Tables

```sql
-- After confirming all data is migrated and working
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
-- ... continue for all business tables
```

### 6.2 Update Documentation

- [ ] Update API documentation
- [ ] Update deployment guides
- [ ] Update developer onboarding
- [ ] Create migration rollback plan

## 📋 Migration Checklist

### Pre-Migration
- [ ] Full backup of both databases
- [ ] Document current table row counts
- [ ] Test rollback procedures
- [ ] Notify team of migration window

### During Migration
- [ ] Run migration scripts in order
- [ ] Validate data after each phase
- [ ] Monitor error logs
- [ ] Test critical flows

### Post-Migration
- [ ] Verify all features working
- [ ] Performance benchmarks
- [ ] Update monitoring alerts
- [ ] Archive old Supabase tables

## 🚨 Rollback Plan

If issues occur:

1. **Immediate**: Revert feature flags to disable platform features
2. **Quick Fix**: Re-enable Supabase tables (not dropped immediately)
3. **Full Rollback**: Restore from backups and revert code

## 📊 Success Metrics

- Platform owners can access all features on mobile
- No performance degradation (API response < 500ms)
- Zero data inconsistencies
- Successful multi-tenant isolation
- Reduced infrastructure complexity

## 🎯 Final Architecture

```
Supabase (Auth Only)          DigitalOcean (Business Data)
├── auth.users                ├── restaurants
├── user_roles                ├── users (linked to Supabase)
├── user_subscriptions        ├── products (menu)
└── [Auth functions]          ├── categories
                             ├── orders
                             ├── payments
                             ├── inventory
                             ├── platform_settings
                             ├── platform_analytics
                             ├── loyalty_programs
                             └── customer_loyalty
```

This migration consolidates data, improves performance, and sets the foundation for scalable multi-tenant operations.