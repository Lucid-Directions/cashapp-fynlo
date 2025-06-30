/**
 * POSScreen Component Tests
 * Testing the main point-of-sale interface
 */

// @ts-nocheck

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import POSScreen from '../POSScreen';
import { customRenderWithStores } from '../../../__tests__/utils/testUtils';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

describe('POSScreen', () => {
  const mockStoreState = {
    cart: [],
    menuItems: [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        category: 'Main',
        available: true,
        description: 'Delicious burger',
      },
      {
        id: 2,
        name: 'French Fries',
        price: 4.99,
        category: 'Sides',
        available: true,
        description: 'Crispy fries',
      },
    ],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
    selectedCategory: 'All',
    setSelectedCategory: jest.fn(),
    getFilteredItems: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.getFilteredItems.mockReturnValue(mockStoreState.menuItems);
  });

  it('renders correctly', () => {
    const { getByText, getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Fynlo POS')).toBeTruthy();
    expect(getByText('Current Order')).toBeTruthy();
    expect(getByTestId('menu-items')).toBeTruthy();
  });

  it('displays menu items correctly', () => {
    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Classic Burger')).toBeTruthy();
    expect(getByText('$12.99')).toBeTruthy();
    expect(getByText('French Fries')).toBeTruthy();
    expect(getByText('$4.99')).toBeTruthy();
  });

  it('adds item to cart when tapped', () => {
    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const burgerItem = getByText('Classic Burger');
    fireEvent.press(burgerItem);

    expect(mockStoreState.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
      })
    );
  });

  it('displays empty cart message when cart is empty', () => {
    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Add items to start an order')).toBeTruthy();
  });

  it('displays cart items when cart has items', () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 2,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 25.98);
    mockStoreState.cartItemCount = jest.fn(() => 2);

    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Classic Burger')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('$25.98')).toBeTruthy();
  });

  it('filters items by category', () => {
    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const mainCategory = getByText('Main');
    fireEvent.press(mainCategory);

    expect(mockStoreState.setSelectedCategory).toHaveBeenCalledWith('Main');
  });

  it('updates item quantity in cart', () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 1,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 12.99);
    mockStoreState.cartItemCount = jest.fn(() => 1);

    const { getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const increaseButton = getByTestId('increase-qty-1');
    fireEvent.press(increaseButton);

    expect(mockStoreState.updateQuantity).toHaveBeenCalledWith(1, 2);
  });

  it('removes item from cart when quantity becomes zero', () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 1,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 12.99);
    mockStoreState.cartItemCount = jest.fn(() => 1);

    const { getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const decreaseButton = getByTestId('decrease-qty-1');
    fireEvent.press(decreaseButton);

    expect(mockStoreState.updateQuantity).toHaveBeenCalledWith(1, 0);
  });

  it('clears entire cart', () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 2,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 25.98);
    mockStoreState.cartItemCount = jest.fn(() => 2);

    const { getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const clearButton = getByTestId('clear-cart-button');
    fireEvent.press(clearButton);

    expect(mockStoreState.clearCart).toHaveBeenCalled();
  });

  it('opens payment modal when checkout button is pressed', async () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 1,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 12.99);
    mockStoreState.cartItemCount = jest.fn(() => 1);

    const { getByTestId, getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const checkoutButton = getByTestId('checkout-button');
    fireEvent.press(checkoutButton);

    await waitFor(() => {
      expect(getByText('Process Payment')).toBeTruthy();
    });
  });

  it('handles unavailable items correctly', () => {
    const itemsWithUnavailable = [
      ...mockStoreState.menuItems,
      {
        id: 3,
        name: 'Unavailable Item',
        price: 9.99,
        category: 'Main',
        available: false,
        description: 'Not available',
      },
    ];

    mockStoreState.menuItems = itemsWithUnavailable;
    mockStoreState.getFilteredItems.mockReturnValue(itemsWithUnavailable);

    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const unavailableItem = getByText('Unavailable Item');
    fireEvent.press(unavailableItem);

    // Should not add to cart
    expect(mockStoreState.addToCart).not.toHaveBeenCalled();
  });

  it('displays correct cart total', () => {
    const cartWithItems = [
      {
        id: 1,
        name: 'Classic Burger',
        price: 12.99,
        quantity: 2,
      },
      {
        id: 2,
        name: 'French Fries',
        price: 4.99,
        quantity: 1,
      },
    ];

    mockStoreState.cartTotal = jest.fn(() => 30.97);
    mockStoreState.cartItemCount = jest.fn(() => 3);

    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('$30.97')).toBeTruthy();
  });
});