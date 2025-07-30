#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Auto-fixing Lint Issues..."
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the project root directory${NC}"
    exit 1
fi

# Run Prettier to fix formatting
echo -e "\n${YELLOW}💅 Running Prettier formatter...${NC}"
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json}"
echo -e "${GREEN}✅ Prettier formatting complete${NC}"

# Run ESLint with fix flag
echo -e "\n${YELLOW}🔧 Running ESLint auto-fix...${NC}"
npx eslint src --ext .js,.jsx,.ts,.tsx --fix
echo -e "${GREEN}✅ ESLint auto-fix complete${NC}"

# Run final check to see remaining issues
echo -e "\n${BLUE}📊 Checking remaining issues...${NC}"
echo "======================================"

# Count remaining ESLint errors
ESLINT_ERRORS=$(npx eslint src --ext .js,.jsx,.ts,.tsx --format compact | grep -E "^/.+" | wc -l | tr -d ' ')

# Count remaining Prettier issues
PRETTIER_ERRORS=$(npx prettier --check "src/**/*.{js,jsx,ts,tsx,json}" 2>&1 | grep -c "Code style issues" || echo "0")

# TypeScript errors (can't be auto-fixed)
echo -e "\n${YELLOW}TypeScript errors (must be fixed manually):${NC}"
npx tsc --noEmit --pretty false | head -20

echo -e "\n======================================"
echo "Summary after auto-fix:"
echo "======================================"

if [ "$ESLINT_ERRORS" -eq 0 ] && [ "$PRETTIER_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ All auto-fixable issues resolved!${NC}"
else
    echo -e "${YELLOW}⚠️  Remaining issues that need manual fixes:${NC}"
    echo "   - ESLint errors: $ESLINT_ERRORS"
    echo "   - Prettier issues: $PRETTIER_ERRORS"
    echo -e "\n${BLUE}Run './scripts/lint.sh' to see detailed errors${NC}"
fi