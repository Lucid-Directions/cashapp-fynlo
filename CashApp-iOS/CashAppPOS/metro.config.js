const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

/** @type {import('metro-config').ConfigT} */
module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);
  return {
    ...defaultConfig,
    transformer: {
      ...defaultConfig.transformer,
      babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
    },
    resolver: {
      ...defaultConfig.resolver,
      sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs'],
      extraNodeModules: {
        '@fynlo/shared': path.resolve(__dirname, '../../shared'),
        '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
      },
      nodeModulesPaths: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '../../node_modules'),
      ],
    },
    watchFolders: [
      path.resolve(__dirname, '../../shared'),
    ],
  };
})();
