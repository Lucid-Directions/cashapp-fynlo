#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get all TypeScript and JavaScript files
const getFiles = (dir, files = []) => {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    // Skip node_modules, coverage, build directories
    if (
      item === 'node_modules' ||
      item === 'coverage' ||
      item === 'build' ||
      item === 'ios' ||
      item === 'android' ||
      item === '.git'
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else if (item.match(/\.(tsx?|jsx?)$/)) {
      files.push(fullPath);
    }
  }

  return files;
};

// Fix require imports to ES6 imports
const fixRequireImports = (content) => {
  // import X from 'Y' -> import X from 'Y'
  content = content.replace(
    /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    "import $1 from '$2'"
  );

  // import { X, Y } from 'Z' -> import { X, Y } from 'Z'
  content = content.replace(
    /const\s+\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    "import {$1} from '$2'"
  );

  // require('X') -> import 'X'
  content = content.replace(/^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?\s*$/gm, "import '$1';");

  return content;
};

// Remove unused variables
const removeUnusedVars = (content, filePath) => {
  // This is a simple approach - for complex cases, we'll need manual review
  const lines = content.split('\n');
  const isTest = filePath.includes('.test.') || filePath.includes('.spec.');

  // Common test utilities that might appear unused but are needed
  const testUtils = [
    'render',
    'fireEvent',
    'waitFor',
    'screen',
    'act',
    'getByText',
    'getByTestId',
    'queryByText',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip if it's a test utility in a test file
    if (isTest && testUtils.some((util) => line.includes(util))) {
      continue;
    }

    // Comment out obviously unused imports (simple cases)
    if (line.match(/^import\s+\{?\s*(\w+)\s*\}?\s+from/) || line.match(/^import\s+(\w+)\s*,/)) {
      const varMatch = line.match(/import\s+\{?\s*(\w+)\s*\}?/);
      if (varMatch) {
        const varName = varMatch[1];
        const restOfFile = lines.slice(i + 1).join('\n');

        // Check if variable is used anywhere else in the file
        const varRegex = new RegExp(`\\b${varName}\\b`);
        if (!restOfFile.match(varRegex)) {
          lines[i] = `// TODO: Unused import - ${line}`;
        }
      }
    }
  }

  return lines.join('\n');
};

// Fix explicit any types with more specific types
const fixExplicitAny = (content) => {
  // Common patterns
  content = content.replace(/:\s*any\[\]/g, ': unknown[]');
  content = content.replace(/:\s*any\s*=>/g, ': unknown =>');
  content = content.replace(/\((\w+):\s*any\)/g, '($1: unknown)');

  // For React components and props
  content = content.replace(/:\s*React\.FC<any>/g, ': React.FC<Record<string, unknown>>');
  content = content.replace(
    /interface\s+(\w+Props)\s*{\s*\[key:\s*string\]:\s*any;?\s*}/g,
    'interface $1 { [key: string]: unknown; }'
  );

  return content;
};

// Main processing
const files = getFiles('.');
let totalFixed = 0;

console.log(`Found ${files.length} files to process...`);

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // Apply fixes
    content = fixRequireImports(content);
    content = removeUnusedVars(content, file);
    content = fixExplicitAny(content);

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      totalFixed++;
      console.log(`Fixed: ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log(`\nFixed ${totalFixed} files.`);
console.log('\nNow running ESLint auto-fix for remaining issues...');

// Run ESLint fix
try {
  execSync('npm run lint:fix', { stdio: 'inherit' });
} catch (error) {
  console.log('ESLint fix completed with some remaining issues.');
}
