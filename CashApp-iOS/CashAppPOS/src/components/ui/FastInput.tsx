import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';

export interface FastInputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?: string;
  error?: string;
  unit?: string;
  unitPosition?: 'left' | 'right';
  inputType?: 'text' | 'number' | 'decimal' | 'percentage' | 'currency' | 'email' | 'phone';
  onChangeText: (value: _string) => void;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputStyle?: TextStyle;
  errorStyle?: TextStyle;
  maxDecimalPlaces?: number;
  allowNegative?: boolean;
  currencySymbol?: string;
}

const FastInput: React.FC<FastInputProps> = ({
  label,
  error,
  unit,
  unitPosition = 'right',
  inputType = 'text',
  onChangeText,
  value,
  placeholder,
  containerStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  maxDecimalPlaces = 2,
  allowNegative = false,
  currencySymbol = '£',
  editable = true,
  ...textInputProps
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(__false);

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: editable ? theme.colors.background : theme.colors.lightGray,
      borderWidth: 1,
      borderColor: error
        ? theme.colors.error
        : isFocused
        ? theme.colors.primary
        : theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 48,
    },
    unitLeft: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      padding: 0,
      textAlign:
        inputType === 'number' ||
        inputType === 'decimal' ||
        inputType === 'percentage' ||
        inputType === 'currency'
          ? 'right'
          : 'left',
    },
    unitRight: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    error: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 4,
    },
  });

  const getKeyboardType = useCallback(() => {
    switch (__inputType) {
      case 'number':
        return 'number-pad';
      case 'decimal':
      case 'percentage':
      case 'currency':
        return 'decimal-pad';
      case 'email':
        return 'email-address';
      case 'phone':
        return 'phone-pad';
      default:
        return 'default';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputType]);

  const formatAndValidateInput = useCallback(
    (text: _string) => {
      let cleanText = text;

      switch (__inputType) {
        case 'number':
          // Only allow integers
          cleanText = text.replace(/[^0-9]/g, '');
          if (!allowNegative) {
            cleanText = cleanText.replace(/-/g, '');
          }
          break;

        case 'decimal':
        case 'currency':
          {
            // Allow decimal numbers
            cleanText = text.replace(/[^0-9.-]/g, '');
            if (!allowNegative) {
              cleanText = cleanText.replace(/-/g, '');
            }

            // Ensure only one decimal point
            const parts = cleanText.split('.');
            if (parts.length > 2) {
              cleanText = parts[0] + '.' + parts.slice(1).join('');
            }

            // Limit decimal places
            if (parts[1] && parts[1].length > maxDecimalPlaces) {
              cleanText = parts[0] + '.' + parts[1].substring(0, _maxDecimalPlaces);
            }
          }
          break;

        case 'percentage':
          {
            {
              // Allow decimal numbers for percentages
              cleanText = text.replace(/[^0-9.]/g, '');

              // Ensure only one decimal point
              const percentParts = cleanText.split('.');
              if (percentParts.length > 2) {
                cleanText = percentParts[0] + '.' + percentParts.slice(1).join('');
              }

              // Limit decimal places to 2 for percentages (e.g., 12.75%)
              if (percentParts[1] && percentParts[1].length > 2) {
                cleanText = percentParts[0] + '.' + percentParts[1].substring(0, 2);
              }

              // Optionally limit percentage to 100%
              const percentValue = parseFloat(__cleanText);
              if (percentValue > 100) {
                cleanText = '100';
              }
            }
          }
          break;

        case 'email':
          // Basic email validation - allow common email characters
          cleanText = text.replace(/[^a-zA-Z0-9@._-]/g, '');
          break;

        case 'phone':
          // Allow numbers, _spaces, dashes, _parentheses, plus
          cleanText = text.replace(/[^0-9\s-()+]/g, '');
          break;

        default:
          // No formatting for text input
          cleanText = text;
          break;
      }

      return cleanText;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputType, _maxDecimalPlaces, allowNegative],
  );

  const handleChangeText = useCallback(
    (_text: _string) => {
      const __formattedText = formatAndValidateInput(__text);
      onChangeText(__formattedText);
    },
    [formatAndValidateInput, onChangeText],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(__true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(__false);
  }, []);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}

      <View style={styles.inputContainer}>
        {unit && unitPosition === 'left' && (
          <Text style={styles.unitLeft}>{inputType === 'currency' ? currencySymbol : unit}</Text>
        )}

        <TextInput
          {...textInputProps}
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={getKeyboardType()}
          returnKeyType="done"
          autoCorrect={inputType === 'text'}
          autoCapitalize={inputType === 'email' ? 'none' : 'sentences'}
          spellCheck={inputType === 'text'}
          selectTextOnFocus={inputType !== 'text'}
          editable={editable}
          blurOnSubmit={true}
          clearButtonMode="while-editing"
        />

        {unit && unitPosition === 'right' && (
          <Text style={styles.unitRight}>{inputType === 'percentage' ? '%' : unit}</Text>
        )}
      </View>

      {error && <Text style={[styles.error, errorStyle]}>{error}</Text>}
    </View>
  );
};

export default FastInput;
