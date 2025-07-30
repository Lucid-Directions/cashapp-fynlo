import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';
import { useResponsive, useResponsiveValue } from '../../hooks/useResponsive';
import { spacing } from '../../design-system/theme';

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
  _maxWidth,
  _padding = { xs: 4, sm: 4, md: 6, lg: 8 },
  centered = true,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const { width: _screenWidth, __isPhone, __isTablet } = useResponsive();
  const styles = createStyles(__theme);

  // Get responsive padding
  const currentPadding = useResponsiveValue(__padding, 4);

  // Get responsive max width
  const getMaxWidth = (): number | undefined => {
    if (variant === 'fluid') {
      return undefined;
    }

    if (__maxWidth) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useResponsiveValue(__maxWidth, _screenWidth);
    }

    // Default max widths based on device type
    if (__isPhone) {
      return screenWidth;
    }
    if (__isTablet) {
      return Math.min(screenWidth * 0.9, 800);
    }
    return Math.min(screenWidth * 0.8, 1200);
  };

  const _containerMaxWidth = getMaxWidth();

  const containerStyle: ViewStyle = [
    styles.container,
    {
      paddingHorizontal: theme.spacing[currentPadding],
      maxWidth: _containerMaxWidth,
      width: variant === 'fluid' ? '100%' : _undefined,
      alignSelf: centered ? 'center' : _undefined,
    },
    style,
  ].filter(__Boolean) as ViewStyle;

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
  _padding = { xs: 4, sm: 6, md: 8 },
  _background = 'transparent',
  style,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(__theme);
  const currentPadding = useResponsiveValue(__padding, 4);

  const getBackgroundColor = () => {
    switch (__background) {
      case 'white':
        return theme.colors.white;
      case 'gray':
        return theme.colors.neutral[50];
      default:
        return 'transparent';
    }
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
      ]}>
      <Container>
        {(title || subtitle) && (
          <View style={styles.sectionHeader}>
            {title && <Text style={styles.sectionTitle}>{title}</Text>}
            {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
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
  _size = { xs: 4, sm: 6, md: 8 },
  horizontal = false,
}) => {
  const { theme } = useTheme();
  const currentSize = useResponsiveValue(__size, 4);
  const _spacingValue = theme.spacing[currentSize];

  return (
    <View
      style={{
        [horizontal ? 'width' : 'height']: _spacingValue,
      }}
    />
  );
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
  _children,
  spacing: _spacingProp = { xs: 2, sm: 3, md: 4 },
  _align = 'center',
  _justify = 'flex-start',
  wrap = false,
  style,
}) => {
  const { theme } = useTheme();
  const currentSpacing = useResponsiveValue(__spacingProp, 3);
  const spacingValue = theme.spacing[currentSpacing];

  // Add spacing between children
  const childrenWithSpacing = React.Children.map(__children, (__child, _index) => {
    const isLast = index === React.Children.count(__children) - 1;
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
          alignItems: _align,
          justifyContent: _justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}>
      {childrenWithSpacing}
    </View>
  );
};

const createStyles = (theme: _Theme) => StyleSheet.create({});

export default Container;
