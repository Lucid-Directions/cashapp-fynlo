#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Fix specific inline style issues
const fixes = {
  // Fix CustomersScreen.tsx inline styles
  'src/screens/customers/CustomersScreen.tsx': [
    {
      find: `style={{ flexDirection: 'row', flexWrap: "wrap ? 'wrap' : 'nowrap'" }}`,
      replace: `style={styles.customerChipContainer}`
    },
    {
      find: `style={{ flex: 1, marginRight: 8 }}`,
      replace: `style={styles.buttonLeft}`
    },
    {
      find: `style={{ flex: 1, marginLeft: 8 }}`,
      replace: `style={styles.buttonRight}`
    }
  ],
  // Fix EmployeesScreen.tsx inline styles
  'src/screens/employees/EmployeesScreen.tsx': [
    {
      find: `style={{ color: 'rgba(255, 255, 255, 0.8)' }}`,
      replace: `style={styles.deleteText}`
    }
  ],
  // Fix UserProfileScreen.tsx inline styles
  'src/screens/settings/user/UserProfileScreen.tsx': [
    {
      find: `style={{ color: "selectedSection === item.id ? '#fff' : '#2c3e50'" }}`,
      replace: `style={selectedSection === item.id ? styles.menuTextSelected : styles.menuText}`
    }
  ]
};

// Process each file
Object.entries(fixes).forEach(([filePath, replacements]) => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ find, replace }) => {
    if (content.includes(find)) {
      content = content.replace(find, replace);
      modified = true;
      console.log(`✅ Fixed inline style in ${filePath}`);
    }
  });
  
  if (modified) {
    // Add the missing styles to StyleSheet.create
    if (filePath.includes('CustomersScreen.tsx')) {
      content = content.replace(
        /const styles = StyleSheet\.create\({/,
        `const styles = StyleSheet.create({
  customerChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  buttonLeft: {
    flex: 1,
    marginRight: 8,
  },
  buttonRight: {
    flex: 1,
    marginLeft: 8,
  },`
      );
    } else if (filePath.includes('EmployeesScreen.tsx')) {
      content = content.replace(
        /const styles = StyleSheet\.create\({/,
        `const styles = StyleSheet.create({
  deleteText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },`
      );
    } else if (filePath.includes('UserProfileScreen.tsx')) {
      content = content.replace(
        /const styles = StyleSheet\.create\({/,
        `const styles = StyleSheet.create({
  menuTextSelected: {
    color: '#fff',
  },
  menuText: {
    color: '#2c3e50',
  },`
      );
    }
    
    fs.writeFileSync(fullPath, content);
  }
});

// Fix files with undefined.styleName issues
const undefinedStyleFiles = [
  'src/components/payment/QRCodePayment.tsx',
  'src/components/theme/ThemeSwitcher.tsx',
  'src/components/ui/List.tsx',
  'src/components/ui/Modal.tsx'
];

undefinedStyleFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Remove references to undefined styles
  content = content.replace(/style={[^}]*undefined\.[^}]*}/g, (match) => {
    console.log(`⚠️  Removing undefined style reference in ${filePath}: ${match}`);
    return '';
  });
  
  fs.writeFileSync(fullPath, content);
});

console.log('\n✨ Style warning fixes complete!');