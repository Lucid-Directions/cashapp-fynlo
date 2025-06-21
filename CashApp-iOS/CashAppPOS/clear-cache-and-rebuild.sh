#!/bin/bash

echo "🧹 Clearing all caches and rebuilding..."

# Kill any running Metro bundler instances
echo "📱 Killing Metro bundler..."
pkill -f "metro" || true

# Clear watchman cache
echo "👁 Clearing watchman cache..."
watchman watch-del-all 2>/dev/null || true

# Clear Metro bundler cache
echo "🚇 Clearing Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

# Clear React Native cache
echo "⚛️ Clearing React Native cache..."
rm -rf ~/Library/Caches/react-native-cli/ 2>/dev/null || true

# Clear npm/yarn cache
echo "📦 Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# Remove node_modules and reinstall
echo "🗑 Removing node_modules..."
rm -rf node_modules

echo "📥 Installing dependencies..."
npm install

# Clear iOS build artifacts
echo "🍎 Clearing iOS build artifacts..."
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
rm -rf build/
rm -rf Pods/
rm -rf CashAppPOS.xcworkspace/xcuserdata/
rm -rf CashAppPOS.xcodeproj/xcuserdata/

# Remove old bundles
echo "🗑 Removing old JavaScript bundles..."
rm -f main.jsbundle
rm -f CashAppPOS/main.jsbundle
rm -f CashAppPOS.xcworkspace/main.jsbundle

echo "🔧 Installing pods..."
pod install

echo "🏗 Building new JavaScript bundle..."
cd ..
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios

echo "✅ Cache cleared and dependencies reinstalled!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Cmd+Shift+K)"
echo "3. Build and Run (Cmd+R)"
echo ""
echo "The app should now show the 10 color theme options!"