import React from 'react';
import type { ViewStyle, GestureResponderEvent } from 'react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import type { Theme } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Card variants
export type CardVariant = 'default' | 'elevated' | 'outlined' | 'flat';

// Card sizes
export type CardSize = 'sm' | 'md' | 'lg';

// Card props interface
export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  size = 'md',
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  // Get variant styles
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.colors.white,
          ...theme.shadows.lg,
        };
      case 'outlined':
        return {
          backgroundColor: theme.colors.white,
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
      case 'flat':
        return {
          backgroundColor: theme.colors.white,
        };
      default:
        return {
          backgroundColor: theme.colors.white,
          ...theme.shadows.md,
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          padding: theme.spacing[3],
          borderRadius: theme.borderRadius.lg,
        };
      case 'lg':
        return {
          padding: theme.spacing[6],
          borderRadius: theme.borderRadius['2xl'],
        };
      default:
        return {
          padding: theme.spacing[4],
          borderRadius: theme.borderRadius.xl,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const cardStyle: ViewStyle = [
    styles.base,
    variantStyles,
    sizeStyles,
    disabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle;

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={cardStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      {children}
    </Component>
  );
};

// Card Header Component
export interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, style }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingBottom: theme.spacing[3],
          borderBottomColor: theme.colors.neutral[100],
          marginBottom: theme.spacing[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

// Card Body Component
export interface CardBodyProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, style }) => {
  const { theme } = useTheme();

  return <View style={[styles.body, style]}>{children}</View>;
};

// Card Footer Component
export interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, style }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingTop: theme.spacing[3],
          borderTopColor: theme.colors.neutral[100],
          marginTop: theme.spacing[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
  header: {
    borderBottomWidth: 1,
  },
  body: {
    // No default styles - flexible content area
  },
  footer: {
    borderTopWidth: 1,
  },
});

export default Card;
