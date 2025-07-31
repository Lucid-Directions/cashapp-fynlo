import { fireEvent, waitFor } from '@testing-library/react-native';

import type { ReactTestInstance } from 'react-test-renderer';

// Validation interfaces
interface TestOrder {
  id: string | number;
  items: unknown[];
  total: number;
  status?: string;
}

interface TestCustomer {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface TestPayment {
  id: string | number;
  amount: number;
  method: string;
  status: string;
}

export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  expectedResults: string[];
  category: TestCategory;
  priority: TestPriority;
}

export interface TestStep {
  action: string;
  target?: string;
  data?: Record<string, unknown> | string | number | boolean | null;
  waitFor?: number;
  description: string;
}

export enum TestCategory {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  USABILITY = 'usability',
}

export enum TestPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface MockDataGeneratorConfig {
  seed?: number;
  locale?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

class TestingUtils {
  /**
   * Generate test data for different scenarios
   */
  static generateTestData = {
    // Generate test orders
    orders: (count: number = 10, _config?: MockDataGeneratorConfig) => {
      const orders = [];
      for (let i = 0; i < count; i++) {
        orders.push({
          id: `test_order_${i + 1}`,
          orderNumber: `ORD-${String(i + 1).padStart(4, '0')}`,
          customerId: `test_customer_${i + 1}`,
          items: TestingUtils.generateTestData.orderItems(Math.floor(Math.random() * 5) + 1),
          total: Math.floor(Math.random() * 10000) / 100,
          status: ['pending', 'processing', 'completed', 'cancelled'][
            Math.floor(Math.random() * 4)
          ],
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          type: ['dine_in', 'takeout', 'delivery'][Math.floor(Math.random() * 3)],
        });
      }
      return orders;
    },

    // Generate test order items
    orderItems: (count: number = 3) => {
      const items = [];
      const menuItems = ['Burger', 'Pizza', 'Salad', 'Fries', 'Drink', 'Dessert'];

      for (let i = 0; i < count; i++) {
        items.push({
          id: `test_item_${i + 1}`,
          name: menuItems[Math.floor(Math.random() * menuItems.length)],
          quantity: Math.floor(Math.random() * 3) + 1,
          price: Math.floor(Math.random() * 2000) / 100,
          modifiers: [],
        });
      }
      return items;
    },

    // Generate test customers
    customers: (count: number = 50) => {
      const customers = [];
      const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];

      for (let i = 0; i < count; i++) {
        customers.push({
          id: `test_customer_${i + 1}`,
          firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
          lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
          email: `customer${i + 1}@test.com`,
          phone: `555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          loyaltyPoints: Math.floor(Math.random() * 1000),
          segment: ['VIP', 'Regular', 'New'][Math.floor(Math.random() * 3)],
        });
      }
      return customers;
    },

    // Generate test payment data
    payments: (count: number = 20) => {
      const payments = [];
      const methods = ['card', 'cash', 'mobile_pay'];

      for (let i = 0; i < count; i++) {
        payments.push({
          id: `test_payment_${i + 1}`,
          orderId: `test_order_${i + 1}`,
          method: methods[Math.floor(Math.random() * methods.length)],
          amount: Math.floor(Math.random() * 10000) / 100,
          status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)],
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        });
      }
      return payments;
    },
  };

  /**
   * Common test scenarios for POS system
   */
  static testScenarios: TestScenario[] = [
    {
      name: 'Create New Order',
      description: 'Test creating a new order with multiple items',
      category: TestCategory.E2E,
      priority: TestPriority.CRITICAL,
      steps: [
        {
          action: 'tap',
          target: 'menu-item-burger',
          description: 'Select burger from menu',
        },
        {
          action: 'tap',
          target: 'add-to-cart-button',
          description: 'Add item to cart',
        },
        {
          action: 'tap',
          target: 'cart-button',
          description: 'Open cart',
        },
        {
          action: 'tap',
          target: 'checkout-button',
          description: 'Proceed to checkout',
        },
      ],
      expectedResults: [
        'Item should be added to cart',
        'Cart badge should show correct count',
        'Total should be calculated correctly',
        'Checkout screen should open',
      ],
    },
    {
      name: 'Process Payment',
      description: 'Test processing payment for an order',
      category: TestCategory.E2E,
      priority: TestPriority.CRITICAL,
      steps: [
        {
          action: 'tap',
          target: 'payment-method-card',
          description: 'Select card payment',
        },
        {
          action: 'input',
          target: 'card-number-input',
          data: '4111111111111111',
          description: 'Enter test card number',
        },
        {
          action: 'tap',
          target: 'process-payment-button',
          description: 'Process payment',
        },
      ],
      expectedResults: [
        'Payment should be processed successfully',
        'Order status should update to completed',
        'Receipt should be generated',
      ],
    },
    {
      name: 'Search Menu Items',
      description: 'Test searching for menu items',
      category: TestCategory.INTEGRATION,
      priority: TestPriority.HIGH,
      steps: [
        {
          action: 'input',
          target: 'search-input',
          data: 'burger',
          description: 'Enter search term',
        },
        {
          action: 'wait',
          waitFor: 500,
          description: 'Wait for search results',
        },
      ],
      expectedResults: [
        'Search results should be filtered',
        'Only matching items should be displayed',
        'Search should be case-insensitive',
      ],
    },
  ];

  /**
   * Accessibility testing helpers
   */
  static accessibility = {
    // Test accessibility labels
    hasAccessibilityLabel: (element: ReactTestInstance, expectedLabel?: string) => {
      const accessibilityLabel = element.props.accessibilityLabel;
      if (expectedLabel) {
        return accessibilityLabel === expectedLabel;
      }
      return !!accessibilityLabel;
    },

    // Test accessibility hints
    hasAccessibilityHint: (element: ReactTestInstance, expectedHint?: string) => {
      const accessibilityHint = element.props.accessibilityHint;
      if (expectedHint) {
        return accessibilityHint === expectedHint;
      }
      return !!accessibilityHint;
    },

    // Test accessibility roles
    hasAccessibilityRole: (element: ReactTestInstance, expectedRole: string) => {
      return element.props.accessibilityRole === expectedRole;
    },

    // Test minimum touch target size (44x44 points for iOS)
    hasMinimumTouchTarget: (element: ReactTestInstance) => {
      const style = element.props.style;
      if (Array.isArray(style)) {
        const flatStyle = Object.assign({}, ...style);
        return (
          (flatStyle.width >= 44 && flatStyle.height >= 44) ||
          (flatStyle.minWidth >= 44 && flatStyle.minHeight >= 44)
        );
      }
      return (
        (style?.width >= 44 && style?.height >= 44) ||
        (style?.minWidth >= 44 && style?.minHeight >= 44)
      );
    },
  };

  /**
   * Performance testing helpers
   */
  static performance = {
    // Measure component render time
    measureRenderTime: async (renderFunction: () => void) => {
      const startTime = performance.now();
      renderFunction();
      const endTime = performance.now();
      return endTime - startTime;
    },

    // Measure async operation time
    measureAsyncOperation: async <T>(
      operation: () => Promise<T>
    ): Promise<{ result: T; duration: number }> => {
      const startTime = performance.now();
      const result = await operation();
      const endTime = performance.now();
      return {
        result,
        duration: endTime - startTime,
      };
    },

    // Test memory usage (simplified)
    simulateMemoryPressure: () => {
      // Create large objects to simulate memory pressure
      const largeArray = new Array(100000).fill('test data');
      setTimeout(() => {
        // Clean up after test
        largeArray.length = 0;
      }, 1000);
    },
  };

  /**
   * Common test utilities
   */
  static common = {
    // Wait for element to appear
    waitForElement: async (getElement: () => ReactTestInstance | null, timeout: number = 5000) => {
      return waitFor(
        () => {
          const element = getElement();
          if (!element) {
            throw new Error('Element not found');
          }
          return element;
        },
        { timeout }
      );
    },

    // Simulate user input with delay
    simulateUserInput: async (element: ReactTestInstance, text: string, delay: number = 100) => {
      for (let i = 0; i <= text.length; i++) {
        fireEvent.changeText(element, text.substring(0, i));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },

    // Simulate scroll to element
    scrollToElement: (scrollView: ReactTestInstance, _element: ReactTestInstance) => {
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 }, // Simplified scroll position
        },
      });
    },

    // Generate random delay for realistic testing
    randomDelay: (min: number = 100, max: number = 500) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
  };

  /**
   * Error simulation for testing error handling
   */
  static errorSimulation = {
    // Simulate network error
    simulateNetworkError: (errorType: 'timeout' | 'connection' | 'server' = 'connection') => {
      const errors = {
        timeout: new Error('Request timeout'),
        connection: new Error('Network connection failed'),
        server: new Error('Server error (500)'),
      };
      return Promise.reject(errors[errorType]);
    },

    // Simulate payment error
    simulatePaymentError: (errorCode: string = 'CARD_DECLINED') => {
      return Promise.reject(new Error(`Payment failed: ${errorCode}`));
    },

    // Simulate validation error
    simulateValidationError: (field: string, message: string) => {
      const error = new Error(`Validation failed: ${message}`) as Error & { field: string };
      error.field = field;
      return Promise.reject(error);
    },
  };

  /**
   * Test data validation
   */
  static validation = {
    // Validate order structure
    isValidOrder: (order: unknown): order is TestOrder => {
      return !!(
        order &&
        typeof order === 'object' &&
        'id' in order &&
        'items' in order &&
        'total' in order &&
        Array.isArray((order as TestOrder).items) &&
        typeof (order as TestOrder).total === 'number'
      );
    },

    // Validate customer structure
    isValidCustomer: (customer: unknown): customer is TestCustomer => {
      return !!(
        customer &&
        typeof customer === 'object' &&
        'id' in customer &&
        'firstName' in customer &&
        'lastName' in customer &&
        'email' in customer &&
        'phone' in customer &&
        typeof (customer as TestCustomer).firstName === 'string' &&
        typeof (customer as TestCustomer).lastName === 'string'
      );
    },

    // Validate payment structure
    isValidPayment: (payment: unknown): payment is TestPayment => {
      return !!(
        payment &&
        typeof payment === 'object' &&
        'id' in payment &&
        'method' in payment &&
        'amount' in payment &&
        'status' in payment &&
        typeof (payment as TestPayment).amount === 'number' &&
        typeof (payment as TestPayment).method === 'string'
      );
    },
  };

  /**
   * Mock API responses for testing
   */
  static mockAPI = {
    // Mock successful API response
    success: <T>(data: T, delay: number = 100): Promise<T> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(data), delay);
      });
    },

    // Mock API error response
    error: (message: string, status: number = 500, delay: number = 100): Promise<never> => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error(message) as Error & { status: number };
          error.status = status;
          reject(error);
        }, delay);
      });
    },

    // Mock paginated response
    paginated: <T>(data: T[], page: number = 1, pageSize: number = 10) => {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = data.slice(startIndex, endIndex);

      return TestingUtils.mockAPI.success({
        data: paginatedData,
        pagination: {
          page,
          pageSize,
          total: data.length,
          totalPages: Math.ceil(data.length / pageSize),
        },
      });
    },
  };
}

export default TestingUtils;
