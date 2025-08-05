module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@utils': './src/utils',
          '@navigation': './src/navigation',
          '@contexts': './src/contexts',
          '@store': './src/store',
          '@config': './src/config',
          '@hooks': './src/hooks',
          '@theme': './src/theme',
          '@types': './src/types',
          '@constants': './src/constants',
          '@api': './src/api',
          '@lib': './src/lib',
        },
      },
    ],
    'react-native-reanimated/plugin', // Must be last
  ],
};