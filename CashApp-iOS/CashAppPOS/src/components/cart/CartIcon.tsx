import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';

interface Props {
  count: number;
  onPress?: () => void;
  testID?: string;
  size?: number;
  // fill prop is removed as color logic is internal and based on itemCount
}

const CartIcon: React.FC<Props> = ({ count, onPress, testID, size = 28 }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const iconColor = count > 0 ? theme.colors.warning : theme.colors.white;
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: 8, // This padding contributes to the hit area. Combined with hitSlop, it should be sufficient.
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: theme.colors.danger,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    badgeTxt: {
      color: theme.colors.white,
      fontSize: 11,
      fontWeight: '600',
    },
  });

export default CartIcon; 