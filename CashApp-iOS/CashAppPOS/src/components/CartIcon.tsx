import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

interface CartIconProps {
  count: number;
  onPress: () => void;
  testID?: string;
}

const CartIcon: React.FC<CartIconProps> = ({ count, onPress, testID }) => {
  return (
    <TouchableOpacity onPress={onPress} testID={testID} style={styles.container}>
      <View style={styles.icon}>
        <Text>🛒</Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  icon: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    padding: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CartIcon;
