#!/bin/bash

echo "🧪 Testing Navigation Fix Implementation..."

# Navigate to project root
cd "$(dirname "$0")"

# Check if bundle exists
if [[ ! -f "ios/main.jsbundle" ]]; then
    echo "❌ Bundle not found. Run ./force-rebuild-bundle.sh first."
    exit 1
fi

echo ""
echo "📦 Bundle Analysis:"
echo "  Size: $(du -h ios/main.jsbundle | cut -f1)"
echo "  Location: ios/main.jsbundle"

# Verify back button implementations
echo ""
echo "🔍 Searching for navigation implementations..."

# Count back button references
BACK_BUTTONS=$(grep -c "arrow-back" ios/main.jsbundle 2>/dev/null || echo "0")
echo "  ✅ Back button icons: $BACK_BUTTONS found"

# Count navigation.goBack calls
GO_BACK_CALLS=$(grep -c "navigation\.goBack\|goBack()" ios/main.jsbundle 2>/dev/null || echo "0")
echo "  ✅ Navigation goBack calls: $GO_BACK_CALLS found"

# Check for enhanced styling
ENHANCED_STYLING=$(grep -c "minWidth.*44\|minHeight.*44" ios/main.jsbundle 2>/dev/null || echo "0")
echo "  ✅ Enhanced back button styling: $ENHANCED_STYLING found"

# Check for affected screens
EMPLOYEES_SCREEN=$(grep -c "EmployeesScreen" ios/main.jsbundle 2>/dev/null | head -1)
CUSTOMERS_SCREEN=$(grep -c "CustomersScreen" ios/main.jsbundle 2>/dev/null | head -1)
INVENTORY_SCREEN=$(grep -c "InventoryScreen" ios/main.jsbundle 2>/dev/null | head -1)
REPORTS_SCREEN=$(grep -c "ReportsScreen" ios/main.jsbundle 2>/dev/null | head -1)

echo ""
echo "📱 Affected Screens Analysis:"
echo "  ✅ EmployeesScreen: $EMPLOYEES_SCREEN references"
echo "  ✅ CustomersScreen: $CUSTOMERS_SCREEN references"
echo "  ✅ InventoryScreen: $INVENTORY_SCREEN references"
echo "  ✅ ReportsScreen: $REPORTS_SCREEN references"

# Check if BackButton component exists
if grep -q "BackButton" ios/main.jsbundle 2>/dev/null; then
    echo "  ✅ BackButton component: Available"
else
    echo "  ⚠️ BackButton component: Not found (optional)"
fi

# Check bundle deployment locations
echo ""
echo "📂 Bundle Deployment Status:"
if [[ -f "ios/CashAppPOS/main.jsbundle" ]]; then
    echo "  ✅ iOS app bundle: Deployed"
    echo "     Size: $(du -h ios/CashAppPOS/main.jsbundle | cut -f1)"
else
    echo "  ❌ iOS app bundle: Missing"
fi

# Summary
echo ""
echo "📊 Navigation Fix Summary:"

if [[ $BACK_BUTTONS -gt 0 && $GO_BACK_CALLS -gt 0 ]]; then
    echo "  ✅ Navigation components: IMPLEMENTED"
else
    echo "  ❌ Navigation components: MISSING"
fi

if [[ $EMPLOYEES_SCREEN -gt 0 && $CUSTOMERS_SCREEN -gt 0 && $INVENTORY_SCREEN -gt 0 && $REPORTS_SCREEN -gt 0 ]]; then
    echo "  ✅ Affected screens: ALL INCLUDED"
else
    echo "  ❌ Affected screens: SOME MISSING"
fi

if [[ -f "ios/CashAppPOS/main.jsbundle" ]]; then
    echo "  ✅ iOS deployment: READY"
else
    echo "  ❌ iOS deployment: NOT READY"
fi

echo ""
echo "🚀 Next Steps for iOS App Testing:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (⌘+Shift+K)"
echo "3. Build and Run (⌘+R)"
echo "4. Navigate to: Employees, Customers, Inventory, or Reports"
echo "5. Verify back buttons are visible with enhanced styling"
echo "6. Test that back buttons respond to taps"
echo ""
echo "🐛 If issues persist:"
echo "• Check iOS app console logs for 'BackButton:' messages"
echo "• Verify bundle is loaded (not using Metro dev server)"
echo "• Try force-closing app and restarting"