#\!/bin/bash

echo "🔨 Force rebuilding JavaScript bundle..."

# Clean old bundles
echo "Cleaning old bundles..."
rm -f ios/main.jsbundle
rm -f ios/main.jsbundle.js
rm -f ios/CashAppPOS/main.jsbundle
rm -f ios/CashAppPOS/main.jsbundle.map

# Build production bundle
echo "Building production bundle..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle.js \
  --assets-dest ios/CashAppPOS

# Move to correct location
echo "Moving bundle to correct location..."
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

# Show checksums
echo ""
echo "✅ Bundle rebuilt successfully\!"
echo "Checksums:"
echo "ios/main.jsbundle: $(shasum ios/main.jsbundle | cut -d' ' -f1)"
echo "ios/CashAppPOS/main.jsbundle: $(shasum ios/CashAppPOS/main.jsbundle | cut -d' ' -f1)"
