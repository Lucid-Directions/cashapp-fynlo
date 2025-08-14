/**
 * Integration test for item modifications flow
 * Tests the complete flow from menu item to cart with modifications
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import POSScreen from '../../screens/main/POSScreen';
import { ThemeProvider } from '../../design-system/ThemeProvider';
import type { MenuItem } from '../../types';

// Mock the services and stores
jest.mock('../../services/DataService');
jest.mock('../../services/ErrorTrackingService');
jest.mock('../../services/PlatformService');
jest.mock('../../services/CustomersService');
jest.mock('../../services/SumUpCompatibilityService');

// Mock the stores
jest.mock('../../store/useAppStore');
jest.mock('../../store/useEnhancedCartStore');
jest.mock('../../store/useSettingsStore');
jest.mock('../../store/useUIStore');

const Stack = createNativeStackNavigator();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="POS" component={POSScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
);

describe('Item Modifications Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should open modification modal for coffee items', async () => {
    // Mock DataService to return coffee items
    const DataService = require('../../services/DataService').default;
    DataService.getInstance.mockReturnValue({
      getMenuItems: jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Cappuccino',
          price: 3.50,
          category: 'Coffee',
          emoji: '☕',
          available: true,
        },
        {
          id: '2',
          name: 'Sandwich',
          price: 5.00,
          category: 'Food',
          emoji: '🥪',
          available: true,
        },
      ]),
      getMenuCategories: jest.fn().mockResolvedValue(['Coffee', 'Food']),
    });

    // Mock the cart store
    const useCartStore = require('../../store/cartStoreAdapter').useCartStore;
    const mockAddToCart = jest.fn();
    useCartStore.mockReturnValue({
      cart: [],
      addToCart: mockAddToCart,
      removeFromCart: jest.fn(),
      updateCartItem: jest.fn(),
      clearCart: jest.fn(),
      cartTotal: jest.fn().mockReturnValue(0),
      cartItemCount: jest.fn().mockReturnValue(0),
    });

    const { getByText, queryByText, getByTestId } = render(
      <TestWrapper>
        <POSScreen />
      </TestWrapper>
    );

    // Wait for menu to load
    await waitFor(() => {
      expect(getByText('Cappuccino')).toBeTruthy();
    });

    // Click on coffee item
    const coffeeItem = getByText('Cappuccino');
    fireEvent.press(coffeeItem);

    // Modification modal should open for coffee
    await waitFor(() => {
      expect(queryByText('Size Options')).toBeTruthy();
      expect(queryByText('Temperature')).toBeTruthy();
      expect(queryByText('Milk Options')).toBeTruthy();
    });

    // Click on sandwich item
    const sandwichItem = getByText('Sandwich');
    fireEvent.press(sandwichItem);

    // Should add directly to cart without modal
    expect(mockAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '2',
        name: 'Sandwich',
        price: 5.00,
      })
    );
  });

  it('should calculate correct price with modifications', async () => {
    const DataService = require('../../services/DataService').default;
    DataService.getInstance.mockReturnValue({
      getMenuItems: jest.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Latte',
          price: 4.00,
          category: 'Coffee',
          emoji: '☕',
          available: true,
        },
      ]),
      getMenuCategories: jest.fn().mockResolvedValue(['Coffee']),
    });

    const useCartStore = require('../../store/cartStoreAdapter').useCartStore;
    const mockAddToCart = jest.fn();
    useCartStore.mockReturnValue({
      cart: [],
      addToCart: mockAddToCart,
      removeFromCart: jest.fn(),
      updateCartItem: jest.fn(),
      clearCart: jest.fn(),
      cartTotal: jest.fn().mockReturnValue(0),
      cartItemCount: jest.fn().mockReturnValue(0),
    });

    const { getByText, getByTestId } = render(
      <TestWrapper>
        <POSScreen />
      </TestWrapper>
    );

    // Wait for menu to load
    await waitFor(() => {
      expect(getByText('Latte')).toBeTruthy();
    });

    // Click on latte
    fireEvent.press(getByText('Latte'));

    // Wait for modal
    await waitFor(() => {
      expect(getByText('Size Options')).toBeTruthy();
    });

    // Select Large size (+$0.50)
    fireEvent.press(getByText('Large'));

    // Select Oat Milk (+$0.70)
    fireEvent.press(getByText('Oat Milk'));

    // Add special instructions
    const instructionsInput = getByTestId('special-instructions-input');
    fireEvent.changeText(instructionsInput, 'Extra hot please');

    // Check price display shows correct total
    expect(getByText(/\$5\.20/)).toBeTruthy(); // 4.00 + 0.50 + 0.70

    // Save modifications
    fireEvent.press(getByText('Save Changes'));

    // Check item was added to cart with correct price
    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Latte',
          price: 5.20, // Base + modifications
          modifications: expect.arrayContaining([
            expect.objectContaining({ name: 'Large', selected: true }),
            expect.objectContaining({ name: 'Oat Milk', selected: true }),
          ]),
          specialInstructions: 'Extra hot please',
        })
      );
    });
  });

  it('should display modifications in cart', async () => {
    const useCartStore = require('../../store/cartStoreAdapter').useCartStore;
    useCartStore.mockReturnValue({
      cart: [
        {
          id: '1',
          name: 'Cappuccino',
          price: 4.70, // 3.50 + 1.20 modifications
          quantity: 1,
          emoji: '☕',
          modifications: [
            { id: 'size-large', name: 'Large', price: 0.50, selected: true, type: 'size', category: 'Size Options' },
            { id: 'milk-oat', name: 'Oat Milk', price: 0.70, selected: true, type: 'addition', category: 'Milk Options' },
          ],
          specialInstructions: 'Extra foam',
          modificationPrice: 1.20,
          originalPrice: 3.50,
        },
      ],
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateCartItem: jest.fn(),
      clearCart: jest.fn(),
      cartTotal: jest.fn().mockReturnValue(4.70),
      cartItemCount: jest.fn().mockReturnValue(1),
    });

    const DataService = require('../../services/DataService').default;
    DataService.getInstance.mockReturnValue({
      getMenuItems: jest.fn().mockResolvedValue([]),
      getMenuCategories: jest.fn().mockResolvedValue([]),
    });

    const { getByText, getByTestId } = render(
      <TestWrapper>
        <POSScreen />
      </TestWrapper>
    );

    // Open cart modal
    fireEvent.press(getByTestId('cart-button'));

    // Check modifications are displayed
    await waitFor(() => {
      expect(getByText('Cappuccino')).toBeTruthy();
      expect(getByText(/Large, Oat Milk/)).toBeTruthy(); // Modification summary
      expect(getByText(/Special instructions/)).toBeTruthy(); // Has special instructions
      expect(getByText('$4.70')).toBeTruthy(); // Total price with modifications
    });
  });
});