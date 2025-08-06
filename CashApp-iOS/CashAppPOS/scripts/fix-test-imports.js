const fs = require('fs');
const path = require('path');

function fixTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace old render imports with new renderWithProviders
  content = content.replace(
    /import\s+{\s*render[^}]*}\s+from\s+['"]@testing-library\/react-native['"]/g,
    "import { renderWithProviders as render } from '../../test-utils/renderWithProviders'"
  );
  
  // Add missing mock imports
  if (content.includes('useTheme') && \!content.includes("jest.mock('../design-system/ThemeProvider')")) {
    content = `jest.mock('../../design-system/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      secondary: '#5856D6',
      background: '#F2F2F7',
      surface: '#FFFFFF',
      text: '#000000',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      border: '#C6C6C8',
      disabled: '#8E8E93',
      placeholder: '#8E8E93',
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
    typography: {
      h1: { fontSize: 32, fontWeight: 'bold' },
      h2: { fontSize: 24, fontWeight: 'bold' },
      h3: { fontSize: 20, fontWeight: 'semibold' },
      body: { fontSize: 16, fontWeight: 'normal' },
      caption: { fontSize: 14, fontWeight: 'normal' },
    },
  }),
}));

` + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Find and fix all test files
const testFiles = [
  'src/screens/main/__tests__/OrdersScreen.test.tsx',
  'src/screens/main/__tests__/SettingsScreen.test.tsx',
  'src/screens/main/__tests__/ReportsScreen.test.tsx',
  'src/screens/employees/__tests__/EnhancedEmployeeScheduleScreen.test.tsx',
];

testFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixTestFile(fullPath);
  }
});
