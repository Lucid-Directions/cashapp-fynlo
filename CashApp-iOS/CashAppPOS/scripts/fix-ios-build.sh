#!/bin/bash

# Fix iOS Build Script
# This script resolves the "CashAppPOS has not been registered" error

echo "🔧 Starting iOS Build Fix..."

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📍 Current directory: $(pwd)"

# Clean build artifacts
echo "🧹 Cleaning build artifacts..."
cd ios
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/CashAppPOS-*
cd ..

# Clear watchman cache
echo "🔄 Clearing watchman cache..."
watchman watch-del-all 2>/dev/null || true

# Rebuild the bundle
echo "📦 Building fresh JavaScript bundle..."
npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios \
  --reset-cache

# Copy bundle to app directory
echo "📋 Copying bundle to app directory..."
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

# Reinstall pods
echo "🔗 Reinstalling CocoaPods dependencies..."
cd ios
pod install
cd ..

echo "✅ iOS Build Fix Complete!"
echo ""
echo "📱 Next steps in Xcode:"
echo "1. Open ios/CashAppPOS.xcworkspace"
echo "2. Product → Clean Build Folder (⇧⌘K)"
echo "3. Product → Build (⌘B)"
echo "4. Product → Run (⌘R)"