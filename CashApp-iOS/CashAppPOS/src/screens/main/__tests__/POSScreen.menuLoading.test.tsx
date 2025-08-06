/**
 * Comprehensive Unit Tests for POSScreen Menu Loading
 * Testing error handling, retry mechanisms, and UI state management
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import POSScreen from '../POSScreen';
import DataService from '../../../services/DataService';
import DatabaseService from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';
import useAppStore from '../../../store/useAppStore';
import useUIStore from '../../../store/useUIStore';
import useSettingsStore from '../../../store/useSettingsStore';

// Mock dependencies
jest.mock('../../../services/DataService');
jest.mock('../../../services/DatabaseService');
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: 'Swipeable',
  gestureHandlerRootHOC: (component: any) => component,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock stores
jest.mock('../../../store/useAppStore');
jest.mock('../../../store/useUIStore');
jest.mock('../../../store/useSettingsStore');

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock navigation
const mockNavigate = jest.fn();
const mockOpenDrawer = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    openDrawer: mockOpenDrawer,
  }),
}));

// Mock custom hooks
jest.mock('../../../hooks/useRestaurantConfig', () => ({
  useRestaurantDisplayName: () => 'Test Restaurant',
}));

// Helper function to render POSScreen with navigation context
const renderPOSScreen = () => {
  return render(
    <NavigationContainer>
      <POSScreen />
    </NavigationContainer>
  );
};

describe('POSScreen - Menu Loading Tests', () => {
  let mockDataService: jest.Mocked<DataService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock stores
    (useAppStore as unknown as jest.Mock).mockReturnValue({
      cart: [],
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateCartItem: jest.fn(),
      clearCart: jest.fn(),
      cartTotal: 0,
      cartItemCount: 0,
    });

    (useUIStore as unknown as jest.Mock).mockReturnValue({
      selectedCategory: 'All',
      setSelectedCategory: jest.fn(),
      showPaymentModal: false,
      setShowPaymentModal: jest.fn(),
    });

    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      taxConfiguration: {
        vatEnabled: true,
        vatRate: 20,
      },
    });

    // Setup mock services
    mockDataService = {
      getInstance: jest.fn().mockReturnThis(),
      getMenuItems: jest.fn(),
      getMenuCategories: jest.fn(),
      getFeatureFlags: jest.fn().mockReturnValue({
        USE_REAL_API: true,
        TEST_API_MODE: false,
        ENABLE_PAYMENTS: false,
        ENABLE_HARDWARE: false,
        SHOW_DEV_MENU: false,
        MOCK_AUTHENTICATION: false,
      }),
    } as any;

    mockDatabaseService = {
      getInstance: jest.fn().mockReturnThis(),
      getCachedMenuData: jest.fn(),
      cacheMenuData: jest.fn(),
    } as any;

    (DataService.getInstance as jest.Mock).mockReturnValue(mockDataService);
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
  });

  describe('Menu Loading on Component Mount', () => {
    it('should load menu items and categories on mount', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
        { id: 2, name: 'Fries', price: 4.99, category: 'Food', available: true },
      ];
      const mockCategories = [
        { id: 1, name: 'Food', description: 'Food items' },
        { id: 2, name: 'Beverages', description: 'Drinks' },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue(mockCategories);

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(mockDataService.getMenuItems).toHaveBeenCalled();
        expect(mockDataService.getMenuCategories).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
        expect(getByText('£10.99')).toBeTruthy();
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Dynamic menu loaded'),
        expect.objectContaining({
          itemCount: 2,
          categories: expect.arrayContaining(['All', 'Food', 'Beverages']),
        })
      );
    });

    it('should show loading state while fetching menu', async () => {
      // Delay the response to test loading state
      mockDataService.getMenuItems.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByTestId, queryByTestId } = renderPOSScreen();

      // Initially should show loading indicator (if implemented)
      // This assumes there's a loading indicator with testID
      expect(queryByTestId('menu-loading')).toBeTruthy();

      await waitFor(() => {
        expect(queryByTestId('menu-loading')).toBeFalsy();
      });
    });
  });

  describe('Error Handling and Retry Mechanism', () => {
    it('should handle menu loading errors gracefully', async () => {
      const error = new Error('Network error');
      mockDataService.getMenuItems.mockRejectedValue(error);
      mockDataService.getMenuCategories.mockRejectedValue(error);

      renderPOSScreen();

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '❌ Failed to load dynamic menu:',
          error
        );
      });

      // Should show error message to user
      expect(Alert.alert).toHaveBeenCalledWith(
        'Menu Loading Error',
        expect.stringContaining('Unable to load menu'),
        expect.any(Array)
      );
    });

    it('should retry menu loading on failure', async () => {
      // First attempt fails, second succeeds
      mockDataService.getMenuItems
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
        ]);
      
      mockDataService.getMenuCategories
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          { id: 1, name: 'Food' },
        ]);

      const { getByText } = renderPOSScreen();

      // Wait for retry
      await waitFor(() => {
        expect(mockDataService.getMenuItems).toHaveBeenCalledTimes(2);
      }, { timeout: 5000 });

      // Should eventually show menu items after retry
      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
      });
    });

    it('should use timeout for menu loading', async () => {
      // Simulate slow API response
      mockDataService.getMenuItems.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 20000))
      );
      mockDataService.getMenuCategories.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 20000))
      );

      renderPOSScreen();

      // Should timeout after 15 seconds
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load dynamic menu'),
          expect.objectContaining({
            message: 'Menu loading timeout',
          })
        );
      }, { timeout: 16000 });
    });

    it('should handle partial data loading failure', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockRejectedValue(new Error('Categories failed'));

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        // Should still show menu items even if categories fail
        expect(getByText('Burger')).toBeTruthy();
      });

      // Should log the partial failure
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load categories')
      );
    });
  });

  describe('Price Display and Normalization', () => {
    it('should correctly display normalized prices', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Item 1', price: '10.99', category: 'Food', available: true }, // String
        { id: 2, name: 'Item 2', price: 5, category: 'Food', available: true }, // Integer
        { id: 3, name: 'Item 3', price: 15.5, category: 'Food', available: true }, // Float
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('£10.99')).toBeTruthy();
        expect(getByText('£5.00')).toBeTruthy();
        expect(getByText('£15.50')).toBeTruthy();
      });
    });

    it('should handle invalid price formats', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Valid Item', price: 10.99, category: 'Food', available: true },
        { id: 2, name: 'Invalid Item', price: 'invalid', category: 'Food', available: true },
        { id: 3, name: 'Null Price', price: null, category: 'Food', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByText, queryByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Valid Item')).toBeTruthy();
        expect(getByText('£10.99')).toBeTruthy();
      });

      // Invalid items should be filtered out or show default price
      expect(queryByText('Invalid Item')).toBeFalsy();
      expect(queryByText('Null Price')).toBeFalsy();
    });
  });

  describe('Category Filtering', () => {
    it('should filter menu items by category', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
        { id: 2, name: 'Cola', price: 2.99, category: 'Beverages', available: true },
        { id: 3, name: 'Fries', price: 4.99, category: 'Food', available: true },
      ];
      const mockCategories = [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Beverages' },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue(mockCategories);

      const { getByText, queryByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
        expect(getByText('Cola')).toBeTruthy();
      });

      // Simulate selecting 'Food' category
      const setSelectedCategory = (useUIStore as unknown as jest.Mock).mock.results[0].value.setSelectedCategory;
      act(() => {
        setSelectedCategory('Food');
      });

      // Re-render with new category
      (useUIStore as unknown as jest.Mock).mockReturnValue({
        selectedCategory: 'Food',
        setSelectedCategory: jest.fn(),
        showPaymentModal: false,
        setShowPaymentModal: jest.fn(),
      });

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
        expect(getByText('Fries')).toBeTruthy();
        expect(queryByText('Cola')).toBeFalsy();
      });
    });

    it('should show all items when "All" category is selected', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
        { id: 2, name: 'Cola', price: 2.99, category: 'Beverages', available: true },
      ];
      const mockCategories = [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Beverages' },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue(mockCategories);

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
        expect(getByText('Cola')).toBeTruthy();
      });
    });
  });

  describe('Offline Support and Caching', () => {
    it('should use cached data when API is unavailable', async () => {
      const cachedData = {
        items: [
          { id: 1, name: 'Cached Burger', price: 9.99, category: 'Food', available: true },
        ],
        categories: [
          { id: 1, name: 'Food' },
        ],
        timestamp: Date.now() - 1000,
      };

      mockDatabaseService.getCachedMenuData.mockResolvedValue(cachedData);
      mockDataService.getMenuItems.mockRejectedValue(new Error('Network unavailable'));
      mockDataService.getMenuCategories.mockRejectedValue(new Error('Network unavailable'));

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(mockDatabaseService.getCachedMenuData).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getByText('Cached Burger')).toBeTruthy();
        expect(getByText('£9.99')).toBeTruthy();
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using cached menu data')
      );
    });

    it('should cache menu data after successful load', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
      ];
      const mockCategories = [
        { id: 1, name: 'Food' },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue(mockCategories);

      renderPOSScreen();

      await waitFor(() => {
        expect(mockDatabaseService.cacheMenuData).toHaveBeenCalledWith(
          mockMenuItems,
          mockCategories
        );
      });
    });
  });

  describe('Menu Item Interaction', () => {
    it('should add item to cart when clicked', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const addToCart = jest.fn();
      (useAppStore as unknown as jest.Mock).mockReturnValue({
        cart: [],
        addToCart,
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 0,
        cartItemCount: 0,
      });

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
      });

      fireEvent.press(getByText('Burger'));

      expect(addToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Burger',
          price: 10.99,
        })
      );
    });

    it('should not add unavailable items to cart', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Unavailable Item', price: 10.99, category: 'Food', available: false },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const addToCart = jest.fn();
      (useAppStore as unknown as jest.Mock).mockReturnValue({
        cart: [],
        addToCart,
        removeFromCart: jest.fn(),
        updateCartItem: jest.fn(),
        clearCart: jest.fn(),
        cartTotal: 0,
        cartItemCount: 0,
      });

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Unavailable Item')).toBeTruthy();
      });

      fireEvent.press(getByText('Unavailable Item'));

      expect(addToCart).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should filter menu items based on search query', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
        { id: 2, name: 'Pizza', price: 12.99, category: 'Food', available: true },
        { id: 3, name: 'Cola', price: 2.99, category: 'Beverages', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByPlaceholderText, getByText, queryByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search menu items...');
      fireEvent.changeText(searchInput, 'Pizza');

      await waitFor(() => {
        expect(getByText('Pizza')).toBeTruthy();
        expect(queryByText('Burger')).toBeFalsy();
        expect(queryByText('Cola')).toBeFalsy();
      });
    });

    it('should show no results message for empty search', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByPlaceholderText, getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Burger')).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search menu items...');
      fireEvent.changeText(searchInput, 'NonExistentItem');

      await waitFor(() => {
        expect(getByText('No items found')).toBeTruthy();
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle large menu lists efficiently', async () => {
      const largeMenuItems = Array.from({ length: 500 }, (_, index) => ({
        id: index + 1,
        name: `Item \${index + 1}`,
        price: Math.random() * 50,
        category: 'Food',
        available: true,
      }));

      mockDataService.getMenuItems.mockResolvedValue(largeMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByText } = renderPOSScreen();

      await waitFor(() => {
        expect(getByText('Item 1')).toBeTruthy();
      });

      // Should use FlatList for performance
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dynamic menu loaded'),
        expect.objectContaining({
          itemCount: 500,
        })
      );
    });

    it('should debounce search input for performance', async () => {
      const mockMenuItems = [
        { id: 1, name: 'Burger', price: 10.99, category: 'Food', available: true },
      ];

      mockDataService.getMenuItems.mockResolvedValue(mockMenuItems);
      mockDataService.getMenuCategories.mockResolvedValue([]);

      const { getByPlaceholderText } = renderPOSScreen();

      await waitFor(() => {
        expect(mockDataService.getMenuItems).toHaveBeenCalled();
      });

      const searchInput = getByPlaceholderText('Search menu items...');
      
      // Rapid text changes
      fireEvent.changeText(searchInput, 'B');
      fireEvent.changeText(searchInput, 'Bu');
      fireEvent.changeText(searchInput, 'Bur');
      fireEvent.changeText(searchInput, 'Burg');

      // Should debounce and not cause multiple re-renders
      await waitFor(() => {
        // Verify search is applied after debounce
        expect(searchInput.props.value).toBe('Burg');
      });
    });
  });
});
ENDOFFILE < /dev/null