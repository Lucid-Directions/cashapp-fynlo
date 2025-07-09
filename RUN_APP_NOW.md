# 🚀 Run the App with Metro (Immediate Fix)

The app is crashing because it's using an old bundle. Here's the fastest way to fix it:

## Step 1: Start Metro Bundler

Open Terminal and run:
```bash
cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS
npm start -- --reset-cache
```

Leave this terminal window open and running.

## Step 2: Run the App

1. **In Xcode**: 
   - Press the Stop button (⏹) if app is running
   - Press the Run button (▶️) to build and run again

2. **The app will now**:
   - Connect to Metro bundler
   - Load the fixed code
   - Show the login screen without errors

## Step 3: Login

- **Email**: `sleepyarno@gmail.com`
- **Password**: Your Supabase password
- Tap "Sign In"

## What Was Fixed

I fixed these issues in the code:
1. ✅ `SimpleTextInput` component now handles missing `onValueChange` prop
2. ✅ `SignInScreen` now uses correct prop names (`onValueChange` instead of `onChangeText`)
3. ✅ Password field uses correct `secureTextEntry` prop

## Alternative: Update Bundle Manually

If you prefer not to use Metro:
```bash
# 1. Clean everything
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/CashAppPOS-*

# 2. Rebuild bundle
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/CashAppPOS/main.jsbundle --assets-dest ios/CashAppPOS

# 3. In Xcode: Product → Clean Build Folder
# 4. Build and run
```

## Troubleshooting

If you still see errors:
- Make sure Metro bundler is running (Step 1)
- Check that your iPhone/simulator has internet access
- Try shaking the device and selecting "Reload" from the developer menu

The Metro bundler approach is best because:
- No need to rebuild bundles
- Live reload for testing
- Better error messages
- Faster iteration