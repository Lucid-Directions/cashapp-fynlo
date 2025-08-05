#!/usr/bin/env node

/**
 * Enhanced React Native Style Warning Fixer
 * Handles edge cases missed by the previous script
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
  createStylesFixed: 0,
  inlineStylesFixed: 0,
  unusedStylesRemoved: 0,
  errors: [],
};

// Pattern 1: Fix files that have createStyles but use styles.
function fixCreateStylesUsage(filePath, content) {
  let modified = false;
  
  // Check if file has createStyles pattern
  const createStylesMatch = content.match(/const\s+createStyles\s*=\s*\([^)]*\)\s*=>\s*StyleSheet\.create/);
  if (createStylesMatch) {
    // Check if component uses styles. instead of proper pattern
    const componentMatch = content.match(/const\s+(\w+)(?::\s*React\.FC(?:<[^>]+>)?)\s*=\s*\([^)]*\)\s*=>\s*{/);
    if (componentMatch) {
      const componentName = componentMatch[1];
      
      // Check if it's missing the styles initialization
      if (!content.includes('const styles = useThemedStyles(createStyles)') && 
          !content.includes('const styles = createStyles(theme)')) {
        
        // Find where to insert the styles initialization
        const useThemeMatch = content.match(/const\s*{\s*theme\s*}\s*=\s*useTheme\(\)/);
        if (useThemeMatch) {
          // Add after useTheme
          const insertPoint = content.indexOf(useThemeMatch[0]) + useThemeMatch[0].length;
          const beforeInsert = content.substring(0, insertPoint);
          const afterInsert = content.substring(insertPoint);
          
          // Check if useThemedStyles is imported
          if (content.includes('useThemedStyles')) {
            content = beforeInsert + ';\n  const styles = useThemedStyles(createStyles)' + afterInsert;
          } else {
            content = beforeInsert + ';\n  const styles = createStyles(theme)' + afterInsert;
          }
          modified = true;
          stats.createStylesFixed++;
        }
      }
    }
  }
  
  return { content, modified };
}

// Pattern 2: Fix inline styles with dynamic values
function fixComplexInlineStyles(filePath, content) {
  let modified = false;
  let styleCounter = 0;
  const dynamicStyles = [];
  
  // Find inline styles with template literals or conditional expressions
  const inlineStyleRegex = /style={({[^}]+})}/g;
  let match;
  
  while ((match = inlineStyleRegex.exec(content)) !== null) {
    const styleContent = match[1];
    
    // Check if it contains dynamic content
    if (styleContent.includes('?') || styleContent.includes('${') || styleContent.includes('flex')) {
      // Extract style to a variable
      const styleName = `dynamicStyle${++styleCounter}`;
      dynamicStyles.push({ name: styleName, content: styleContent });
      
      // Replace inline style with reference
      content = content.replace(match[0], `style={${styleName}}`);
      modified = true;
      stats.inlineStylesFixed++;
    }
  }
  
  // Add dynamic styles before the return statement
  if (dynamicStyles.length > 0) {
    const returnMatch = content.match(/(\s+)return\s*\(/);
    if (returnMatch) {
      const indent = returnMatch[1];
      const styleDeclarations = dynamicStyles
        .map(s => `${indent}const ${s.name} = ${s.content};`)
        .join('\n');
      
      content = content.replace(returnMatch[0], `\n${styleDeclarations}\n${returnMatch[0]}`);
    }
  }
  
  return { content, modified };
}

// Pattern 3: Remove genuinely unused styles
function removeUnusedStyles(filePath, content) {
  let modified = false;
  
  // Find all style definitions in StyleSheet.create
  const styleSheetMatch = content.match(/StyleSheet\.create\s*\(\s*{([^}]+)}\s*\)/s);
  if (styleSheetMatch) {
    const stylesContent = styleSheetMatch[1];
    const styleNames = [];
    
    // Extract style names
    const styleRegex = /(\w+)\s*:\s*{/g;
    let match;
    while ((match = styleRegex.exec(stylesContent)) !== null) {
      styleNames.push(match[1]);
    }
    
    // Check which styles are actually used
    const usedStyles = new Set();
    styleNames.forEach(styleName => {
      // Check various usage patterns
      const patterns = [
        `styles\\.${styleName}`,
        `styles\\['${styleName}'\\]`,
        `styles\\["${styleName}"\\]`,
        `\\[styles\\.${styleName}`,
        `{styles\\.${styleName}`,
        ` styles\\.${styleName}`,
      ];
      
      if (patterns.some(pattern => new RegExp(pattern).test(content))) {
        usedStyles.add(styleName);
      }
    });
    
    // Remove unused styles
    const unusedStyles = styleNames.filter(name => !usedStyles.has(name));
    if (unusedStyles.length > 0) {
      unusedStyles.forEach(styleName => {
        // Remove the style definition
        const styleDefRegex = new RegExp(`\\s*${styleName}\\s*:\\s*{[^}]*},?`, 'g');
        content = content.replace(styleDefRegex, '');
      });
      
      // Clean up trailing commas
      content = content.replace(/,(\s*})/, '$1');
      
      modified = true;
      stats.unusedStylesRemoved += unusedStyles.length;
    }
  }
  
  return { content, modified };
}

// Main processing function
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Apply fixes in order
    let result;
    
    result = fixCreateStylesUsage(filePath, content);
    if (result.modified) {
      content = result.content;
      modified = true;
    }
    
    result = fixComplexInlineStyles(filePath, content);
    if (result.modified) {
      content = result.content;
      modified = true;
    }
    
    result = removeUnusedStyles(filePath, content);
    if (result.modified) {
      content = result.content;
      modified = true;
    }
    
    // Write the file if modified
    if (modified && !config.dryRun) {
      fs.writeFileSync(filePath, content, 'utf8');
      if (config.verbose) {
        console.log(`✅ Fixed ${filePath}`);
      }
    }
    
    stats.filesProcessed++;
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
  }
}

// Main execution
console.log('🔍 Searching for React Native files...');

const files = glob.sync(`${config.srcDir}/**/*.${config.extensions}`);
console.log(`Found ${files.length} files to process\n`);

// Process files
files.forEach(file => processFile(file));

// Print summary
console.log('\n📊 Summary:');
console.log(`Files processed: ${stats.filesProcessed}`);
console.log(`CreateStyles patterns fixed: ${stats.createStylesFixed}`);
console.log(`Inline styles fixed: ${stats.inlineStylesFixed}`);
console.log(`Unused styles removed: ${stats.unusedStylesRemoved}`);
console.log(`Errors: ${stats.errors.length}`);

if (stats.errors.length > 0) {
  console.log('\n❌ Errors:');
  stats.errors.forEach(({ file, error }) => {
    console.log(`  ${file}: ${error}`);
  });
}

if (config.dryRun) {
  console.log('\n⚠️  DRY RUN MODE - No files were actually modified');
}