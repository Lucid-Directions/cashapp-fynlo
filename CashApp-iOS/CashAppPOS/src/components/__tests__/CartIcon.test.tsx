/**
 * CartIcon Component Tests
 * Testing cart icon display, badge functionality, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CartIcon from '../cart/CartIcon';
import { ThemeProvider } from '../../design-system/ThemeProvider';

// Mock the theme system
const mockTheme = {
  colors: {
    white: '#FFFFFF',
    text: '#000000',
    danger: {
      500: '#FF3B30'
    }
  }
};

// Mock useTheme hook
jest.mock('../../design-system/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({ theme: mockTheme })
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  return (props: any) => {
    return React.createElement('Text', {
      ...props,
      testID: 'mock-icon'
    }, props.name || 'MockedIcon');
  };
});

// Helper to render with ThemeProvider
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {ui}
    </ThemeProvider>
  );
};

describe('CartIcon', () => {
  it('renders with correct color and no badge when count is 0', () => {
    renderWithProviders(<CartIcon count={0} onPress={() => {}} testID="cart-icon" />);

    const icon = screen.getByTestId('mock-icon');
    expect(icon.props.color).toBe(mockTheme.colors.text);

    // Badge should not be present
    const badge = screen.queryByTestId('cart-badge');
    expect(badge).toBeNull();
  });

  it('renders with danger color and badge when count is greater than 0', () => {
    const itemCount = 5;
    renderWithProviders(<CartIcon count={itemCount} onPress={() => {}} testID="cart-icon" />);

    const icon = screen.getByTestId('mock-icon');
    expect(icon.props.color).toBe(mockTheme.colors.danger[500]);

    // Badge should be visible with the correct count
    const badge = screen.getByTestId('cart-badge');
    expect(badge).toBeTruthy();
    
    const badgeText = screen.getByText(itemCount.toString());
    expect(badgeText).toBeTruthy();
  });

  it('displays "99+" in badge when count is greater than 99', () => {
    renderWithProviders(<CartIcon count={150} onPress={() => {}} testID="cart-icon" />);

    const badgeText = screen.getByText('99+');
    expect(badgeText).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    renderWithProviders(<CartIcon count={0} onPress={mockOnPress} testID="cart-icon-press" />);

    const touchable = screen.getByTestId('cart-icon-press');
    fireEvent.press(touchable);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('has proper accessibility properties', () => {
    renderWithProviders(<CartIcon count={3} onPress={() => {}} testID="cart-icon" />);

    const touchable = screen.getByTestId('cart-icon');
    expect(touchable.props.accessibilityRole).toBe('button');
    expect(touchable.props.accessibilityLabel).toContain('Shopping cart with 3 items');
    expect(touchable.props.accessibilityHint).toContain('Double tap to view your cart');
  });

  it('shows correct accessibility label for empty cart', () => {
    renderWithProviders(<CartIcon count={0} onPress={() => {}} testID="cart-icon" />);

    const touchable = screen.getByTestId('cart-icon');
    expect(touchable.props.accessibilityLabel).toBe('Shopping cart, empty');
  });

  it('shows correct accessibility label for single item', () => {
    renderWithProviders(<CartIcon count={1} onPress={() => {}} testID="cart-icon" />);

    const touchable = screen.getByTestId('cart-icon');
    expect(touchable.props.accessibilityLabel).toContain('Shopping cart with 1 item');
  });

  it('has minimum touch target size', () => {
    renderWithProviders(<CartIcon count={0} onPress={() => {}} testID="cart-icon" />);

    const touchable = screen.getByTestId('cart-icon');
    expect(touchable.props.hitSlop).toEqual({ 
      top: 10, 
      bottom: 10, 
      left: 10, 
      right: 10 
    });
  });
});
