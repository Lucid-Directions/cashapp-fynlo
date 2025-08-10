import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, _Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { logger } from '../../utils/logger';

interface DecimalInputProps {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  suffix?: string;
  maxValue?: number;
  minValue?: number;
  decimalPlaces?: number;
  label?: string;
  style?: unknown;
  disabled?: boolean;
}

const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onValueChange,
  placeholder = '0.00',
  suffix = '',
  maxValue = 999.99,
  minValue = 0,
  decimalPlaces = 2,
  label,
  style,
  disabled = false,
}) => {
  const [displayValue, setDisplayValue] = useState(value.toFixed(decimalPlaces));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Update display when external value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toFixed(decimalPlaces));
    }
  }, [value, decimalPlaces, isFocused]);

  const handleTextChange = (text: string) => {
    logger.info('💰 DecimalInput - Raw input:', text);

    // Allow empty string - don't call onValueChange yet
    if (text === '') {
      setDisplayValue('');
      return;
    }

    // Remove any non-numeric characters except decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');

    // Handle multiple decimal points - keep only the first one
    const decimalIndex = cleaned.indexOf('.');
    if (decimalIndex !== -1) {
      const beforeDecimal = cleaned.substring(0, decimalIndex);
      const afterDecimal = cleaned.substring(decimalIndex + 1).replace(/\./g, '');
      cleaned = beforeDecimal + '.' + afterDecimal;
    }

    // Limit decimal places only if we have more than allowed
    if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length > decimalPlaces) {
        cleaned = parts[0] + '.' + parts[1].substring(0, decimalPlaces);
      }
    }

    // Update display value with cleaned input
    setDisplayValue(cleaned);

    // Convert to number to validate range - only if it's a complete number
    const numericValue = parseFloat(cleaned);

    // Only update parent if we have a valid number and it's not just a decimal point
    if (!isNaN(numericValue) && cleaned !== '.') {
      const clampedValue = Math.max(minValue, Math.min(maxValue, numericValue));
      logger.info('💰 DecimalInput - Calling onValueChange with:', clampedValue);
      onValueChange(clampedValue);
    }

    logger.info('💰 DecimalInput - Display value set to:', cleaned);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Don't clear the input - keep the current value visible for editing
    logger.info('💰 DecimalInput - Focus gained, keeping value:', displayValue);
  };

  const handleBlur = () => {
    setIsFocused(false);

    // Convert to number and validate
    const numericValue = parseFloat(displayValue) || 0;
    const clampedValue = Math.max(minValue, Math.min(maxValue, numericValue));

    // Format the display value nicely when losing focus - only format if it's a valid number
    if (!isNaN(numericValue) && displayValue !== '') {
      setDisplayValue(clampedValue.toFixed(decimalPlaces));

      // Only call onValueChange if the value actually changed
      if (clampedValue !== value) {
        onValueChange(clampedValue);
      }
    }

    logger.info('💰 DecimalInput - Blur with final value:', clampedValue);
  };

  const handleClear = () => {
    setDisplayValue('');
    inputRef.current?.focus();
  };

  const handlePresetValue = (presetValue: number) => {
    const formattedValue = presetValue.toFixed(decimalPlaces);
    setDisplayValue(formattedValue);
    onValueChange(presetValue);
  };

  // Common preset values for service charges
  const presetValues = [0, 2.5, 5, 10, 12.5, 15, 20];
  const showPresets =
    label?.toLowerCase().includes('service') || label?.toLowerCase().includes('charge');

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          disabled && styles.inputContainerDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, disabled && styles.inputDisabled]}
          value={displayValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          editable={!disabled}
          maxLength={10}
          blurOnSubmit={true}
          multiline={false}
        />

        {displayValue !== '' && !disabled && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Icon name="clear" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {suffix && <Text style={[styles.suffix, disabled && styles.suffixDisabled]}>{suffix}</Text>}
      </View>

      {/* Preset buttons for service charges */}
      {showPresets && !disabled && (
        <View style={styles.presetsContainer}>
          <Text style={styles.presetsLabel}>Quick values:</Text>
          <View style={styles.presetButtons}>
            {presetValues.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetButton, value === preset && styles.presetButtonActive]}
                onPress={() => handlePresetValue(preset)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    value === preset && styles.presetButtonTextActive,
                  ]}
                >
                  {preset}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  inputContainerFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#F8F9FF',
  },
  inputContainerDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D1D1D1',
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    padding: 0,
    textAlign: 'left',
  },
  inputDisabled: {
    color: '#999',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  suffix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  suffixDisabled: {
    color: '#999',
  },
  presetsContainer: {
    marginTop: 12,
  },
  presetsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  presetButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  presetButtonTextActive: {
    color: '#fff',
  },
});

export default DecimalInput;
