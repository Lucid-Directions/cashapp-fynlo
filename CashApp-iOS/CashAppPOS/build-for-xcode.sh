#!/bin/bash

# Build script to ensure iOS bundle is in correct location for Xcode
# This script should be run before opening Xcode or building in Xcode

echo "🚀 Building React Native bundle for Xcode..."

# Clean previous bundle
rm -f ios/CashAppPOS/main.jsbundle ios/main.jsbundle

# Build the bundle to the correct location
npm run build:ios

# Verify bundle was created
if [ -f "ios/CashAppPOS/main.jsbundle" ]; then
    echo "✅ Bundle created successfully at ios/CashAppPOS/main.jsbundle"
    echo "📱 Ready for Xcode build!"
    ls -lh ios/CashAppPOS/main.jsbundle
else
    echo "❌ Bundle creation failed!"
    exit 1
fi