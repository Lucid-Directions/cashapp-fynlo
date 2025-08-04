#!/usr/bin/env ts-node

/**
 * Powerful Style Warning Transformer using jscodeshift
 * Fixes React Native style warnings in bulk
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { execSync } from 'child_process';

interface TransformStats {
  filesProcessed: number;
  createStylesFixed: number;
  inlineStylesFixed: number;
  unusedStylesRemoved: number;
  importsAdded: number;
  errors: string[];
}

const stats: TransformStats = {
  filesProcessed: 0,
  createStylesFixed: 0,
  inlineStylesFixed: 0,
  unusedStylesRemoved: 0,
  importsAdded: 0,
  errors: [],
};

// Transform functions as jscodeshift codemods
const transforms = {
  // 1. Convert createStyles(theme) to static StyleSheet
  createStylesTransform: `
    module.exports = function(fileInfo, api) {
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      let hasChanges = false;
      
      // Find createStyles pattern
      root.find(j.VariableDeclarator, {
        id: { name: 'createStyles' },
        init: { type: 'ArrowFunctionExpression' }
      }).forEach(path => {
        const func = path.value.init;
        if (func.params.length === 1 && func.params[0].name === 'theme') {
          // Convert to static styles
          path.value.id.name = 'styles';
          path.value.init = func.body.arguments[0];
          hasChanges = true;
          
          // TODO: Track theme usage for manual conversion
        }
      });
      
      return hasChanges ? root.toSource() : null;
    };
  `,

  // 2. Convert inline styles to StyleSheet
  inlineStylesTransform: `
    module.exports = function(fileInfo, api) {
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      let hasChanges = false;
      let styleCounter = 0;
      const newStyles = {};
      
      // Find inline styles
      root.find(j.JSXAttribute, { name: { name: 'style' } })
        .filter(path => {
          const value = path.value.value;
          return value && value.type === 'JSXExpressionContainer' &&
                 value.expression.type === 'ObjectExpression';
        })
        .forEach(path => {
          const styleObj = path.value.value.expression;
          const styleName = \`inlineStyle\${++styleCounter}\`;
          
          // Store the style
          newStyles[styleName] = styleObj;
          
          // Replace with reference
          path.value.value = j.jsxExpressionContainer(
            j.memberExpression(
              j.identifier('styles'),
              j.identifier(styleName)
            )
          );
          hasChanges = true;
        });
      
      // Add new styles to StyleSheet
      if (Object.keys(newStyles).length > 0) {
        root.find(j.CallExpression, {
          callee: {
            object: { name: 'StyleSheet' },
            property: { name: 'create' }
          }
        }).forEach(path => {
          const arg = path.value.arguments[0];
          if (arg.type === 'ObjectExpression') {
            Object.entries(newStyles).forEach(([name, style]) => {
              arg.properties.push(
                j.property('init', j.identifier(name), style)
              );
            });
          }
        });
      }
      
      return hasChanges ? root.toSource() : null;
    };
  `,

  // 3. Remove unused styles
  unusedStylesTransform: `
    module.exports = function(fileInfo, api) {
      const j = api.jscodeshift;
      const root = j(fileInfo.source);
      let hasChanges = false;
      
      // Collect defined styles
      const definedStyles = new Set();
      root.find(j.CallExpression, {
        callee: {
          object: { name: 'StyleSheet' },
          property: { name: 'create' }
        }
      }).forEach(path => {
        const arg = path.value.arguments[0];
        if (arg.type === 'ObjectExpression') {
          arg.properties.forEach(prop => {
            if (prop.key.type === 'Identifier') {
              definedStyles.add(prop.key.name);
            }
          });
        }
      });
      
      // Collect used styles
      const usedStyles = new Set();
      root.find(j.MemberExpression, {
        object: { name: 'styles' }
      }).forEach(path => {
        if (path.value.property.type === 'Identifier') {
          usedStyles.add(path.value.property.name);
        }
      });
      
      // Remove unused styles
      root.find(j.CallExpression, {
        callee: {
          object: { name: 'StyleSheet' },
          property: { name: 'create' }
        }
      }).forEach(path => {
        const arg = path.value.arguments[0];
        if (arg.type === 'ObjectExpression') {
          const originalLength = arg.properties.length;
          arg.properties = arg.properties.filter(prop => {
            return prop.key.type !== 'Identifier' || 
                   usedStyles.has(prop.key.name);
          });
          if (arg.properties.length < originalLength) {
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? root.toSource() : null;
    };
  `,
};

// Helper to run jscodeshift transform
function runTransform(files: string[], transformCode: string, transformName: string) {
  // Write transform to temp file
  const tempFile = `/tmp/transform-${Date.now()}.js`;
  fs.writeFileSync(tempFile, transformCode);
  
  try {
    // Run jscodeshift
    const result = execSync(
      `npx jscodeshift -t ${tempFile} ${files.join(' ')} --parser=tsx`,
      { encoding: 'utf8' }
    );
    
    // Parse results
    const lines = result.split('\\n');
    const statsLine = lines.find(line => line.includes('Results:'));
    if (statsLine) {
      console.log(`  ${transformName}: ${statsLine}`);
    }
  } catch (error) {
    stats.errors.push(`${transformName} failed: ${error.message}`);
  } finally {
    // Clean up
    fs.unlinkSync(tempFile);
  }
}

// Main bulk fix function
async function bulkFixStyles() {
  console.log('🚀 React Native Style Warning Bulk Fixer');
  console.log('=======================================\\n');
  
  // Find all TypeScript/TSX files
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/__tests__/**'],
  });
  
  console.log(`📁 Found ${files.length} files to process\\n`);
  
  // Count initial warnings
  try {
    const initialWarnings = execSync(
      'npm run lint 2>&1 | grep -E "(no-inline-styles|no-unused-styles)" | wc -l',
      { encoding: 'utf8' }
    ).trim();
    console.log(`📊 Initial warnings: ${initialWarnings}\\n`);
  } catch (error) {
    console.log('Could not count initial warnings\\n');
  }
  
  // Run transforms in sequence
  console.log('🔧 Running transformations...\\n');
  
  console.log('1️⃣ Converting createStyles patterns...');
  runTransform(files, transforms.createStylesTransform, 'createStyles');
  
  console.log('\\n2️⃣ Converting inline styles...');
  runTransform(files, transforms.inlineStylesTransform, 'inlineStyles');
  
  console.log('\\n3️⃣ Removing unused styles...');
  runTransform(files, transforms.unusedStylesTransform, 'unusedStyles');
  
  // Add missing imports using simple script
  console.log('\\n4️⃣ Adding missing imports...');
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('StyleSheet.create') && !content.includes("import.*StyleSheet.*from 'react-native'")) {
      let newContent = content;
      
      if (content.includes("from 'react-native'")) {
        // Add to existing import
        newContent = content.replace(
          /import {([^}]+)} from 'react-native'/,
          "import {$1, StyleSheet} from 'react-native'"
        );
      } else {
        // Add new import
        newContent = content.replace(
          /import React/,
          "import React from 'react';\\nimport { StyleSheet } from 'react-native'"
        );
      }
      
      if (newContent !== content) {
        fs.writeFileSync(file, newContent);
        stats.importsAdded++;
      }
    }
  });
  
  // Count final warnings
  try {
    const finalWarnings = execSync(
      'npm run lint 2>&1 | grep -E "(no-inline-styles|no-unused-styles)" | wc -l',
      { encoding: 'utf8' }
    ).trim();
    console.log(`\\n📊 Final warnings: ${finalWarnings}`);
  } catch (error) {
    console.log('\\nCould not count final warnings');
  }
  
  // Print summary
  console.log('\\n✨ Bulk fix complete!');
  console.log('\\n📈 Summary:');
  console.log(`  Files processed: ${files.length}`);
  console.log(`  Imports added: ${stats.importsAdded}`);
  
  if (stats.errors.length > 0) {
    console.log(`\\n⚠️  Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
}

// Run the bulk fixer
bulkFixStyles().catch(console.error);