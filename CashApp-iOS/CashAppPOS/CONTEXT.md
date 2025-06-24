# 🏗️ **Fynlo POS - Project Context & Development Guide**

**Last Updated**: June 24, 2025  
**Purpose**: Essential context for development sessions  
**Status**: Active Development - Critical Bug Fixes & Platform Features

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

### **1. Critical Bug Fixes (15 Issues Resolved)**
1. ✅ **Employee Management**: Add Employee modal with form validation
2. ✅ **QR Scanner**: Camera permissions for iOS/Android
3. ✅ **Inventory**: Edit functionality with modal
4. ✅ **Reports**: Responsive font sizing across devices
5. ✅ **Employee Scheduling**: Complete rota management system
6. ✅ **Profile Editing**: Removed "coming soon" placeholder
7. ✅ **Bank Details**: Restaurant payment setup screen
8. ✅ **Payment Methods**: Platform-controlled settings
9. ✅ **Receipt Logo**: Image upload functionality
10. ✅ **Platform Dashboard**: Real system health metrics
11. ✅ **Payment Processing**: Input validation and UX
12. ✅ **Logo Display**: Fixed login screen branding
13. ✅ **Platform Settings**: Added restaurant override screen
14. ✅ **Error Tracking**: Comprehensive NaN price detection
15. ✅ **Bundle Process**: Documented and fixed deployment

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

### **4. Key Navigation Updates**
- Added Platform Settings to main settings menu
- Connected RestaurantPlatformOverridesScreen to navigation
- Settings → Platform Settings → Platform Overrides

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
│   │   │   ├── EmployeesScreen.tsx        # Staff management
│   │   │   └── EmployeeScheduleScreen.tsx # New scheduling system
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
3. **Theme Imports**: Some screens use hardcoded colors
   - Ongoing migration to theme context

### **Fixed Issues**
- ✅ Metro bundler fallback
- ✅ RNDateTimePicker conflicts
- ✅ Navigation missing screens
- ✅ NaN pricing errors
- ✅ Bundle deployment process

---

## 📈 **Next Development Priorities**

### **Immediate**
1. Complete user security features (2FA, biometrics)
2. Enhance onboarding flow
3. Make commission structure modular

### **Platform Features**
1. Multi-restaurant dashboard
2. Consolidated reporting
3. Platform-wide settings management

### **Technical Debt**
1. Migrate all screens to theme context
2. Complete Sentry integration
3. Optimize bundle size

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
- Employees: `src/screens/employees/EmployeesScreen.tsx`

### **Services**
- Error Tracking: `src/services/ErrorTrackingService.ts`
- Platform API: `src/services/PlatformService.ts`
- Payment: `src/services/PaymentService.ts`

---

## 📝 **Session Context Notes**

When starting a new session, remember:
1. **Check bundle deployment first** if changes aren't showing
2. **Use simple alternatives** if dependencies fail
3. **Platform settings** are in Settings → Platform Settings
4. **Square payment** is integrated and working
5. **Error tracking** logs to console in development

This file should be your first reference when resuming development!