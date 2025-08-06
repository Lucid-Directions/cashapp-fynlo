// Theme Constants for Fynlo POS Design System
// Centralized constants to avoid magic numbers in components

export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 60,
  xxxl: 80,
} as const;

export const MODAL_DIMENSIONS = {
  small: {
    width: 320,
    maxHeight: 400,
  },
  medium: {
    width: 400,
    maxHeight: 500,
  },
  large: {
    width: 500,
    maxHeight: 600,
  },
  fullscreen: {
    widthPercent: 0.9,
    maxWidth: 500,
    heightPercent: 0.8,
  },
} as const;

export const ANIMATION_DURATIONS = {
  instant: 0,
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 1000,
} as const;

export const ANIMATION_CONFIG = {
  spring: {
    friction: 8,
    tension: 40,
  },
  timing: {
    useNativeDriver: true,
  },
} as const;

export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700,
} as const;

export const OPACITY = {
  disabled: 0.5,
  overlay: 0.7,
  subtle: 0.8,
  full: 1,
} as const;

export const BORDER_WIDTH = {
  thin: 1,
  medium: 2,
  thick: 3,
} as const;

export const LINE_HEIGHT = {
  tight: 18,
  normal: 22,
  relaxed: 26,
  loose: 30,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 36,
} as const;

export const PROGRESS_BAR = {
  height: 4,
  borderRadius: 2,
} as const;

export const LETTER_SPACING = {
  tight: -1,
  normal: 0,
  wide: 1,
} as const;
