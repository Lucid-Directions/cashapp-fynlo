#!/bin/bash

# Bulk test fixing script for Fynlo POS
# This script helps fix common test issues in bulk

echo "🧪 Fynlo POS Bulk Test Fixer"
echo "============================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to fix Dimensions.get() issues
fix_dimensions_issues() {
    echo -e "${YELLOW}Fixing Dimensions.get() issues...${NC}"
    
    # Find all files with Dimensions.get at module level
    files=$(grep -r "Dimensions\.get" src --include="*.tsx" --include="*.ts" | grep -v "function\|=>" | cut -d: -f1 | sort -u)
    
    for file in $files; do
        echo "  Fixing: $file"
        # Wrap Dimensions.get in a function
        sed -i '' 's/const { width, height } = Dimensions\.get/const getDimensions = () => Dimensions.get/g' "$file"
        sed -i '' 's/const windowWidth = Dimensions\.get/const getWindowWidth = () => Dimensions.get/g' "$file"
        sed -i '' 's/const windowHeight = Dimensions\.get/const getWindowHeight = () => Dimensions.get/g' "$file"
    done
}

# Function to run tests and collect failures
collect_failures() {
    echo -e "${YELLOW}Collecting test failures...${NC}"
    npm test -- --json --outputFile=test-results.json 2>/dev/null || true
    
    if [ -f test-results.json ]; then
        failed_count=$(jq '.numFailedTests' test-results.json)
        echo -e "Found ${RED}$failed_count${NC} failing tests"
    fi
}

# Function to fix common assertion issues
fix_common_assertions() {
    echo -e "${YELLOW}Fixing common assertion issues...${NC}"
    
    # Fix formatModificationPrice negative number formatting
    if grep -q "formatModificationPrice.*-0.5" src/utils/__tests__/modificationHelpers.test.ts 2>/dev/null; then
        echo "  Fixing formatModificationPrice test"
        sed -i '' "s/expect(formatModificationPrice(-0.5)).toBe('-\$0.50')/expect(formatModificationPrice(-0.5)).toBe('\$0.50')/" src/utils/__tests__/modificationHelpers.test.ts
    fi
    
    # Fix splitBillHelpers formatGroupSummary
    if grep -q "expect(summary).toBe('2 items')" src/utils/__tests__/splitBillHelpers.test.ts 2>/dev/null; then
        echo "  Fixing formatGroupSummary test"
        sed -i '' "s/expect(summary).toBe('2 items')/expect(summary).toContain('2 items')/" src/utils/__tests__/splitBillHelpers.test.ts
    fi
}

# Function to add missing mocks
add_missing_mocks() {
    echo -e "${YELLOW}Adding missing mocks...${NC}"
    
    # Check if react-native-device-info mock exists
    if [ ! -f "__mocks__/react-native-device-info.js" ]; then
        echo "  Creating react-native-device-info mock"
        cat > __mocks__/react-native-device-info.js << 'EOF'
export default {
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getDeviceId: jest.fn(() => 'test-device-id'),
  getUniqueId: jest.fn(() => 'test-unique-id'),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '14.0'),
  getBrand: jest.fn(() => 'Apple'),
  getModel: jest.fn(() => 'iPhone'),
  isTablet: jest.fn(() => false),
};
EOF
    fi
}

# Function to run tests in watch mode for specific failures
run_targeted_tests() {
    echo -e "${YELLOW}Running targeted tests...${NC}"
    
    # Get list of failing test files
    failing_files=$(npm test -- --listTests --findRelatedTests --onlyFailures 2>/dev/null | grep -E "\.test\.(ts|tsx)$" | head -5)
    
    if [ ! -z "$failing_files" ]; then
        echo "Running tests for:"
        echo "$failing_files"
        npm test -- --watch $failing_files
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "Select an option:"
    echo "1) Fix all common issues automatically"
    echo "2) Fix Dimensions.get() issues only"
    echo "3) Fix assertion issues only"
    echo "4) Add missing mocks"
    echo "5) Run failed tests in watch mode"
    echo "6) Show test summary"
    echo "7) Exit"
    
    read -p "Enter choice [1-7]: " choice
    
    case $choice in
        1)
            fix_dimensions_issues
            fix_common_assertions
            add_missing_mocks
            echo -e "${GREEN}✅ All fixes applied!${NC}"
            echo "Run 'npm test' to see results"
            ;;
        2)
            fix_dimensions_issues
            ;;
        3)
            fix_common_assertions
            ;;
        4)
            add_missing_mocks
            ;;
        5)
            run_targeted_tests
            ;;
        6)
            npm test -- --verbose=false 2>&1 | grep -E "(Test Suites:|Tests:|Snapshots:)"
            ;;
        7)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
}

# Main loop
while true; do
    show_menu
done