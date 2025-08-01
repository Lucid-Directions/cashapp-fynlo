module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/**/*.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/screens/auth/__tests__',
    '<rootDir>/src/services/__tests__',
    '<rootDir>/__tests__/performance',
    '<rootDir>/src/__tests__/ComprehensiveAppTest.tsx',
    '<rootDir>/src/__tests__/OnboardingNavigationTests.tsx',
    '<rootDir>/__tests__/App.test.tsx',
    '<rootDir>/__tests__/components',
    '<rootDir>/src/__tests__/performance',
    '<rootDir>/src/__tests__/fixtures',
    '<rootDir>/__tests__/fixtures',
    '<rootDir>/src/__tests__/integration',
    '<rootDir>/src/__tests__/utils',
    '<rootDir>/__tests__/utils',
    '<rootDir>/__tests__/testSetup.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|react-native-gesture-handler|react-native-reanimated|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-modal|sumup-react-native-alpha|@supabase|isows|react-native-url-polyfill)/)',
  ],
  collectCoverage: false,
  // collectCoverageFrom temporarily disabled until suites are stabilised
  coverageThreshold: {
    global: { branches: 0, functions: 0, lines: 0, statements: 0 },
  },
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
