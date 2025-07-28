#!/bin/bash

# Comprehensive Test Runner for CashApp POS
# This script runs all tests and generates a detailed report

echo "🧪 Starting Comprehensive App Testing..."
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test results directory
mkdir -p test-results

# Function to run tests with nice output
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Running $suite_name...${NC}"
    
    if $test_command > test-results/${suite_name// /-}.log 2>&1; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track failures
FAILED_TESTS=0

# 1. Run Unit Tests
run_test_suite "Unit Tests" "npm test -- --testPathPattern=ComprehensiveAppTest.tsx --verbose"
FAILED_TESTS=$((FAILED_TESTS + $?))

# 2. Run Lint Checks
run_test_suite "Lint Checks" "npm run lint"
FAILED_TESTS=$((FAILED_TESTS + $?))

# 3. TypeScript Type Checking
run_test_suite "TypeScript Check" "npx tsc --noEmit"
FAILED_TESTS=$((FAILED_TESTS + $?))

# 4. Check for Missing Dependencies
run_test_suite "Dependency Check" "npm ls"
FAILED_TESTS=$((FAILED_TESTS + $?))

# 5. Security Audit
echo -e "\n${YELLOW}Running Security Audit...${NC}"
npm audit --audit-level=high > test-results/security-audit.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ No high severity vulnerabilities${NC}"
else
    echo -e "${YELLOW}⚠ Security vulnerabilities found (see test-results/security-audit.log)${NC}"
fi

# Generate Test Report
echo -e "\n${YELLOW}Generating Test Report...${NC}"
cat > test-results/test-report.md << EOF
# Test Report - $(date)

## Summary
- Total Test Suites Run: 4
- Failed Test Suites: $FAILED_TESTS

## Test Results

### Unit Tests
\`\`\`
$(tail -n 20 test-results/Unit-Tests.log || echo "No test output")
\`\`\`

### Lint Results
\`\`\`
$(tail -n 20 test-results/Lint-Checks.log || echo "No lint output")
\`\`\`

### TypeScript Check
\`\`\`
$(tail -n 20 test-results/TypeScript-Check.log || echo "No TypeScript output")
\`\`\`

### Security Audit
\`\`\`
$(cat test-results/security-audit.log || echo "No audit output")
\`\`\`

## Recommendations
EOF

# Add recommendations based on failures
if [ $FAILED_TESTS -gt 0 ]; then
    echo "- ❌ Fix failing tests before deployment" >> test-results/test-report.md
else
    echo "- ✅ All tests passing, safe to deploy" >> test-results/test-report.md
fi

# Final Summary
echo -e "\n======================================="
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ $FAILED_TESTS test suites failed${NC}"
    echo -e "Check test-results/ directory for details"
fi
echo "======================================="

# Open test report
echo -e "\n📊 Test report saved to: test-results/test-report.md"

exit $FAILED_TESTS