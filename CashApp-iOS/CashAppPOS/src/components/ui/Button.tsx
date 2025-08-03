import React from 'react';

import type { ViewStyle, TextStyle } from 'react-native';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';

// Button variants
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning';

// Button sizes
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

// Button props interface
export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  testID,
}) => {
  const { theme } = useTheme();

  // Get variant styles
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: disabled ? theme.colors.neutral[300] : theme.colors.primary,
          },
          text: { color: theme.colors.white },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: disabled ? theme.colors.neutral[100] : theme.colors.secondary,
          },
          text: { color: theme.colors.white },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: disabled ? theme.colors.neutral[300] : theme.colors.primary,
          },
          text: { color: disabled ? theme.colors.neutral[400] : theme.colors.primary },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: disabled ? theme.colors.neutral[400] : theme.colors.primary },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: disabled ? theme.colors.neutral[300] : theme.colors.danger[500],
          },
          text: { color: theme.colors.white },
        };
      case 'success':
        return {
          container: {
            backgroundColor: disabled ? theme.colors.neutral[300] : theme.colors.success[500],
          },
          text: { color: theme.colors.white },
        };
      case 'warning':
        return {
          container: {
            backgroundColor: disabled ? theme.colors.neutral[300] : theme.colors.warning[500],
          },
          text: { color: theme.colors.white },
        };
      default:
        return {
          container: { backgroundColor: theme.colors.primary },
          text: { color: theme.colors.white },
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; icon: number } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingVertical: theme.spacing[2],
            paddingHorizontal: theme.spacing[3],
            borderRadius: theme.borderRadius.md,
          },
          text: { fontSize: theme.typography.fontSize.sm },
          icon: 16,
        };
      case 'md':
        return {
          container: {
            paddingVertical: theme.spacing[3],
            paddingHorizontal: theme.spacing[4],
            borderRadius: theme.borderRadius.lg,
          },
          text: { fontSize: theme.typography.fontSize.base },
          icon: 20,
        };
      case 'lg':
        return {
          container: {
            paddingVertical: theme.spacing[4],
            paddingHorizontal: theme.spacing[6],
            borderRadius: theme.borderRadius.xl,
          },
          text: { fontSize: theme.typography.fontSize.lg },
          icon: 24,
        };
      case 'xl':
        return {
          container: {
            paddingVertical: theme.spacing[5],
            paddingHorizontal: theme.spacing[8],
            borderRadius: theme.borderRadius.xl,
          },
          text: { fontSize: theme.typography.fontSize.xl },
          icon: 28,
        };
      default:
        return {
          container: {
            paddingVertical: theme.spacing[3],
            paddingHorizontal: theme.spacing[4],
            borderRadius: theme.borderRadius.lg,
          },
          text: { fontSize: theme.typography.fontSize.base },
          icon: 20,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Create theme-dependent styles inline
  const baseStyle = {
    ...styles.base,
    ...theme.shadows.sm,
  };

  const textBaseStyle = {
    ...styles.text,
    fontWeight: theme.typography.fontWeight.semibold,
  };

  const containerStyle: ViewStyle = [
    baseStyle,
    sizeStyles.container,
    variantStyles.container,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle;

  const textStyleCombined: TextStyle = [
    textBaseStyle,
    sizeStyles.text,
    variantStyles.text,
    textStyle,
  ].filter(Boolean) as TextStyle;

  const iconColor = variantStyles.text.color as string;

  // Create theme-dependent spacing styles inline
  const loadingIndicatorStyle = {
    ...styles.loadingIndicator,
    marginRight: theme.spacing[2],
  };

  const iconLeftStyle = {
    ...styles.iconLeft,
    marginRight: theme.spacing[2],
  };

  const iconRightStyle = {
    ...styles.iconRight,
    marginLeft: theme.spacing[2],
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.contentContainer}>
          <ActivityIndicator size="small" color={iconColor} style={loadingIndicatorStyle} />
          <Text style={[textStyleCombined, styles.loadingText]}>{title}</Text>
        </View>
      );
    }

    if (icon) {
      return (
        <View style={styles.contentContainer}>
          {iconPosition === 'left' && (
            <Icon name={icon} size={sizeStyles.icon} color={iconColor} style={iconLeftStyle} />
          )}
          <Text style={textStyleCombined}>{title}</Text>
          {iconPosition === 'right' && (
            <Icon name={icon} size={sizeStyles.icon} color={iconColor} style={iconRightStyle} />
          )}
        </View>
      );
    }

    return <Text style={textStyleCombined}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// Static styles - no theme dependencies
const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    textAlign: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    // marginRight will be added inline with theme.spacing[2]
  },
  iconRight: {
    // marginLeft will be added inline with theme.spacing[2]
  },
  loadingIndicator: {
    // marginRight will be added inline with theme.spacing[2]
  },
  loadingText: {
    opacity: 0.8,
  },
});

export default Button;
