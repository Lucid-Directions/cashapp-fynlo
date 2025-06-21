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

# Clear Metro cache
echo "🧹 Clearing Metro cache..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep 5

# Build the bundle
echo "🏗 Building fresh JavaScript bundle..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios \
  --reset-cache

# Kill Metro after bundle is built
kill $METRO_PID 2>/dev/null || true

# Copy bundle to all locations
echo "📋 Copying bundle to all locations..."
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle 2>/dev/null || true
cp ios/main.jsbundle ios/CashAppPOS.xcworkspace/main.jsbundle 2>/dev/null || true

# Verify the bundle contains the color themes
echo ""
echo "🔍 Verifying bundle contents..."
if grep -q "Ocean Blue" ios/main.jsbundle && grep -q "Royal Purple" ios/main.jsbundle; then
    echo "✅ Color themes found in bundle!"
    
    # Check if colors variant is properly compiled
    if grep -q "variant.*===.*'colors'" ios/main.jsbundle; then
        echo "✅ Colors variant code found!"
    else
        echo "⚠️ Warning: Colors variant code might not be properly compiled"
    fi
    
    # Check if colorThemeOptions import is used
    if grep -q "colorThemeOptions.map" ios/main.jsbundle; then
        echo "✅ colorThemeOptions import is being used!"
    else
        echo "⚠️ Warning: colorThemeOptions might be hardcoded"
    fi
else
    echo "❌ Color themes NOT found in bundle - there might be a compilation issue"
fi

echo ""
echo "📱 Bundle rebuild complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Cmd+Shift+K)"
echo "3. Build and Run (Cmd+R)"
echo ""
echo "If the issue persists, run ./clear-cache-and-rebuild.sh for a full cache clear."