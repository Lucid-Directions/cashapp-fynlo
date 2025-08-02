#!/bin/bash
# Quick syntax check for all Python files in the backend
# Run this before committing to catch syntax errors

echo "🔍 Checking Python syntax in backend directory..."

# Find all Python files and check syntax
error_count=0
for file in $(find app -name "*.py" -type f); do
    if ! python3 -m py_compile "$file" 2>/dev/null; then
        echo "❌ Syntax error in: $file"
        python3 -m py_compile "$file" 2>&1 | grep -E "SyntaxError|line"
        ((error_count++))
    fi
done

if [ $error_count -eq 0 ]; then
    echo "✅ All Python files have valid syntax!"
    exit 0
else
    echo "❌ Found $error_count file(s) with syntax errors"
    echo "Please fix these errors before deploying"
    exit 1
fi