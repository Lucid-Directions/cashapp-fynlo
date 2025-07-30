/**
 * ShadowUtils - Optimized shadow styling utilities
 * Fixes performance warnings by providing efficient shadow configurations
 */

import { ViewStyle } from 'react-native';

export interface ShadowStyle extends ViewStyle {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number; // Android elevation
  backgroundColor?: string; // Required for efficient shadow calculation
}

/**
 * Optimized shadow configurations that prevent iOS performance warnings
 * Each shadow style includes backgroundColor for efficient calculation
 */
export const ShadowUtils = {
  // Light shadow for cards and components
  light: (backgroundColor = '#FFFFFF'): ShadowStyle => ({
    backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2, // Android
  }),

  // Medium shadow for elevated components
  medium: (backgroundColor = '#FFFFFF'): ShadowStyle => ({
    backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4, // Android
  }),

  // Strong shadow for modals and popovers
  strong: (backgroundColor = '#FFFFFF'): ShadowStyle => ({
    backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8, // Android
  }),

  // Subtle shadow for buttons
  button: (backgroundColor = '#00A651'): ShadowStyle => ({
    backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3, // Android
  }),

  // No shadow (for performance-critical components)
  none: (backgroundColor = 'transparent'): ShadowStyle => ({
    backgroundColor,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Android
  }),

  // Custom shadow with optimized defaults
  custom: (options: {
    backgroundColor?: string;
    shadowColor?: string;
    offset?: { width: number; height: number };
    opacity?: number;
    radius?: number;
    elevation?: number;
  }): ShadowStyle => ({
    backgroundColor: options.backgroundColor || '#FFFFFF',
    shadowColor: options.shadowColor || '#000000',
    shadowOffset: options.offset || { width: 0, height: 2 },
    shadowOpacity: options.opacity || 0.1,
    shadowRadius: options.radius || 4,
    elevation: options.elevation || 4, // Android
  }),
};

/**
 * Creates an optimized shadow style that prevents iOS performance warnings
 * Automatically includes backgroundColor for efficient shadow calculation
 */
export const createOptimizedShadow = (
  shadowLevel: 'light' | 'medium' | 'strong' | 'button' | 'none' = 'medium',
  _backgroundColor = '#FFFFFF',
): ShadowStyle => {
  return ShadowUtils[shadowLevel](__backgroundColor);
};

export default ShadowUtils;
