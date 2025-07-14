import { Platform } from 'react-native';

/**
 * Font utilities for cross-platform font handling
 */

/**
 * Get the appropriate monospace font for the platform
 * iOS: 'Courier', 'Menlo', or 'Courier New'
 * Android: 'monospace'
 */
export const getMonospaceFont = () => {
  if (Platform.OS === 'ios') {
    // iOS supports these monospace fonts natively
    return 'Courier';
  } else {
    // Android recognizes 'monospace' as a generic font family
    return 'monospace';
  }
};

/**
 * Common font families for the app
 */
export const fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }),
  monospace: getMonospaceFont(),
};

/**
 * Font weights that work across platforms
 */
export const fontWeights = {
  regular: Platform.select({
    ios: '400',
    android: 'normal',
    default: 'normal',
  }),
  medium: Platform.select({
    ios: '500',
    android: '500',
    default: '500',
  }),
  semibold: Platform.select({
    ios: '600',
    android: '600',
    default: '600',
  }),
  bold: Platform.select({
    ios: '700',
    android: 'bold',
    default: 'bold',
  }),
};