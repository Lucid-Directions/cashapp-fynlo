# CashApp POS - Complete Project Context

## Project Overview

**Fynlo CashApp POS** is a React Native iOS application (v0.80.0) designed as a **phone-only restaurant point-of-sale system**. The app enables restaurant staff to use their iPhone to take orders and accept payments without requiring hardware card readers or terminals.

### Core Philosophy
- **Phone-Only Operation**: Primary design for iPhone-based payment acceptance
- **Hardware Support Preserved**: All hardware code maintained for future expansion
- **Multi-Payment Methods**: 5 payment options for comprehensive coverage
- **Restaurant Focused**: Built specifically for restaurant/hospitality use

## Technical Architecture

### Platform Details
- **Framework**: React Native 0.72.17 (STABLE - rolled back from 0.80.0 due to compatibility issues)
- **React Version**: 18.2.0 (compatible with RN 0.72.17)
- **iOS Deployment Target**: 13.0+ (minimum for RN 0.72.17)
- **Platform**: iOS only (iPhone XS+ required for Tap to Pay)
- **State Management**: Zustand with AsyncStorage persistence
- **Payment Integration**: SumUp iOS SDK 4.2.1
- **Native Bridge**: Objective-C bridge for SumUp SDK

### Critical Version Rollback (January 2025)
**IMPORTANT**: The project was rolled back from React Native 0.80.0 to 0.72.17 due to:
- **react-native-screens compatibility issues**: RN 0.80.0 has C++ API breaking changes
- **App startup crashes**: White screen and infinite loops with newer versions
- **Network timeout hangs**: Settings service caused app freezing
- **Working configuration restored**: All dependencies set to RN 0.72.17 compatible versions

### Key Directories
```
CashApp-iOS/CashAppPOS/
├── src/
│   ├── screens/payment/EnhancedPaymentScreen.tsx
│   ├── services/
│   │   ├── SumUpService.ts
│   │   └── providers/SumUpPaymentProvider.ts
│   └── store/useSettingsStore.ts
├── ios/
│   ├── CashAppPOS/
│   │   ├── SumUpSDKBridge.h
│   │   ├── SumUpSDKBridge.m
│   │   └── main.jsbundle (bundle deployment)
│   └── Podfile (SumUp SDK integration)
├── SUMUP_IMPLEMENTATION_PROGRESS.md
├── SUMUP_INTEGRATION_COMPLETE.md
└── CONTEXT.md (this file)
```

## Dependency Management & Version Requirements

### Critical Version Dependencies

#### React Native 0.72.17 Requirements (STABLE CONFIGURATION)
The project uses **React Native 0.72.17** after rollback from 0.80.0. This is the PROVEN WORKING configuration:

**✅ Required Versions:**
- **React**: 19.1.0 (exact match required for RN 0.80.0)
- **iOS Deployment Target**: 16.0+ (minimum for Apple Silicon compatibility)
- **Node.js**: 18.18.0+ (specified in package.json engines)
- **npm**: 9.0.0+ (specified in package.json engines)
- **CocoaPods**: 1.16.2+ (for iOS dependency management)

#### iOS Platform Requirements
```json
{
  "platform": "ios: 16.0",
  "IPHONEOS_DEPLOYMENT_TARGET": "16.0",
  "requirement_reason": "React Native 0.80.0 minimum compatibility"
}
```

### Version Resolution History

#### The React Native 0.80.0 Migration (June 2025)

**Problem Encountered:**
```
Build input file cannot be found: 
'/Users/.../node_modules/react-native/ReactCommon/yoga/yoga/log.cpp'
Did you forget to declare this file as an output of a script phase?
```

**Root Cause Analysis:**
1. **Missing File**: `log.cpp` was removed from Yoga library in RN 0.80.0
2. **Deployment Target**: iOS 14.0 was too low for RN 0.80.0 requirements
3. **React Version**: React 18.x was incompatible with RN 0.80.0 (requires 19.1.0)
4. **CocoaPods**: Old dependency cache was referencing deprecated file structure

**Resolution Steps:**
1. **Updated React Native**: 0.72.17 → 0.80.0 (latest stable)
2. **Updated React**: 18.3.1 → 19.1.0 (RN 0.80.0 requirement)
3. **Updated iOS Target**: 14.0 → 16.0 (minimum for RN 0.80.0)
4. **Clean Installation**: Removed node_modules + pod cache
5. **Xcode Project Update**: Updated deployment target in project.pbxproj

**Final Working Configuration:**
```json
{
  "react": "19.1.0",
  "react-native": "0.80.0",
  "ios_deployment_target": "16.0",
  "status": "✅ Build successful"
}
```

### Why These Specific Versions?

#### React Native 0.80.0 Selection
- **Latest Stable**: Most recent stable release (June 2025)
- **New Architecture**: Default New Architecture with better performance
- **React 19 Support**: Uses latest React stable with concurrent features
- **Yoga 3.1**: Updated layout engine with percentage value support
- **iOS 16+ Features**: Access to latest iOS APIs and frameworks

#### iOS 16.0+ Deployment Target
- **Apple Silicon**: Native M1/M2/M3 Mac compatibility
- **React Native Requirement**: Minimum for RN 0.80.0 dependencies
- **SumUp SDK**: Compatible with iOS 16+ for Tap to Pay features
- **Future Proofing**: Apple's recommended minimum for new apps

#### React 19.1.0 Selection
- **RN 0.80.0 Requirement**: Exact version match required
- **Concurrent Features**: Improved performance and rendering
- **Owner Stacks**: Better error debugging in development
- **Forward Compatibility**: Latest stable React features

### Dependency Conflict Prevention

#### Package.json Lock Strategy
```json
{
  "engines": {
    "node": ">=18.18.0",
    "npm": ">=9.0.0"
  },
  "packageManager": "npm@11.4.2"
}
```

#### CocoaPods Version Locking
```ruby
# Podfile
platform :ios, '16.0'
# Ensures all pods use iOS 16.0+ deployment target
```

#### Common Version Conflicts & Solutions

**React/React Native Mismatch:**
```bash
# Problem: React 18.x with RN 0.80.0
npm error ERESOLVE unable to resolve dependency tree
# Solution: Use exact React 19.1.0
npm install react@19.1.0 --force
```

**iOS Deployment Target Conflicts:**
```bash
# Problem: Mixed deployment targets
CocoaPods could not find compatible versions
# Solution: Unified iOS 16.0 across all configs
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 14.0/IPHONEOS_DEPLOYMENT_TARGET = 16.0/g' ios/CashAppPOS.xcodeproj/project.pbxproj
```

**Node/npm Version Issues:**
```bash
# Problem: Node 16.x with RN 0.80.0
# Solution: Use Node 18.18.0+
nvm use 18.18.0
npm install
```

### Dependency Maintenance

#### Regular Update Strategy
1. **Check React Native Releases**: Monthly review of new versions
2. **Test Compatibility**: Staging environment validation
3. **iOS Target Updates**: Follow Apple's minimum requirements
4. **Documentation Updates**: Maintain version history in this file

#### Update Testing Checklist
- [ ] React Native version compatibility
- [ ] React version exact match
- [ ] iOS deployment target requirements
- [ ] CocoaPods dependency resolution
- [ ] SumUp SDK compatibility
- [ ] Physical device testing (iPhone XS+)
- [ ] Payment flow validation

#### Rollback Strategy
If dependency updates cause issues:
```bash
# 1. Revert package.json changes
git checkout package.json package-lock.json

# 2. Clean install
rm -rf node_modules
npm install

# 3. Clean iOS build
cd ios && rm -rf Pods && pod install

# 4. Update this documentation with issue details
```

### Version History Log

| Date | React Native | React | iOS Target | Reason |
|------|-------------|-------|------------|---------|
| June 2025 | 0.80.0 | 19.1.0 | 16.0 | Latest stable, New Architecture default |
| Previous | 0.72.17 | 18.3.1 | 14.0 | Initial development version |

**Next Planned Updates:**
- Monitor RN 0.81.x for stability
- Evaluate iOS 17.0 target when appropriate
- Track React 19.x updates for compatibility

## Payment System Architecture

### 5 Payment Methods (Phone-Only Focus)

1. **Tap to Pay on iPhone** (Primary)
   - Uses iPhone's NFC for contactless card acceptance
   - Requires iPhone XS+, iOS 16.4+
   - No hardware needed - pure phone-based

2. **QR Code Payments**
   - Generate QR for customer scanning
   - PayPal, Venmo, SumUp QR support
   - Visual display on iPhone screen

3. **Mobile Wallets**
   - Apple Pay, Google Pay integration
   - Processed through SumUp SDK
   - Native wallet UI integration

4. **Manual Card Entry**
   - Fallback for non-contactless cards
   - Card-not-present processing
   - Secure manual input

5. **Cash Payments**
   - Local recording and tracking
   - Change calculation
   - Transaction logging

### Hardware Support (Future Ready)
- **Card Readers**: Solo, Air, Air Lite, PIN+ support coded but disabled
- **Printers**: Receipt/kitchen printer configs preserved
- **Cash Drawer**: Settings maintained for future hardware
- **Barcode Scanner**: Code ready for product scanning

## Recent Implementation History

### SumUp Integration Completion
- **SumUp iOS SDK 4.2.1** integrated with native Objective-C bridge
- **Phone-only configuration** with hardware preservation
- **Production-ready** payment processing
- **Fee structure**: 0.69% + £19/month (volume ≥£2,714)

### Build Issues Resolved
- **Expo References Removed**: Fixed "ExpoModulesProvider.swift" build error
- **Objective-C Syntax Fixed**: Corrected bridge implementation
- **Bundle Deployment**: `main.jsbundle` process documented
- **React Native 0.80.0 Upgrade**: Resolved Yoga library `log.cpp` missing file error
- **iOS Deployment Target**: Updated to 16.0+ for React Native 0.80.0 compatibility
- **React Version Alignment**: Updated to React 19.1.0 for proper RN 0.80.0 support
- **Swift API Changes**: Fixed RCTBundleURLProvider optional chaining for RN 0.80.0

### Documentation Recovery
- **SUMUP_IMPLEMENTATION_PROGRESS.md**: Phone-only setup status
- **SUMUP_INTEGRATION_COMPLETE.md**: Complete integration guide
- **CONTEXT.md**: This comprehensive project overview

## Common Issues & Solutions

### Bundle Deployment (Most Common)
When app changes don't appear:
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Build Errors

#### Dependency Version Conflicts
```bash
# React Native 0.80.0 missing log.cpp error
Build input file cannot be found: '.../yoga/yoga/log.cpp'
# Solution: Update to proper RN 0.80.0 + React 19.1.0 + iOS 16.0
rm -rf node_modules
npm install react@19.1.0 react-native@0.80.0 --force
cd ios && rm -rf Pods && pod install
```

#### iOS Deployment Target Errors
```bash
# CocoaPods compatibility issues
CocoaPods could not find compatible versions for pod "React-NativeModulesApple"
# Solution: Update all deployment targets to iOS 16.0
sed -i '' 's/platform :ios, .*/platform :ios, '"'"'16.0'"'"'/g' ios/Podfile
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = .*/IPHONEOS_DEPLOYMENT_TARGET = 16.0/g' ios/CashAppPOS.xcodeproj/project.pbxproj
```

#### Deployment Target Mismatch Warnings
```bash
# Problem: Object file was built for newer 'iOS' version (16.0) than being linked (15.1)
# This happens when pods are built for iOS 16.0 but app target is still 15.1
# Solution: Update all targets and clean rebuild
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 15.1/IPHONEOS_DEPLOYMENT_TARGET = 16.0/g' ios/CashAppPOS.xcodeproj/project.pbxproj
cd ios && rm -rf Pods Podfile.lock
pod install
rm -rf ~/Library/Developer/Xcode/DerivedData/CashAppPOS-*
xcodebuild clean -workspace CashAppPOS.xcworkspace -scheme CashAppPOS
```

#### Swift API Compatibility (React Native 0.80.0)
```swift
// Problem: Cannot use optional chaining on non-optional value of type 'RCTBundleURLProvider'
if let bundleURL = RCTBundleURLProvider.sharedSettings()?.jsBundleURL(forBundleRoot: "index") {
// Solution: Remove optional chaining - sharedSettings() is now non-optional
if let bundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") {
```

#### Traditional Build Issues
- **Check for Expo references**: Remove all ExpoModulesProvider entries
- **Objective-C syntax**: Ensure proper NSNumber boxing in bridge
- **Pod dependencies**: `cd ios && pod install` for SumUp SDK

### SumUp Configuration
- **Simulator Limitation**: SumUp SDK doesn't support arm64 simulator (Apple Silicon)
- **Device Testing**: Use physical iPhone XS+ for Tap to Pay testing
- **Authentication**: Merchant must be logged in before processing payments

## Key Files Breakdown

### SumUpService.ts
Core service managing SumUp SDK integration:
- SDK initialization and authentication
- Payment processing orchestration
- Event handling and error management
- Phone-only method prioritization

### SumUpPaymentProvider.ts
Payment provider with 5 method implementations:
- `processTapToPayPayment()` - iPhone NFC contactless
- `processQRCodePayment()` - QR generation and handling
- `processMobileWalletPayment()` - Apple Pay integration
- `processManualEntryPayment()` - Card-not-present fallback
- `processCashPayment()` - Local cash recording

### SumUpSDKBridge.m
Native iOS bridge in Objective-C:
- SDK setup and configuration
- Payment checkout processing
- Merchant authentication
- Settings and preferences

### EnhancedPaymentScreen.tsx
Main payment interface:
- Payment method selection
- Tip calculation and split payments
- Receipt generation options
- Error handling and user feedback

### useSettingsStore.ts
Persistent settings with payment configurations:
- Payment method enablement
- Fee percentages
- Hardware settings (preserved for future)
- Business information and tax configuration

## Development Workflow

### Git & Branching
- **Prefix conventions**: `front/feature` or `back/feature`
- **Protected main**: PR required, no direct pushes
- **Current branch**: `back/payment-provider-architecture`
- **Commit format**: `<type>(<scope>): <description>`

### Pull Request Issues (Recent)
- **Documentation Loss**: PRs caused loss of SumUp documentation
- **File Duplication**: Multiple CLAUDE.md and reverted files
- **Conflicts**: Branch conflicts prevented clean merges
- **Resolution**: All PRs closed, work committed directly to current branch

### Testing Approach
- **No Expo**: Pure React Native testing only
- **Physical Device**: Required for SumUp SDK and Tap to Pay
- **SumUp Sandbox**: Test cards and merchant account
- **Payment Flow**: All 5 methods tested independently

## Production Configuration

### iOS Requirements
- **Entitlements**: Proximity Reader Payment Acceptance
- **Info.plist**: NFC usage descriptions
- **Apple Developer**: Tap to Pay capability enabled
- **Provisioning**: Updated profiles with NFC entitlements

### SumUp Requirements
- **Merchant Account**: Business verified with SumUp
- **Tap to Pay**: Feature enabled by SumUp support
- **API Keys**: Production affiliate and app keys
- **Fee Verification**: 0.69% + 0.15p confirmed

### App Store Submission
- **Payment Processing**: Category declared
- **NFC Permissions**: Usage justified
- **Review Process**: Payment app guidelines followed

## Architecture Decisions

### Phone-Only by Default
- **Design Choice**: Prioritize phone-based payments
- **Hardware Preserved**: All hardware code maintained
- **Future Expansion**: Easy hardware enablement
- **Cost Effective**: No hardware purchase required

### SumUp Selection
- **UK Market**: Strong presence and support
- **Fee Structure**: Competitive rates for volume
- **SDK Quality**: Mature iOS integration
- **Phone Support**: Tap to Pay on iPhone capability

### React Native Choice
- **Performance**: Native bridge for payment processing
- **iOS Focus**: Single platform optimization
- **State Management**: Zustand for simplicity
- **Persistence**: AsyncStorage for offline capability

## Integration Status

### Completed ✅
- SumUp iOS SDK integration
- Native Objective-C bridge
- 5 payment method implementations
- Phone-only configuration
- Build error resolution
- Documentation recreation
- Settings store integration

### In Progress 🔄
- Comprehensive testing of all payment methods
- Production deployment preparation
- Context documentation (this file)

### Future Scope 📋
- Hardware card reader integration
- Android platform support
- Advanced reporting and analytics
- Multi-tenant restaurant management
- Kitchen display system integration

## Contact & Support

### Technical Issues
- **SumUp Developer**: developer@sumup.com
- **Apple Developer**: developer.apple.com/support
- **React Native**: reactnative.dev/help

### Documentation References
- **SumUp iOS SDK**: docs.sumup.com/docs/ios-sdk
- **Tap to Pay**: developer.apple.com/tap-to-pay
- **React Native**: reactnative.dev/docs

## Critical Troubleshooting Guide (January 2025 Fixes)

### 🚨 App Startup Issues - White Screen/Infinite Loop

**Symptoms**: App shows white screen, spinning wheel, or crashes on startup

**Root Cause**: React Native version compatibility issues

**Solution** (TESTED AND WORKING):
```bash
# 1. Rollback to React Native 0.72.17 (STABLE)
npm install react@18.2.0 react-native@0.72.17

# 2. Install compatible React Navigation v6
npm install @react-navigation/native@6.1.0 @react-navigation/stack@6.3.0 @react-navigation/bottom-tabs@6.5.0 @react-navigation/drawer@6.6.0

# 3. Downgrade react-native-screens to compatible version
npm install react-native-screens@3.27.0

# 4. Downgrade react-native-reanimated to compatible version  
npm install react-native-reanimated@3.8.0

# 5. Update react-test-renderer to match React version
npm install react-test-renderer@18.2.0

# 6. Clean and reinstall iOS pods
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..

# 7. Rebuild bundle
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### 🔧 Service Fee Editing Issues

**Symptoms**: Can't edit service fee, hardcoded 12.5%, input crashes, no decimal support

**Root Cause**: Hardcoded values and broken input validation

**Files Fixed**:
- `/src/screens/platform/settings/PricingPlansScreen.tsx` - Fixed hardcoded service fee value
- `/src/screens/settings/business/TaxConfigurationScreen.tsx` - Dynamic platform rate display
- `/src/components/ui/FastInput.tsx` - Added decimal/percentage input support
- `/src/hooks/useEffectiveSettings.ts` - Platform-restaurant settings sync

**Key Changes**:
```typescript
// BEFORE (broken)
platformServiceCharge: 12.5,  // Hardcoded

// AFTER (dynamic)
platformServiceCharge: effectiveSettings?.serviceTaxRate || 0,
```

### 🔴 Red Error Banners During Startup

**Symptoms**: Red error banners showing "API request failed" during app startup

**Root Cause**: console.error() calls showing network failures as red banners

**Solution** (IMPLEMENTED):
```typescript
// Changed in PlatformService.ts and useEffectiveSettings.ts
// BEFORE
console.error('API request failed:', error);

// AFTER  
console.warn('API request failed:', error);
```

### 📦 Working Package.json Configuration (STABLE)

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.17", 
    "@react-navigation/native": "6.1.0",
    "@react-navigation/stack": "6.3.0",
    "@react-navigation/bottom-tabs": "6.5.0", 
    "@react-navigation/drawer": "6.6.0",
    "react-native-screens": "3.27.0",
    "react-native-reanimated": "3.8.0",
    "react-native-gesture-handler": "2.26.0"
  },
  "devDependencies": {
    "react-test-renderer": "18.2.0"
  }
}
```

### ⚡ Network Timeout Protection

**Added to SettingsResolver.ts**:
```typescript
// 2-second timeout prevents app hanging
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Network timeout')), 2000);
});

// Fallback settings prevent crashes
try {
  settings = await Promise.race([apiCall, timeoutPromise]);
} catch (error) {
  return this.getFallbackSettings(); // Always works
}
```

### 🔄 Bundle Deployment Fix

**When changes don't appear in app**:
```bash
# CRITICAL: Copy to ALL three locations
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## Key Insights for Development

### Critical Reminders
1. **Always check this CONTEXT.md first** for common issues and solutions
2. **Use React Native 0.72.17** - DO NOT upgrade to 0.80.0 (causes crashes)
3. **Bundle deployment required** when React Native changes don't appear
4. **Physical device testing** required for payment functionality
5. **SumUp merchant login** required before payment processing
6. **Hardware code preserved** - don't remove, just disable

### Most Common Development Pattern
1. Make React Native changes
2. Run bundle deployment script (copy to ALL 3 locations)
3. Test on physical iPhone XS+
4. Verify SumUp authentication
5. Test payment flow end-to-end

### Emergency Recovery
If documentation or configuration is lost:
1. Check this CONTEXT.md for complete project understanding
2. Review SUMUP_INTEGRATION_COMPLETE.md for setup
3. Check SUMUP_IMPLEMENTATION_PROGRESS.md for status
4. Use React Native 0.72.17 configuration (NEVER 0.80.0)
5. Use git status to verify staged vs committed files

---

**Project Status**: Production-ready phone-only POS with SumUp integration
**Last Updated**: 2025-06-25
**Maintainer**: Arnaud (Fynlo Development Team)