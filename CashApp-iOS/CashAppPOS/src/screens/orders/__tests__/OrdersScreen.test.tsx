/**
 * OrdersScreen Component Tests
 * Testing order list display, filtering, and error handling
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OrdersScreen from '../OrdersScreen';
import { ThemeProvider } from '../../../design-system/ThemeProvider';

// Mock navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Mock DataService
const mockDataService = {
  getOrders: jest.fn(),
};

jest.mock('../../../services/DataService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockDataService,
  },
}));

// Mock theme
const mockTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#000000',
    primary: '#007AFF',
  }
};

jest.mock('../../../design-system/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({ theme: mockTheme }),
}));

// Test data
const mockOrders = [
  {
    id: 'order1',
    date: new Date(),
    customer: { id: 'cust1', name: 'Alice Wonderland', email: 'alice@example.com' },
    total: 100,
    items: 2,
    status: 'completed',
    paymentMethod: 'card',
    employee: 'Bob',
  },
  {
    id: 'order2',
    date: new Date(),
    // No customer info for this order
    total: 50,
    items: 1,
    status: 'pending',
    paymentMethod: 'cash',
    employee: 'Alice',
  },
  {
    id: 'order3',
    date: new Date(),
    customer: { id: 'cust2', name: 'Charlie Brown', email: 'charlie@example.com' },
    total: 75,
    items: 3,
    status: 'completed',
    paymentMethod: 'card',
    employee: 'Bob',
  },
];

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={mockTheme}>{children}</ThemeProvider>
);

describe('OrdersScreen', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockDataService.getOrders.mockClear();
    mockDataService.getOrders.mockResolvedValue([]); // Default to empty
  });

  it('renders loading state initially', () => {
    const { getByText } = render(<OrdersScreen />, { wrapper: AllProviders });
    expect(getByText('Loading Orders...')).toBeTruthy();
  });

  it('fetches and displays orders with customer names', async () => {
    mockDataService.getOrders.mockResolvedValue(mockOrders);

    const { findByText, getByText } = render(<OrdersScreen />, { wrapper: AllProviders });

    await waitFor(() => expect(mockDataService.getOrders).toHaveBeenCalledWith('today'));

    // Check for customer names
    expect(await findByText('Alice Wonderland')).toBeTruthy();
    expect(await findByText('Walk-in Customer')).toBeTruthy(); // For order2 with no customer
    expect(await findByText('Charlie Brown')).toBeTruthy();

    // Check other details to ensure orders are rendered
    expect(getByText('order1')).toBeTruthy();
    expect(getByText('order2')).toBeTruthy();
    expect(getByText('order3')).toBeTruthy();
  });

  it('displays "Walk-in Customer" when customer name is not available', async () => {
    mockDataService.getOrders.mockResolvedValue([mockOrders[1]]); // Only the order without customer

    const { findByText } = render(<OrdersScreen />, { wrapper: AllProviders });

    expect(await findByText('Walk-in Customer')).toBeTruthy();
  });

  it('filters orders by search query (customer name)', async () => {
    mockDataService.getOrders.mockResolvedValue(mockOrders);

    const { getByPlaceholderText, findByText, queryByText } = render(<OrdersScreen />, {
      wrapper: AllProviders,
    });

    await waitFor(() => expect(mockDataService.getOrders).toHaveBeenCalled());

    const searchInput = getByPlaceholderText('Search orders, customers, or staff...');
    fireEvent.changeText(searchInput, 'Alice');

    expect(await findByText('Alice Wonderland')).toBeTruthy();
    expect(queryByText('Charlie Brown')).toBeNull();
    expect(queryByText('Walk-in Customer')).toBeNull(); // Assuming 'Alice' employee also matches
  });

  it('filters orders by search query (customer email)', async () => {
    mockDataService.getOrders.mockResolvedValue(mockOrders);

    const { getByPlaceholderText, findByText, queryByText } = render(<OrdersScreen />, {
      wrapper: AllProviders,
    });

    await waitFor(() => expect(mockDataService.getOrders).toHaveBeenCalled());

    const searchInput = getByPlaceholderText('Search orders, customers, or staff...');
    fireEvent.changeText(searchInput, 'alice@example.com');

    expect(await findByText('Alice Wonderland')).toBeTruthy();
    expect(queryByText('Charlie Brown')).toBeNull();
  });

  it('shows an error message if fetching orders fails', async () => {
    mockDataService.getOrders.mockRejectedValue(
      new Error('Network Error')
    );

    const { findByText } = render(<OrdersScreen />, { wrapper: AllProviders });

    expect(await findByText('Error Loading Orders')).toBeTruthy();
    expect(await findByText('Network Error')).toBeTruthy();
  });

  it('shows "No orders found" when there are no orders', async () => {
    mockDataService.getOrders.mockResolvedValue([]);

    const { findByText } = render(<OrdersScreen />, { wrapper: AllProviders });

    expect(await findByText('No orders found')).toBeTruthy();
  });
});
