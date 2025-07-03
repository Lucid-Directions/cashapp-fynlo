#!/bin/bash

echo "🔄 Force rebuilding JavaScript bundle..."

# Navigate to project root
cd "$(dirname "$0")"

# Kill Metro bundler
echo "📱 Stopping Metro bundler..."
pkill -f "metro" || true
pkill -f "react-native" || true

# Remove ALL existing bundles
echo "🗑 Removing all existing JavaScript bundles..."
find . -name "*.jsbundle" -type f -delete 2>/dev/null || true
find ./ios -name "*.jsbundle" -type f -delete 2>/dev/null || true

# Build the bundle with correct syntax
echo "🏗 Building fresh JavaScript bundle..."
npx metro build --platform ios --dev false --out ios/main.jsbundle index.js

# Handle the .js extension that Metro adds
if [[ -f "ios/main.jsbundle.js" ]]; then
    mv ios/main.jsbundle.js ios/main.jsbundle
    echo "✅ Fixed bundle extension"
fi

# Copy bundle to all locations
echo "📋 Copying bundle to all locations..."
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle 2>/dev/null || true
cp ios/main.jsbundle ios/CashAppPOS.xcworkspace/main.jsbundle 2>/dev/null || true

# Verify the bundle contains the changes
echo ""
echo "🔍 Verifying bundle contents..."

if grep -q "arrow-back" ios/main.jsbundle; then
    echo "✅ Back button icons found in bundle!"
else
    echo "⚠️ Warning: Back button icons might not be properly compiled"
fi

if grep -q "navigation\.goBack\|goBack()" ios/main.jsbundle; then
    echo "✅ Navigation back functions found in bundle!"
else
    echo "⚠️ Warning: Navigation back functions might not be properly compiled"
fi

if grep -q "EmployeesScreen\|CustomersScreen\|InventoryScreen\|ReportsScreen" ios/main.jsbundle; then
    echo "✅ Affected screens found in bundle!"
else
    echo "⚠️ Warning: Affected screens might not be properly compiled"
fi

echo ""
echo "📱 Bundle rebuild complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Cmd+Shift+K)"
echo "3. Build and Run (Cmd+R)"
echo ""
echo "Navigation fixes should now be visible in the app:"
echo "• All screens should have visible back buttons with proper styling"
echo "• Back buttons should respond to taps and navigate backwards"
echo "• Users should no longer get stuck in screens"
