import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { breakpoints, deviceTypes } from '../design-system/theme';

interface ResponsiveHookReturn {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export const useResponsive = (): ResponsiveHookReturn => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  // Device type detection
  const isPhone = width < breakpoints.md;
  const isTablet = width >= breakpoints.md && width < breakpoints.xl;
  const isDesktop = width >= breakpoints.xl;

  // Orientation
  const orientation = width > height ? 'landscape' : 'portrait';

  // Breakpoint detection
  const getBreakpoint = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' => {
    if (width >= breakpoints.xxl) return 'xxl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return 'xs';
  };

  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    orientation,
    breakpoint: getBreakpoint(),
  };
};

// Hook for responsive values based on breakpoints
export const useResponsiveValue = <T>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    xxl?: T;
  },
  fallback: T
): T => {
  const { breakpoint } = useResponsive();

  // Return value based on current breakpoint, falling back to smaller breakpoints
  if (values[breakpoint] !== undefined) return values[breakpoint]!;
  
  // Fallback logic
  const breakpointOrder: Array<keyof typeof values> = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);
  
  for (let i = currentIndex + 1; i < breakpointOrder.length; i++) {
    const key = breakpointOrder[i];
    if (values[key] !== undefined) return values[key]!;
  }
  
  return fallback;
};

// Hook for responsive grid columns
export const useResponsiveColumns = (
  columns: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  },
  defaultColumns: number = 1
): number => {
  return useResponsiveValue(columns, defaultColumns);
};

// Hook for responsive spacing
export const useResponsiveSpacing = (
  spacing: {
    xs?: keyof typeof import('../design-system/theme').spacing;
    sm?: keyof typeof import('../design-system/theme').spacing;
    md?: keyof typeof import('../design-system/theme').spacing;
    lg?: keyof typeof import('../design-system/theme').spacing;
    xl?: keyof typeof import('../design-system/theme').spacing;
    xxl?: keyof typeof import('../design-system/theme').spacing;
  },
  defaultSpacing: keyof typeof import('../design-system/theme').spacing = 4
) => {
  return useResponsiveValue(spacing, defaultSpacing);
};

export default useResponsive;