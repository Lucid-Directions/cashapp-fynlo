#!/bin/bash

echo "📊 Analyzing Test Failures by Category"
echo "====================================="
echo ""

# Run tests and capture output
echo "Running tests (this may take a moment)..."
TEST_OUTPUT=$(npm test -- --verbose=false 2>&1)

# Extract summary
echo "$TEST_OUTPUT" | grep -E "Test Suites:|Tests:" | tail -2

echo ""
echo "🔍 Categorizing Failures..."
echo "==========================="
echo ""

# Category 1: Provider/Render Issues
echo "1️⃣ PROVIDER/RENDER ISSUES:"
echo "$TEST_OUTPUT" | grep -E "Cannot read.*useTheme|Cannot read.*useNavigation|ThemeProvider|NavigationContainer|No QueryClient|could not find react-redux" | head -10 | sed 's/^/   /'
PROVIDER_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "Cannot read.*useTheme|Cannot read.*useNavigation|ThemeProvider|NavigationContainer|No QueryClient|could not find react-redux")
echo "   Total: $PROVIDER_COUNT failures"
echo ""

# Category 2: Async/Promise Issues
echo "2️⃣ ASYNC/PROMISE ISSUES:"
echo "$TEST_OUTPUT" | grep -E "Cannot read.*then|Promise rejected|Timeout.*Async|async.*callback|await.*expression" | head -10 | sed 's/^/   /'
ASYNC_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "Cannot read.*then|Promise rejected|Timeout.*Async|async.*callback|await.*expression")
echo "   Total: $ASYNC_COUNT failures"
echo ""

# Category 3: Mock Issues
echo "3️⃣ MOCK ISSUES:"
echo "$TEST_OUTPUT" | grep -E "Cannot read.*mock|mockReturnValue|jest\.fn|mock.*not.*function|Cannot spy" | head -10 | sed 's/^/   /'
MOCK_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "Cannot read.*mock|mockReturnValue|jest\.fn|mock.*not.*function|Cannot spy")
echo "   Total: $MOCK_COUNT failures"
echo ""

# Category 4: Import/Module Issues
echo "4️⃣ IMPORT/MODULE ISSUES:"
echo "$TEST_OUTPUT" | grep -E "Cannot find module|Module not found|Unable to resolve|export.*not found" | head -10 | sed 's/^/   /'
IMPORT_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "Cannot find module|Module not found|Unable to resolve|export.*not found")
echo "   Total: $IMPORT_COUNT failures"
echo ""

# Category 5: WebSocket/Network Issues
echo "5️⃣ WEBSOCKET/NETWORK ISSUES:"
echo "$TEST_OUTPUT" | grep -E "CloseEvent|MessageEvent|WebSocket|NetInfo|network.*timeout" | head -10 | sed 's/^/   /'
WS_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "CloseEvent|MessageEvent|WebSocket|NetInfo|network.*timeout")
echo "   Total: $WS_COUNT failures"
echo ""

# Category 6: Timing/Performance Issues
echo "6️⃣ TIMING/PERFORMANCE ISSUES:"
echo "$TEST_OUTPUT" | grep -E "toBeLessThan|performance|renderTime|updateTime|Expected.*less than" | head -10 | sed 's/^/   /'
PERF_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "toBeLessThan|performance|renderTime|updateTime|Expected.*less than")
echo "   Total: $PERF_COUNT failures"
echo ""

# List failing test files
echo "📁 FAILING TEST FILES:"
echo "====================="
echo "$TEST_OUTPUT" | grep "FAIL " | sort | uniq | sed 's/^/   /'
echo ""

# Recommendations
echo "💡 RECOMMENDATIONS:"
echo "=================="
TOTAL_ISSUES=$((PROVIDER_COUNT + ASYNC_COUNT + MOCK_COUNT + IMPORT_COUNT + WS_COUNT + PERF_COUNT))

if [ $PROVIDER_COUNT -gt 10 ]; then
  echo "   🔧 High number of provider issues - run: ./scripts/fix-provider-tests.sh"
fi

if [ $ASYNC_COUNT -gt 10 ]; then
  echo "   🔧 High number of async issues - run: ./scripts/fix-async-tests.sh"
fi

if [ $MOCK_COUNT -gt 10 ]; then
  echo "   🔧 High number of mock issues - check __mocks__ directory setup"
fi

echo ""
echo "   📈 Total categorized issues: $TOTAL_ISSUES"
echo "   🎯 Run ./scripts/batch-fix-remaining-tests.sh to fix common patterns"
echo ""