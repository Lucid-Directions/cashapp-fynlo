#!/usr/bin/env node

/**
 * Adds ESLint disable comments to files using useThemedStyles pattern
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/screens/main/POSScreen.tsx',
  'src/screens/more/MoreScreen.tsx', 
  'src/screens/orders/OrdersScreen.tsx',
  'src/screens/settings/user/UserProfileScreen.tsx',
  'src/screens/settings/app/MenuManagementScreen.tsx',
  'src/screens/payment/ServiceChargeSelectionScreen.tsx',
  'src/screens/main/ProfileScreen.tsx',
  'src/screens/settings/RestaurantPlatformOverridesScreen.tsx',
];

const comment = `/* eslint-disable react-native/no-unused-styles */
// This file uses useThemedStyles pattern which ESLint cannot statically analyze
`;

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if comment already exists
    if (content.includes('eslint-disable react-native/no-unused-styles')) {
      console.log(`✓ ${file} - already has comment`);
      return;
    }
    
    // Add comment after first import or at the beginning
    const importMatch = content.match(/^import .* from .*/m);
    if (importMatch) {
      const insertIndex = content.indexOf('\n', importMatch.index) + 1;
      content = content.slice(0, insertIndex) + '\n' + comment + content.slice(insertIndex);
    } else {
      content = comment + '\n' + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - added ESLint comment`);
    
  } catch (error) {
    console.error(`❌ ${file} - ${error.message}`);
  }
});

console.log('\nDone! Files have been updated with ESLint disable comments.');