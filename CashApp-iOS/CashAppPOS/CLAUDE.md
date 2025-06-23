# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fynlo POS** is a hardware-free restaurant point of sale platform built with React Native (iOS) and FastAPI backend. The app serves as a multi-tenant platform where platform owners can onboard multiple restaurant clients. The current implementation features a Mexican restaurant as the pilot client.

**Key Value Propositions:**
- Hardware-free: No expensive POS terminals required
- QR code payments at 1.2% fees (vs 2.9% traditional cards)
- Multi-tenant architecture: Platform → Restaurants → Users
- Real-time operations via WebSocket

## Development Commands

### iOS Development
```bash
# Initial setup (first time only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Build for iOS device
npm run build:ios

# Build iOS bundle manually
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/CashAppPOS/main.jsbundle --assets-dest ios/CashAppPOS

# Build and install iOS app to device
cd ios && xcodebuild -workspace CashAppPOS.xcworkspace -scheme CashAppPOS -destination "platform=iOS,name=Device Name" build
xcrun devicectl device install app --device "DEVICE_ID" /path/to/CashAppPOS.app

# Clean builds when needed
npm run clean
npm run clean:all
```

### Testing & Debugging
```bash
# Run tests
npm test

# Lint code
npm run lint

# Security audit
npm run audit:security

# Update dependencies
npm run update:dependencies
```

### Backend (FastAPI)
```bash
cd backend/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Architecture Overview

### Multi-Tenant Platform Structure
- **Platform Level**: Platform owners manage multiple restaurants
- **Restaurant Level**: Restaurant owners manage their specific business
- **User Level**: Staff members with role-based permissions

### Key Components

**Navigation Architecture:**
- `AppNavigator.tsx`: Root navigator deciding between platform/restaurant flows
- `PlatformNavigator.tsx`: Platform owner interface (dashboard, restaurants, monitoring, users)
- `MainNavigator.tsx`: Restaurant user interface (POS, orders, settings)
- `SettingsNavigator.tsx`: Comprehensive settings management

**Authentication & Authorization:**
- `AuthContext.tsx`: Multi-role authentication (platform_owner, restaurant_owner, manager, employee)
- Role-based navigation routing
- Demo mode support for investor presentations

**Theme System:**
- `ThemeProvider.tsx`: Global theme management with 10 color schemes
- `theme.ts`: Design system with light/dark modes
- Theme context should be used instead of hardcoded Colors constants

**Data Management:**
- `DataService.ts`: Unified API service with mock/real data switching
- `MockDataService.ts`: Demo data for presentations
- `DatabaseService.ts`: Real backend API client
- `useSettingsStore.ts`: Zustand store for settings persistence

### Platform vs Restaurant Settings

**Platform-Controlled Settings** (cannot be modified by restaurants):
- Payment processing fees and methods
- Service charge rates (fixed at 12.5%)
- Commission structures
- Tax compliance settings

**Restaurant-Controlled Settings**:
- VAT rates and tax exemptions
- Business information and branding
- Operating hours
- Receipt customization
- User management

## Critical Development Notes

### Bundle Management
The app uses pre-built JavaScript bundles for stability. When making TypeScript changes:

1. Always create a new bundle: `npm run build:ios`
2. Copy to iOS folder: `cp main.jsbundle ios/CashAppPOS/main.jsbundle`
3. Rebuild and install the iOS app

### Platform vs Restaurant Context
- Mexican restaurant menu/inventory is the **pilot client**, not the platform default
- The platform is designed to support ANY restaurant type with custom menus
- Always consider multi-tenant implications when adding features
- Settings should be categorized as platform-controlled vs restaurant-controlled

### Demo Mode
- `MockDataService.ts` provides demo data for investor presentations
- Demo mode must be preserved for business development
- Real backend integration should not interfere with demo functionality

### iOS Stability
- Metro bundler fallback is configured in `AppDelegate.swift`
- CocoaPods includes extensive Xcode 16.4 compatibility fixes
- SocketRocket patches are applied automatically during pod install

## Common Development Patterns

### Adding New Settings
1. Determine if setting is platform-controlled or restaurant-controlled
2. Add to appropriate settings navigator section
3. Use existing `SettingsCard`, `SettingsSection`, `ToggleSwitch` components
4. Persist data via `useSettingsStore` or backend API

### Screen Development
1. Use theme context: `const { theme } = useTheme()`
2. Follow existing navigation patterns
3. Add proper error boundaries and loading states
4. Consider both platform owner and restaurant user perspectives

### API Integration
1. Use `DataService.ts` for API calls
2. Implement mock data fallbacks
3. Handle authentication via `AuthContext`
4. Use proper TypeScript interfaces from `src/types/`

### Testing Screen Stability
Always test critical user flows:
- Platform settings navigation
- Payment methods (should show platform-controlled message)
- Service charge configuration (platform-controlled)
- Orders screen loading
- Theme picker functionality

## Known Issues & Workarounds

### Theme Application
Many screens use hardcoded `Colors` constants instead of theme context. To fix:
- Replace `Colors.primary` with `theme.colors.primary`
- Use `useTheme()` hook instead of importing Colors
- This is an ongoing migration that should be done incrementally

### Bundle Dependency
The app relies on pre-built bundles rather than Metro for production stability. This means:
- TypeScript changes require bundle regeneration
- Hot reload may not work consistently
- Always test with fresh bundles before deployment

### Multi-Platform Considerations
When working with settings or business logic:
- Check if the feature should be platform-controlled
- Ensure restaurant owners cannot modify platform revenue settings
- Consider the multi-tenant impact of any changes

## Project Context Files

- `PROJECT_CONTEXT_COMPLETE.md`: Comprehensive project documentation with Mexican restaurant pilot details
- `ios/APP_RUNTIME_FIXES.md`: iOS-specific fixes and bundle management
- Backend documentation in `backend/RYAN DOCS/`

## Service Charge & Payment Settings Migration

Recent changes moved service charges and payment methods from restaurant control to platform control:
- Service charges are now fixed at 12.5% platform-wide
- Payment methods are configured by platform owners only
- Tax configuration screens show platform-controlled sections with lock icons
- Business settings show informational alerts instead of navigating to configuration screens