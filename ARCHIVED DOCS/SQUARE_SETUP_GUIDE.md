# Square Payment Integration Setup Guide

This guide provides step-by-step instructions for setting up Square payments as a secondary payment method in the Fynlo POS app.

## ✅ Completed Setup

### 1. **NPM Dependencies Resolved**
- Fixed npm dependency conflicts using `--legacy-peer-deps` flag
- Successfully installed `react-native-square-in-app-payments@^1.7.6`
- Added missing `react-native-webview@^13.15.0` dependency for SumUp compatibility

### 2. **iOS Native Dependencies**
- ✅ Square SDK frameworks installed via CocoaPods:
  - `RNSquareInAppPayments (1.6.3)`
  - `SquareBuyerVerificationSDK (1.6.3)`  
  - `SquareInAppPaymentsSDK (1.6.3)`
- ✅ iOS auto-linking configured successfully
- ✅ Bundle compilation successful

### 3. **Core Implementation**
- ✅ **SquareService.ts**: Comprehensive service with real SDK integration
- ✅ **SquareCardPaymentScreen.tsx**: Card payment interface using SQIPCardEntry
- ✅ **SquareContactlessPaymentScreen.tsx**: Apple Pay/Google Pay interface
- ✅ **POSScreen.tsx**: Square integrated as secondary payment option
- ✅ **Navigation**: Square screens added to MainNavigator with proper TypeScript types

### 4. **Configuration Files**
- ✅ **square.ts**: Environment-specific configuration
- ✅ **SquareInitService.ts**: SDK initialization service
- ✅ **Payment routing**: Square prioritized after SumUp in platform config

## 🔧 Required Configuration

### Square Developer Account Setup

1. **Create Square Developer Account** (Already completed per user)
2. **Get Application Credentials**:
   ```typescript
   // Update src/config/square.ts with your credentials
   export const SQUARE_CONFIG = {
     development: {
       applicationId: 'sandbox-sq0idb-YOUR_SANDBOX_APP_ID', // Replace this
       environment: 'sandbox',
       baseUrl: 'https://connect.squareupsandbox.com',
     },
     production: {
       applicationId: 'sq0idb-YOUR_PRODUCTION_APP_ID', // Replace this
       environment: 'production', 
       baseUrl: 'https://connect.squareup.com',
     },
   };
   
   export const SQUARE_LOCATION_ID = {
     development: 'YOUR_SANDBOX_LOCATION_ID', // Replace this
     production: 'YOUR_PRODUCTION_LOCATION_ID', // Replace this
   };
   ```

### iOS Configuration (For Apple Pay)

1. **Apple Developer Account Setup**:
   ```xml
   <!-- Add to ios/CashAppPOS/CashAppPOS.entitlements -->
   <key>com.apple.developer.in-app-payments</key>
   <array>
     <string>merchant.com.yourcompany.yourapp</string>
   </array>
   ```

2. **Create Merchant Identifier**:
   - Go to Apple Developer Portal
   - Create new Merchant ID: `merchant.com.fynlo.pos`
   - Enable Apple Pay in your app's capabilities

### Android Configuration (For Google Pay)

1. **Add Google Pay Configuration**:
   ```xml
   <!-- Add to android/app/src/main/AndroidManifest.xml -->
   <meta-data
     android:name="com.google.android.gms.wallet.api.enabled"
     android:value="true" />
   ```

## 🚀 Usage

### In POS Screen
Square appears as the second payment option:
1. **SumUp** (Primary - 0.69%)
2. **Square** (Secondary - 1.75%) ← New!
3. **QR Payment** (1.2%)
4. **Cash** (Free)
5. **Stripe** (Backup - 1.4% + 20p)

### Payment Flow
1. User selects Square payment method
2. App shows choice: "Card Payment" or "Contactless (Apple/Google Pay)"
3. Square SDK handles payment processing
4. Real-time nonce generation and payment completion
5. Automatic fallback on failure

## 🧪 Testing

### Sandbox Testing
1. Use Square's test card numbers:
   - **Visa**: `4111 1111 1111 1111`
   - **Mastercard**: `5555 5555 5555 4444`  
   - **Discover**: `6011 1111 1111 1117`

2. Test contactless payments:
   - iOS: Use Touch ID/Face ID in simulator
   - Android: Use test Google Pay account

### Integration Testing
```bash
# Build and test
npm run build:ios
cd ios && xcodebuild -workspace CashAppPOS.xcworkspace -scheme CashAppPOS
```

## 📊 Current Status

| Component | Status | Details |
|-----------|--------|---------|
| **NPM Dependencies** | ✅ Complete | Square SDK installed with legacy peer deps |
| **iOS Dependencies** | ✅ Complete | CocoaPods integration successful |
| **Android Dependencies** | ⏳ Pending | Need to configure native Android modules |
| **Core Service** | ✅ Complete | SquareService with real SDK integration |
| **Payment Screens** | ✅ Complete | Card and contactless payment UIs |
| **Navigation** | ✅ Complete | Proper routing and TypeScript types |
| **POS Integration** | ✅ Complete | Square as secondary payment method |
| **Apple Pay Setup** | ⏳ Pending | Need merchant identifier configuration |
| **Google Pay Setup** | ⏳ Pending | Need Android manifest updates |
| **Production Config** | ⏳ Pending | Need real Square credentials |

## 🔄 Next Steps

### Critical (Before Production)
1. **Configure Square Credentials**: Add real application ID and location ID
2. **Apple Pay Setup**: Configure merchant identifier and entitlements
3. **Android Configuration**: Set up native dependencies and Google Pay

### Optional Enhancements  
1. **Advanced Error Handling**: Custom error recovery flows
2. **Payment Analytics**: Track Square payment performance vs other methods
3. **Fee Optimization**: Dynamic routing based on transaction amount

## 🛠️ Development Commands

```bash
# Install dependencies
npm install --legacy-peer-deps

# iOS setup
cd ios && pod install

# Build bundle
npm run build:ios

# Clean rebuild
npm run clean:all
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Errors**: Use `--legacy-peer-deps` for all npm installs
2. **Missing WebView**: Install `react-native-webview` for SumUp compatibility  
3. **iOS Build Fails**: Run `pod install` after any new package installation
4. **Square SDK Errors**: Check application ID configuration in `src/config/square.ts`

### Support Resources
- [Square Developer Documentation](https://developer.squareup.com/docs)
- [React Native Square SDK](https://github.com/square/react-native-square-in-app-payments)
- [Apple Pay Integration Guide](https://developer.apple.com/apple-pay/implementation/)

---

**Status**: Square integration successfully implemented as secondary payment method! 🎉
**Ready for**: Configuration with real Square credentials and Apple Pay setup
**Impact**: Provides payment redundancy and alternative processing fees for merchants