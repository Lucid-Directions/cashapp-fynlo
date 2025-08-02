#!/bin/bash
# Comprehensive PR #459 Conflict Resolution Script
# Uses all available tools including Trivy

set -e
echo "🚀 PR #459 Conflict Resolution Process"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
WORK_DIR="pr459-resolution"
PR_BRANCH="cleanup/100-percent-code-quality"
MAIN_BRANCH="main"

# Create work directory
mkdir -p $WORK_DIR

# Function to analyze conflicts
analyze_conflicts() {
    echo -e "\n${BLUE}📊 Analyzing Conflicts${NC}"
    echo "------------------------"
    
    # Get conflict statistics
    CONFLICTS=$(git diff --name-only --diff-filter=U | wc -l)
    echo -e "Total conflicts: ${RED}$CONFLICTS${NC}"
    
    # Categorize conflicts
    echo -e "\n${YELLOW}Conflicts by type:${NC}"
    git diff --name-only --diff-filter=U | while read file; do
        case "$file" in
            */endpoints/*.py) echo "  API Endpoint: $file" ;;
            */core/*.py) echo "  Core Module: $file" ;;
            */services/*.py) echo "  Service: $file" ;;
            */tests/*.py) echo "  Test: $file" ;;
            *) echo "  Other: $file" ;;
        esac
    done > $WORK_DIR/conflicts_categorized.txt
    
    # Show summary
    echo "  API Endpoints: $(grep -c "API Endpoint:" $WORK_DIR/conflicts_categorized.txt || echo 0)"
    echo "  Core Modules: $(grep -c "Core Module:" $WORK_DIR/conflicts_categorized.txt || echo 0)"
    echo "  Services: $(grep -c "Service:" $WORK_DIR/conflicts_categorized.txt || echo 0)"
    echo "  Tests: $(grep -c "Test:" $WORK_DIR/conflicts_categorized.txt || echo 0)"
}

# Function to resolve a single file
resolve_file() {
    local file=$1
    local strategy=$2
    
    echo -e "\n${BLUE}Resolving: $file${NC}"
    
    case $strategy in
        "ryan")
            # Take Ryan's version
            git checkout --theirs "$file"
            echo "  ✓ Using Ryan's version"
            ;;
        "main")
            # Take main version
            git checkout --ours "$file"
            echo "  ✓ Using main version"
            ;;
        "merge")
            # Manual merge needed
            echo "  ⚠️  Manual merge required"
            # Open in editor if available
            if command -v code &> /dev/null; then
                code "$file"
            fi
            ;;
    esac
    
    # Validate syntax after resolution
    if [[ $file == *.py ]]; then
        if python3 -m py_compile "$file" 2>/dev/null; then
            echo -e "  ${GREEN}✓ Syntax valid${NC}"
        else
            echo -e "  ${RED}✗ Syntax error!${NC}"
            return 1
        fi
    fi
}

# Function to run security scan
run_security_scan() {
    echo -e "\n${BLUE}🔒 Running Security Scans${NC}"
    echo "-------------------------"
    
    # Trivy scan
    if command -v trivy &> /dev/null; then
        echo "Running Trivy vulnerability scan..."
        trivy fs --scanners vuln backend/ --format table > $WORK_DIR/trivy_report.txt
        
        # Check for critical vulnerabilities
        CRITICAL=$(grep -c "CRITICAL" $WORK_DIR/trivy_report.txt || echo 0)
        HIGH=$(grep -c "HIGH" $WORK_DIR/trivy_report.txt || echo 0)
        
        echo -e "  Critical vulnerabilities: ${RED}$CRITICAL${NC}"
        echo -e "  High vulnerabilities: ${YELLOW}$HIGH${NC}"
        
        # Also generate JSON report for detailed analysis
        trivy fs --scanners vuln backend/ --format json --output $WORK_DIR/trivy_report.json
    else
        echo -e "  ${YELLOW}⚠️  Trivy not found, skipping vulnerability scan${NC}"
    fi
    
    # Check for hardcoded secrets
    echo -e "\nChecking for hardcoded secrets..."
    grep -r "SECRET_KEY.*=.*\"" backend/ --include="*.py" | grep -v "__pycache__" > $WORK_DIR/secrets_found.txt || true
    
    if [ -s $WORK_DIR/secrets_found.txt ]; then
        echo -e "  ${RED}✗ Hardcoded secrets found:${NC}"
        cat $WORK_DIR/secrets_found.txt
    else
        echo -e "  ${GREEN}✓ No hardcoded secrets found${NC}"
    fi
}

# Function to validate resolution
validate_resolution() {
    echo -e "\n${BLUE}✅ Validating Resolution${NC}"
    echo "------------------------"
    
    # Check for remaining conflicts
    if git diff --check; then
        echo -e "  ${GREEN}✓ No conflict markers${NC}"
    else
        echo -e "  ${RED}✗ Conflict markers still present!${NC}"
        return 1
    fi
    
    # Python syntax check
    echo "Running Python syntax validation..."
    find backend -name "*.py" -exec python3 -m py_compile {} \; 2>&1 | tee $WORK_DIR/syntax_check.log
    SYNTAX_ERRORS=$(grep -c "SyntaxError" $WORK_DIR/syntax_check.log || echo 0)
    
    if [ "$SYNTAX_ERRORS" -eq 0 ]; then
        echo -e "  ${GREEN}✓ All Python files valid${NC}"
    else
        echo -e "  ${RED}✗ $SYNTAX_ERRORS syntax errors found${NC}"
    fi
    
    # Import analysis
    echo "Analyzing imports..."
    if command -v ruff &> /dev/null; then
        ruff check backend/ --select F401 --format concise > $WORK_DIR/unused_imports.txt 2>&1 || true
        UNUSED=$(wc -l < $WORK_DIR/unused_imports.txt)
        echo -e "  Unused imports: ${YELLOW}$UNUSED${NC}"
    fi
}

# Main resolution process
main() {
    # Step 1: Setup
    echo -e "${BLUE}Step 1: Setup${NC}"
    git fetch origin
    
    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    echo "Current branch: $CURRENT_BRANCH"
    
    # Step 2: Analyze current state
    if [ "$1" == "analyze" ]; then
        analyze_conflicts
        run_security_scan
        exit 0
    fi
    
    # Step 3: Start resolution
    if [ "$1" == "resolve" ]; then
        echo -e "\n${BLUE}Starting conflict resolution...${NC}"
        
        # Create resolution branch
        git checkout -b fix/pr459-resolution-$(date +%Y%m%d-%H%M%S)
        
        # Attempt merge
        echo "Attempting merge..."
        git merge origin/$PR_BRANCH --no-commit --no-ff || true
        
        # Analyze conflicts
        analyze_conflicts
        
        # Resolve each file based on type
        git diff --name-only --diff-filter=U | while read file; do
            # Determine strategy
            if [[ $file == */endpoints/*.py ]]; then
                # For endpoints, generally keep Ryan's cleanup but add new endpoints
                resolve_file "$file" "merge"
            elif [[ $file == */core/exceptions.py ]]; then
                # For exceptions, use Ryan's FynloException
                resolve_file "$file" "ryan"
            elif [[ $file == */services/payment_factory.py ]]; then
                # For duplicates, need manual review
                resolve_file "$file" "merge"
            else
                # Default: try Ryan's version
                resolve_file "$file" "ryan"
            fi
        done
        
        # Validate
        validate_resolution
        run_security_scan
    fi
    
    # Step 4: Final report
    echo -e "\n${GREEN}📊 Resolution Summary${NC}"
    echo "===================="
    echo "Work directory: $WORK_DIR"
    echo "Reports generated:"
    echo "  - conflicts_categorized.txt"
    echo "  - trivy_report.txt/json"
    echo "  - syntax_check.log"
    echo "  - unused_imports.txt"
    echo "  - secrets_found.txt"
    
    # Show next steps
    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo "1. Review and fix any remaining conflicts manually"
    echo "2. Run: python3 scripts/pr459_fixer.py"
    echo "3. Run: pytest backend/"
    echo "4. Commit: git add -A && git commit"
    echo "5. Push: git push origin HEAD"
}

# Show usage if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 [analyze|resolve]"
    echo "  analyze - Analyze conflicts and security issues"
    echo "  resolve - Start conflict resolution process"
    exit 1
fi

# Run main function
main $1