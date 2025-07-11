# 📱 Mobile App & Backend Alignment Plan

## Executive Summary

This document outlines the necessary changes to align the mobile app and backend with the web portal functionality. Since authentication is already working (users can create accounts on portal and login to app), we need to focus on feature parity and data synchronization.

**UPDATE**: Based on the completed implementation phases (1-8), most critical work is already done. This document reflects remaining tasks and maintenance items.

---

## ✅ What's Already Working

### From Completed Phases:
1. **Authentication Flow**: Portal → Supabase → Backend → Mobile App ✅
2. **User Creation**: Restaurant managers created on portal can login to mobile app ✅
3. **Basic Data Structure**: Users and restaurants are properly linked ✅
4. **Platform Owner Removed**: No platform features in mobile app (Phase 1) ✅
5. **Subscription System**: 3-tier plans with feature gating (Phase 7) ✅
6. **Dynamic Menus**: All menus from API, no hardcoded items (Phase 3) ✅
7. **Real Reports**: All analytics use real API data (Phase 4) ✅
8. **No Mock Data**: All mock data removed (Phase 6) ✅
9. **Platform API Ready**: Backend endpoints for web portal (Phase 8) ✅

---

## 🔧 Required Mobile App Changes

### 1. ~~Remove Remaining Mock Data Dependencies~~ ✅ COMPLETED

#### 1.1 Menu Management ✅ DONE (Phase 3)
- ~~**Current**: Hardcoded Mexican restaurant menu in `POSScreen.tsx`~~
- **Completed**: Menus now fetched from backend dynamically
- **Status**: ✅ Working in production

#### 1.2 Reports & Analytics ✅ DONE (Phase 4)
- ~~**Current**: Mock data in `DataService.ts` for all reports~~
- **Completed**: All reports use real API data
- **Status**: ✅ Working in production

#### 1.3 Inventory Management ✅ DONE (Phase 6)
- ~~**Current**: Static mock inventory data~~
- **Completed**: Dynamic inventory from backend
- **Status**: ✅ Working with proper empty states

### 2. Ensure Feature Completeness

The mobile app should expose all features that will be mirrored in the portal:

#### 2.1 Core POS Features
- ✅ Order Management
- ✅ Payment Processing
- ✅ Receipt Generation
- ✅ Table Management

#### 2.2 Business Management
- ✅ Menu Management (needs API connection)
- ✅ Staff Management
- ✅ Inventory Control
- ✅ Customer Database

#### 2.3 Analytics & Reports
- ✅ Sales Reports (Phase 4)
- ✅ Inventory Reports (Phase 4)
- ✅ Staff Performance (Phase 4)
- ✅ Financial Analytics (Phase 4)
- ❌ **Missing**: Export functionality (PDF/CSV) - Portal will handle this

#### 2.4 Settings & Configuration
- ✅ Business Information
- ✅ Operating Hours
- ✅ Tax Configuration
- ✅ Receipt Customization
- ❌ **Missing**: Subscription management (portal only)

### 3. API Standardization

Ensure all API calls follow the same pattern for portal compatibility:

```typescript
// Standardized API response format
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// All endpoints should use restaurant context
const apiCall = async (endpoint: string) => {
  const user = await getAuthUser();
  return fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${user.token}`,
      'X-Restaurant-ID': user.restaurant_id
    }
  });
};
```

---

## 🔧 Required Backend Changes

### 1. API Endpoints for Portal Features

#### 1.1 Enhanced Menu Management (NEEDED FOR PORTAL)
```python
# backend/app/api/v1/endpoints/menu.py
@router.get("/restaurants/{restaurant_id}/menu/export")
async def export_menu(format: str = "json"):  # json, csv, pdf
    """Export menu in various formats for portal"""
    
@router.post("/restaurants/{restaurant_id}/menu/import")
async def import_menu(file: UploadFile):
    """Import menu from file"""
```

**Note**: Basic menu CRUD already exists, these are portal-specific enhancements

#### 1.2 Comprehensive Analytics
```python
# backend/app/api/v1/endpoints/analytics.py
@router.get("/restaurants/{restaurant_id}/analytics/dashboard")
async def get_dashboard_metrics():
    """Aggregated metrics for portal dashboard"""
    return {
        "revenue": {...},
        "orders": {...},
        "customers": {...},
        "inventory": {...},
        "staff": {...}
    }

@router.get("/restaurants/{restaurant_id}/reports/export")
async def export_report(
    report_type: str,
    format: str,
    date_from: date,
    date_to: date
):
    """Generate and export reports"""
```

#### 1.3 Real-time Data Sync
```python
# backend/app/api/v1/endpoints/sync.py
@router.websocket("/ws/restaurant/{restaurant_id}")
async def restaurant_updates(websocket: WebSocket, restaurant_id: str):
    """WebSocket for real-time updates to portal"""
    # Emit events for:
    # - New orders
    # - Inventory changes
    # - Staff clock in/out
    # - Payment completions
```

### 2. Database Schema Additions

```sql
-- Add portal-specific fields
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS
  portal_settings JSONB DEFAULT '{}',
  dashboard_config JSONB DEFAULT '{}',
  export_preferences JSONB DEFAULT '{}';

-- Add audit trail for portal actions
CREATE TABLE IF NOT EXISTS portal_activity_log (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Permission System Enhancement

```python
# backend/app/core/permissions.py
class PortalPermissions:
    """Extended permissions for portal features"""
    
    # Restaurant Manager Portal Permissions
    VIEW_ANALYTICS = "portal.analytics.view"
    EXPORT_REPORTS = "portal.reports.export"
    MANAGE_ONLINE_MENU = "portal.menu.online"
    CONFIGURE_INTEGRATIONS = "portal.integrations.manage"
    
    # Platform Owner Portal Permissions
    VIEW_ALL_RESTAURANTS = "platform.restaurants.view_all"
    MANAGE_SUBSCRIPTIONS = "platform.subscriptions.manage"
    VIEW_PLATFORM_ANALYTICS = "platform.analytics.view"
    CONFIGURE_PLATFORM = "platform.settings.manage"
```

---

## 📊 Data Synchronization Strategy

### 1. Immediate Sync Requirements

#### From Mobile App → Portal Display
- Order creation/updates
- Payment completions
- Inventory adjustments
- Staff clock in/out

#### From Portal → Mobile App
- Menu changes
- Business settings updates
- Staff management changes
- Customer data updates

### 2. Implementation Approach

```python
# backend/app/services/sync_service.py
class SyncService:
    async def emit_update(self, event_type: str, data: dict):
        """Emit updates to all connected clients"""
        await redis.publish(f"restaurant:{data['restaurant_id']}", {
            "event": event_type,
            "data": data,
            "timestamp": datetime.utcnow()
        })
```

---

## 🔐 Security Considerations

### 1. Portal Access Control
- Ensure restaurant managers can only access their own data
- Platform owners need multi-tenant access
- Implement row-level security

### 2. API Rate Limiting
```python
# Different limits for portal vs mobile
RATE_LIMITS = {
    "mobile_app": "100/minute",
    "portal_dashboard": "300/minute",  # Higher for analytics
    "portal_export": "10/minute"       # Lower for resource-intensive
}
```

---

## 📋 Implementation Checklist

### Mobile App Tasks
- [ ] Replace hardcoded menu with API calls
- [ ] Connect all reports to real endpoints
- [ ] Add export functionality to reports
- [ ] Implement WebSocket connection for real-time updates
- [ ] Add subscription status display (read-only)
- [ ] Test all features with portal-created accounts

### Backend Tasks
- [ ] Create export endpoints for all data types
- [ ] Implement dashboard aggregation endpoints
- [ ] Add WebSocket support for real-time sync
- [ ] Enhance permission system for portal roles
- [ ] Add portal activity logging
- [ ] Implement rate limiting per client type
- [ ] Create data migration scripts if needed

### Testing Requirements
- [ ] End-to-end test: Portal signup → Mobile login
- [ ] Data sync test: Portal change → Mobile update
- [ ] Export test: Mobile data → Portal report
- [ ] Performance test: Multiple restaurants
- [ ] Security test: Cross-restaurant data access

---

## 🚀 Deployment Sequence

1. **Backend First**: Deploy all new endpoints
2. **Mobile App Update**: Release with API connections
3. **Portal Activation**: Enable features progressively
4. **Monitor & Optimize**: Track performance metrics

---

## 📈 Success Metrics

- **Authentication**: 100% of portal users can login to mobile
- **Data Sync**: < 2 second delay for updates
- **Feature Parity**: All mobile features accessible via portal
- **API Performance**: < 200ms average response time
- **Export Success**: 100% successful report generations

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Implementation