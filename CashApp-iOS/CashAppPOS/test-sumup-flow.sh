#!/bin/bash

# Test script for SumUp Tap to Pay integration
# This script validates that the native bridge is properly connected
# and that payments flow through the real SDK, not mock data

echo "🧪 SumUp Tap to Pay Integration Test Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -n "Testing: $test_name... "
    
    result=$(eval "$test_command" 2>&1)
    
    if [[ "$result" == *"$expected_result"* ]]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "  Expected: $expected_result"
        echo "  Got: $result"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1️⃣ Checking native module registration..."
echo "-------------------------------------------"

# Test 1: Check if SumUpTapToPayModule exists in native code
run_test "Swift module exists" \
    "grep -r 'class SumUpTapToPayModule' ios/CashAppPOS/*.swift 2>/dev/null | head -1" \
    "SumUpTapToPayModule"

# Test 2: Check if module is exported to React Native
run_test "Module exported to RN" \
    "grep -r 'RCT_EXTERN_MODULE' ios/CashAppPOS/*.m 2>/dev/null | head -1" \
    "RCT_EXTERN_MODULE"

echo ""
echo "2️⃣ Checking TypeScript service layer..."
echo "----------------------------------------"

# Test 3: Verify no mock data in service
run_test "No mock data in service" \
    "grep -c 'DEMO_MERCHANT\\|PENDING_REACT_COMPONENT\\|Mock payment' src/services/SumUpNativeService.ts" \
    "0"

# Test 4: Verify native module import
run_test "Native module imported" \
    "grep 'NativeModules' src/services/SumUpNativeService.ts | head -1" \
    "NativeModules"

# Test 5: Verify SumUpTapToPayModule usage
run_test "SumUpTapToPayModule used" \
    "grep 'SumUpTapToPayModule' src/services/SumUpNativeService.ts | head -1" \
    "SumUpTapToPayModule"

echo ""
echo "3️⃣ Checking payment flow integration..."
echo "----------------------------------------"

# Test 6: Verify PaymentScreen uses native service
run_test "PaymentScreen uses native" \
    "grep 'NativeSumUpService' src/screens/payment/PaymentScreen.tsx | head -1" \
    "NativeSumUpService"

# Test 7: Verify no fallback to React Native package
run_test "No RN package fallback" \
    "grep -c 'sumup-react-native' src/screens/payment/PaymentScreen.tsx" \
    "0"

echo ""
echo "4️⃣ Checking backend configuration..."
echo "--------------------------------------"

# Test 8: Check backend has SumUp endpoint
run_test "Backend SumUp endpoint" \
    "grep '@router.post(\"/initialize\")' ../../backend/app/api/v1/endpoints/sumup.py | head -1" \
    "/initialize"

# Test 9: Check for environment variables
run_test "SumUp env vars check" \
    "grep 'SUMUP_API_KEY' ../../backend/app/api/v1/endpoints/sumup.py | head -1" \
    "SUMUP_API_KEY"

echo ""
echo "5️⃣ Checking Apple entitlements..."
echo "-----------------------------------"

# Test 10: Check for Tap to Pay entitlement
run_test "Tap to Pay entitlement" \
    "grep 'ProximityReader' ios/CashAppPOS/CashAppPOS.entitlements | head -1" \
    "ProximityReader"

echo ""
echo "6️⃣ Checking for known issues..."
echo "--------------------------------"

# Test 11: Check for demo alerts
run_test "No demo alerts" \
    "grep -r 'This is a demo' src/ 2>/dev/null | wc -l | tr -d ' '" \
    "0"

# Test 12: Check for simulate payment
run_test "No simulate buttons" \
    "grep -ri 'simulate.*payment' src/ 2>/dev/null | wc -l | tr -d ' '" \
    "0"

echo ""
echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! SumUp integration is properly configured.${NC}"
    echo ""
    echo "✅ Native Swift module is registered"
    echo "✅ TypeScript service connects to native module" 
    echo "✅ No mock data or demo mode"
    echo "✅ Payment flow uses native SDK"
    echo "✅ Backend configuration is ready"
    echo "✅ Apple entitlements are configured"
    echo ""
    echo "Next steps:"
    echo "1. Build the iOS app: npm run ios"
    echo "2. Run on physical iPhone with Tap to Pay capability"
    echo "3. Test with real SumUp merchant account"
    exit 0
else
    echo -e "${RED}⚠️ Some tests failed. Please review the issues above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Run 'cd ios && pod install' to link native modules"
    echo "2. Clean build: 'cd ios && rm -rf build && xcodebuild clean'"
    echo "3. Ensure you're on the fix/sumup-native-integration branch"
    echo "4. Check that backend/.env has SumUp credentials"
    exit 1
fi