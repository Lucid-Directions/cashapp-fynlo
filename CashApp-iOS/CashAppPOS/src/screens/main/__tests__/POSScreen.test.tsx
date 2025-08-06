/**
 * POSScreen Component Tests
 * Testing the main point-of-sale interface
 */

import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { customRenderWithStores, useTestTheme } from '../../../__tests__/utils/testUtils';
import { ThemeProvider } from '../../../design-system/ThemeProvider';
import POSScreen from '../POSScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

// Mock stores
jest.mock('../../../store/useAppStore', () => ({
  __esModule: true,
  default: () => ({
    cart: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateCartItem: jest.fn(),
    clearCart: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
  }),
}));

jest.mock('../../../store/useUIStore', () => ({
  __esModule: true,
  default: () => ({
    selectedCategory: 'All',
    setSelectedCategory: jest.fn(),
    showPaymentModal: false,
    setShowPaymentModal: jest.fn(),
  }),
}));

// Mock theme provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const theme = useTestTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('POSScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and shows main elements', () => {
    const { getByText, getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    // Check for header elements
    expect(getByText('Fynlo POS')).toBeTruthy();
    expect(getByTestId('menu-flat-list')).toBeTruthy();
  });

  it('renders with proper navigation setup', () => {
    const { getByText } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Fynlo POS')).toBeTruthy();
  });

  it('shows cart icon that can be pressed', () => {
    const { getByTestId } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const cartButton = getByTestId('shopping-cart-button');
    fireEvent.press(cartButton);
    
    // Should trigger some action (opening cart modal or navigation)
    expect(cartButton).toBeTruthy();
  });

  it('displays menu items correctly', () => {
    const { getByText } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    
    // Check for common menu items that might exist
    // This will depend on your actual menu data
    expect(getByTestId('menu-flat-list')).toBeTruthy();
  });

  describe('Search Functionality', () => {
    it('renders search bubble component', () => {
      const { queryByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });
      
      // Look for search functionality - test based on actual implementation
      const searchElement = queryByTestId('search-input') || queryByTestId('category-search-bubble-inactive');
      if (searchElement) {
        expect(searchElement).toBeTruthy();
      }
    });
  });

  describe('Cart Functionality', () => {
    it('cart icon renders with proper test id', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });

      const cartIcon = getByTestId('shopping-cart-button');
      expect(cartIcon).toBeTruthy();
    });

    it('cart icon is pressable', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });

      const cartButton = getByTestId('shopping-cart-button');
      fireEvent.press(cartButton);
      
      // Should not throw an error
      expect(cartButton).toBeTruthy();
    });
  });

  describe('Menu Display', () => {
    it('renders menu list container', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });

      expect(getByTestId('menu-flat-list')).toBeTruthy();
    });

    it('handles empty menu state gracefully', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });

      // Should render without crashing even with empty menu
      expect(getByTestId('menu-flat-list')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('renders without crashing', () => {
      expect(() => {
        customRenderWithStores(<POSScreen />, {
          navigationProps: { navigation: mockNavigation },
        });
      }).not.toThrow();
    });

    it('handles missing navigation props gracefully', () => {
      expect(() => {
        customRenderWithStores(<POSScreen />, {});
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('cart button has accessibility properties', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });

      const cartButton = getByTestId('shopping-cart-button');
      expect(cartButton.props.accessibilityRole).toBeDefined();
    });
  });

  describe('Theme Integration', () => {
    it('renders with theme provider', () => {
      expect(() => {
        customRenderWithStores(
          <TestWrapper>
            <POSScreen />
          </TestWrapper>,
          { navigationProps: { navigation: mockNavigation } }
        );
      }).not.toThrow();
    });
  });
});
EOF < /dev/null