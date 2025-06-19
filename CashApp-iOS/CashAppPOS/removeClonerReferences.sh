#!/bin/bash

# Remove all Clover references and replace with Fynlo branding
# This is critical to avoid revealing research source

echo "🔒 Removing all Clover references from codebase..."

# Replace Clover POS Color Scheme comments
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover POS Color Scheme/\/\/ Fynlo POS Color Scheme/g' {} \;

# Replace Clover POS Colors comments
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover POS Colors/\/\/ Fynlo POS Colors/g' {} \;

# Replace color comments
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover Green/\/\/ Fynlo Green/g' {} \;
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover Blue/\/\/ Fynlo Blue/g' {} \;
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover Blue Accent/\/\/ Fynlo Blue Accent/g' {} \;

# Replace specific references in design system
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Clover-style POS theme/\/\/ Fynlo POS theme/g' {} \;
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Color Palette - Clover POS Professional/\/\/ Color Palette - Fynlo POS Professional/g' {} \;
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\/\/ Main Clover Green/\/\/ Main Fynlo Green/g' {} \;

# Replace Clover hardware references
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' "s/'Clover Mini'/'Fynlo Terminal'/g" {} \;

# Replace email addresses
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/manager@cloverpos\.com/manager@fynlo\.com/g' {} \;

# Replace any remaining cloverpos references
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/cloverpos/fynlo/g' {} \;

# Replace Clover header comments
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/{\/\* Clover Header \*\/}/{\/\* Fynlo Header \*\/}/g' {} \;

# Replace any remaining Clover references that might be standalone
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/Clover/Fynlo/g' {} \;

echo "✅ All Clover references replaced with Fynlo"

# Verify no Clover references remain
echo ""
echo "🔍 Checking for any remaining Clover references..."
REMAINING=$(grep -r "Clover\|clover" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | wc -l)

if [ $REMAINING -eq 0 ]; then
    echo "✅ SUCCESS: No Clover references found"
else
    echo "⚠️  WARNING: $REMAINING Clover references still found:"
    grep -r "Clover\|clover" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
fi

echo ""
echo "🎯 Branding update complete - all references now use Fynlo"