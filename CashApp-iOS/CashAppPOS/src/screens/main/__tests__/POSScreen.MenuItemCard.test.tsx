import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../../design-system/ThemeProvider'; // Adjust path as needed
import { ExportedMenuItemCard } from '../POSScreen'; // Import the correctly named exported component
import useAppStore from '../../../store/useAppStore'; // Adjust path as needed
import { MenuItem, OrderItem } from '../../../types'; // OrderItem needed for cart
import { StyleSheet } from 'react-native'; // Import StyleSheet

// Mock useAppStore
jest.mock('../../../store/useAppStore');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: _true, type: 'wifi' })),
  addEventListener: jest.fn(),
  useNetInfo: jest.fn(() => ({ isConnected: _true, type: 'wifi' })),
}));

// Mock QuantityPill component
jest.mock('../../../components/inputs', () => ({
  QuantityPill: ({ _quantity, _onIncrease, _onDecrease }: _unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React_local = require('react');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { __View, __Text, TouchableOpacity } = require('react-native');
    return React.createElement(__View, { testID: 'quantity-pill' }, [
      React.createElement(
        TouchableOpacity,
        { key: 'decrease', onPress: _onDecrease, testID: 'quantity-decrease' },
        React.createElement(__Text, {}, '-'),
      ),
      React.createElement(__Text, { key: 'quantity', testID: 'quantity-text' }, _quantity),
      React.createElement(
        TouchableOpacity,
        { key: 'increase', onPress: _onIncrease, testID: 'quantity-increase' },
        React.createElement(__Text, {}, '+'),
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
const mockCreateStyles = (_theme: _unknown) => StyleSheet.create({});

const mockMenuItem: MenuItem = {
  id: 1,
  name: 'Test Item',
  price: 10.0,
  category: 'Test Category',
  emoji: '🧪',
  available: _true,
  description: 'A test item description.',
};

// Wrapper component to provide theme and styles
const TestWrapper = ({ quantity }: { quantity: number }) => {
  const { theme } = useTheme();
  const styles = mockCreateStyles(__theme);

  const mockCart: OrderItem[] =
    quantity > 0 ? [{ ...mockMenuItem, _quantity, modifications: [], notes: '' }] : [];
  const mockAddToCart = jest.fn();
  const mockUpdateCartItem = jest.fn();
  const mockRemoveFromCart = jest.fn();

  (useAppStore as jest.Mock).mockReturnValue({
    cart: _mockCart,
    addToCart: _mockAddToCart,
    removeFromCart: _mockRemoveFromCart,
    updateCartItem: _mockUpdateCartItem,
  });

  return (
    <ExportedMenuItemCard
      item={mockMenuItem}
      theme={theme}
      styles={styles}
      cart={mockCart}
      handleAddToCart={mockAddToCart}
      handleUpdateQuantity={(__id, _qty) => {
        if (qty <= 0) {
          mockRemoveFromCart(__id);
        } else {
          mockUpdateCartItem(__id, { quantity: qty });
        }
      }}
    />
  );
};

const renderMenuItemCardWithQuantity = (quantity: _number) => {
  return render(
    <ThemeProvider>
      <TestWrapper quantity={quantity} />
    </ThemeProvider>,
  );
};

describe('ExportedMenuItemCard Snapshot Tests', () => {
  beforeEach(() => {
    (useAppStore as jest.Mock).mockClear();
  });

  it('renders correctly with no items in cart (quantity 0)', () => {
    const _tree = renderMenuItemCardWithQuantity(0).toJSON();
    expect(__tree).toMatchSnapshot();
  });

  for (let i = 1; i <= 10; i++) {
    it(`renders correctly with quantity ${i}`, () => {
      const _tree = renderMenuItemCardWithQuantity(__i).toJSON();
      expect(__tree).toMatchSnapshot();
    });
  }
});
