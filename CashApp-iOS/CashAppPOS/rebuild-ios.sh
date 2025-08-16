#!/bin/bash

echo "🧹 Cleaning everything..."

# Clean React Native cache
echo "Clearing Metro cache..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep 3
kill $METRO_PID 2>/dev/null

# Clean Xcode build
echo "Cleaning Xcode build..."
cd ios
xcodebuild clean -workspace CashAppPOS.xcworkspace -scheme CashAppPOS -configuration Debug

# Remove old bundles
echo "Removing old bundles..."
rm -f main.jsbundle
rm -f CashAppPOS/main.jsbundle

# Rebuild the JavaScript bundle with assets
echo "Building new JavaScript bundle..."
cd ..
npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios

# Copy bundle to the app directory
echo "Copying bundle to app directory..."
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

echo "✅ Done! Now open Xcode and press Cmd+R to run the app"
echo "The logo should now display properly!"