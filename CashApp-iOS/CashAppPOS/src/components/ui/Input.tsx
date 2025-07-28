import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';
import { Theme } from '../../design-system/theme';

// Input variants
export type InputVariant = 'default' | 'error' | 'success';

// Input sizes
export type InputSize = 'sm' | 'md' | 'lg';

// Input props interface
export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  variant?: InputVariant;
  size?: InputSize;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  required?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  testID?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  variant = 'default',
  size = 'md',
  leftIcon,
  rightIcon,
  onRightIconPress,
  required = false,
  disabled = false,
  style,
  inputStyle,
  testID,
  ...textInputProps
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const styles = createStyles(theme);

  // Determine variant based on error
  const currentVariant = error ? 'error' : variant;

  // Get variant styles
  const getVariantStyles = (): { border: string; icon: string } => {
    switch (currentVariant) {
      case 'error':
        return {
          border: theme.colors.danger[500],
          icon: theme.colors.danger[500],
        };
      case 'success':
        return {
          border: theme.colors.success[500],
          icon: theme.colors.success[500],
        };
      default:
        return {
          border: isFocused ? theme.colors.primary : theme.colors.border,
          icon: theme.colors.neutral[400],
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { 
    container: ViewStyle; 
    input: TextStyle; 
    icon: number;
    label: TextStyle;
  } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: theme.spacing[3],
            paddingVertical: theme.spacing[2],
            borderRadius: theme.borderRadius.md,
          },
          input: { fontSize: theme.typography.fontSize.sm },
          icon: 16,
          label: { fontSize: theme.typography.fontSize.sm },
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: theme.spacing[5],
            paddingVertical: theme.spacing[4],
            borderRadius: theme.borderRadius.xl,
          },
          input: { fontSize: theme.typography.fontSize.lg },
          icon: 24,
          label: { fontSize: theme.typography.fontSize.lg },
        };
      default:
        return {
          container: {
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3],
            borderRadius: theme.borderRadius.lg,
          },
          input: { fontSize: theme.typography.fontSize.base },
          icon: 20,
          label: { fontSize: theme.typography.fontSize.base },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = [
    styles.container,
    sizeStyles.container,
    {
      borderColor: variantStyles.border,
      borderWidth: isFocused ? 2 : 1,
    },
    disabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle;

  const inputTextStyle: TextStyle = [
    styles.input,
    sizeStyles.input,
    {
      color: disabled ? theme.colors.neutral[400] : theme.colors.text,
    },
    inputStyle,
  ].filter(Boolean) as TextStyle;

  return (
    <View style={styles.wrapper}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, sizeStyles.label]}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}

      {/* Input Container */}
      <View style={containerStyle}>
        {/* Left Icon */}
        {leftIcon && (
          <Icon 
            name={leftIcon} 
            size={sizeStyles.icon} 
            color={variantStyles.icon}
            style={styles.leftIcon}
          />
        )}

        {/* Text Input */}
        <TextInput
          style={inputTextStyle}
          placeholderTextColor={theme.colors.neutral[400]}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          {...textInputProps}
        />

        {/* Right Icon */}
        {rightIcon && (
          <TouchableOpacity 
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIconContainer}
          >
            <Icon 
              name={rightIcon} 
              size={sizeStyles.icon} 
              color={variantStyles.icon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Helper/Error Text */}
      {(error || helper) && (
        <View style={styles.helperContainer}>
          {error && (
            <View style={styles.errorContainer}>
              <Icon 
                name="error" 
                size={14} 
                color={theme.colors.danger[500]}
                style={styles.errorIcon}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {helper && !error && (
            <Text style={styles.helperText}>{helper}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: theme.spacing[4],
    },
    labelContainer: {
      marginBottom: theme.spacing[2],
    },
    label: {
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    required: {
      color: theme.colors.danger[500],
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderWidth: 1,
    },
    disabled: {
      backgroundColor: theme.colors.neutral[50],
      opacity: 0.6,
    },
    input: {
      flex: 1,
      fontFamily: theme.typography.fontFamily.sans,
      color: theme.colors.text,
      padding: 0, // Remove default padding
    },
    leftIcon: {
      marginRight: theme.spacing[3],
    },
    rightIconContainer: {
      marginLeft: theme.spacing[3],
      padding: theme.spacing[1],
    },
    helperContainer: {
      marginTop: theme.spacing[1],
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorIcon: {
      marginRight: theme.spacing[1],
    },
    errorText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.danger[500],
      flex: 1,
    },
    helperText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[500],
    },
  });

export default Input;