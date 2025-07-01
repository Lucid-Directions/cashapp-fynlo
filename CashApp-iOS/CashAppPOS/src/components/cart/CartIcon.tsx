import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';

interface Props {
  count: number;
  onPress?: () => void;
  testID?: string;
  size?: number;
  fill?: string; // Added fill prop for consistency, though color logic is internal
}

const CartIcon: React.FC<Props> = ({ count, onPress, testID, size = 28 }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Fynlo Orange for empty cart, Red for cart with items
  const fynloOrange = '#FF6D00';
  const fynloRed = '#FF3B30';

  const iconColor = count > 0 ? fynloRed : fynloOrange;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} accessibilityRole="button" testID={testID}>
      <Icon name="shopping-cart" size={size} color={iconColor} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: 8,
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: '#FF3B30', // Badge color remains red
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    badgeTxt: {
      color: theme.colors.white, // Text color for badge
      fontSize: 11,
      fontWeight: '600',
    },
  });

export default CartIcon; 