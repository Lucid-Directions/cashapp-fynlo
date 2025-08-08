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

# Build the bundle
echo "🏗 Building fresh JavaScript bundle..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios \
  --reset-cache

# Copy bundle to all locations
echo "📋 Copying bundle to all locations..."
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle 2>/dev/null || true
cp ios/main.jsbundle ios/CashAppPOS.xcworkspace/main.jsbundle 2>/dev/null || true

# Verify the bundle contains the changes
echo ""
echo "🔍 Verifying bundle contents..."

if grep -q "SalesReport\|InventoryReport\|StaffReport\|FinancialReport" ios/main.jsbundle; then
    echo "✅ Report navigation found in bundle!"
else
    echo "⚠️ Warning: Report navigation might not be properly compiled"
fi

if grep -q "Order Details\|orderDetailsModal\|showOrderDetails" ios/main.jsbundle; then
    echo "✅ Order details modal found in bundle!"
else
    echo "⚠️ Warning: Order details modal might not be properly compiled"
fi

if grep -q "useSettingsStore\|taxConfiguration" ios/main.jsbundle; then
    echo "✅ Settings store integration found in bundle!"
else
    echo "⚠️ Warning: Settings store integration might not be properly compiled"
fi

echo ""
echo "📱 Bundle rebuild complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Cmd+Shift+K)"
echo "3. Build and Run (Cmd+R)"
echo ""
echo "All fixes should now be visible in the app:"
echo "• Reports → Individual report screens with detailed data"
echo "• Orders → Click any order to see full details popup"
echo "• POS → Payment method selection now works (Card/Cash/Mobile/QR)"
echo "• Settings → Service fees now connect to business settings"
