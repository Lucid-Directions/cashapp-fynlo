#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Running Comprehensive Lint Checks..."
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the project root directory${NC}"
    exit 1
fi

# JavaScript/TypeScript Linting
echo -e "\n${YELLOW}📝 Running ESLint...${NC}"
npx eslint src --ext .js,.jsx,.ts,.tsx --max-warnings 0
ESLINT_EXIT=$?

if [ $ESLINT_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ ESLint passed!${NC}"
else
    echo -e "${RED}❌ ESLint found issues${NC}"
fi

# Prettier Check
echo -e "\n${YELLOW}📝 Running Prettier check...${NC}"
npx prettier --check "src/**/*.{js,jsx,ts,tsx,json}"
PRETTIER_EXIT=$?

if [ $PRETTIER_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Prettier check passed!${NC}"
else
    echo -e "${RED}❌ Prettier found formatting issues${NC}"
    echo "Run 'npm run format' to fix automatically"
fi

# TypeScript Type Checking
echo -e "\n${YELLOW}📝 Running TypeScript compiler...${NC}"
npx tsc --noEmit
TSC_EXIT=$?

if [ $TSC_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript check passed!${NC}"
else
    echo -e "${RED}❌ TypeScript found type errors${NC}"
fi

# Summary
echo -e "\n======================================"
echo "Summary:"
echo "======================================"

TOTAL_EXIT=$((ESLINT_EXIT + PRETTIER_EXIT + TSC_EXIT))

if [ $TOTAL_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
    
    if [ $PRETTIER_EXIT -ne 0 ]; then
        echo -e "\n${YELLOW}TIP: Run 'npm run format' to auto-fix Prettier issues${NC}"
    fi
    
    exit 1
fi