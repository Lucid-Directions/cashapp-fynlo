# 🔧 Decimal Input & Service Charge Debug Guide

## Issue Report
- **Decimal inputs**: Still not working properly for entering decimal points
- **Service charge sync**: Platform changes not appearing in restaurant POS

## Recent Fixes Applied

### 1. Real-time Service Charge Sync
**Added immediate persistence** in `PaymentProcessingScreen.tsx`:
- Service charge rate changes now call `platformService.updateServiceChargeConfig()` immediately
- Service charge toggle changes also sync immediately
- No longer need to click "Save" for changes to take effect

### 2. Decimal Input Component Fixes  
**Improved text handling** in `DecimalInput.tsx`:
- Fixed text input to allow proper decimal point entry
- Better validation and number parsing
- Added extensive console logging for debugging

### 3. Bundle Deployment
- Built fresh bundle with all fixes
- Deployed to `ios/CashAppPOS/main.jsbundle`

## Testing Instructions

### Test 1: Decimal Input
1. **Go to**: Platform → Payment Processing → Service Charge Rate
2. **Try**: Tap the input field and type "15.5"
3. **Expected**: Should allow you to type decimal points normally
4. **Check console**: Look for logs like `💰 DecimalInput - Raw input: 15.5`

### Test 2: Service Charge Real-time Sync
1. **Open two views**: Platform Payment Processing + Restaurant POS
2. **Change**: Service charge rate from 12.5% to 15%
3. **Expected**: Restaurant POS stats bar should show "15%" immediately
4. **Check console**: Look for logs like:
   - `✅ Service charge updated immediately: 15`
   - `🔄 Service charge config updated in real-time`

## Potential Issues to Check

### 1. Bundle Not Refreshed
If decimal inputs still don't work:
```bash
# Force refresh the bundle
cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### 2. App Cache Issues
If service charge sync doesn't work:
- Try force-closing and reopening the app
- Check if SharedDataStore is persisting data correctly
- Look for console errors in the logs

### 3. Component State Issues
If decimal input clears when typing:
- This suggests the `handleTextChange` logic needs adjustment
- The input should maintain what you type while validating

## Console Logs to Watch For

### Working Decimal Input:
```
💰 DecimalInput - Raw input: 1
💰 DecimalInput - Display value set to: 1
💰 DecimalInput - Calling onValueChange with: 1
💰 Service charge rate changed to: 1
✅ Service charge updated immediately: 1
```

### Working Service Charge Sync:
```
✅ Service charge config saved: {enabled: true, rate: 15, description: "Real-time service charge update"}
🔄 Service charge config updated in real-time: {enabled: true, rate: 15, ...}
📊 Service charge debug: SYNC: 15% @ 2:30:45 PM
```

## Quick Verification Steps

1. **Check if bundle is current**: Look at `ios/CashAppPOS/main.jsbundle` timestamp
2. **Test decimal entry**: Try typing "12.50" in service charge field  
3. **Test immediate sync**: Change rate and watch restaurant POS stats bar
4. **Check console logs**: Verify the debug messages appear

If these steps don't work, the issue may be:
- Bundle deployment not working properly
- App not using the latest bundle
- Component state management issues
- Data persistence problems

Let me know which specific behavior you're seeing!