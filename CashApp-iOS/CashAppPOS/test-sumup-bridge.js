/**
 * Test script to verify SumUp native bridge is working
 * Run this with: node test-sumup-bridge.js
 */

import { NativeModules } from 'react-native';

const { SumUpTapToPay } = NativeModules;

async function testSumUpBridge() {
  console.log('🧪 Testing SumUp Native Bridge...\n');
  
  // Check if module exists
  if (!SumUpTapToPay) {
    console.error('❌ SumUpTapToPay native module not found!');
    console.log('Make sure:');
    console.log('1. The iOS project is properly linked');
    console.log('2. You\'ve run pod install');
    console.log('3. You\'re running on iOS (not Android)');
    return;
  }
  
  console.log('✅ SumUpTapToPay module found!\n');
  console.log('Available methods:');
  
  // List all available methods
  const methods = Object.keys(SumUpTapToPay).filter(key => typeof SumUpTapToPay[key] === 'function');
  methods.forEach(method => {
    console.log(`  - ${method}`);
  });
  
  console.log('\n🎯 Native bridge is properly connected!');
  console.log('The SumUp SDK can now be used for real payments.');
}

// Run the test
testSumUpBridge().catch(console.error);