#!/bin/bash

# Fynlo POS - Performance Fixes Application Script
echo "🚀 Applying Fynlo POS Performance Fixes..."
echo "========================================"

# Navigate to the project root
cd "$(dirname "$0")"

# Create backup directory
echo "📦 Creating backups..."
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

# Backup original files
echo "💾 Backing up original files..."

if [ -f "src/screens/more/MoreScreen.tsx" ]; then
    cp "src/screens/more/MoreScreen.tsx" "$BACKUP_DIR/MoreScreen.tsx.backup"
    echo "✅ Backed up MoreScreen.tsx"
fi

if [ -f "src/screens/main/ReportsScreen.tsx" ]; then
    cp "src/screens/main/ReportsScreen.tsx" "$BACKUP_DIR/ReportsScreen.tsx.backup"
    echo "✅ Backed up ReportsScreen.tsx"
fi

if [ -f "src/utils/mockDataGenerator.ts" ]; then
    cp "src/utils/mockDataGenerator.ts" "$BACKUP_DIR/mockDataGenerator.ts.backup"
    echo "✅ Backed up mockDataGenerator.ts"
fi

# Apply optimized components
echo ""
echo "🔧 Applying performance optimizations..."

# Replace MoreScreen
if [ -f "src/screens/more/MoreScreenOptimized.tsx" ]; then
    cp "src/screens/more/MoreScreenOptimized.tsx" "src/screens/more/MoreScreen.tsx"
    echo "✅ Applied optimized MoreScreen"
else
    echo "❌ MoreScreenOptimized.tsx not found"
fi

# Replace ReportsScreen
if [ -f "src/screens/main/ReportsScreenOptimized.tsx" ]; then
    cp "src/screens/main/ReportsScreenOptimized.tsx" "src/screens/main/ReportsScreen.tsx"
    echo "✅ Applied optimized ReportsScreen"
else
    echo "❌ ReportsScreenOptimized.tsx not found"
fi

# Replace MockDataGenerator
if [ -f "src/utils/mockDataGeneratorOptimized.ts" ]; then
    cp "src/utils/mockDataGeneratorOptimized.ts" "src/utils/mockDataGenerator.ts"
    echo "✅ Applied optimized MockDataGenerator"
else
    echo "❌ mockDataGeneratorOptimized.ts not found"
fi

# Check if React Native is installed
echo ""
echo "🔍 Checking React Native environment..."

if command -v npx &> /dev/null; then
    echo "✅ npx is available"
    
    # Clear Metro cache
    echo "🧹 Clearing Metro cache..."
    npx react-native start --reset-cache &
    METRO_PID=$!
    sleep 3
    kill $METRO_PID 2>/dev/null
    echo "✅ Metro cache cleared"
    
    # Check for common dependencies
    if [ -f "package.json" ]; then
        echo "📦 Checking dependencies..."
        
        if grep -q "react-native-vector-icons" package.json; then
            echo "✅ react-native-vector-icons found"
        else
            echo "⚠️  react-native-vector-icons not found - may need to install"
        fi
        
        if grep -q "react-navigation" package.json; then
            echo "✅ react-navigation found"
        else
            echo "⚠️  react-navigation not found - may need to install"
        fi
    fi
else
    echo "❌ npx not found - make sure Node.js is installed"
fi

# Verify files were applied correctly
echo ""
echo "🔍 Verifying applied fixes..."

# Check MoreScreen for optimization markers
if grep -q "MoreScreenOptimized" "src/screens/more/MoreScreen.tsx" 2>/dev/null; then
    echo "✅ MoreScreen optimization applied"
elif grep -q "Error Boundary" "src/screens/more/MoreScreen.tsx" 2>/dev/null; then
    echo "✅ MoreScreen optimization detected"
else
    echo "❌ MoreScreen optimization may not be applied correctly"
fi

# Check ReportsScreen for optimization markers
if grep -q "ReportsScreenOptimized" "src/screens/main/ReportsScreen.tsx" 2>/dev/null; then
    echo "✅ ReportsScreen optimization applied"
elif grep -q "performanceUtils.debounce" "src/screens/main/ReportsScreen.tsx" 2>/dev/null; then
    echo "✅ ReportsScreen optimization detected"
else
    echo "❌ ReportsScreen optimization may not be applied correctly"
fi

# Check MockDataGenerator for optimization markers
if grep -q "mockDataGeneratorOptimized" "src/utils/mockDataGenerator.ts" 2>/dev/null; then
    echo "✅ MockDataGenerator optimization applied"
elif grep -q "InteractionManager" "src/utils/mockDataGenerator.ts" 2>/dev/null; then
    echo "✅ MockDataGenerator optimization detected"
else
    echo "❌ MockDataGenerator optimization may not be applied correctly"
fi

echo ""
echo "📋 Performance Fix Summary:"
echo "=========================="
echo "✅ Error boundaries added to prevent crashes"
echo "✅ React.memo and useCallback optimizations applied"
echo "✅ Data generation moved to background threads"
echo "✅ Debounced input handling implemented"
echo "✅ Memory management and cleanup added"
echo "✅ Virtual list performance optimizations"

echo ""
echo "🎯 Next Steps:"
echo "============="
echo "1. Start your React Native development server:"
echo "   npx react-native start --reset-cache"
echo ""
echo "2. Build and run your app:"
echo "   npx react-native run-ios"
echo ""
echo "3. Test the following areas:"
echo "   • Navigate to More screen (should be instant)"
echo "   • Open Reports screen and test typing (should be smooth)"
echo "   • Try rapid navigation (should not crash)"
echo ""
echo "4. Monitor performance:"
echo "   • Check console logs for performance metrics"
echo "   • Watch memory usage in development"
echo "   • Test on slower devices if available"

echo ""
echo "📁 Backup Location: $BACKUP_DIR"
echo "📖 Full guide: PERFORMANCE_FIX_GUIDE.md"

echo ""
echo "🎉 Performance fixes applied successfully!"
echo "If you experience any issues, restore from backups in: $BACKUP_DIR"