#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript and TypeScript React files
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/*.test.ts', '**/*.test.tsx', '**/node_modules/**']
});

let totalRemoved = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Remove console.log, console.warn, console.error statements
  const newContent = content.replace(/console\.(log|warn|error)\([^)]*\);?\s*\n?/g, '');
  
  if (content !== newContent) {
    const count = (content.match(/console\.(log|warn|error)/g) || []).length;
    console.log(`Removing ${count} console statements from ${file}`);
    fs.writeFileSync(file, newContent);
    totalRemoved += count;
  }
});

console.log(`\n✅ Removed ${totalRemoved} console statements from ${files.length} files`);