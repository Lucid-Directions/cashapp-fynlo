module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/integration/**/*.test.{ts,tsx,js,jsx}'],
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|react-native-gesture-handler|react-native-reanimated|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-modal|sumup-react-native-alpha)/)',
  ],
};
