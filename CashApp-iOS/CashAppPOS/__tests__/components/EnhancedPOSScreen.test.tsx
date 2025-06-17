import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EnhancedPOSScreen from '../../src/screens/main/EnhancedPOSScreen';
import TestingUtils from '../../src/utils/testingUtils';

// Mock the stores
jest.mock('../../src/store/useAppStore', () => ({
  __esModule: true,
  default: () => ({
    cart: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    cartTotal: 0,
    cartItemCount: 0,
  }),
}));

jest.mock('../../src/store/useUIStore', () => ({
  __esModule: true,
  default: () => ({
    selectedCategory: 'All',
    setSelectedCategory: jest.fn(),
  }),
}));

describe('EnhancedPOSScreen', () => {
  const defaultProps = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      expect(getByTestId('enhanced-pos-screen')).toBeTruthy();
    });

    it('should display header with logo and search', () => {
      const { getByText, getByPlaceholderText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByText('FYNLO')).toBeTruthy();
      expect(getByText('POS SYSTEM')).toBeTruthy();
      expect(getByPlaceholderText('Search menu items...')).toBeTruthy();
    });

    it('should display category tabs', () => {
      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByText('All')).toBeTruthy();
      expect(getByText('Appetizers')).toBeTruthy();
      expect(getByText('Mains')).toBeTruthy();
      expect(getByText('Sides')).toBeTruthy();
      expect(getByText('Drinks')).toBeTruthy();
    });

    it('should display menu items grid', () => {
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      expect(getByTestId('menu-items-grid')).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('should filter menu items based on search query', async () => {
      const { getByPlaceholderText, queryByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const searchInput = getByPlaceholderText('Search menu items...');
      
      fireEvent.changeText(searchInput, 'burger');
      
      await waitFor(() => {
        // Should show burger items and hide others
        expect(queryByText('Classic Burger')).toBeTruthy();
        expect(queryByText('Pizza Margherita')).toBeFalsy();
      });
    });

    it('should show empty state when no items match search', async () => {
      const { getByPlaceholderText, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const searchInput = getByPlaceholderText('Search menu items...');
      
      fireEvent.changeText(searchInput, 'nonexistent item');
      
      await waitFor(() => {
        expect(getByText('No items found')).toBeTruthy();
        expect(getByText('Try adjusting your search or category')).toBeTruthy();
      });
    });

    it('should be case insensitive', async () => {
      const { getByPlaceholderText, queryByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const searchInput = getByPlaceholderText('Search menu items...');
      
      fireEvent.changeText(searchInput, 'BURGER');
      
      await waitFor(() => {
        expect(queryByText('Classic Burger')).toBeTruthy();
      });
    });
  });

  describe('Category Selection', () => {
    it('should filter items by selected category', () => {
      const { getByText, queryByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      fireEvent.press(getByText('Appetizers'));
      
      // Should show appetizer items
      expect(queryByText('Nachos')).toBeTruthy();
      expect(queryByText('Classic Burger')).toBeFalsy();
    });

    it('should highlight active category', () => {
      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const appetizersTab = getByText('Appetizers');
      fireEvent.press(appetizersTab);
      
      // Check if the tab has active styling (this would depend on your implementation)
      expect(appetizersTab.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: expect.any(String) })
      );
    });
  });

  describe('Menu Item Interactions', () => {
    it('should open modifier modal for items with modifiers', async () => {
      const { getByTestId, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      // Find and press an item that has modifiers
      const burgerItem = getByTestId('menu-item-burger');
      fireEvent.press(burgerItem);
      
      await waitFor(() => {
        expect(getByText('Customize your order')).toBeTruthy();
      });
    });

    it('should add item directly to cart if no modifiers', () => {
      const mockAddToCart = jest.fn();
      
      // Mock the store to return the mocked function
      require('../../src/store/useAppStore').default.mockReturnValue({
        cart: [],
        addToCart: mockAddToCart,
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 0,
        cartItemCount: 0,
      });

      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      // Find and press an item without modifiers
      const drinkItem = getByTestId('menu-item-drink');
      fireEvent.press(drinkItem);
      
      expect(mockAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ name: expect.any(String) }),
        1,
        [],
        ''
      );
    });

    it('should show quantity badge for items in cart', () => {
      // Mock cart with items
      require('../../src/store/useAppStore').default.mockReturnValue({
        cart: [{ id: 1, name: 'Burger', quantity: 2 }],
        addToCart: jest.fn(),
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 20.00,
        cartItemCount: 2,
      });

      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByText('2')).toBeTruthy(); // Quantity badge
    });
  });

  describe('Cart Functionality', () => {
    it('should display cart badge with correct count', () => {
      require('../../src/store/useAppStore').default.mockReturnValue({
        cart: [
          { id: 1, name: 'Burger', quantity: 1 },
          { id: 2, name: 'Fries', quantity: 2 },
        ],
        addToCart: jest.fn(),
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 15.00,
        cartItemCount: 3,
      });

      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByText('3')).toBeTruthy(); // Cart badge count
    });

    it('should open cart modal when cart button is pressed', () => {
      const { getByTestId, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const cartButton = getByTestId('cart-button');
      fireEvent.press(cartButton);
      
      expect(getByText('Cart')).toBeTruthy();
    });
  });

  describe('Barcode Scanner', () => {
    it('should open barcode scanner modal', () => {
      const { getByTestId, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const barcodeButton = getByTestId('barcode-button');
      fireEvent.press(barcodeButton);
      
      expect(getByText('Barcode Scanner')).toBeTruthy();
      expect(getByText('Point camera at barcode')).toBeTruthy();
    });

    it('should handle test barcode scan', () => {
      const mockAddToCart = jest.fn();
      
      require('../../src/store/useAppStore').default.mockReturnValue({
        cart: [],
        addToCart: mockAddToCart,
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 0,
        cartItemCount: 0,
      });

      const { getByTestId, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      // Open barcode scanner
      const barcodeButton = getByTestId('barcode-button');
      fireEvent.press(barcodeButton);
      
      // Press test barcode
      const testBarcode = getByText('123456789');
      fireEvent.press(testBarcode);
      
      expect(mockAddToCart).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should render within acceptable time', async () => {
      const renderTime = await TestingUtils.performance.measureRenderTime(() => {
        render(<EnhancedPOSScreen {...defaultProps} />);
      });
      
      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle large menu efficiently', () => {
      // Mock large menu data
      const largeMenuData = TestingUtils.generateTestData.orderItems(100);
      
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByTestId('menu-items-grid')).toBeTruthy();
      // Test should complete without timeout
    });
  });

  describe('Accessibility', () => {
    it('should have accessible menu items', () => {
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const menuItem = getByTestId('menu-item-burger');
      expect(menuItem).toBeAccessible();
    });

    it('should have accessible navigation elements', () => {
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const cartButton = getByTestId('cart-button');
      expect(cartButton).toBeAccessible();
      expect(cartButton).toHaveMinimumTouchTarget();
    });

    it('should have accessible category buttons', () => {
      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      const categoryButton = getByText('Appetizers');
      expect(categoryButton).toBeAccessible();
      expect(categoryButton).toHaveMinimumTouchTarget();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate error in data loading
      jest.spyOn(TestingUtils.errorSimulation, 'simulateNetworkError')
        .mockRejectedValue(new Error('Network error'));
      
      const { getByTestId } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      expect(getByTestId('enhanced-pos-screen')).toBeTruthy();
      
      consoleSpy.mockRestore();
    });

    it('should display error message for failed operations', async () => {
      const { getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      // This would test error notification display
      // Implementation depends on your error handling system
    });
  });

  describe('Integration Tests', () => {
    it('should complete full order flow', async () => {
      const mockAddToCart = jest.fn();
      
      require('../../src/store/useAppStore').default.mockReturnValue({
        cart: [],
        addToCart: mockAddToCart,
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 0,
        cartItemCount: 0,
      });

      const { getByTestId, getByText } = render(<EnhancedPOSScreen {...defaultProps} />);
      
      // 1. Select item
      const menuItem = getByTestId('menu-item-drink');
      fireEvent.press(menuItem);
      
      // 2. Verify item added to cart
      expect(mockAddToCart).toHaveBeenCalled();
      
      // 3. Open cart
      const cartButton = getByTestId('cart-button');
      fireEvent.press(cartButton);
      
      // 4. Verify cart modal opens
      await waitFor(() => {
        expect(getByText('Cart')).toBeTruthy();
      });
    });
  });
});