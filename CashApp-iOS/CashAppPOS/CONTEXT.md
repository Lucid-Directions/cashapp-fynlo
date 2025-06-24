# 🏗️ **Fynlo POS - Project Context & Development Guide**

**Last Updated**: June 24, 2025  
**Purpose**: Essential context for development sessions  
**Status**: Active Development - Employee Management & Advanced Reporting Complete

---

## 📋 **Project Overview**

### **What is Fynlo POS?**
Fynlo POS is a **hardware-free restaurant payment and management platform**:
- **iOS React Native App**: Point of sale, menu management, staff interface
- **FastAPI Backend**: Complete restaurant management API with PostgreSQL
- **Payment Innovation**: QR code payments (1.2% fees vs 2.9% traditional)
- **Multi-tenant Architecture**: Platform → Restaurants → Users
- **Current Pilot**: Mexican restaurant (first implementation)

### **Key Value Propositions**
1. **Hardware-Free**: No expensive POS terminals required
2. **Cost Advantage**: QR payments at 1.2% fees (67% savings)
3. **Real-time Operations**: WebSocket-powered kitchen displays
4. **Comprehensive Integration**: Xero accounting, payment processing

---

## 🚨 **CRITICAL: Common Issues & Solutions**

### **1. Bundle Deployment Issue (Most Common)**
**Problem**: "You make changes and they don't show in the app"  
**Root Cause**: iOS app uses pre-built bundles, not Metro server

**Solution**:
```bash
# Build the bundle
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle

# Metro adds .js extension, so rename
mv ios/main.jsbundle.js ios/main.jsbundle

# Copy to iOS project
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

**Always run this after making changes!**

### **2. Logo/Image Issues**
**Problem**: Images not appearing, showing file:// errors  
**Solution**: Use Image component with proper asset references or fallback UI:
```tsx
// If asset doesn't work, use styled placeholder
<View style={styles.logoPlaceholder}>
  <Text style={styles.logoText}>FYNLO</Text>
</View>
```

### **3. Missing Dependencies**
**Problem**: Module not found errors  
**Solution**: 
- Check if dependency exists in package.json
- Install in correct directory (CashApp-iOS/CashAppPOS)
- For problematic dependencies, create simple alternatives

---

## 🛠️ **Recent Implementations (June 2025)**

### **1. Critical System Fixes & Features (20+ Issues Resolved)**
1. ✅ **Employee Management**: Add Employee modal with validation
2. ✅ **QR Scanner**: Camera permissions for iOS/Android
3. ✅ **Inventory Management**: Edit functionality with modal
4. ✅ **Advanced Employee Scheduling**: Complete rota system with week/day/list views
5. ✅ **Schedule Management**: Clickable shifts, edit functionality, time pickers
6. ✅ **Rota Date Selection**: Fixed green highlight navigation between days
7. ✅ **Enhanced Reporting**: Real-time employee performance & labor cost analytics
8. ✅ **Labor Cost Tracking**: Weekly hours, efficiency, cost calculations
9. ✅ **Staff Performance Reports**: Rankings, metrics, real data integration
10. ✅ **Profile Editing**: Removed "coming soon" placeholder
11. ✅ **Bank Details**: Restaurant payment setup screen
12. ✅ **Payment Methods**: Platform-controlled settings
13. ✅ **Receipt Logo**: Image upload functionality
14. ✅ **Platform Dashboard**: Real system health metrics
15. ✅ **Payment Processing**: Input validation and UX
16. ✅ **Logo Display**: Fixed login screen branding
17. ✅ **Platform Settings**: Added restaurant override screen
18. ✅ **Error Tracking**: Comprehensive NaN price detection
19. ✅ **Bundle Process**: Documented and fixed deployment
20. ✅ **Theme Consistency**: Migrated screens to use theme context

### **2. Error Tracking System**
- **SimpleErrorTrackingService**: Console-based error logging
- **Price Validation Utils**: NaN detection and safe formatting
- **All price displays protected**: formatPrice() with fallbacks
- **Comprehensive context tracking**: Screen, operation, values

### **3. Platform Settings Architecture**
- **Platform-Controlled**: Payment fees, service charges, security
- **Restaurant-Controlled**: Business info, hours, receipts
- **Override System**: Restaurants can request platform overrides
- **New Screen**: RestaurantPlatformOverridesScreen

### **4. Employee Scheduling System**
- **Multi-view Interface**: Week, day, and list views
- **Interactive Scheduling**: Clickable shifts, drag-and-drop ready
- **Native Time Pickers**: iOS DateTimePicker integration
- **Real-time Calculations**: Labor costs, efficiency tracking
- **Status Management**: Scheduled, confirmed, completed, absent
- **Role-based Organization**: Color-coded by employee roles

### **5. Enhanced Reporting System**
- **Real Data Integration**: Live employee and sales data
- **Labor Analytics**: Weekly costs, hours worked, efficiency metrics
- **Performance Tracking**: Employee rankings and productivity
- **Cost Analysis**: Labor vs revenue reporting (in development)
- **Schedule Reports**: Rota analysis and staffing insights (in development)
- **Dynamic Dashboards**: Auto-updating metrics and KPIs

### **6. Key Navigation Updates**
- Added Platform Settings to main settings menu
- Enhanced Reports section with new analytics screens
- Connected RestaurantPlatformOverridesScreen to navigation
- Settings → Platform Settings → Platform Overrides
- Reports → Schedule & Labor Report (new)
- Reports → Cost Analysis (new)

---

## 🏗️ **Architecture & Key Files**

### **Frontend Structure**
```
CashApp-iOS/CashAppPOS/
├── src/
│   ├── screens/
│   │   ├── main/POSScreen.tsx             # Main POS with payment methods
│   │   ├── auth/LoginScreen.tsx           # Login with Fynlo branding
│   │   ├── employees/
│   │   │   ├── EmployeesScreen.tsx        # Staff management with add modal
│   │   │   └── EnhancedEmployeeScheduleScreen.tsx # Advanced rota system
│   │   ├── reports/
│   │   │   ├── ReportsScreenSimple.tsx    # Enhanced reports dashboard
│   │   │   ├── StaffReportDetailScreen.tsx # Employee performance analytics
│   │   │   ├── SalesReportDetailScreen.tsx # Sales analytics
│   │   │   ├── InventoryReportDetailScreen.tsx # Inventory tracking
│   │   │   └── FinancialReportDetailScreen.tsx # Financial reporting
│   │   ├── settings/
│   │   │   ├── RestaurantPlatformOverridesScreen.tsx # Platform settings
│   │   │   └── business/BankDetailsScreen.tsx        # Bank setup
│   │   └── scanner/QRScannerScreen.tsx    # QR code scanner
│   ├── services/
│   │   ├── ErrorTrackingService.ts        # Error monitoring
│   │   ├── SimpleErrorTrackingService.ts  # Fallback tracking
│   │   ├── PaymentService.ts              # Payment coordination
│   │   └── PlatformService.ts             # Platform API
│   ├── utils/
│   │   └── priceValidation.ts             # NaN price protection
│   └── navigation/
│       └── SettingsNavigator.tsx          # Updated navigation
├── ios/
│   ├── main.jsbundle                      # CRITICAL: Pre-built bundle
│   └── CashAppPOS/
│       └── main.jsbundle                  # CRITICAL: Copy here too
└── CONTEXT.md                             # This file (renamed)
```

### **Key Backend Features (by Ryan)**
- **43+ API Endpoints**: Complete restaurant management
- **Performance**: 1.20ms DB queries, 4.29ms API responses
- **Real-time**: WebSocket channels for updates
- **Security**: 90% OWASP compliance

---

## 📱 **Development Commands**

### **iOS Development**
```bash
# Initial setup
cd ios && pod install && cd ..

# Build bundle (CRITICAL - use this instead of npm start)
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

# Clean builds
npm run clean
npm run clean:all

# Run tests
npm test
```

### **Backend (FastAPI)**
```bash
cd backend/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 🔧 **Technology Stack**

### **Frontend**
- React Native 0.72.7 with TypeScript
- React Navigation (Stack + Drawer)
- Zustand (state management)
- React Native Vector Icons
- AsyncStorage for persistence

### **Backend**
- FastAPI + PostgreSQL
- Redis for caching/sessions
- JWT authentication
- WebSocket for real-time
- Alembic migrations

### **Payment Providers**
- Square SDK (cards, contactless)
- SumUp (EU markets)
- QR payments (custom)
- Cash handling

---

## 💡 **Best Practices & Patterns**

### **Always Test Bundle Deployment**
1. Make changes
2. Build bundle: `npx metro build...`
3. Copy to iOS: `cp ios/main.jsbundle ios/CashAppPOS/`
4. Test in app

### **Error Handling**
- Use formatPrice() for all price displays
- Wrap calculations in try-catch
- Track errors with ErrorTrackingService
- Provide fallback UI for missing assets

### **Platform vs Restaurant Settings**
- Platform controls: payment fees, security, compliance
- Restaurant controls: business info, hours, branding
- Use PlatformService for platform-level configs

### **Git Workflow**
- Branch naming: `front/<feature>` or `back/<feature>`
- Commit style: `fix(scope): description`
- Always sign commits as Arnaud
- Small PRs under 400 lines

---

## 🐛 **Known Issues & Workarounds**

### **Current Issues**
1. **Image Assets**: Some images fail to load from bundle
   - Workaround: Use styled placeholders
2. **Sentry Integration**: Dependency issues
   - Workaround: Using SimpleErrorTrackingService
3. **Schedule Report Screen**: Navigation route needs implementation
   - Temporary: Uses existing StaffReportDetailScreen
4. **Cost Analysis Screen**: Backend integration pending
   - Ready for API connection when available

### **Fixed Issues**
- ✅ Metro bundler fallback
- ✅ RNDateTimePicker conflicts
- ✅ Navigation missing screens
- ✅ NaN pricing errors
- ✅ Bundle deployment process
- ✅ Rota date selector highlighting
- ✅ Theme consistency across reports
- ✅ Employee data integration
- ✅ Real-time labor cost calculations

---

## 📈 **Next Development Priorities**

### **Immediate**
1. Complete Schedule & Labor Report screen implementation
2. Create Cost Analysis Report with labor vs revenue metrics
3. Complete user security features (2FA, biometrics)
4. Enhance onboarding flow
5. Make commission structure modular

### **Platform Features**
1. Multi-restaurant dashboard
2. Consolidated reporting across all restaurants
3. Platform-wide analytics and insights
4. Advanced scheduling optimization
5. Cross-restaurant performance comparisons

### **Technical Debt**
1. ✅ Migrate reports screens to theme context (completed)
2. Complete remaining screens theme migration
3. Complete Sentry integration
4. Optimize bundle size
5. Add automated testing for scheduling system

---

## 🔗 **Quick Links**

### **Documentation**
- Backend API: `backend/RYAN DOCS/`
- iOS Guides: `IOS DOCS/`
- Xero Integration: `XERO_INTEGRATION_GUIDE.md`
- Payment Setup: `SQUARE_SETUP_GUIDE.md`

### **Key Screens**
- Main POS: `src/screens/main/POSScreen.tsx`
- Settings: `src/screens/settings/SettingsScreen.tsx`
- Platform: `src/screens/platform/PlatformDashboardScreen.tsx`
- Employee Management: `src/screens/employees/EmployeesScreen.tsx`
- Advanced Scheduling: `src/screens/employees/EnhancedEmployeeScheduleScreen.tsx`
- Enhanced Reports: `src/screens/reports/ReportsScreenSimple.tsx`
- Staff Analytics: `src/screens/reports/StaffReportDetailScreen.tsx`

### **Services**
- Error Tracking: `src/services/ErrorTrackingService.ts`
- Platform API: `src/services/PlatformService.ts`
- Payment: `src/services/PaymentService.ts`

---

## 📝 **Session Context Notes**

When starting a new session, remember:
1. **Check bundle deployment first** if changes aren't showing
2. **Use simple alternatives** if dependencies fail
3. **Employee scheduling** is fully functional with week/day/list views
4. **Reports system** uses real employee and sales data
5. **Platform settings** are in Settings → Platform Settings
6. **Square payment** is integrated and working
7. **Error tracking** logs to console in development
8. **Rota system** supports shift editing, time pickers, and real-time calculations
9. **Labor analytics** track costs, efficiency, and performance metrics

This file should be your first reference when resuming development!