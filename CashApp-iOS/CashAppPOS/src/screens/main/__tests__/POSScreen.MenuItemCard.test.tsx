import React from 'react';

import { StyleSheet } from 'react-native'; // Import StyleSheet

import { render } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../../../design-system/ThemeProvider'; // Adjust path as needed
import useAppStore from '../../../store/useAppStore'; // Adjust path as needed
import { ExportedMenuItemCard } from '../POSScreen'; // Import the correctly named exported component

import type { MenuItem, OrderItem } from '../../../types'; // OrderItem needed for cart

// Mock useAppStore
jest.mock('../../../store/useAppStore');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
  addEventListener: jest.fn(),
  useNetInfo: jest.fn(() => ({ isConnected: true, type: 'wifi' })),
}));

// Mock QuantityPill component
jest.mock('../../../components/inputs', () => ({
  QuantityPill: ({ quantity, onIncrease, onDecrease }: any) => {
    import React from 'react';

    import { View, Text, TouchableOpacity } from 'react-native';
    return React.createElement(View, { testID: 'quantity-pill' }, [
      React.createElement(
        TouchableOpacity,
        { key: 'decrease', onPress: onDecrease, testID: 'quantity-decrease' },
        React.createElement(Text, {}, '-')
      ),
      React.createElement(Text, { key: 'quantity', testID: 'quantity-text' }, quantity),
      React.createElement(
        TouchableOpacity,
        { key: 'increase', onPress: onIncrease, testID: 'quantity-increase' },
        React.createElement(Text, {}, '+')
      ),
    ]);
  },
}));

// Mock useNavigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Minimal styles mock - replace with actual createStyles if needed for visual accuracy
const mockCreateStyles = (_theme: unknown) =>
  StyleSheet.create({
    menuCard: { backgroundColor: 'white', padding: 10 },
    menuCardDisabled: { opacity: 0.5 },
    menuCardContent: {},
    menuItemEmoji: {},
    menuItemName: {},
    menuItemPrice: { overflow: 'hidden' },
    quantityPillContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  });

const mockMenuItem: MenuItem = {
  id: 1,
  name: 'Test Item',
  price: 10.0,
  category: 'Test Category',
  emoji: '🧪',
  available: true,
  description: 'A test item description.',
};

// Wrapper component to provide theme and styles
const TestWrapper = ({ quantity }: { quantity: number }) => {
  const { theme } = useTheme();
  const styles = mockCreateStyles(theme);

  const mockCart: OrderItem[] =
    quantity > 0 ? [{ ...mockMenuItem, quantity, modifications: [], notes: '' }] : [];
  const mockAddToCart = jest.fn();
  const mockUpdateCartItem = jest.fn();
  const mockRemoveFromCart = jest.fn();

  (useAppStore as jest.Mock).mockReturnValue({
    cart: mockCart,
    addToCart: mockAddToCart,
    removeFromCart: mockRemoveFromCart,
    updateCartItem: mockUpdateCartItem,
  });

  return (
    <ExportedMenuItemCard
      item={mockMenuItem}
      theme={theme}
      styles={styles}
      cart={mockCart}
      handleAddToCart={mockAddToCart}
      handleUpdateQuantity={(id, qty) => {
        if (qty <= 0) {
          mockRemoveFromCart(id);
        } else {
          mockUpdateCartItem(id, { quantity: qty });
        }
      }}
    />
  );
};

const renderMenuItemCardWithQuantity = (quantity: number) => {
  return render(
    <ThemeProvider>
      <TestWrapper quantity={quantity} />
    </ThemeProvider>
  );
};

describe('ExportedMenuItemCard Snapshot Tests', () => {
  beforeEach(() => {
    (useAppStore as jest.Mock).mockClear();
  });

  it('renders correctly with no items in cart (quantity 0)', () => {
    const tree = renderMenuItemCardWithQuantity(0).toJSON();
    expect(tree).toMatchSnapshot();
  });

  for (let i = 1; i <= 10; i++) {
    it(`renders correctly with quantity ${i}`, () => {
      const tree = renderMenuItemCardWithQuantity(i).toJSON();
      expect(tree).toMatchSnapshot();
    });
  }
});
