#!/bin/bash

# Bulk Style Warning Fixer for React Native
# Uses jscodeshift and other tools for mass transformations

echo "🚀 React Native Bulk Style Warning Fixer"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SRC_DIR="./src"
DRY_RUN=${1:-"--dry-run"}

# Check if we're in the right directory
if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}Error: src directory not found. Run this from CashApp-iOS/CashAppPOS${NC}"
    exit 1
fi

# Function to count current warnings
count_warnings() {
    npm run lint 2>&1 | grep -E "(no-inline-styles|no-unused-styles)" | wc -l
}

echo "📊 Current style warnings: $(count_warnings)"

# 1. Fix createStyles pattern using sed
echo -e "\n${YELLOW}Phase 1: Converting createStyles patterns...${NC}"
find $SRC_DIR -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "createStyles.*theme" "$file"; then
        echo "  Fixing: $file"
        if [ "$DRY_RUN" != "--dry-run" ]; then
            # Backup original
            cp "$file" "$file.bak"
            
            # Convert createStyles to styles
            sed -i '' 's/const createStyles = (theme[^)]*) => StyleSheet.create/const styles = StyleSheet.create/g' "$file"
            
            # Mark files that need manual theme conversion
            if grep -q "theme\." "$file"; then
                echo "    ⚠️  Needs manual theme conversion"
                echo "$file" >> files-need-theme-conversion.txt
            fi
        fi
    fi
done

# 2. Fix inline styles using a Node.js script
echo -e "\n${YELLOW}Phase 2: Converting inline styles...${NC}"
cat > /tmp/fix-inline-styles.js << 'EOF'
const fs = require('fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');

// Match inline style={{ ... }} patterns
const inlineStyleRegex = /style=\{\{([^}]+)\}\}/g;
let newContent = content;
let styleCounter = 0;
const newStyles = [];

newContent = newContent.replace(inlineStyleRegex, (match, styleContent) => {
    styleCounter++;
    const styleName = `dynamicStyle${styleCounter}`;
    newStyles.push(`  ${styleName}: {${styleContent}},`);
    return `style={styles.${styleName}}`;
});

// If we found inline styles, add them to StyleSheet
if (newStyles.length > 0 && newContent.includes('StyleSheet.create')) {
    // Find the StyleSheet.create call and add new styles
    newContent = newContent.replace(
        /const styles = StyleSheet\.create\(\{([^}]+)\}\);/s,
        (match, existingStyles) => {
            return `const styles = StyleSheet.create({\n${existingStyles},\n${newStyles.join('\n')}\n});`;
        }
    );
    fs.writeFileSync(file, newContent);
    console.log(`Fixed ${newStyles.length} inline styles in ${file}`);
}
EOF

find $SRC_DIR -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q 'style={{' "$file"; then
        if [ "$DRY_RUN" != "--dry-run" ]; then
            node /tmp/fix-inline-styles.js "$file"
        else
            echo "  Would fix: $file"
        fi
    fi
done

# 3. Remove unused styles
echo -e "\n${YELLOW}Phase 3: Removing unused styles...${NC}"
cat > /tmp/remove-unused-styles.js << 'EOF'
const fs = require('fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');

// Extract all defined styles
const styleMatches = content.match(/(\w+):\s*\{[^}]+\}/g) || [];
const definedStyles = styleMatches.map(match => match.split(':')[0].trim());

// Find all used styles
const usedStyleRegex = /styles\.(\w+)/g;
const usedStyles = new Set();
let match;
while ((match = usedStyleRegex.exec(content)) !== null) {
    usedStyles.add(match[1]);
}

// Find unused styles
const unusedStyles = definedStyles.filter(style => !usedStyles.has(style));

if (unusedStyles.length > 0) {
    console.log(`Found ${unusedStyles.length} unused styles in ${file}: ${unusedStyles.join(', ')}`);
    
    // Remove unused styles
    let newContent = content;
    unusedStyles.forEach(style => {
        const regex = new RegExp(`\\s*${style}:\\s*\\{[^}]+\\},?`, 'g');
        newContent = newContent.replace(regex, '');
    });
    
    // Clean up trailing commas
    newContent = newContent.replace(/,(\s*\})/, '$1');
    
    fs.writeFileSync(file, newContent);
}
EOF

find $SRC_DIR -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q 'StyleSheet.create' "$file"; then
        if [ "$DRY_RUN" != "--dry-run" ]; then
            node /tmp/remove-unused-styles.js "$file"
        else
            echo "  Would check: $file"
        fi
    fi
done

# 4. Fix missing imports
echo -e "\n${YELLOW}Phase 4: Adding missing imports...${NC}"
find $SRC_DIR -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q 'StyleSheet.create' "$file"; then
        if ! grep -q "import.*StyleSheet.*from 'react-native'" "$file"; then
            echo "  Adding StyleSheet import to: $file"
            if [ "$DRY_RUN" != "--dry-run" ]; then
                # Check if there's already a react-native import
                if grep -q "from 'react-native'" "$file"; then
                    # Add StyleSheet to existing import
                    sed -i '' "s/import {\([^}]*\)} from 'react-native'/import {\1, StyleSheet} from 'react-native'/g" "$file"
                else
                    # Add new import after React import
                    sed -i '' "/import React/a\\
import { StyleSheet } from 'react-native';" "$file"
                fi
            fi
        fi
    fi
done

# 5. Fix undefined.styleName warnings
echo -e "\n${YELLOW}Phase 5: Fixing undefined style references...${NC}"
npm run lint 2>&1 | grep "undefined\." | grep -o "[^/]*\.tsx\?:[0-9]*" | sort -u | while read location; do
    file=$(echo $location | cut -d: -f1)
    line=$(echo $location | cut -d: -f2)
    
    if [ -f "$SRC_DIR/$file" ]; then
        echo "  Checking: $file:$line"
        # This would need more sophisticated fixing
    fi
done

# Clean up
rm -f /tmp/fix-inline-styles.js /tmp/remove-unused-styles.js

# Final report
echo -e "\n${GREEN}✅ Bulk fixing complete!${NC}"
if [ "$DRY_RUN" == "--dry-run" ]; then
    echo "This was a DRY RUN. To apply changes, run:"
    echo "  ./scripts/bulk-fix-styles.sh --apply"
else
    echo "📊 New style warnings count: $(count_warnings)"
    echo -e "\n${YELLOW}Files that need manual theme conversion:${NC}"
    if [ -f "files-need-theme-conversion.txt" ]; then
        cat files-need-theme-conversion.txt
    fi
fi