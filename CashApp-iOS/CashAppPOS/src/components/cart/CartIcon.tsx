import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';
import { Colors } from '../../constants/Colors';

interface Props {
  count: number;
  onPress?: () => void;
  testID?: string;
  size?: number;
  // fill prop is removed as color logic is internal and based on itemCount
}

const CartIcon: React.FC<Props> = ({ count, onPress, testID, size = 28 }) => {
  const { theme } = useTheme(); // theme might be used for other styling, keeping it.
  const styles = createStyles(theme, count); // Pass count to createStyles for dynamic badge color

  const iconColor = count > 0 ? Colors.alertSoft : Colors.onPrimary;
  const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      hitSlop={hitSlop}
    >
      <Icon name="shopping-cart" size={size} color={iconColor} />
      {count > 0 && (
        <View style={styles.badge} testID="cart-badge">
          <Text style={styles.badgeTxt}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: any, count: number) => // Added count as a parameter
  StyleSheet.create({
    container: {
      padding: 8, // This padding contributes to the hit area. Combined with hitSlop, it should be sufficient.
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: Colors.alertStrong, // Badge color updated to alertStrong
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    badgeTxt: {
      color: Colors.white, // Text color for badge, assuming white is desired for onPrimary
      fontSize: 11,
      fontWeight: '600',
    },
  });

export default CartIcon; 