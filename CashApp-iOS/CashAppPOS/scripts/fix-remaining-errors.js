#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

// Files with specific syntax errors based on the latest output
const specificFixes = [
  {
    file: 'src/components/modals/ReceiptScanModal.tsx',
    fixes: [
      { pattern: /style=\{([^}]+)\};/g, replacement: 'style={$1}' },
      { pattern: /value=\{([^}]+)\};/g, replacement: 'value={$1}' },
    ]
  },
  {
    file: 'src/components/payment/QRPaymentErrorBoundary.tsx',
    fixes: [
      { pattern: /errorContainer: \{;/g, replacement: 'errorContainer: {' }
    ]
  },
  {
    file: 'src/components/payment/SumUpPaymentComponent.tsx',
    fixes: [
      { pattern: /initPaymentSheet: "function",  \/\/ typeof initPaymentSheet,/g, 
        replacement: 'initPaymentSheet: "function" as any,  // typeof initPaymentSheet,' }
    ]
  },
  {
    file: 'src/components/payment/SumUpTestComponent.tsx',
    fixes: [
      { pattern: /useEffect\(\(\) => \{([\s\S]*?)hasHooks: !!/g, 
        replacement: 'useEffect(() => {\n    console.log({\n      hasHooks: !!' }
    ]
  },
  {
    file: 'src/components/ui/List.tsx',
    fixes: [
      { pattern: /\]};/g, replacement: ']}' },
      { pattern: /\);/g, replacement: ')' },
      { pattern: /disabled};/g, replacement: 'disabled}' }
    ]
  },
  {
    file: 'src/contexts/AuthContext_old.tsx',
    fixes: [
      { pattern: /`✅ Platform data loaded:([^`]+)`,([\s]*)\);/g, 
        replacement: '`✅ Platform data loaded:$1`$2);' }
    ]
  },
  {
    file: 'src/lib/supabase.ts',
    fixes: [
      { pattern: /SUPABASE_ANON_KEY: SUPABASE_ANON_KEY as string as string/g, 
        replacement: 'SUPABASE_ANON_KEY: SUPABASE_ANON_KEY as string' }
    ]
  },
  {
    file: 'src/navigation/AppNavigator.tsx',
    fixes: [
      { pattern: /needsOnboarding,\s*\);/g, replacement: 'needsOnboarding);' }
    ]
  },
  {
    file: 'src/screens/main/HomeHubScreen.tsx',
    fixes: [
      { pattern: /iconTitle: icon\.title,/g, replacement: 'iconTitle: icon.title' }
    ]
  },
  {
    file: 'src/screens/main/POSScreen.tsx',
    fixes: [
      { pattern: /categories: _categoryNames,/g, replacement: 'categories: _categoryNames' }
    ]
  },
  {
    file: 'src/screens/onboarding/ComprehensiveRestaurantOnboardingScreen.tsx',
    fixes: [
      { pattern: /swiftBic: '&apos;,/g, replacement: "swiftBic: ''," }
    ]
  },
  {
    file: 'src/screens/onboarding/RestaurantSetupScreen.tsx',
    fixes: [
      { pattern: /continuing\.&apos;/g, replacement: "continuing.'" }
    ]
  },
  {
    file: 'src/screens/payment/ServiceChargeSelectionScreen.tsx',
    fixes: [
      { pattern: /StyleSheet\.create\(\{08`/g, replacement: 'StyleSheet.create({' },
      { pattern: /\},08`,/g, replacement: '},' }
    ]
  },
  {
    file: 'src/screens/payments/SquareCardPaymentScreen.tsx',
    fixes: [
      { pattern: /currency = 'GBP&apos;,/g, replacement: "currency = 'GBP'," }
    ]
  },
  {
    file: 'src/screens/payments/SquareContactlessPaymentScreen.tsx', 
    fixes: [
      { pattern: /currency = 'GBP&apos;,/g, replacement: "currency = 'GBP'," }
    ]
  },
  {
    file: 'src/screens/reports/ReportsScreenSimple.tsx',
    fixes: [
      { pattern: /available\.&apos;/g, replacement: "available.'" }
    ]
  },
  {
    file: 'src/screens/settings/app/BackupRestoreScreen.tsx',
    fixes: [
      { pattern: /reports&apos;/g, replacement: "'reports'" }
    ]
  },
  {
    file: 'src/screens/settings/hardware/CashDrawerScreen.tsx',
    fixes: [
      { pattern: /connected&apos;/g, replacement: "'connected'" }
    ]
  },
  {
    file: 'src/screens/settings/hardware/PrinterSetupScreen.tsx',
    fixes: [
      { pattern: /connected&apos;/g, replacement: "'connected'" }
    ]
  },
  {
    file: 'src/screens/settings/RecipesScreen.tsx',
    fixes: [
      { pattern: /recipe\.&apos;/g, replacement: "recipe.'" }
    ]
  },
  {
    file: 'src/screens/payment/EnhancedPaymentScreen.tsx',
    fixes: [
      { pattern: /customerMetadata: \{;/g, replacement: 'customerMetadata: {' }
    ]
  },
  {
    file: 'src/services/DatabaseService.ts',
    fixes: [
      { pattern: /metadata: \{;/g, replacement: 'metadata: {' }
    ]
  },
  {
    file: 'src/services/DataService.ts',
    fixes: [
      { pattern: /headers: \{;/g, replacement: 'headers: {' }
    ]
  },
  {
    file: 'src/services/InventoryApiService.ts',
    fixes: [
      { pattern: /headers: \{;/g, replacement: 'headers: {' }
    ]
  },
  {
    file: 'src/services/NetworkDiagnosticsService.ts',
    fixes: [
      { pattern: /type: netInfo\.type,\s*isConnected:/g, 
        replacement: 'type: netInfo.type,\n        isConnected:' }
    ]
  },
  {
    file: 'src/services/OrderService.ts',
    fixes: [
      { pattern: /items: orderData\.items\.length,\s*total:/g, 
        replacement: 'items: orderData.items.length,\n        total:' }
    ]
  },
  {
    file: 'src/services/RestaurantDataService.ts',
    fixes: [
      { pattern: /isConnected: diagnostics\.isConnected,\s*connectionType:/g, 
        replacement: 'isConnected: diagnostics.isConnected,\n        connectionType:' }
    ]
  },
  {
    file: 'src/services/SumUpNativeService.ts',
    fixes: [
      { pattern: /amount: request\.amount,\s*title:/g, 
        replacement: 'amount: request.amount,\n        title:' }
    ]
  },
  {
    file: 'src/utils/ErrorLogger.ts',
    fixes: [
      { pattern: /^❌ ============ ERROR DETAILS ============/gm, 
        replacement: '    // ❌ ============ ERROR DETAILS ============' }
    ]
  }
];

// Fix common patterns across all files
async function fixCommonPatterns() {
  console.log('\n🔧 Fixing common patterns...');
  
  const allFiles = fs.readdirSync('src', { recursive: true })
    .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map(file => path.join('src', file));
  
  for (const file of allFiles) {
    if (!fs.existsSync(file)) continue;
    
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Fix console.log statements without proper wrapping
    const consolePattern = /^\s*(['"`][\s\S]*?['"`]),?\s*\);/gm;
    if (consolePattern.test(content)) {
      content = content.replace(consolePattern, (match, str) => {
        return `    console.log(${str});`;
      });
      modified = true;
    }
    
    // Fix style prop semicolons
    const stylePattern = /style=\{([^}]+)\};/g;
    if (stylePattern.test(content)) {
      content = content.replace(stylePattern, 'style={$1}');
      modified = true;
    }
    
    // Fix object property semicolons
    const objPattern = /:\s*\{;/g;
    if (objPattern.test(content)) {
      content = content.replace(objPattern, ': {');
      modified = true;
    }
    
    // Fix multiple semicolons
    const multiSemiPattern = /;{2,}/g;
    if (multiSemiPattern.test(content)) {
      content = content.replace(multiSemiPattern, ';');
      modified = true;
    }
    
    // Fix &apos; entities
    const aposPattern = /&apos;/g;
    if (aposPattern.test(content)) {
      content = content.replace(aposPattern, "'");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  ✓ Fixed common patterns in ${path.basename(file)}`);
    }
  }
}

// Apply specific fixes
async function applySpecificFixes() {
  console.log('\n🎯 Applying specific fixes...');
  
  for (const fileConfig of specificFixes) {
    const filePath = path.join(process.cwd(), fileConfig.file);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const fix of fileConfig.fixes) {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ Applied fixes to ${fileConfig.file}`);
    }
  }
}

// Run ESLint fix
async function runESLintFix() {
  console.log('\n🔄 Running ESLint auto-fix...');
  
  const eslint = new ESLint({ fix: true, cache: false });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  await ESLint.outputFixes(results);
  
  const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0);
  const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);
  
  console.log(`  ✓ ESLint complete: ${errorCount} errors, ${warningCount} warnings`);
  return { errorCount, warningCount };
}

// Main function
async function main() {
  console.log('🚀 Final Error Fixing Script');
  console.log('============================');
  
  try {
    await fixCommonPatterns();
    await applySpecificFixes();
    
    // Run ESLint fix multiple times
    let lastErrorCount = Infinity;
    let iterations = 0;
    
    while (iterations < 3) {
      const { errorCount } = await runESLintFix();
      if (errorCount === 0 || errorCount >= lastErrorCount) break;
      lastErrorCount = errorCount;
      iterations++;
    }
    
    // Run Prettier
    console.log('\n💅 Running Prettier...');
    const { execSync } = require('child_process');
    try {
      execSync('npx prettier --write "src/**/*.{ts,tsx}" --ignore-unknown', { stdio: 'inherit' });
      console.log('  ✓ Prettier complete');
    } catch (error) {
      console.log('  ⚠ Some Prettier errors (expected for files with syntax issues)');
    }
    
    console.log('\n✅ Fixing complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();