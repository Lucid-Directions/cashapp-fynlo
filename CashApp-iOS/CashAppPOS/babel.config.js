module.exports = {
  presets: [
    '@babel/preset-typescript', // Explicitly add preset-typescript
    'module:@react-native/babel-preset',
  ],
  plugins: [
    'react-native-reanimated/plugin', // Must be last
  ],
};
