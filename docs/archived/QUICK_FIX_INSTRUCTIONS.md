# Quick Fix for App Crash

The app is crashing because it's loading an old JavaScript bundle. Here's how to fix it:

## Option 1: Run with Metro Bundler (Recommended for Testing)

1. **Start Metro bundler**:
   ```bash
   cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS
   npm start -- --reset-cache
   ```

2. **In Xcode**: Build and run the app again
   - The app will connect to Metro and load the latest code
   - You'll see better error messages if something goes wrong

## Option 2: Force Update the Bundle

1. **Delete old bundle from device**:
   - Delete the app from your iPhone/simulator
   - Clean build folder in Xcode: Product → Clean Build Folder (⇧⌘K)

2. **Rebuild and install**:
   - Build and run from Xcode
   - This forces it to use the new bundle

## The Current Issue

The error `TypeError: onValueChange is not a function` is happening because:
- Some component is using `SimpleTextInput` without the required `onValueChange` prop
- The app is still loading an old bundle with the error

## To Test Login Once Fixed:

1. **Email**: `sleepyarno@gmail.com`
2. **Password**: Your Supabase password
3. The app should authenticate and log you in as platform owner

## If Still Having Issues:

Run this command to see which screen is causing the error:
```bash
# Search for SimpleTextInput usage without onValueChange
grep -r "SimpleTextInput" src/ | grep -v "onValueChange" | grep -v "import"
```

The Metro bundler option (Option 1) is best for testing because:
- Live reload when you make changes
- Better error messages
- No need to rebuild bundles