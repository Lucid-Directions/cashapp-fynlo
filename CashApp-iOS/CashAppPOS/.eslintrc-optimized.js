module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2022,
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react', 'react-native', 'react-hooks', 'prettier', 'import'],
  settings: {
    'react-native/style-sheet-object-names': ['StyleSheet', 'EStyleSheet', 'OtherStyleSheet', 'PlatformStyleSheet'],
  },
  rules: {
    // React Native specific rules
    'react-native/no-unused-styles': [
      'warn', // Changed from 'error' to 'warn' - less disruptive
      {
        // This rule has limitations with modern patterns, so we treat it as a hint
      }
    ],
    'react-native/split-platform-components': 'warn',
    'react-native/no-inline-styles': 'error', // Keep this strict - genuine issue
    'react-native/no-raw-text': [
      'warn',
      {
        skip: ['Button', 'TouchableOpacity', 'Text'],
      },
    ],

    // TypeScript rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      },
    ],
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/ban-ts-comment': [
      'warn',
      {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-check': false,
      },
    ],
    '@typescript-eslint/no-require-imports': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'warn',
    '@typescript-eslint/no-shadow': 'error',

    // React rules
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/no-unescaped-entities': 'warn',
    'react/jsx-uses-react': 'off',

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // General rules
    'no-console': 'warn',
    'no-shadow': 'off', // Use @typescript-eslint/no-shadow instead
    'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
    'no-undef': 'off', // TypeScript handles this
    'no-extra-boolean-cast': 'warn',
    'no-useless-escape': 'warn',
    radix: 'warn',

    // Import rules
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],

    // Prettier
    'prettier/prettier': 'warn',
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      // For files using useThemedStyles, add a comment explaining the pattern
      files: [
        '**/screens/main/POSScreen.tsx',
        '**/screens/settings/app/MenuManagementScreen.tsx',
        '**/screens/orders/OrdersScreen.tsx',
        '**/screens/settings/RestaurantPlatformOverridesScreen.tsx',
      ],
      rules: {
        // These files use useThemedStyles which the linter cannot track
        // Add this comment at the top of these files:
        // /* eslint-disable-next-line react-native/no-unused-styles -- useThemedStyles pattern */
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'ios/',
    'android/',
    'dist/',
    'build/',
    'coverage/',
    '.expo/',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
    '.eslintrc.js',
    '__tests__/',
    '*.test.ts',
    '*.test.tsx',
  ],
};