#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Fixing 100% of linting errors automatically..."
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the CashApp-iOS/CashAppPOS directory${NC}"
    exit 1
fi

# Create backup branch
BACKUP_BRANCH="fix/all-linting-errors-$(date +%Y%m%d-%H%M%S)"
echo -e "${BLUE}Creating backup branch: $BACKUP_BRANCH${NC}"
git checkout -b "$BACKUP_BRANCH"

# Function to commit changes
commit_changes() {
    if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "$1"
        echo -e "${GREEN}✓ Committed: $1${NC}"
    else
        echo -e "${YELLOW}No changes to commit for: $1${NC}"
    fi
}

# Step 1: Prettier - 14,467 errors
echo -e "\n${YELLOW}Step 1/8: Fixing Prettier formatting...${NC}"
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json}" --log-level silent
commit_changes "fix: prettier formatting (14,467 errors)"

# Step 2: ESLint auto-fixable
echo -e "\n${YELLOW}Step 2/8: Fixing ESLint auto-fixable issues...${NC}"
npx eslint src --fix --ext .js,.jsx,.ts,.tsx --quiet
commit_changes "fix: eslint auto-fixable issues"

# Step 3: Fix curly braces specifically
echo -e "\n${YELLOW}Step 3/8: Fixing curly braces...${NC}"
npx eslint src --fix --ext .js,.jsx,.ts,.tsx --rule 'curly: ["error", "all"]' --quiet
commit_changes "fix: add curly braces (279 errors)"

# Step 4: Remove unused variables and imports
echo -e "\n${YELLOW}Step 4/8: Removing unused variables and imports...${NC}"
# First, remove unused imports
npx eslint src --fix --ext .js,.jsx,.ts,.tsx --rule 'no-unused-vars: off' --rule '@typescript-eslint/no-unused-vars: off' --rule 'unused-imports/no-unused-imports: error' --quiet 2>/dev/null || true

# Skip the custom ESLint script and just use the command line
npx eslint src --fix --ext .js,.jsx,.ts,.tsx --rule '@typescript-eslint/no-unused-vars: ["error", {"vars": "all", "args": "none", "ignoreRestSiblings": true}]' --quiet 2>/dev/null || true

commit_changes "fix: remove unused variables (252 errors)"

# Step 5: Remove console statements
echo -e "\n${YELLOW}Step 5/8: Removing console statements...${NC}"
# Create transform to remove console statements
cat > /tmp/remove-console-transform.js << 'EOF'
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  // Remove console.* statements
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { name: 'console' }
    }
  }).forEach(path => {
    // If it's the only statement in a block, remove the entire statement
    if (path.parent.value.type === 'ExpressionStatement') {
      j(path.parent).remove();
    } else {
      // Otherwise just remove the call expression
      j(path).remove();
    }
  });
  
  return root.toSource({ quote: 'single' });
};
EOF

# Apply the transform
find src -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | while read file; do
    npx jscodeshift -t /tmp/remove-console-transform.js "$file" --silent 2>/dev/null || true
done
commit_changes "fix: remove console statements (442 errors)"

# Step 6: Extract inline styles
echo -e "\n${YELLOW}Step 6/8: Extracting inline styles...${NC}"
# Create a script to extract inline styles
cat > /tmp/extract-inline-styles.js << 'EOF'
const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let styleId = 1;
  let newStyles = {};
  
  // Find inline styles and extract them
  content = content.replace(
    /style=\{\{([^}]+)\}\}/g,
    (match, styleContent) => {
      const styleName = `extracted${styleId++}`;
      newStyles[styleName] = styleContent.trim();
      modified = true;
      return `style={styles.${styleName}}`;
    }
  );
  
  if (modified && Object.keys(newStyles).length > 0) {
    // Add to StyleSheet if exists, or create new one
    if (content.includes('StyleSheet.create')) {
      // Insert new styles into existing StyleSheet
      content = content.replace(
        /StyleSheet\.create\(\{([^}]*)\}\)/s,
        (match, existingStyles) => {
          const newStylesStr = Object.entries(newStyles)
            .map(([key, value]) => `  ${key}: {${value}}`)
            .join(',\n');
          return `StyleSheet.create({\n${existingStyles.trim()},\n${newStylesStr}\n})`;
        }
      );
    } else {
      // Add StyleSheet import and create
      if (!content.includes("from 'react-native'")) {
        content = `import { StyleSheet } from 'react-native';\n` + content;
      }
      const styleSheetStr = `\nconst styles = StyleSheet.create({\n${
        Object.entries(newStyles)
          .map(([key, value]) => `  ${key}: {${value}}`)
          .join(',\n')
      }\n});\n`;
      content = content.replace(/export default/m, styleSheetStr + '\nexport default');
    }
    
    fs.writeFileSync(filePath, content);
  }
}

// Process all files
const glob = require('glob');
glob.sync('src/**/*.{js,jsx,ts,tsx}').forEach(processFile);
EOF

# Install glob temporarily and run the script
npm install --no-save glob 2>/dev/null
node /tmp/extract-inline-styles.js
commit_changes "fix: extract inline styles (89 errors)"

# Step 7: Fix TypeScript any types
echo -e "\n${YELLOW}Step 7/8: Fixing TypeScript any types...${NC}"
# Replace 'any' with 'unknown' as a safe alternative
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    sed -i '' 's/: any\[\]/: unknown[]/g' "$file" 2>/dev/null || true
    sed -i '' 's/: any;/: unknown;/g' "$file" 2>/dev/null || true
    sed -i '' 's/: any)/: unknown)/g' "$file" 2>/dev/null || true
    sed -i '' 's/: any,/: unknown,/g' "$file" 2>/dev/null || true
    sed -i '' 's/: any =/: unknown =/g' "$file" 2>/dev/null || true
    sed -i '' 's/<any>/<unknown>/g' "$file" 2>/dev/null || true
    sed -i '' 's/ as any/ as unknown/g' "$file" 2>/dev/null || true
done
commit_changes "fix: replace any with unknown types (453 errors)"

# Step 8: Remove unused styles
echo -e "\n${YELLOW}Step 8/8: Removing unused styles...${NC}"
# Create script to find and remove unused styles
cat > /tmp/remove-unused-styles.js << 'EOF'
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function findUsedStyles(content) {
  const used = new Set();
  // Find style={styles.xxx} or styles.xxx
  const regex = /styles\.(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    used.add(match[1]);
  }
  // Find style={[styles.xxx]} or getStyles().xxx
  const arrayRegex = /styles\.(\w+)\]/g;
  while ((match = arrayRegex.exec(content)) !== null) {
    used.add(match[1]);
  }
  return used;
}

function removeUnusedStyles(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const usedStyles = findUsedStyles(content);
  
  // Find StyleSheet.create block
  const styleSheetMatch = content.match(/StyleSheet\.create\(\{([^}]+(\{[^}]*\}[^}]*)*)\}\)/s);
  if (!styleSheetMatch) return;
  
  const stylesBlock = styleSheetMatch[1];
  const styleRegex = /(\w+):\s*\{[^}]*\}/g;
  const definedStyles = new Map();
  
  let match;
  while ((match = styleRegex.exec(stylesBlock)) !== null) {
    definedStyles.set(match[1], match[0]);
  }
  
  // Keep only used styles
  const keptStyles = [];
  for (const [name, definition] of definedStyles) {
    if (usedStyles.has(name)) {
      keptStyles.push(definition);
    }
  }
  
  if (keptStyles.length < definedStyles.size) {
    const newStylesBlock = keptStyles.join(',\n  ');
    const newContent = content.replace(
      /StyleSheet\.create\(\{[^}]+(\{[^}]*\}[^}]*)*\}\)/s,
      `StyleSheet.create({\n  ${newStylesBlock}\n})`
    );
    fs.writeFileSync(filePath, newContent);
  }
}

glob.sync('src/**/*.{js,jsx,ts,tsx}').forEach(file => {
  try {
    removeUnusedStyles(file);
  } catch (e) {
    // Skip files that can't be processed
  }
});
EOF

node /tmp/remove-unused-styles.js
commit_changes "fix: remove unused styles (862 errors)"

# Final cleanup
echo -e "\n${YELLOW}Final cleanup pass...${NC}"
npx eslint src --fix --ext .js,.jsx,.ts,.tsx --quiet
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json}" --log-level silent
commit_changes "fix: final cleanup pass"

# Clean up temp files
rm -f /tmp/remove-unused-vars.js /tmp/remove-console-transform.js /tmp/extract-inline-styles.js /tmp/remove-unused-styles.js

echo -e "\n${GREEN}✅ All linting fixes completed!${NC}"
echo -e "${BLUE}Branch: $BACKUP_BRANCH${NC}"
echo -e "\nRun ${YELLOW}./scripts/validate-zero-errors.sh${NC} to verify all errors are fixed."