#!/usr/bin/env node

/**
 * Automated React Native Style Warning Fixer
 * Fixes all style warnings in bulk using AST transformations
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

// Configuration
const config = {
  srcDir: path.join(__dirname, '../src'),
  extensions: ['.tsx', '.ts'],
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
};

// Track statistics
const stats = {
  filesProcessed: 0,
  createStylesConverted: 0,
  inlineStylesFixed: 0,
  unusedStylesRemoved: 0,
  importsAdded: 0,
  errors: [],
};

// 1. Convert createStyles pattern to static StyleSheet
function convertCreateStylesPattern(ast, code) {
  let modified = false;
  const themeProperties = new Map();

  traverse(ast, {
    // Find createStyles functions
    VariableDeclarator(path) {
      if (
        path.node.id.name === 'createStyles' &&
        t.isArrowFunctionExpression(path.node.init) &&
        path.node.init.params.length === 1
      ) {
        const themeParam = path.node.init.params[0].name;
        const styleSheetCall = path.node.init.body;

        // Extract theme-dependent properties
        traverse(styleSheetCall, {
          MemberExpression(innerPath) {
            if (innerPath.node.object.name === themeParam) {
              const parent = innerPath.parent;
              if (t.isObjectProperty(parent)) {
                const styleName = parent.key.name;
                const propertyPath = generate(innerPath.node).code;
                
                if (!themeProperties.has(styleName)) {
                  themeProperties.set(styleName, []);
                }
                themeProperties.get(styleName).push({
                  key: parent.key.name,
                  value: propertyPath,
                });
              }
            }
          },
        }, {
          noScope: true,
        });

        // Convert to static StyleSheet
        path.node.id.name = 'styles';
        path.node.init = styleSheetCall.body;
        modified = true;
        stats.createStylesConverted++;
      }
    },

    // Update component to use useTheme hook
    FunctionDeclaration(path) {
      if (modified && themeProperties.size > 0) {
        // Add useTheme import if needed
        // Implementation depends on your theme provider
      }
    },
  });

  return { ast, modified, themeProperties };
}

// 2. Fix inline styles
function fixInlineStyles(ast, code) {
  let modified = false;
  const newStyles = {};
  let styleCounter = 0;

  traverse(ast, {
    JSXAttribute(path) {
      if (path.node.name.name === 'style') {
        const value = path.node.value;
        
        // Check for inline object expressions
        if (
          t.isJSXExpressionContainer(value) &&
          t.isObjectExpression(value.expression) &&
          value.expression.properties.length > 0
        ) {
          // Generate a unique style name
          const styleName = `style${++styleCounter}`;
          
          // Extract the style object
          const styleObject = value.expression;
          newStyles[styleName] = styleObject;
          
          // Replace with style reference
          path.node.value = t.jsxExpressionContainer(
            t.memberExpression(
              t.identifier('styles'),
              t.identifier(styleName)
            )
          );
          
          modified = true;
          stats.inlineStylesFixed++;
        }
      }
    },
  });

  // Add new styles to StyleSheet if any were found
  if (Object.keys(newStyles).length > 0) {
    traverse(ast, {
      CallExpression(path) {
        if (
          path.node.callee.object?.name === 'StyleSheet' &&
          path.node.callee.property?.name === 'create'
        ) {
          const styleObject = path.node.arguments[0];
          if (t.isObjectExpression(styleObject)) {
            // Add new styles
            Object.entries(newStyles).forEach(([name, style]) => {
              styleObject.properties.push(
                t.objectProperty(t.identifier(name), style)
              );
            });
          }
        }
      },
    });
  }

  return { ast, modified };
}

// 3. Remove unused styles
function removeUnusedStyles(ast, code) {
  let modified = false;
  const definedStyles = new Set();
  const usedStyles = new Set();

  // First pass: collect all defined styles
  traverse(ast, {
    CallExpression(path) {
      if (
        path.node.callee.object?.name === 'StyleSheet' &&
        path.node.callee.property?.name === 'create'
      ) {
        const styleObject = path.node.arguments[0];
        if (t.isObjectExpression(styleObject)) {
          styleObject.properties.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              definedStyles.add(prop.key.name);
            }
          });
        }
      }
    },
  });

  // Second pass: collect all used styles
  traverse(ast, {
    MemberExpression(path) {
      if (path.node.object.name === 'styles' && t.isIdentifier(path.node.property)) {
        usedStyles.add(path.node.property.name);
      }
    },
  });

  // Third pass: remove unused styles
  traverse(ast, {
    CallExpression(path) {
      if (
        path.node.callee.object?.name === 'StyleSheet' &&
        path.node.callee.property?.name === 'create'
      ) {
        const styleObject = path.node.arguments[0];
        if (t.isObjectExpression(styleObject)) {
          const originalLength = styleObject.properties.length;
          styleObject.properties = styleObject.properties.filter(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              return usedStyles.has(prop.key.name);
            }
            return true;
          });
          
          const removed = originalLength - styleObject.properties.length;
          if (removed > 0) {
            modified = true;
            stats.unusedStylesRemoved += removed;
          }
        }
      }
    },
  });

  return { ast, modified };
}

// 4. Add missing imports
function addMissingImports(ast, code) {
  let modified = false;
  let hasStyleSheet = false;
  let hasReactImport = false;

  // Check existing imports
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'react-native') {
        const specifiers = path.node.specifiers;
        hasStyleSheet = specifiers.some(spec => 
          t.isImportSpecifier(spec) && spec.imported.name === 'StyleSheet'
        );
      }
      if (path.node.source.value === 'react') {
        hasReactImport = true;
      }
    },
  });

  // Check if StyleSheet is used
  let needsStyleSheet = false;
  traverse(ast, {
    MemberExpression(path) {
      if (path.node.object.name === 'StyleSheet') {
        needsStyleSheet = true;
      }
    },
  });

  // Add StyleSheet import if needed
  if (needsStyleSheet && !hasStyleSheet) {
    traverse(ast, {
      Program(path) {
        const importDeclaration = t.importDeclaration(
          [t.importSpecifier(t.identifier('StyleSheet'), t.identifier('StyleSheet'))],
          t.stringLiteral('react-native')
        );
        
        // Find the right place to insert
        let insertIndex = 0;
        path.node.body.forEach((node, index) => {
          if (t.isImportDeclaration(node) && node.source.value === 'react-native') {
            // Add to existing react-native import
            node.specifiers.push(
              t.importSpecifier(t.identifier('StyleSheet'), t.identifier('StyleSheet'))
            );
            modified = true;
            stats.importsAdded++;
            return;
          }
          if (t.isImportDeclaration(node)) {
            insertIndex = index + 1;
          }
        });
        
        // If no react-native import exists, add new one
        if (!modified) {
          path.node.body.splice(insertIndex, 0, importDeclaration);
          modified = true;
          stats.importsAdded++;
        }
      },
    });
  }

  return { ast, modified };
}

// Process a single file
function processFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Parse the file
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    let modified = false;

    // Apply transformations
    const step1 = convertCreateStylesPattern(ast, code);
    if (step1.modified) modified = true;

    const step2 = fixInlineStyles(step1.ast, code);
    if (step2.modified) modified = true;

    const step3 = removeUnusedStyles(step2.ast, code);
    if (step3.modified) modified = true;

    const step4 = addMissingImports(step3.ast, code);
    if (step4.modified) modified = true;

    // Generate new code if modified
    if (modified) {
      const output = generate(step4.ast, {
        retainLines: true,
        compact: false,
      });

      if (!config.dryRun) {
        fs.writeFileSync(filePath, output.code);
      }

      if (config.verbose) {
        console.log(`✅ Fixed: ${path.relative(config.srcDir, filePath)}`);
      }
    }

    stats.filesProcessed++;
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    if (config.verbose) {
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }
}

// Main execution
function main() {
  console.log('🔧 React Native Style Warning Fixer');
  console.log('===================================');
  
  if (config.dryRun) {
    console.log('🔍 Running in DRY RUN mode - no files will be modified');
  }

  // Find all TypeScript/TSX files
  const pattern = `${config.srcDir}/**/*.{ts,tsx}`;
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/__tests__/**', '**/*.test.*'],
  });

  console.log(`📁 Found ${files.length} files to process`);

  // Process each file
  files.forEach(file => processFile(file));

  // Print statistics
  console.log('\n📊 Results:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`CreateStyles patterns converted: ${stats.createStylesConverted}`);
  console.log(`Inline styles fixed: ${stats.inlineStylesFixed}`);
  console.log(`Unused styles removed: ${stats.unusedStylesRemoved}`);
  console.log(`Imports added: ${stats.importsAdded}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }

  console.log('\n✨ Done!');
}

// Run the script
main();