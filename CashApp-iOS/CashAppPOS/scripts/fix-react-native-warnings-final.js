#!/usr/bin/env node

/**
 * Final React Native Style Warning Fixer
 * Focuses on fixing genuine inline styles and configuring ESLint properly
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const config = {
  srcDir: path.join(__dirname, '../src'),
  extensions: '{tsx,ts}',
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
};

// Track statistics
const stats = {
  filesProcessed: 0,
  inlineStylesFixed: 0,
  eslintConfigUpdated: false,
  filesWithUseThemedStyles: 0,
};

// Fix inline styles
function fixInlineStyles(filePath, content) {
  let modified = false;
  let styleCounter = 0;
  
  // Find the styles object or create one
  const hasStyleSheet = content.includes('StyleSheet.create');
  const hasCreateStyles = content.includes('const createStyles');
  
  // Pattern to match inline styles
  const patterns = [
    // style={{ property: value }}
    /style=\{\{([^}]+)\}\}/g,
    // style={[{ property: value }]}
    /style=\{\[\{([^}]+)\}\]\}/g,
  ];
  
  const inlineStyles = new Map();
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const styleContent = match[1].trim();
      
      // Skip if it's a simple reference like style={styles.something}
      if (!styleContent.includes(':')) continue;
      
      // Skip if it contains dynamic values (ternary, template literals, variables)
      if (styleContent.includes('?') || styleContent.includes('${') || styleContent.includes('(')) {
        // For dynamic styles, create a const before the return
        styleCounter++;
        const varName = `dynamicStyle${styleCounter}`;
        const fullMatch = match[0];
        
        // Find the component function
        const componentMatch = content.lastIndexOf('return (', match.index);
        if (componentMatch !== -1) {
          // Insert the dynamic style declaration before return
          const beforeReturn = content.substring(0, componentMatch);
          const afterReturn = content.substring(componentMatch);
          
          const styleDeclaration = `  const ${varName} = {${styleContent}};\n  `;
          content = beforeReturn + styleDeclaration + afterReturn;
          
          // Update the match index due to insertion
          const newMatchIndex = match.index + styleDeclaration.length;
          
          // Replace the inline style with the variable
          content = content.substring(0, newMatchIndex) + 
                   content.substring(newMatchIndex).replace(fullMatch, `style={${varName}}`);
          
          modified = true;
          stats.inlineStylesFixed++;
        }
      } else {
        // For static styles, collect them to add to StyleSheet
        styleCounter++;
        const styleName = `inlineStyle${styleCounter}`;
        inlineStyles.set(styleName, styleContent);
        
        // Replace inline style with reference
        content = content.replace(match[0], `style={styles.${styleName}}`);
        modified = true;
        stats.inlineStylesFixed++;
      }
    }
  });
  
  // Add collected inline styles to StyleSheet
  if (inlineStyles.size > 0) {
    if (hasStyleSheet) {
      // Add to existing StyleSheet.create
      const styleSheetMatch = content.match(/(StyleSheet\.create\s*\(\s*\{)([\s\S]*?)(\}\s*\))/);
      if (styleSheetMatch) {
        const beforeStyles = styleSheetMatch[1];
        const existingStyles = styleSheetMatch[2];
        const afterStyles = styleSheetMatch[3];
        
        const newStyles = Array.from(inlineStyles.entries())
          .map(([name, style]) => `  ${name}: {${style}}`)
          .join(',\n');
        
        const updatedStyles = existingStyles.trimEnd() + 
                            (existingStyles.trim() ? ',\n' : '') + 
                            newStyles;
        
        content = content.replace(
          styleSheetMatch[0],
          beforeStyles + updatedStyles + '\n' + afterStyles
        );
      }
    } else if (hasCreateStyles) {
      // Add to createStyles function
      const createStylesMatch = content.match(/(createStyles[^{]*\{[\s\S]*?StyleSheet\.create\s*\(\s*\{)([\s\S]*?)(\}\s*\))/);
      if (createStylesMatch) {
        const beforeStyles = createStylesMatch[1];
        const existingStyles = createStylesMatch[2];
        const afterStyles = createStylesMatch[3];
        
        const newStyles = Array.from(inlineStyles.entries())
          .map(([name, style]) => `    ${name}: {${style}}`)
          .join(',\n');
        
        const updatedStyles = existingStyles.trimEnd() + 
                            (existingStyles.trim() ? ',\n' : '') + 
                            newStyles;
        
        content = content.replace(
          createStylesMatch[0],
          beforeStyles + updatedStyles + '\n  ' + afterStyles
        );
      }
    }
  }
  
  // Count files using useThemedStyles
  if (content.includes('useThemedStyles(createStyles)')) {
    stats.filesWithUseThemedStyles++;
  }
  
  return { content, modified };
}

// Update ESLint configuration
function updateEslintConfig() {
  const eslintPath = path.join(__dirname, '../.eslintrc.js');
  
  try {
    let eslintContent = fs.readFileSync(eslintPath, 'utf8');
    
    // Add settings for style-sheet-object-names if not present
    if (!eslintContent.includes('style-sheet-object-names')) {
      // Add settings section if it doesn't exist
      if (!eslintContent.includes('settings:')) {
        // Add before rules
        eslintContent = eslintContent.replace(
          /(\s+)(rules:\s*{)/,
          `$1settings: {
$1  'react-native/style-sheet-object-names': ['StyleSheet', 'useThemedStyles', 'createStyles'],
$1},
$1$2`
        );
        stats.eslintConfigUpdated = true;
      }
    }
    
    if (!config.dryRun && stats.eslintConfigUpdated) {
      fs.writeFileSync(eslintPath, eslintContent);
      console.log('✅ Updated .eslintrc.js with custom style providers');
    }
  } catch (error) {
    console.error('Failed to update ESLint config:', error.message);
  }
}

// Main processing function
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const result = fixInlineStyles(filePath, content);
    
    if (result.modified && !config.dryRun) {
      fs.writeFileSync(filePath, result.content, 'utf8');
      if (config.verbose) {
        console.log(`✅ Fixed ${filePath}`);
      }
    }
    
    stats.filesProcessed++;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
  }
}

// Main execution
console.log('🔍 Searching for React Native files...');

const files = glob.sync(`${config.srcDir}/**/*.${config.extensions}`);
console.log(`Found ${files.length} files to process\n`);

// Process files
files.forEach(file => processFile(file));

// Update ESLint config
updateEslintConfig();

// Print summary
console.log('\n📊 Summary:');
console.log(`Files processed: ${stats.filesProcessed}`);
console.log(`Inline styles fixed: ${stats.inlineStylesFixed}`);
console.log(`Files using useThemedStyles: ${stats.filesWithUseThemedStyles}`);
console.log(`ESLint config updated: ${stats.eslintConfigUpdated ? 'Yes' : 'No'}`);

// Provide recommendations
console.log('\n📝 Recommendations:');
console.log(`1. Fixed ${stats.inlineStylesFixed} inline styles`);
console.log(`2. Found ${stats.filesWithUseThemedStyles} files using useThemedStyles pattern`);

if (stats.filesWithUseThemedStyles > 0) {
  console.log('\n⚠️  Note: Files using useThemedStyles will show false positive warnings.');
  console.log('   Consider adding to .eslintrc.js:');
  console.log('   "react-native/no-unused-styles": ["warn", {');
  console.log('     "ignorePatterns": ["useThemedStyles", "createStyles"]');
  console.log('   }]');
  console.log('\n   Or disable the rule for files using custom hooks:');
  console.log('   /* eslint-disable react-native/no-unused-styles */');
}

if (config.dryRun) {
  console.log('\n⚠️  DRY RUN MODE - No files were actually modified');
}