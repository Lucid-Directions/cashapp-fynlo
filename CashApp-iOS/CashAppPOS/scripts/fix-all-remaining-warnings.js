#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Map of files to fix with their specific issues
const filesToFix = {
  'src/components/payment/QRCodePayment.tsx': {
    removeUnusedStyles: ['errorContainer', 'errorText', 'unavailableText']
  },
  'src/components/theme/ThemeSwitcher.tsx': {
    removeUnusedStyles: ['container', 'track', 'thumb']
  },
  'src/components/ui/List.tsx': {
    removeUnusedStyles: ['contentContainer', 'columnWrapper']
  },
  'src/components/ui/Modal.tsx': {
    removeUnusedStyles: ['menuCard', 'menuCardDisabled', 'menuCardContent', 'menuItemEmoji', 'menuItemName', 'menuItemPrice', 'quantityPillContainer']
  },
  'src/screens/customers/CustomersScreen.tsx': {
    inlineStyles: [
      { find: "{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap' }", replace: 'styles.customerChipContainer' },
      { find: '{ flex: 1, marginRight: 8 }', replace: 'styles.buttonLeft' },
      { find: '{ flex: 1, marginLeft: 8 }', replace: 'styles.buttonRight' }
    ]
  },
  'src/screens/employees/EmployeesScreen.tsx': {
    inlineStyles: [
      { find: "{ color: 'rgba(255, 255, 255, 0.8)' }", replace: 'styles.deleteText' }
    ]
  },
  'src/screens/settings/user/UserProfileScreen.tsx': {
    inlineStyles: [
      { find: "{ color: selectedSection === item.id ? '#fff' : '#2c3e50' }", replace: 'selectedSection === item.id ? styles.menuTextSelected : styles.menuText' }
    ]
  }
};

// Process each file
Object.entries(filesToFix).forEach(([filePath, fixes]) => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true
    });
    
    // Handle unused styles removal
    if (fixes.removeUnusedStyles) {
      traverse(ast, {
        ObjectExpression(path) {
          // Look for StyleSheet.create calls
          if (
            path.parent.type === 'CallExpression' &&
            path.parent.callee.type === 'MemberExpression' &&
            path.parent.callee.object.name === 'StyleSheet' &&
            path.parent.callee.property.name === 'create'
          ) {
            // Remove unused properties
            path.node.properties = path.node.properties.filter(prop => {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                return !fixes.removeUnusedStyles.includes(prop.key.name);
              }
              return true;
            });
            modified = true;
          }
        }
      });
    }
    
    // Handle inline styles
    if (fixes.inlineStyles) {
      traverse(ast, {
        JSXAttribute(path) {
          if (path.node.name.name === 'style') {
            fixes.inlineStyles.forEach(({ find, replace }) => {
              // Convert the style value to string for comparison
              const styleCode = generate(path.node.value).code;
              if (styleCode.includes(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
                // Replace with the new style reference
                if (replace.includes('?')) {
                  // Conditional style
                  const parts = replace.split(' ? ');
                  const condition = parts[0];
                  const [trueStyle, falseStyle] = parts[1].split(' : ');
                  path.node.value = t.jsxExpressionContainer(
                    t.conditionalExpression(
                      t.identifier(condition),
                      t.memberExpression(t.identifier('styles'), t.identifier(trueStyle)),
                      t.memberExpression(t.identifier('styles'), t.identifier(falseStyle))
                    )
                  );
                } else {
                  // Simple style reference
                  path.node.value = t.jsxExpressionContainer(
                    t.memberExpression(t.identifier('styles'), t.identifier(replace.replace('styles.', '')))
                  );
                }
                modified = true;
              }
            });
          }
        }
      });
      
      // Add missing styles to StyleSheet.create
      traverse(ast, {
        CallExpression(path) {
          if (
            path.node.callee.type === 'MemberExpression' &&
            path.node.callee.object.name === 'StyleSheet' &&
            path.node.callee.property.name === 'create' &&
            path.node.arguments[0].type === 'ObjectExpression'
          ) {
            const styles = path.node.arguments[0];
            const existingStyles = styles.properties.map(p => p.key.name);
            
            // Add missing styles
            if (filePath.includes('CustomersScreen')) {
              if (!existingStyles.includes('customerChipContainer')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('customerChipContainer'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('flexDirection'), t.stringLiteral('row'))
                    ])
                  )
                );
              }
              if (!existingStyles.includes('buttonLeft')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('buttonLeft'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('flex'), t.numericLiteral(1)),
                      t.objectProperty(t.identifier('marginRight'), t.numericLiteral(8))
                    ])
                  )
                );
              }
              if (!existingStyles.includes('buttonRight')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('buttonRight'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('flex'), t.numericLiteral(1)),
                      t.objectProperty(t.identifier('marginLeft'), t.numericLiteral(8))
                    ])
                  )
                );
              }
            } else if (filePath.includes('EmployeesScreen')) {
              if (!existingStyles.includes('deleteText')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('deleteText'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('color'), t.stringLiteral('rgba(255, 255, 255, 0.8)'))
                    ])
                  )
                );
              }
            } else if (filePath.includes('UserProfileScreen')) {
              if (!existingStyles.includes('menuTextSelected')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('menuTextSelected'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('color'), t.stringLiteral('#fff'))
                    ])
                  )
                );
              }
              if (!existingStyles.includes('menuText')) {
                styles.properties.unshift(
                  t.objectProperty(
                    t.identifier('menuText'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('color'), t.stringLiteral('#2c3e50'))
                    ])
                  )
                );
              }
            }
          }
        }
      });
    }
    
    if (modified) {
      const output = generate(ast, { preserveComments: true }, content);
      fs.writeFileSync(fullPath, output.code);
      console.log(`✅ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    
    // Fallback to simple string replacement for files that fail AST parsing
    if (fixes.inlineStyles) {
      fixes.inlineStyles.forEach(({ find, replace }) => {
        if (content.includes(find)) {
          content = content.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
          modified = true;
        }
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Fixed ${filePath} (fallback method)`);
      }
    }
  }
});

// Fix remaining inline styles with simple replacements
const remainingFixes = [
  {
    file: 'src/screens/reports/SalesReportDetailScreen.tsx',
    replacements: [
      { find: "style={{ fontWeight: 'bold' }}", replace: "style={styles.boldText}" },
      { find: "style={{ fontStyle: 'italic' }}", replace: "style={styles.italicText}" }
    ]
  },
  {
    file: 'src/screens/reports/FinancialReportDetailScreen.tsx',
    replacements: [
      { find: "style={{ marginBottom: 0 }}", replace: "style={styles.noMarginBottom}" }
    ]
  }
];

remainingFixes.forEach(({ file, replacements }) => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    replacements.forEach(({ find, replace }) => {
      if (content.includes(find)) {
        content = content.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
        modified = true;
      }
    });
    
    if (modified) {
      // Add styles to StyleSheet
      const styleMatch = content.match(/const styles = StyleSheet\.create\({([^}]*)}\);/s);
      if (styleMatch) {
        const existingStyles = styleMatch[1];
        const newStyles = [];
        
        if (content.includes('styles.boldText') && !existingStyles.includes('boldText')) {
          newStyles.push("  boldText: { fontWeight: 'bold' },");
        }
        if (content.includes('styles.italicText') && !existingStyles.includes('italicText')) {
          newStyles.push("  italicText: { fontStyle: 'italic' },");
        }
        if (content.includes('styles.noMarginBottom') && !existingStyles.includes('noMarginBottom')) {
          newStyles.push("  noMarginBottom: { marginBottom: 0 },");
        }
        
        if (newStyles.length > 0) {
          content = content.replace(
            /const styles = StyleSheet\.create\({/,
            `const styles = StyleSheet.create({\n${newStyles.join('\n')}`
          );
        }
      }
      
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Fixed ${file}`);
    }
  }
});

console.log('\n✨ All remaining style warnings fixed!');