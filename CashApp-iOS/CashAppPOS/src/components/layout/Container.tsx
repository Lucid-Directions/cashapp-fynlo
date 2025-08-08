import React from 'react';
import type { ViewStyle } from 'react-native';
import { View, Text, StyleSheet } from 'react-native';

import { spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { useResponsive, useResponsiveValue } from '../../hooks/useResponsive';

// Container variants
export type ContainerVariant = 'fluid' | 'constrained';

// Container props interface
export interface ContainerProps {
  children: React.ReactNode;
  variant?: ContainerVariant;
  maxWidth?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  padding?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  centered?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const Container: React.FC<ContainerProps> = ({
  children,
  variant = 'constrained',
  maxWidth,
  padding = { xs: 4, sm: 4, md: 6, lg: 8 },
  centered = true,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const { width: screenWidth, isPhone, isTablet } = useResponsive();

  // Get responsive padding
  const currentPadding = useResponsiveValue(padding, 4);

  // Get responsive max width
  const getMaxWidth = (): number | undefined => {
    if (variant === 'fluid') return undefined;

    if (maxWidth) {
      return useResponsiveValue(maxWidth, screenWidth);
    }

    // Default max widths based on device type
    if (isPhone) return screenWidth;
    if (isTablet) return Math.min(screenWidth * 0.9, 800);
    return Math.min(screenWidth * 0.8, 1200);
  };

  const containerMaxWidth = getMaxWidth();

  const containerStyle: ViewStyle = [
    styles.container,
    {
      paddingHorizontal: theme.spacing[currentPadding],
      maxWidth: containerMaxWidth,
      width: variant === 'fluid' ? '100%' : undefined,
      alignSelf: centered ? 'center' : undefined,
    },
    style,
  ].filter(Boolean) as ViewStyle;

  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
};

// Section Container Component
export interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  padding?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  background?: 'transparent' | 'white' | 'gray';
  style?: ViewStyle;
}

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  padding = { xs: 4, sm: 6, md: 8 },
  background = 'transparent',
  style,
}) => {
  const { theme } = useTheme();
  const currentPadding = useResponsiveValue(padding, 4);

  const getBackgroundColor = () => {
    switch (background) {
      case 'white':
        return theme.colors.white;
      case 'gray':
        return theme.colors.neutral[50];
      default:
        return 'transparent';
    }
  };

  // Theme-based dynamic styles for section header
  const sectionHeaderStyle = {
    ...styles.sectionHeader,
    marginBottom: theme.spacing[6],
  };

  const sectionTitleStyle = {
    ...styles.sectionTitle,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing[2],
  };

  const sectionSubtitleStyle = {
    ...styles.sectionSubtitle,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.neutral[600],
  };

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: theme.spacing[currentPadding],
        },
        style,
      ]}
    >
      <Container>
        {(title || subtitle) && (
          <View style={sectionHeaderStyle}>
            {title && <Text style={sectionTitleStyle}>{title}</Text>}
            {subtitle && <Text style={sectionSubtitleStyle}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </Container>
    </View>
  );
};

// Spacer Component for responsive spacing
export interface SpacerProps {
  size?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  horizontal?: boolean;
}

export const Spacer: React.FC<SpacerProps> = ({
  size = { xs: 4, sm: 6, md: 8 },
  horizontal = false,
}) => {
  const { theme } = useTheme();
  const currentSize = useResponsiveValue(size, 4);
  const spacingValue = theme.spacing[currentSize];

  const dynamicStyle1 = { [horizontal ? 'width' : 'height']: spacingValue };
  return <View style={dynamicStyle1} />;
};

// Row Component for horizontal layouts
export interface RowProps {
  children: React.ReactNode;
  spacing?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  wrap?: boolean;
  style?: ViewStyle;
}

export const Row: React.FC<RowProps> = ({
  children,
  spacing: spacingProp = { xs: 2, sm: 3, md: 4 },
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  style,
}) => {
  const { theme } = useTheme();
  const currentSpacing = useResponsiveValue(spacingProp, 3);
  const spacingValue = theme.spacing[currentSpacing];

  // Add spacing between children
  const childrenWithSpacing = React.Children.map(children, (child, index) => {
    const isLast = index === React.Children.count(children) - 1;
    return (
      <React.Fragment key={index}>
        {child}
        {!isLast && <View style={{ width: spacingValue }} />}
      </React.Fragment>
    );
  });

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {childrenWithSpacing}
    </View>
  );
};

// Static styles - no theme dependencies
const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  section: {
    width: '100%',
  },
  sectionHeader: {
    // marginBottom will be added inline with theme.spacing[6]
  },
  sectionTitle: {
    // fontSize, fontWeight, color, marginBottom will be added inline
  },
  sectionSubtitle: {
    // fontSize and color will be added inline
  },
});

export default Container;
