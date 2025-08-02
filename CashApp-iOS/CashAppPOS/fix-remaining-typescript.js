#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get lint issues
const getLintIssues = () => {
  try {
    const output = execSync('npm run lint 2>&1', { encoding: 'utf8' });
    return output.split('\n');
  } catch (error) {
    // Lint will exit with error if there are issues
    return error.stdout.split('\n');
  }
};

// Parse lint output to get file issues
const parseIssues = (lines) => {
  const fileIssues = {};
  let currentFile = null;

  for (const line of lines) {
    // Match file path
    const fileMatch = line.match(/^(\/[^\s]+\.(tsx?|jsx?))$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      fileIssues[currentFile] = [];
      continue;
    }

    // Match issue line
    if (currentFile && line.match(/^\s*\d+:\d+/)) {
      fileIssues[currentFile].push(line);
    }
  }

  return fileIssues;
};

// Fix specific patterns in a file
const fixFile = (filePath, issues) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // Process each issue
    for (const issue of issues) {
      // Extract line number and issue type
      const match = issue.match(
        /^\s*(\d+):(\d+)\s+\w+\s+(.+?)\s+(@typescript-eslint\/[\w-]+|no-unused-vars)$/
      );
      if (!match) continue;

      const lineNum = parseInt(match[1]) - 1;
      const colNum = parseInt(match[2]) - 1;
      const message = match[3];
      const rule = match[4];

      const lines = content.split('\n');
      if (lineNum >= lines.length) continue;

      const line = lines[lineNum];

      // Fix no-explicit-any
      if (rule === '@typescript-eslint/no-explicit-any') {
        // Replace any with more specific types
        if (line.includes(': any[]')) {
          lines[lineNum] = line.replace(/: any\[\]/g, ': unknown[]');
          modified = true;
        } else if (line.includes(': any)')) {
          lines[lineNum] = line.replace(/: any\)/g, ': unknown)');
          modified = true;
        } else if (line.includes(': any,')) {
          lines[lineNum] = line.replace(/: any,/g, ': unknown,');
          modified = true;
        } else if (line.includes(': any;')) {
          lines[lineNum] = line.replace(/: any;/g, ': unknown;');
          modified = true;
        } else if (line.includes(': any ')) {
          lines[lineNum] = line.replace(/: any /g, ': unknown ');
          modified = true;
        } else if (line.includes('<any>')) {
          lines[lineNum] = line.replace(/<any>/g, '<unknown>');
          modified = true;
        } else if (line.includes(' as any')) {
          lines[lineNum] = line.replace(/ as any/g, ' as unknown');
          modified = true;
        }
      }

      // Fix no-unused-vars by prefixing with underscore
      if (rule === '@typescript-eslint/no-unused-vars' || rule === 'no-unused-vars') {
        // Extract variable name from message
        const varMatch = message.match(
          /'(\w+)' is (defined but never used|assigned a value but never used)/
        );
        if (varMatch) {
          const varName = varMatch[1];

          // Don't rename if it's already prefixed with underscore
          if (!varName.startsWith('_')) {
            // Replace in destructuring
            const destructureRegex = new RegExp(`\\b${varName}\\b(?=\\s*[,}])`, 'g');
            if (line.match(destructureRegex)) {
              lines[lineNum] = line.replace(destructureRegex, `_${varName}`);
              modified = true;
            }

            // Replace in function parameters
            const paramRegex = new RegExp(`\\b${varName}\\b(?=\\s*[,):])`, 'g');
            if (line.match(paramRegex)) {
              lines[lineNum] = line.replace(paramRegex, `_${varName}`);
              modified = true;
            }

            // Replace in variable declarations
            const declRegex = new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g');
            if (line.match(declRegex)) {
              lines[lineNum] = line.replace(declRegex, `$1 _${varName}`);
              modified = true;
            }
          }
        }
      }

      // Fix ban-ts-comment
      if (rule === '@typescript-eslint/ban-ts-comment') {
        if (line.includes('@ts-ignore')) {
          lines[lineNum] = line.replace(/@ts-ignore/g, '@ts-expect-error');
          modified = true;
        } else if (line.includes('@ts-nocheck')) {
          // Comment out @ts-nocheck
          lines[lineNum] = '// ' + line;
          modified = true;
        }
      }

      content = lines.join('\n');
    }

    // Write back if modified
    if (modified && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
};

// Main
console.log('Analyzing lint issues...');
const lintOutput = getLintIssues();
const fileIssues = parseIssues(lintOutput);

let totalFixed = 0;
const filesToFix = Object.entries(fileIssues).filter(([_, issues]) => issues.length > 0);

console.log(`Found ${filesToFix.length} files with TypeScript issues`);

for (const [filePath, issues] of filesToFix) {
  if (fixFile(filePath, issues)) {
    totalFixed++;
    console.log(`Fixed: ${filePath}`);
  }
}

console.log(`\nFixed ${totalFixed} files`);

// Run ESLint fix again
console.log('\nRunning ESLint auto-fix...');
try {
  execSync('npm run lint:fix', { stdio: 'inherit' });
} catch (error) {
  console.log('ESLint completed');
}
