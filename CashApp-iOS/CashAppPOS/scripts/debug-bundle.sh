#!/bin/bash

echo "🔍 Debugging iOS Bundle Issues"
echo "==============================="

# Navigate to project root
cd "$(dirname "$0")/.."

echo ""
echo "1️⃣ Checking if index.js exists..."
if [ -f "index.js" ]; then
    echo "✅ index.js found"
    echo "First 10 lines:"
    head -10 index.js
else
    echo "❌ index.js NOT FOUND!"
fi

echo ""
echo "2️⃣ Checking if App.tsx exists..."
if [ -f "App.tsx" ]; then
    echo "✅ App.tsx found"
else
    echo "❌ App.tsx NOT FOUND!"
fi

echo ""
echo "3️⃣ Checking app.json..."
if [ -f "app.json" ]; then
    echo "✅ app.json found:"
    cat app.json
else
    echo "❌ app.json NOT FOUND!"
fi

echo ""
echo "4️⃣ Building debug bundle with verbose output..."
npx react-native bundle \
    --entry-file index.debug.js \
    --platform ios \
    --dev true \
    --bundle-output ios/debug.jsbundle \
    --verbose 2>&1 | grep -E "(ERROR|Warning|Failed|theme)"

echo ""
echo "5️⃣ Checking for 'theme' references in source files..."
echo "Files containing standalone 'theme' variable:"
grep -r "^theme\." src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" 2>/dev/null | head -5

echo ""
echo "6️⃣ Checking for registration in bundle..."
if [ -f "ios/main.jsbundle" ]; then
    echo "Searching for registerComponent in bundle..."
    grep -c "registerComponent" ios/main.jsbundle || echo "❌ No registerComponent found!"
    
    echo "Searching for CashAppPOS in bundle..."
    grep -c "CashAppPOS" ios/main.jsbundle || echo "❌ CashAppPOS not found!"
fi

echo ""
echo "7️⃣ Checking Metro config..."
if [ -f "metro.config.js" ]; then
    echo "✅ metro.config.js exists"
else
    echo "❌ metro.config.js NOT FOUND!"
fi

echo ""
echo "8️⃣ Checking node_modules..."
if [ -d "node_modules" ]; then
    MODULES=$(ls node_modules | wc -l)
    echo "✅ node_modules exists with $MODULES packages"
else
    echo "❌ node_modules NOT FOUND! Run: npm install"
fi

echo ""
echo "==============================="
echo "Debug complete!"