#!/usr/bin/env node

/**
 * Script to migrate AsyncStorage usage to SecureStorageService
 * 
 * Usage: node scripts/migrate-asyncstorage.js [--dry-run]
 * 
 * Features:
 * - Replaces AsyncStorage imports with SecureStorageService
 * - Detects sensitive keys and marks them for encryption
 * - Updates method calls to match new API
 * - Supports dry-run mode
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/ios/**',
  '**/android/**',
  '**/SecureStorageService.ts',
  '**/scripts/**',
  '**/__tests__/**',
  '**/__mocks__/**'
];

// Sensitive key patterns that should be encrypted
const SENSITIVE_KEY_PATTERNS = [
  'token',
  'password',
  'secret',
  'key',
  'credential',
  'auth',
  'session',
  'card',
  'payment',
  'bank'
];

function isSensitiveKey(key) {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

function getRelativeImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const servicesPath = path.join(process.cwd(), 'src/services/SecureStorageService');
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
    
    // Check if file uses AsyncStorage
    if (!content.includes('AsyncStorage')) {
      return { changed: false };
    }
    
    // Replace import statement
    const importRegex = /import\s+(?:{\s*)?AsyncStorage(?:\s*})?\s+from\s+['"]@react-native-async-storage\/async-storage['"];?/g;
    const relativePath = getRelativeImportPath(filePath);
    content = content.replace(importRegex, `import secureStorage from '${relativePath}';`);
    
    // Also handle named imports if the file uses specific methods
    const namedImportRegex = /import\s+AsyncStorage,?\s*(?:{[^}]+})?\s*from\s+['"]@react-native-async-storage\/async-storage['"];?/g;
    content = content.replace(namedImportRegex, `import secureStorage from '${relativePath}';`);
    
    // Replace AsyncStorage method calls
    let replacementCount = 0;
    
    // Replace AsyncStorage.setItem with encryption detection
    content = content.replace(
      /AsyncStorage\.setItem\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*([^)]+)\)/g,
      (match, quote, key, value) => {
        replacementCount++;
        const keyVar = key.includes('${') || !quote;
        const isSensitive = !keyVar && isSensitiveKey(key);
        
        if (isSensitive) {
          return `secureStorage.setItem(${quote}${key}${quote}, ${value}, { encrypt: true })`;
        } else {
          return `secureStorage.setItem(${quote}${key}${quote}, ${value})`;
        }
      }
    );
    
    // Replace other AsyncStorage methods
    const methodReplacements = [
      { from: /AsyncStorage\.getItem\(/g, to: 'secureStorage.getItem(' },
      { from: /AsyncStorage\.removeItem\(/g, to: 'secureStorage.removeItem(' },
      { from: /AsyncStorage\.clear\(/g, to: 'secureStorage.clear(' },
      { from: /AsyncStorage\.getAllKeys\(/g, to: 'secureStorage.getAllKeys(' },
      { from: /AsyncStorage\.multiGet\(/g, to: 'secureStorage.multiGet(' },
      { from: /AsyncStorage\.multiSet\(/g, to: 'secureStorage.multiSet(' },
      { from: /AsyncStorage\.multiRemove\(/g, to: 'secureStorage.multiRemove(' }
    ];
    
    methodReplacements.forEach(({ from, to }) => {
      const beforeLength = content.length;
      content = content.replace(from, to);
      if (content.length !== beforeLength) {
        replacementCount++;
      }
    });
    
    // Add comment for keys that might need encryption
    const keyStringRegex = /secureStorage\.setItem\s*\(\s*(['"`])([^'"`]+)\1/g;
    let matches;
    const keysToReview = [];
    
    while ((matches = keyStringRegex.exec(content)) !== null) {
      const key = matches[2];
      if (isSensitiveKey(key) && !content.includes(`{ encrypt: true }`)) {
        keysToReview.push(key);
      }
    }
    
    if (keysToReview.length > 0 && content !== originalContent) {
      // Add a comment at the top of the file
      const warningComment = `// TODO: Review these potentially sensitive keys for encryption: ${keysToReview.join(', ')}\n`;
      content = warningComment + content;
    }
    
    // Check if content changed
    if (content !== originalContent) {
      if (!isDryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      return {
        changed: true,
        replacements: replacementCount,
        filePath,
        sensitiveKeys: keysToReview
      };
    }
    
    return { changed: false };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { changed: false, error: error.message };
  }
}

function main() {
  console.log(`🔄 ${isDryRun ? 'DRY RUN: ' : ''}Migrating AsyncStorage to SecureStorageService...\n`);
  
  // Find all TypeScript files
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: EXCLUDE_PATTERNS,
    cwd: process.cwd()
  });
  
  console.log(`Found ${files.length} files to process\n`);
  
  let totalFiles = 0;
  let totalReplacements = 0;
  const changedFiles = [];
  const filesWithSensitiveKeys = [];
  
  files.forEach(file => {
    const result = processFile(file);
    if (result.changed) {
      totalFiles++;
      totalReplacements += result.replacements || 0;
      changedFiles.push(result.filePath);
      console.log(`✅ ${result.filePath} - ${result.replacements} replacements`);
      
      if (result.sensitiveKeys && result.sensitiveKeys.length > 0) {
        filesWithSensitiveKeys.push({
          file: result.filePath,
          keys: result.sensitiveKeys
        });
      }
    }
  });
  
  console.log('\n📊 Summary:');
  console.log(`Files processed: ${files.length}`);
  console.log(`Files modified: ${totalFiles}`);
  console.log(`Total replacements: ${totalReplacements}`);
  
  if (filesWithSensitiveKeys.length > 0) {
    console.log('\n⚠️  Files with potentially sensitive keys:');
    filesWithSensitiveKeys.forEach(({ file, keys }) => {
      console.log(`   ${file}:`);
      keys.forEach(key => console.log(`     - ${key}`));
    });
    console.log('\nReview these files and add { encrypt: true } option where needed.');
  }
  
  if (isDryRun) {
    console.log('\n⚠️  This was a dry run. No files were modified.');
    console.log('Run without --dry-run to apply changes.');
  } else if (totalFiles > 0) {
    console.log('\n✨ AsyncStorage migration complete!');
    console.log('\nNext steps:');
    console.log('1. Review the changes with: git diff');
    console.log('2. Check files marked with TODO comments for sensitive keys');
    console.log('3. Run tests to ensure storage operations work correctly');
    console.log('4. Consider running the app and testing key features');
    console.log('5. Commit the changes');
  } else {
    console.log('\n✅ No AsyncStorage usage found to migrate.');
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