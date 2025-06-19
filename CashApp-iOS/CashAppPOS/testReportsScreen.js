#!/usr/bin/env node

/**
 * Test ReportsScreen specifically to identify crash causes
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing ReportsScreen for Crash Issues\n');

const reportsPath = path.join(__dirname, 'src/screens/main/ReportsScreen.tsx');
const content = fs.readFileSync(reportsPath, 'utf8');

console.log('1. Checking basic structure...');
const hasReactImport = content.includes("import React");
const hasErrorBoundary = content.includes("import ErrorBoundary");
const hasWrappedExport = content.includes("const ReportsScreen: React.FC = () => {");
console.log(`  ${hasReactImport ? '✅' : '❌'} React import`);
console.log(`  ${hasErrorBoundary ? '✅' : '❌'} ErrorBoundary import`);
console.log(`  ${hasWrappedExport ? '✅' : '❌'} Wrapped export`);

console.log('\n2. Checking for problematic patterns...');
const hasRequire = content.includes('require(');
const hasUndefined = content.includes('undefined');
const hasComplexState = content.includes('useState') && content.split('useState').length > 5;
console.log(`  ${hasRequire ? '❌' : '✅'} No require() statements`);
console.log(`  ${hasUndefined ? '⚠️' : '✅'} No undefined references`);
console.log(`  ${hasComplexState ? '⚠️' : '✅'} State complexity reasonable`);

console.log('\n3. Checking interactive elements...');
const touchableElements = (content.match(/TouchableOpacity/g) || []).length;
const iconElements = (content.match(/<Icon/g) || []).length;
const modalElements = (content.match(/Modal/g) || []).length;
console.log(`  📱 ${touchableElements} TouchableOpacity elements`);
console.log(`  🎨 ${iconElements} Icon elements`);
console.log(`  📋 ${modalElements} Modal elements`);

console.log('\n4. Checking for async operations...');
const hasAsyncCode = content.includes('async') || content.includes('await');
const hasPromises = content.includes('Promise') || content.includes('.then(');
console.log(`  ${hasAsyncCode ? '⚠️' : '✅'} Async operations: ${hasAsyncCode ? 'Found' : 'None'}`);
console.log(`  ${hasPromises ? '⚠️' : '✅'} Promises: ${hasPromises ? 'Found' : 'None'}`);

console.log('\n5. Checking navigation...');
const hasNavigation = content.includes('useNavigation') || content.includes('navigation.');
const hasNavigationCalls = content.includes('navigation.navigate') || content.includes('navigation.goBack');
console.log(`  ${hasNavigation ? '✅' : '❌'} Navigation hook`);
console.log(`  ${hasNavigationCalls ? '⚠️' : '✅'} Navigation calls: ${hasNavigationCalls ? 'Found' : 'None'}`);

console.log('\n📋 Recommendations:');
if (hasRequire) {
  console.log('❌ Remove require() statements - they cause "undefined is not an object" errors');
}
if (hasNavigationCalls) {
  console.log('⚠️ Navigation calls may cause crashes if screens don\'t exist');
}
if (hasAsyncCode) {
  console.log('⚠️ Async operations may need proper error handling');
}

console.log('\n🔧 Quick Fix: Wrap all interactive elements in try-catch');
console.log('💡 Consider simplifying state management');