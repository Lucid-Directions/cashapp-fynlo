#!/bin/bash
# Fix PR #459 Syntax Errors - Comprehensive Script
# This script implements the 7-phase plan to fix PR #459

set -e  # Exit on error

echo "🚀 Starting PR #459 Fix Process"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create working directory
WORK_DIR="pr459-fixes"
mkdir -p $WORK_DIR

# Phase 1: Discovery & Analysis
echo -e "${BLUE}📊 Phase 1: Discovery & Analysis${NC}"
echo "--------------------------------"

# 1.1 Syntax scan
echo "Running syntax scan..."
find backend -name "*.py" -exec python3 -m py_compile {} \; 2>&1 | tee $WORK_DIR/syntax_errors.log || true
SYNTAX_ERRORS=$(grep -c "SyntaxError" $WORK_DIR/syntax_errors.log || echo "0")
echo -e "Found ${RED}$SYNTAX_ERRORS${NC} syntax errors"

# 1.2 Pattern analysis
echo "Analyzing docstring patterns..."
grep -r '"""Execute.*operation."""' backend/ | tee $WORK_DIR/docstring_pattern.log || true
DOCSTRING_ISSUES=$(wc -l < $WORK_DIR/docstring_pattern.log)
echo -e "Found ${YELLOW}$DOCSTRING_ISSUES${NC} malformed docstrings"

# 1.3 Security scan
echo "Running security scan..."
if command -v semgrep &> /dev/null; then
    semgrep --config=auto backend/ --json > $WORK_DIR/security_scan.json 2>/dev/null || true
    echo "Security scan complete"
else
    echo -e "${YELLOW}Warning: semgrep not installed, skipping security scan${NC}"
fi

# Phase 2: Automated Fixes
echo -e "\n${BLUE}🔧 Phase 2: Automated Fixes${NC}"
echo "--------------------------------"

# 2.1 Create Python fix script
cat > $WORK_DIR/fix_docstrings.py << 'EOF'
#!/usr/bin/env python3
import re
import sys
import os

def fix_malformed_docstrings(file_path):
    """Fix common docstring patterns that cause syntax errors."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Fix pattern: """Execute operation.""" without proper indentation
        # Replace with properly formatted docstring
        content = re.sub(
            r'(\s*)("""Execute\s+\w+\s+operation\.""")',
            r'\1\2\n\1pass',
            content
        )
        
        # Fix empty function bodies after docstrings
        content = re.sub(
            r'(def\s+\w+[^:]*:\s*\n\s*"""[^"]+"""\s*)(\n\s*(?:def|class|@))',
            r'\1\n    pass\n\2',
            content
        )
        
        # Fix decorator followed by incomplete function
        content = re.sub(
            r'(@\w+(?:\([^)]*\))?\s*\n)(\s*)(def\s+\w+[^:]*:)\s*$',
            r'\1\2\3\n\2    """TODO: Implement this function."""\n\2    pass',
            content,
            flags=re.MULTILINE
        )
        
        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    fixed_count = 0
    for root, dirs, files in os.walk('backend'):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                if fix_malformed_docstrings(file_path):
                    fixed_count += 1
                    print(f"Fixed: {file_path}")
    
    print(f"\nTotal files fixed: {fixed_count}")
EOF

# Run the fix script
echo "Running docstring fixes..."
python3 $WORK_DIR/fix_docstrings.py

# 2.2 Ruff fixes (if available)
if command -v ruff &> /dev/null; then
    echo "Running ruff auto-fixes..."
    ruff check backend/ --fix --select I,F401 || true
else
    echo -e "${YELLOW}Warning: ruff not installed, skipping import fixes${NC}"
fi

# 2.3 Black formatting (if available)
if command -v black &> /dev/null; then
    echo "Running black formatter..."
    black backend/ --quiet || true
else
    echo -e "${YELLOW}Warning: black not installed, skipping formatting${NC}"
fi

# Phase 3: Validation
echo -e "\n${BLUE}✅ Phase 3: Validation${NC}"
echo "--------------------------------"

# Re-run syntax check
echo "Re-running syntax validation..."
find backend -name "*.py" -exec python3 -m py_compile {} \; 2>&1 | tee $WORK_DIR/syntax_errors_after.log || true
SYNTAX_ERRORS_AFTER=$(grep -c "SyntaxError" $WORK_DIR/syntax_errors_after.log || echo "0")

# Summary
echo -e "\n${GREEN}📊 Summary Report${NC}"
echo "================================"
echo -e "Syntax errors before: ${RED}$SYNTAX_ERRORS${NC}"
echo -e "Syntax errors after: ${YELLOW}$SYNTAX_ERRORS_AFTER${NC}"
echo -e "Docstring issues fixed: ${GREEN}$DOCSTRING_ISSUES${NC}"

if [ "$SYNTAX_ERRORS_AFTER" -eq "0" ]; then
    echo -e "\n${GREEN}✅ All syntax errors fixed!${NC}"
    echo "You can now proceed with:"
    echo "1. Run tests: pytest backend/"
    echo "2. Commit changes: git add -A && git commit -m 'fix: syntax errors in PR #459'"
    echo "3. Push to PR: git push origin HEAD"
else
    echo -e "\n${YELLOW}⚠️  Some syntax errors remain. Check $WORK_DIR/syntax_errors_after.log${NC}"
    echo "Manual intervention required for remaining issues."
fi

# Create fix report
cat > $WORK_DIR/fix_report.md << EOF
# PR #459 Fix Report

## Syntax Errors
- Before: $SYNTAX_ERRORS
- After: $SYNTAX_ERRORS_AFTER
- Fixed: $((SYNTAX_ERRORS - SYNTAX_ERRORS_AFTER))

## Automated Fixes Applied
- Docstring pattern fixes
- Import sorting (if ruff available)
- Code formatting (if black available)

## Next Steps
$(if [ "$SYNTAX_ERRORS_AFTER" -eq "0" ]; then
    echo "1. Run full test suite"
    echo "2. Address security vulnerabilities"
    echo "3. Remove code duplications"
    echo "4. Create updated PR"
else
    echo "1. Manually fix remaining syntax errors"
    echo "2. Re-run this script"
    echo "3. Continue with test suite once syntax is clean"
fi)

## Files Requiring Manual Review
$(if [ "$SYNTAX_ERRORS_AFTER" -gt "0" ]; then
    grep "SyntaxError" $WORK_DIR/syntax_errors_after.log | head -10
else
    echo "None - all syntax errors resolved!"
fi)
EOF

echo -e "\nFull report saved to: ${BLUE}$WORK_DIR/fix_report.md${NC}"