# PR #459 Conflict Resolution Plan

## 🚨 Current Situation
- PR #459 has **27 merge conflicts** with main
- We attempted resolution on branch `pr-459-conflict-resolution` 
- Syntax errors were introduced during conflict resolution
- We need a clean approach that preserves Ryan's work

## 🛠️ Additional Tools Available

### **Trivy** - Vulnerability Scanner
```bash
# Scan for vulnerabilities in Python dependencies
trivy fs --scanners vuln backend/

# Scan Docker images
trivy image fynlo-backend:latest

# Generate detailed report
trivy fs --format json --output trivy-report.json backend/
```

### **Tree-based Tools**
- `tree` command - Directory structure visualization
- `ast` module in Python - Abstract Syntax Tree parsing
- File tree analysis for finding patterns

## 📋 Revised Conflict Resolution Strategy

### Phase 1: Clean Slate Approach
```bash
# 1. Create fresh branch from main
git checkout main
git pull origin main
git checkout -b fix/pr459-clean-resolution

# 2. Cherry-pick Ryan's commits WITHOUT conflicts
git log origin/cleanup/100-percent-code-quality --oneline
# Identify non-conflicting commits

# 3. Apply changes file by file
git checkout origin/cleanup/100-percent-code-quality -- backend/app/services/non_conflicting_file.py
```

### Phase 2: Smart Conflict Resolution
```bash
# Create conflict analysis script
cat > analyze_conflicts.py << 'EOF'
#!/usr/bin/env python3
import subprocess
import json

def get_conflicts():
    """Get detailed conflict information"""
    # Get list of conflicting files
    result = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], 
                          capture_output=True, text=True)
    conflicts = result.stdout.strip().split('\n')
    
    conflict_data = []
    for file in conflicts:
        # Analyze each conflict
        data = {
            'file': file,
            'ryan_changes': get_changes(file, 'cleanup/100-percent-code-quality'),
            'main_changes': get_changes(file, 'main'),
            'conflict_type': determine_conflict_type(file)
        }
        conflict_data.append(data)
    
    return conflict_data

def get_changes(file, branch):
    """Get what changed in a file on a branch"""
    # Implementation here
    pass

def determine_conflict_type(file):
    """Determine if conflict is imports, exceptions, or other"""
    # Implementation here
    pass

# Generate conflict report
conflicts = get_conflicts()
with open('conflict_analysis.json', 'w') as f:
    json.dump(conflicts, f, indent=2)
EOF
```

### Phase 3: Pattern-Based Resolution
```bash
# For each conflict type, apply consistent resolution

# 1. Import conflicts - Keep Ryan's cleanup
git checkout --theirs backend/app/api/v1/endpoints/auth.py
# Then add back any NEW imports from main

# 2. Exception conflicts - Use FynloException
sed -i 's/HTTPException/FynloException/g' backend/app/**/*.py

# 3. Logging conflicts - Use logger
sed -i 's/print(/logger.info(/g' backend/app/**/*.py
```

### Phase 4: Incremental Testing
```bash
# Test each resolved file immediately
for file in $(git diff --name-only --cached); do
    echo "Testing $file..."
    python3 -m py_compile "$file" || echo "FAILED: $file" >> failed_files.txt
done
```

## 🔄 Automated Conflict Resolution Script

```bash
#!/bin/bash
# smart_merge.sh - Intelligently merge PR #459

# Step 1: Analyze conflicts
echo "🔍 Analyzing conflicts..."
git checkout origin/cleanup/100-percent-code-quality
git merge main --no-commit --no-ff || true

# Step 2: Categorize conflicts
git diff --name-only --diff-filter=U > conflicts.txt

# Step 3: Apply resolution strategies
while IFS= read -r file; do
    echo "Resolving: $file"
    
    # Determine resolution strategy based on file type
    case "$file" in
        */endpoints/*.py)
            # API endpoints - preserve new endpoints from main
            # Apply Ryan's patterns to new code
            ;;
        */core/*.py)
            # Core modules - careful merge needed
            ;;
        */services/*.py)
            # Services - check for duplicates
            ;;
    esac
done < conflicts.txt

# Step 4: Validate each resolution
python3 scripts/pr459_fixer.py --validate-only
```

## 🎯 Conflict Resolution Rules

### Rule 1: Preserve Ryan's Cleanup
- ✅ Keep all import removals (400+ cleaned up)
- ✅ Keep all print → logger conversions
- ✅ Keep HTTPException → FynloException migrations

### Rule 2: Integrate New Features
- ✅ Add any NEW endpoints from main
- ✅ Add any NEW imports that are actually used
- ✅ Apply Ryan's patterns to new code

### Rule 3: Security First
- 🔒 Run Trivy after resolution
- 🔒 Check for hardcoded secrets
- 🔒 Validate auth patterns

## 📊 Success Metrics

1. **All conflicts resolved**: `git status` shows no conflicts
2. **Syntax valid**: `python3 -m compileall backend/`
3. **Security clean**: `trivy fs backend/` shows no HIGH/CRITICAL
4. **Tests pass**: `pytest backend/` succeeds
5. **Ryan's work preserved**: 400+ imports still removed

## 🚀 Execution Plan

### Option A: Fresh Cherry-Pick
```bash
# Start fresh and cherry-pick good commits
git checkout main
git checkout -b fix/pr459-fresh
git cherry-pick <commit1> <commit2> ...
# Fix conflicts as they arise
```

### Option B: Patch-Based Approach
```bash
# Create patches for Ryan's changes
git format-patch main..origin/cleanup/100-percent-code-quality
# Apply patches selectively
git apply --check 0001-*.patch
git apply 0001-*.patch
```

### Option C: File-by-File Resolution
```bash
# Most controlled approach
for file in $(git diff --name-only main origin/cleanup/100-percent-code-quality); do
    echo "Processing $file"
    # Manually review and apply changes
done
```

## 🔧 Tools to Use

1. **Conflict Resolution**:
   - `git mergetool` with VS Code
   - `git checkout --theirs/--ours`
   - Custom Python scripts for patterns

2. **Validation**:
   - `trivy fs backend/` - Security scan
   - `python3 -m compileall` - Syntax check
   - `ruff check --fix` - Linting
   - `pytest` - Functional tests

3. **Analysis**:
   - `git diff --stat` - Change statistics
   - `tree backend/` - Directory structure
   - AST parsing for code analysis

The key is to be methodical and test after each conflict resolution!