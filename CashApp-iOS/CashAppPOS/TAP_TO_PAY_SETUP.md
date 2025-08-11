# Tap to Pay on iPhone Setup Guide

## Problem
Xcode's automatic signing fails with Tap to Pay entitlements because they require special provisioning profiles that automatic signing cannot generate.

## Solution: Manual Provisioning Profile

### Step 1: Create Manual Provisioning Profile
1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list)
2. Click the "+" button to create a new profile
3. Select "iOS App Development" (for testing) or "App Store" (for production)
4. Select App ID: `com.fynlo.cashappposlucid`
5. **Important**: The profile will automatically include the Tap to Pay entitlement since it's enabled for your App ID
6. Select your development certificates
7. Select your test devices (for development profile)
8. Name it: "Fynlo POS Tap to Pay Development" 
9. Download the profile

### Step 2: Install the Profile
1. Double-click the downloaded `.mobileprovision` file
2. Xcode will automatically install it

### Step 3: Configure Xcode for Manual Signing
1. Open the project in Xcode
2. Select the CashAppPOS target
3. Go to "Signing & Capabilities" tab
4. **Uncheck** "Automatically manage signing"
5. Select Team: "Lucid Directions LTD"
6. Select Provisioning Profile: "Fynlo POS Tap to Pay Development" (the one you just created)

### Step 4: Build and Run
The app should now build successfully with Tap to Pay entitlements.

## Alternative: Temporary Development Without Tap to Pay

If you need to build quickly without setting up manual provisioning:

1. Comment out the Tap to Pay entitlement in `CashAppPOS.entitlements`:
```xml
<!-- Temporarily disabled for automatic signing
<key>com.apple.developer.proximity-reader.payment.acceptance</key>
<array>
    <string>SUMUP</string>
</array>
-->
```

2. Keep automatic signing enabled
3. The app will build but Tap to Pay will show as unavailable

## Important Notes

- **SUMUP** is the correct payment provider identifier for the SumUp SDK
- The bundle ID must be exactly `com.fynlo.cashappposlucid`
- Apple Pay uses `merchant.com.fynlo.cashappposlucid` (with merchant prefix)
- Tap to Pay uses `SUMUP` (payment provider identifier)

## Troubleshooting

### "Provisioning profile doesn't match" error
- Make sure you're using a manually created profile that includes Tap to Pay
- Verify the profile is for the correct bundle ID
- Check that your Apple Developer account has Tap to Pay enabled

### "No profiles for 'com.fynlo.cashappposlucid' were found"
- Create the manual profile as described above
- Make sure it's installed in Xcode
- Restart Xcode if needed

### Tap to Pay not working on device
- Requires iPhone XS or later
- iOS 15.4 or later
- Physical device only (not simulator)
- Apple Developer account with Tap to Pay approval