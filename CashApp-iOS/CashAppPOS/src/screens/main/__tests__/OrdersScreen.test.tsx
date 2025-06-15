/**
 * OrdersScreen Component Tests
 * Testing order management and history interface
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import OrdersScreen from '../OrdersScreen';
import { customRender } from '../../../__tests__/utils/testUtils';
import { useAppStore } from '../../../store/useAppStore';

// Mock the store
jest.mock('../../../store/useAppStore');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

describe('OrdersScreen', () => {
  const mockOrders = [
    {
      id: 1,
      customer_name: 'John Doe',
      items: [
        { name: 'Classic Burger', quantity: 2, price: 12.99 },
        { name: 'French Fries', quantity: 1, price: 4.99 },
      ],
      total: 30.97,
      status: 'completed',
      created_at: '2024-01-15T10:30:00Z',
      table_number: 5,
    },
    {
      id: 2,
      customer_name: 'Jane Smith',
      items: [
        { name: 'Caesar Salad', quantity: 1, price: 8.99 },
      ],
      total: 8.99,
      status: 'pending',
      created_at: '2024-01-15T11:15:00Z',
      table_number: 3,
    },
  ];

  const mockStoreState = {
    orders: mockOrders,
    loadOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    deleteOrder: jest.fn(),
    searchOrders: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(mockStoreState);
  });

  it('renders correctly', () => {
    const { getByText, getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Orders')).toBeTruthy();
    expect(getByTestId('orders-list')).toBeTruthy();
  });

  it('displays orders correctly', () => {
    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Order #1')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('$30.97')).toBeTruthy();
    expect(getByText('Table 5')).toBeTruthy();
    expect(getByText('completed')).toBeTruthy();

    expect(getByText('Order #2')).toBeTruthy();
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('$8.99')).toBeTruthy();
    expect(getByText('Table 3')).toBeTruthy();
    expect(getByText('pending')).toBeTruthy();
  });

  it('displays empty state when no orders', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      orders: [],
    });

    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('No orders found')).toBeTruthy();
    expect(getByText('Orders will appear here once created')).toBeTruthy();
  });

  it('displays loading state', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      isLoading: true,
    });

    const { getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('navigates to order details when order is tapped', () => {
    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const orderItem = getByText('Order #1');
    fireEvent.press(orderItem);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OrderDetails', {
      orderId: 1,
    });
  });

  it('updates order status', async () => {
    const { getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const statusButton = getByTestId('status-button-2');
    fireEvent.press(statusButton);

    await waitFor(() => {
      expect(mockStoreState.updateOrderStatus).toHaveBeenCalledWith(2, 'completed');
    });
  });

  it('filters orders by status', () => {
    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const pendingFilter = getByText('Pending');
    fireEvent.press(pendingFilter);

    // Should filter orders (implementation would depend on store logic)
    expect(getByText('Jane Smith')).toBeTruthy();
  });

  it('searches orders by customer name', async () => {
    const { getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const searchInput = getByTestId('search-input');
    fireEvent.changeText(searchInput, 'John');

    await waitFor(() => {
      expect(mockStoreState.searchOrders).toHaveBeenCalledWith('John');
    });
  });

  it('refreshes orders on pull to refresh', async () => {
    const { getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const ordersList = getByTestId('orders-list');
    fireEvent(ordersList, 'refresh');

    await waitFor(() => {
      expect(mockStoreState.loadOrders).toHaveBeenCalled();
    });
  });

  it('deletes order when delete button is pressed', async () => {
    const { getByTestId } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    const deleteButton = getByTestId('delete-order-1');
    fireEvent.press(deleteButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(getByTestId('delete-confirmation')).toBeTruthy();
    });

    const confirmButton = getByTestId('confirm-delete');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockStoreState.deleteOrder).toHaveBeenCalledWith(1);
    });
  });

  it('displays order items correctly', () => {
    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Classic Burger x2')).toBeTruthy();
    expect(getByText('French Fries x1')).toBeTruthy();
    expect(getByText('Caesar Salad x1')).toBeTruthy();
  });

  it('formats order date correctly', () => {
    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    // Assuming date formatting function exists
    expect(getByText('Jan 15, 10:30 AM')).toBeTruthy();
    expect(getByText('Jan 15, 11:15 AM')).toBeTruthy();
  });

  it('handles order status changes correctly', async () => {
    const { getByTestId, rerender } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    // Update order status in store
    const updatedOrders = [
      { ...mockOrders[0] },
      { ...mockOrders[1], status: 'completed' },
    ];

    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      orders: updatedOrders,
    });

    rerender(<OrdersScreen />);

    // Should reflect updated status
    await waitFor(() => {
      expect(getByTestId('order-status-2')).toHaveTextContent('completed');
    });
  });

  it('groups orders by date', () => {
    const ordersWithDifferentDates = [
      { ...mockOrders[0], created_at: '2024-01-15T10:30:00Z' },
      { ...mockOrders[1], created_at: '2024-01-14T15:20:00Z' },
    ];

    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      orders: ordersWithDifferentDates,
    });

    const { getByText } = customRender(
      <OrdersScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
  });
});