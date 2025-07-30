#!/usr/bin/env node

const { ESLint } = require('eslint');

async function analyzeErrors() {
  const eslint = new ESLint({
    fix: false,
    cache: false
  });

  console.log('Analyzing remaining errors...\n');
  
  const results = await eslint.lintFiles(['src/**/*.{js,jsx,ts,tsx}']);
  
  const errorsByRule = {};
  const errorsByFile = {};
  const fixableErrors = {};
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFixable = 0;

  for (const result of results) {
    if (result.messages.length > 0) {
      errorsByFile[result.filePath] = result.messages.length;
    }
    
    for (const message of result.messages) {
      if (message.severity === 2) totalErrors++;
      if (message.severity === 1) totalWarnings++;
      
      if (!errorsByRule[message.ruleId]) {
        errorsByRule[message.ruleId] = {
          count: 0,
          fixable: 0,
          examples: []
        };
      }
      
      errorsByRule[message.ruleId].count++;
      
      if (message.fix) {
        errorsByRule[message.ruleId].fixable++;
        totalFixable++;
      }
      
      // Store first 3 examples of each error type
      if (errorsByRule[message.ruleId].examples.length < 3) {
        errorsByRule[message.ruleId].examples.push({
          file: result.filePath.replace(/.*\/src\//, 'src/'),
          line: message.line,
          message: message.message
        });
      }
    }
  }

  console.log(`Total: ${totalErrors} errors, ${totalWarnings} warnings`);
  console.log(`Fixable: ${totalFixable} issues\n`);
  
  console.log('Top 20 Error Types:');
  console.log('==================');
  
  const sortedRules = Object.entries(errorsByRule)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);
  
  for (const [rule, data] of sortedRules) {
    console.log(`\n${rule}: ${data.count} (${data.fixable} fixable)`);
    console.log('Examples:');
    data.examples.forEach(ex => {
      console.log(`  - ${ex.file}:${ex.line} - ${ex.message}`);
    });
  }
  
  console.log('\n\nFiles with most errors:');
  console.log('======================');
  
  const sortedFiles = Object.entries(errorsByFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [file, count] of sortedFiles) {
    console.log(`${count} - ${file.replace(/.*\/src\//, 'src/')}`);
  }
}

analyzeErrors().catch(console.error);