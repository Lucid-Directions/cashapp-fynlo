#!/bin/bash

# Script to add JavaScript bundle to Xcode project

echo "🔧 Adding JavaScript bundle to Xcode project..."

PROJECT_DIR="/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS/ios"
BUNDLE_PATH="$PROJECT_DIR/CashAppPOS/main.jsbundle"

# Ensure bundle exists
if [ ! -f "$BUNDLE_PATH" ]; then
    echo "📦 Creating JavaScript bundle..."
    cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS
    npm run build:ios
    cp ios/main.jsbundle ios/CashAppPOS/
fi

# Check if bundle exists in Xcode project
if [ -f "$BUNDLE_PATH" ]; then
    echo "✅ JavaScript bundle found at: $BUNDLE_PATH"
    ls -la "$BUNDLE_PATH"
else
    echo "❌ JavaScript bundle not found!"
    exit 1
fi

echo "🎯 To complete setup:"
echo "1. Open CashAppPOS.xcworkspace in Xcode"
echo "2. Right-click on CashAppPOS folder in navigator"
echo "3. Select 'Add Files to CashAppPOS'"
echo "4. Navigate to ios/CashAppPOS/ and select main.jsbundle"
echo "5. Ensure 'Add to target: CashAppPOS' is checked"
echo "6. Click 'Add'"
echo ""
echo "Or Metro bundler should be running at http://localhost:8081"