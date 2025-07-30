#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Validating linting fixes..."
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the CashApp-iOS/CashAppPOS directory${NC}"
    exit 1
fi

# Initialize counters
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

# Function to count issues
count_issues() {
    local count=$1
    local type=$2
    local tool=$3
    
    if [ "$count" -gt 0 ]; then
        echo -e "${RED}❌ $tool: $count $type${NC}"
        if [ "$type" = "errors" ]; then
            TOTAL_ERRORS=$((TOTAL_ERRORS + count))
        else
            TOTAL_WARNINGS=$((TOTAL_WARNINGS + count))
        fi
    else
        echo -e "${GREEN}✅ $tool: 0 $type${NC}"
    fi
}

# 1. ESLint Check
echo -e "\n${YELLOW}Checking ESLint...${NC}"
ESLINT_OUTPUT=$(npx eslint src --ext .js,.jsx,.ts,.tsx --format json 2>/dev/null)
ESLINT_ERRORS=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .errorCount] | add' 2>/dev/null || echo "0")
ESLINT_WARNINGS=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .warningCount] | add' 2>/dev/null || echo "0")

count_issues "$ESLINT_ERRORS" "errors" "ESLint"
count_issues "$ESLINT_WARNINGS" "warnings" "ESLint"

# Show top ESLint issues if any exist
if [ "$ESLINT_ERRORS" -gt 0 ] || [ "$ESLINT_WARNINGS" -gt 0 ]; then
    echo -e "${BLUE}Top ESLint issues:${NC}"
    echo "$ESLINT_OUTPUT" | jq -r '.[] | .messages[] | .ruleId' 2>/dev/null | sort | uniq -c | sort -nr | head -10
fi

# 2. Prettier Check
echo -e "\n${YELLOW}Checking Prettier...${NC}"
PRETTIER_OUTPUT=$(npx prettier --check "src/**/*.{js,jsx,ts,tsx,json}" 2>&1)
PRETTIER_ERRORS=0

if echo "$PRETTIER_OUTPUT" | grep -q "Code style issues found"; then
    PRETTIER_ERRORS=$(echo "$PRETTIER_OUTPUT" | grep -c "Code style issues found" || echo "1")
fi

count_issues "$PRETTIER_ERRORS" "errors" "Prettier"

# 3. TypeScript Check
echo -e "\n${YELLOW}Checking TypeScript...${NC}"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")

count_issues "$TSC_ERRORS" "errors" "TypeScript"

if [ "$TSC_ERRORS" -gt 0 ]; then
    echo -e "${BLUE}First 10 TypeScript errors:${NC}"
    echo "$TSC_OUTPUT" | grep "error TS" | head -10
fi

# 4. Test Suite Check
echo -e "\n${YELLOW}Running test suite...${NC}"
TEST_OUTPUT=$(npm test -- --passWithNoTests --silent 2>&1)
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passing${NC}"
else
    echo -e "${RED}❌ Test suite failed${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 5. Build Check
echo -e "\n${YELLOW}Checking if project builds...${NC}"
BUILD_OUTPUT=$(npm run build:ios 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ iOS build successful${NC}"
else
    echo -e "${RED}❌ iOS build failed${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# Summary
echo -e "\n=============================="
echo "VALIDATION SUMMARY"
echo "=============================="

if [ $TOTAL_ERRORS -eq 0 ] && [ $TOTAL_WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All checks passed!${NC}"
    echo -e "${GREEN}0 errors, 0 warnings${NC}"
    exit 0
else
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo -e "Total errors: ${RED}$TOTAL_ERRORS${NC}"
    echo -e "Total warnings: ${YELLOW}$TOTAL_WARNINGS${NC}"
    
    echo -e "\n${YELLOW}Next steps:${NC}"
    if [ $TOTAL_ERRORS -gt 0 ]; then
        echo "1. Review the errors above"
        echo "2. Run specific linters to see detailed errors"
        echo "3. Fix remaining issues manually if needed"
    else
        echo "1. Warnings don't block deployment but should be addressed"
        echo "2. Run './scripts/lint.sh' for detailed output"
    fi
    
    exit 1
fi