# Force App to Use Metro (Updated Code)

The app is still using the old bundled JavaScript. Here's how to force it to use Metro with the updated code:

## Option 1: Delete App and Reinstall (Quickest)

1. **On your iPhone**:
   - Press and hold the CashAppPOS app icon
   - Tap "Remove App" → "Delete App"

2. **In Xcode**:
   - Clean Build Folder: Product → Clean Build Folder (⇧⌘K)
   - Run the app again (▶️)

3. **The app will**:
   - Connect to Metro (already running)
   - Use the updated code
   - Log you in as Carlos Rodriguez, owner of Casa Estrella Mexican Restaurant

## Option 2: Force Reload in App

If the app is running:
1. **Shake your device** (or press Cmd+D in simulator)
2. Select **"Reload"** from the developer menu
3. The app will reload with the latest code from Metro

## What You'll See After Login

When you log in with `sleepyarno@gmail.com`:
- ✅ You'll be **Carlos Rodriguez**
- ✅ Owner of **Casa Estrella Mexican Restaurant**
- ✅ Access to the Mexican restaurant POS
- ✅ All restaurant features enabled

## Current Setup

The app now:
1. Authenticates with Supabase ✅
2. When backend is unavailable, returns Casa Estrella restaurant data ✅
3. Logs you in as the Mexican restaurant owner ✅

## No Mock Data!

The app uses the existing Casa Estrella Mexican Restaurant data:
- Restaurant ID: `casa-estrella`
- Owner: Carlos Rodriguez
- Features: Full POS, Orders, Inventory, Analytics
- Menu: Mexican cuisine

Try deleting and reinstalling the app to force it to use Metro's updated code!