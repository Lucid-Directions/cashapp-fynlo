#!/usr/bin/env node

/**
 * Script to automatically replace console.log statements with LoggingService
 * 
 * Usage: node scripts/replace-console-logs.js [--dry-run]
 * 
 * Features:
 * - Replaces console.log with appropriate logging levels
 * - Preserves formatting and indentation
 * - Adds import statement if needed
 * - Supports dry-run mode to preview changes
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Patterns to detect and replace
const CONSOLE_PATTERNS = [
  {
    pattern: /console\.log\s*\(/g,
    replacement: 'info(',
    logLevel: 'info'
  },
  {
    pattern: /console\.info\s*\(/g,
    replacement: 'info(',
    logLevel: 'info'
  },
  {
    pattern: /console\.warn\s*\(/g,
    replacement: 'warn(',
    logLevel: 'warn'
  },
  {
    pattern: /console\.error\s*\(/g,
    replacement: 'error(',
    logLevel: 'error'
  },
  {
    pattern: /console\.debug\s*\(/g,
    replacement: 'debug(',
    logLevel: 'debug'
  }
];

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/ios/**',
  '**/android/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/LoggingService.ts',
  '**/scripts/**',
  '**/__tests__/**',
  '**/__mocks__/**'
];

// Import statement to add
const LOGGING_IMPORT = "import { debug, info, warn, error } from '../services/LoggingService';";

function getRelativeImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const servicesPath = path.join(process.cwd(), 'src/services/LoggingService');
  let relativePath = path.relative(fileDir, servicesPath);
  
  // Ensure forward slashes
  relativePath = relativePath.replace(/\\/g, '/');
  
  // Add ./ if it doesn't start with ..
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath;
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Check if file contains console statements
    let hasConsoleStatements = false;
    let usedMethods = new Set();
    
    CONSOLE_PATTERNS.forEach(({ pattern, logLevel }) => {
      if (pattern.test(content)) {
        hasConsoleStatements = true;
        usedMethods.add(logLevel);
      }
    });
    
    if (!hasConsoleStatements) {
      return { changed: false };
    }
    
    // Replace console statements
    let replacementCount = 0;
    CONSOLE_PATTERNS.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, () => {
        replacementCount++;
        return replacement;
      });
    });
    
    // Check if import already exists
    const hasLoggingImport = content.includes('LoggingService');
    
    if (!hasLoggingImport && replacementCount > 0) {
      // Get the correct relative import path
      const relativePath = getRelativeImportPath(filePath);
      const importStatement = `import { ${Array.from(usedMethods).join(', ')} } from '${relativePath}';`;
      
      // Find where to insert the import
      const importRegex = /^import\s+.*$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        // Add after the last import
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        content = content.slice(0, insertPosition) + '\n' + importStatement + content.slice(insertPosition);
      } else {
        // Add at the beginning of the file
        content = importStatement + '\n\n' + content;
      }
    }
    
    // Check if content changed
    if (content !== originalContent) {
      if (!isDryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      return {
        changed: true,
        replacements: replacementCount,
        filePath
      };
    }
    
    return { changed: false };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { changed: false, error: error.message };
  }
}

function main() {
  console.log(`🔄 ${isDryRun ? 'DRY RUN: ' : ''}Replacing console.log statements with LoggingService...\n`);
  
  // Find all TypeScript files
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: EXCLUDE_PATTERNS,
    cwd: process.cwd()
  });
  
  console.log(`Found ${files.length} files to process\n`);
  
  let totalFiles = 0;
  let totalReplacements = 0;
  const changedFiles = [];
  
  files.forEach(file => {
    const result = processFile(file);
    if (result.changed) {
      totalFiles++;
      totalReplacements += result.replacements || 0;
      changedFiles.push(result.filePath);
      console.log(`✅ ${result.filePath} - ${result.replacements} replacements`);
    }
  });
  
  console.log('\n📊 Summary:');
  console.log(`Files processed: ${files.length}`);
  console.log(`Files modified: ${totalFiles}`);
  console.log(`Total replacements: ${totalReplacements}`);
  
  if (isDryRun) {
    console.log('\n⚠️  This was a dry run. No files were modified.');
    console.log('Run without --dry-run to apply changes.');
  } else if (totalFiles > 0) {
    console.log('\n✨ Console.log replacement complete!');
    console.log('\nNext steps:');
    console.log('1. Review the changes with: git diff');
    console.log('2. Run tests to ensure nothing broke');
    console.log('3. Commit the changes');
  } else {
    console.log('\n✅ No console.log statements found to replace.');
  }
}

// Check if glob is installed
try {
  require.resolve('glob');
} catch (e) {
  console.error('Error: glob package is required. Please install it with:');
  console.error('npm install --save-dev glob');
  process.exit(1);
}

// Run the script
main();