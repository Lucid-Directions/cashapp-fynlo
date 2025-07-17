# Square SDK Integration Fix

The Square SDK is currently not installed but the app has code to handle its absence gracefully. Square payments are disabled when the SDK is missing.

## To Enable Square Payments

1. Install the Square In-App Payments SDK:
```bash
npm install react-native-square-in-app-payments --save
```

2. For iOS, install the native dependencies:
```bash
cd ios && pod install && cd ..
```

3. Configure Square credentials in your environment or settings:
- Application ID
- Location ID
- Access Token

## Current Status

The app gracefully handles the missing SDK by:
- Catching the import error (line 19-26 in SquareService.ts)
- Showing a warning message
- Disabling Square payment functionality
- Falling back to other payment methods (SumUp, Stripe)

## Note

Square payments are positioned as a secondary payment method to SumUp in this app. The app will function normally without Square, just with that payment option disabled.