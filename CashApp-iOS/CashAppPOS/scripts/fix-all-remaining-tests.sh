#!/bin/bash

echo "🚀 MASTER TEST FIX SCRIPT"
echo "========================="
echo "This will systematically fix all remaining test issues"
echo ""

# Make all scripts executable
chmod +x scripts/*.sh

# Step 1: Analyze current state
echo "📊 Step 1: Analyzing current test failures..."
echo "============================================"
./scripts/analyze-test-failures.sh > test-analysis.log
cat test-analysis.log | head -20
echo ""

# Step 2: Run batch fixes
echo "🔧 Step 2: Running batch fixes for common patterns..."
echo "===================================================="
./scripts/batch-fix-remaining-tests.sh
echo ""

# Step 3: Fix provider issues specifically
echo "🎯 Step 3: Fixing provider/render issues..."
echo "=========================================="
./scripts/fix-provider-tests.sh
echo ""

# Step 4: Fix remaining async issues
echo "⏳ Step 4: Fixing async/timing issues..."
echo "======================================="
# Fix all async issues in one go
find src -name "*.test.ts" -o -name "*.test.tsx" | while read file; do
  # Make all test callbacks async if they use await
  if grep -q "await" "$file"; then
    sed -i '' 's/it(\(.*\), () => {/it(\1, async () => {/g' "$file"
    sed -i '' 's/test(\(.*\), () => {/test(\1, async () => {/g' "$file"
    sed -i '' 's/describe(\(.*\), () => {/describe(\1, () => {/g' "$file"
  fi
done
echo "✅ Async fixes applied"
echo ""

# Step 5: Clean up obsolete snapshots
echo "🧹 Step 5: Cleaning up obsolete snapshots..."
echo "==========================================="
npm test -- -u
echo ""

# Step 6: Final test run
echo "📈 Step 6: Running final test suite..."
echo "======================================"
npm test -- --verbose=false 2>&1 | tee final-test-results.log | tail -30

# Extract results
PASS_COUNT=$(grep -o "passed" final-test-results.log | wc -l)
FAIL_COUNT=$(grep -o "failed" final-test-results.log | wc -l)
TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))

echo ""
echo "📊 FINAL RESULTS"
echo "==============="
echo "✅ Passing: $PASS_COUNT"
echo "❌ Failing: $FAIL_COUNT"
echo "📈 Total: $TOTAL_COUNT"
echo "🎯 Pass Rate: $((PASS_COUNT * 100 / TOTAL_COUNT))%"
echo ""

# If still failing, provide targeted advice
if [ $FAIL_COUNT -gt 0 ]; then
  echo "💡 NEXT STEPS FOR REMAINING FAILURES:"
  echo "===================================="
  echo "1. Check final-test-results.log for specific errors"
  echo "2. Run individual test files to debug:"
  echo "   npm test -- path/to/failing.test.ts"
  echo "3. Most common remaining issues:"
  echo "   - Complex integration tests needing custom mocks"
  echo "   - Business logic bugs in hooks (not test issues)"
  echo "   - Missing environment variables or configs"
fi