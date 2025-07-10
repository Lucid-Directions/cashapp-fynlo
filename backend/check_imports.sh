#!/bin/bash

echo "🔍 Checking Python imports in backend..."

# Find all Python files and check for common import issues
echo "Checking for incorrect import paths..."

# Check for imports from auth endpoints that should be from core
incorrect_auth_imports=$(grep -r "from app.api.v1.endpoints.auth import" app/ --include="*.py" | grep -v "router")
if [ ! -z "$incorrect_auth_imports" ]; then
    echo "❌ Found incorrect auth imports:"
    echo "$incorrect_auth_imports"
fi

# Check for missing Session imports where used
echo "Checking for Session usage without imports..."
for file in $(find app/ -name "*.py"); do
    if grep -q "Session\s*=" "$file" || grep -q ": Session" "$file"; then
        if ! grep -q "from sqlalchemy.orm import.*Session" "$file" && ! grep -q "from sqlalchemy.orm import Session" "$file"; then
            echo "❌ Missing Session import in: $file"
        fi
    fi
done

# Check for missing User imports where used
echo "Checking for User usage without imports..."
for file in $(find app/ -name "*.py"); do
    # Look for User as a type annotation, excluding comments, strings, and docstrings
    # Check for patterns like ": User" or "User =" but not in quotes or after #
    if grep -E "^[^#\"']*:\s*User(\s|,|\)|$)" "$file" | grep -v "UserInfo" | grep -v "UserResponse" | grep -v "UserPermissions" | grep -q .; then
        if ! grep -q "from app.core.database import.*User" "$file" && ! grep -q "from app.core.database import User" "$file"; then
            echo "❌ Missing User import in: $file"
        fi
    fi
    # Also check for User as a standalone reference (e.g., User.query)
    if grep -E "^[^#\"']*\bUser\." "$file" | grep -q .; then
        if ! grep -q "from app.core.database import.*User" "$file" && ! grep -q "from app.core.database import User" "$file"; then
            echo "❌ Missing User import in: $file"
        fi
    fi
done

echo "✅ Import check complete"