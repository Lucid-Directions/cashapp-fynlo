/**
 * QuantityPill - Clean, centered quantity control component
 * 
 * Features:
 * - Fixed width design that accommodates 2-digit counts
 * - Centered alignment with proper spacing
 * - Accessible hit targets (40px high)
 * - Smooth animations for count changes
 * - Theme-aware styling
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../design-system/ThemeProvider';

interface QuantityPillProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  style?: ViewStyle;
  minValue?: number;
  maxValue?: number;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  colorScheme?: 'primary' | 'accent' | 'success';
}

const QuantityPill: React.FC<QuantityPillProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  style,
  minValue = 0,
  maxValue = 99,
  disabled = false,
  size = 'medium',
  colorScheme = 'accent',
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  // Animation for count changes
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Trigger scale animation when quantity changes
  React.useEffect(() => {
    scale.value = withTiming(1.1, { duration: 75 }, () => {
      scale.value = withTiming(1, { duration: 75 });
    });
  }, [quantity]);

  // Size configurations
  const sizeConfig = {
    small: { width: 80, height: 32, iconSize: 16, fontSize: 12 },
    medium: { width: 96, height: 40, iconSize: 18, fontSize: 14 },
    large: { width: 112, height: 48, iconSize: 20, fontSize: 16 },
  };

  const config = sizeConfig[size];

  // Color scheme configurations
  const getColorScheme = () => {
    switch (colorScheme) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary,
          textColor: theme.colors.white,
          buttonColor: 'rgba(255, 255, 255, 0.2)',
          iconColor: theme.colors.white,
        };
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          textColor: theme.colors.white,
          buttonColor: 'rgba(255, 255, 255, 0.2)',
          iconColor: theme.colors.white,
        };
      case 'accent':
      default:
        return {
          backgroundColor: theme.colors.accent,
          textColor: theme.colors.white,
          buttonColor: 'rgba(255, 255, 255, 0.2)',
          iconColor: theme.colors.white,
        };
    }
  };

  const colors = getColorScheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: config.width,
      height: config.height,
      backgroundColor: disabled ? theme.colors.lightGray : colors.backgroundColor,
      borderRadius: config.height / 2, // Perfect circle ends
      paddingHorizontal: 8,
      opacity: disabled ? 0.6 : 1,
    },
    button: {
      width: config.height - 8, // Circular button
      height: config.height - 8,
      borderRadius: (config.height - 8) / 2,
      backgroundColor: colors.buttonColor,
      justifyContent: 'center',
      alignItems: 'center',
      // Ensure proper hit target
      minWidth: 32,
      minHeight: 32,
    },
    buttonDisabled: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    quantityContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    quantityText: {
      fontSize: config.fontSize,
      fontWeight: '600',
      color: disabled ? theme.colors.darkGray : colors.textColor,
      textAlign: 'center',
      minWidth: 20, // Ensures consistent width for 1-2 digit numbers
    },
  });

  const canDecrease = quantity > minValue && !disabled;
  const canIncrease = quantity < maxValue && !disabled;

  return (
    <View style={[styles.container, style]} testID="quantity-pill">
      <TouchableOpacity
        style={[
          styles.button,
          !canDecrease && styles.buttonDisabled,
        ]}
        onPress={onDecrease}
        disabled={!canDecrease}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="quantity-decrease"
      >
        <Minus
          size={config.iconSize}
          color={canDecrease ? colors.iconColor : 'rgba(255, 255, 255, 0.5)'}
          strokeWidth={2.5}
        />
      </TouchableOpacity>

      <Animated.View style={[styles.quantityContainer, animatedStyle]}>
        <Text style={styles.quantityText} testID="quantity-text">
          {quantity}
        </Text>
      </Animated.View>

      <TouchableOpacity
        style={[
          styles.button,
          !canIncrease && styles.buttonDisabled,
        ]}
        onPress={onIncrease}
        disabled={!canIncrease}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="quantity-increase"
      >
        <Plus
          size={config.iconSize}
          color={canIncrease ? colors.iconColor : 'rgba(255, 255, 255, 0.5)'}
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    </View>
  );
};

export default QuantityPill;