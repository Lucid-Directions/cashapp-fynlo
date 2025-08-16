#!/bin/bash

echo "🧹 Force rebuilding iOS app with new bundle..."

# Kill any Metro processes
echo "Killing Metro bundler..."
pkill -f metro || true

# Remove all caches and old bundles
echo "Removing old bundles and caches..."
rm -rf ios/main.jsbundle*
rm -rf ios/CashAppPOS/main.jsbundle*
rm -rf ~/Library/Developer/Xcode/DerivedData/CashAppPOS-*
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/react-*

# Copy the logo to ensure it's in the right place
echo "Copying logo asset..."
mkdir -p ios/CashAppPOS/assets/src/assets
cp src/assets/fynlo-logo.png ios/CashAppPOS/assets/src/assets/

# Build the bundle with minimal workers to avoid EMFILE
echo "Building new bundle..."
export NODE_OPTIONS="--max-old-space-size=4096"
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle --max-workers 1

# Rename the output file
mv ios/main.jsbundle.js ios/main.jsbundle 2>/dev/null || true

# Copy to app directory
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

echo "✅ Bundle rebuilt! Now:"
echo "1. In Xcode, press Cmd+Shift+K to clean"
echo "2. Press Cmd+R to build and run"
echo "3. The logo should now appear correctly!"