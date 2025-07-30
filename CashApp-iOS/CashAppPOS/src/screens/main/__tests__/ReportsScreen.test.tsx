/**
 * ReportsScreen Component Tests
 * Testing sales analytics and reporting interface
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ReportsScreen from '../../reports/ReportsScreenSimple';
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

describe('ReportsScreen', () => {
  const mockReportsData = {
    dailySales: {
      total: 1247.5,
      orders: 42,
      avgOrderValue: 29.7,
      topItems: [
        { name: 'Classic Burger', quantity: 15, revenue: 194.85 },
        { name: 'French Fries', quantity: 12, revenue: 59.88 },
        { name: 'Caesar Salad', quantity: 8, revenue: 71.92 },
      ],
    },
    weeklySales: {
      total: 8732.25,
      orders: 294,
      avgOrderValue: 29.7,
    },
    monthlySales: {
      total: 37456.8,
      orders: 1261,
      avgOrderValue: 29.7,
    },
    salesChart: [
      { date: '2024-01-10', total: 156.5 },
      { date: '2024-01-11', total: 203.75 },
      { date: '2024-01-12', total: 189.25 },
      { date: '2024-01-13', total: 234.8 },
      { date: '2024-01-14', total: 216.45 },
      { date: '2024-01-15', total: 247.5 },
    ],
  };

  const mockStoreState = {
    reports: mockReportsData,
    loadReports: jest.fn(),
    exportReport: jest.fn(),
    isLoading: false,
    selectedDateRange: 'today',
    setDateRange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(mockStoreState);
  });

  it('renders correctly', () => {
    const { getByText, getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Reports & Analytics')).toBeTruthy();
    expect(getByTestId('reports-container')).toBeTruthy();
  });

  it('displays daily sales summary correctly', () => {
    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText("Today's Sales")).toBeTruthy();
    expect(getByText('$1,247.50')).toBeTruthy();
    expect(getByText('42 Orders')).toBeTruthy();
    expect(getByText('$29.70 Avg')).toBeTruthy();
  });

  it('displays top selling items', () => {
    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Top Items')).toBeTruthy();
    expect(getByText('Classic Burger')).toBeTruthy();
    expect(getByText('15 sold')).toBeTruthy();
    expect(getByText('$194.85')).toBeTruthy();

    expect(getByText('French Fries')).toBeTruthy();
    expect(getByText('12 sold')).toBeTruthy();
    expect(getByText('$59.88')).toBeTruthy();
  });

  it('switches between date ranges', async () => {
    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const weeklyTab = getByText('Weekly');
    fireEvent.press(weeklyTab);

    await waitFor(() => {
      expect(mockStoreState.setDateRange).toHaveBeenCalledWith('week');
    });

    const monthlyTab = getByText('Monthly');
    fireEvent.press(monthlyTab);

    await waitFor(() => {
      expect(mockStoreState.setDateRange).toHaveBeenCalledWith('month');
    });
  });

  it('displays loading state', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      isLoading: true,
    });

    const { getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('refreshes data on pull to refresh', async () => {
    const { getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const scrollView = getByTestId('reports-scroll');
    fireEvent(scrollView, 'refresh');

    await waitFor(() => {
      expect(mockStoreState.loadReports).toHaveBeenCalled();
    });
  });

  it('exports report when export button is pressed', async () => {
    const { getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const exportButton = getByTestId('export-button');
    fireEvent.press(exportButton);

    await waitFor(() => {
      expect(mockStoreState.exportReport).toHaveBeenCalledWith('today');
    });
  });

  it('displays empty state when no data', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      reports: null,
    });

    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('No sales data available')).toBeTruthy();
    expect(getByText('Sales reports will appear here once orders are placed')).toBeTruthy();
  });

  it('displays chart correctly', () => {
    const { getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByTestId('sales-chart')).toBeTruthy();
  });

  it('handles date picker selection', async () => {
    const { getByTestId } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const datePickerButton = getByTestId('date-picker-button');
    fireEvent.press(datePickerButton);

    await waitFor(() => {
      expect(getByTestId('date-picker-modal')).toBeTruthy();
    });

    // Simulate date selection
    const dateOption = getByTestId('date-option-yesterday');
    fireEvent.press(dateOption);

    await waitFor(() => {
      expect(mockStoreState.setDateRange).toHaveBeenCalledWith('yesterday');
    });
  });

  it('displays weekly sales data correctly', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      selectedDateRange: 'week',
    });

    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText("This Week's Sales")).toBeTruthy();
    expect(getByText('$8,732.25')).toBeTruthy();
    expect(getByText('294 Orders')).toBeTruthy();
  });

  it('displays monthly sales data correctly', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      selectedDateRange: 'month',
    });

    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText("This Month's Sales")).toBeTruthy();
    expect(getByText('$37,456.80')).toBeTruthy();
    expect(getByText('1,261 Orders')).toBeTruthy();
  });

  it('formats currency values correctly', () => {
    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    // Should display properly formatted currency
    expect(getByText('$1,247.50')).toBeTruthy();
    expect(getByText('$194.85')).toBeTruthy();
    expect(getByText('$29.70')).toBeTruthy();
  });

  it('handles error state', () => {
    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      reports: null,
      error: 'Failed to load reports',
    });

    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Error loading reports')).toBeTruthy();
    expect(getByText('Failed to load reports')).toBeTruthy();
  });

  it('displays percentage changes correctly', () => {
    const reportsWithChanges = {
      ...mockReportsData,
      dailySales: {
        ...mockReportsData.dailySales,
        changeFromYesterday: 15.5,
      },
    };

    mockUseAppStore.mockReturnValue({
      ...mockStoreState,
      reports: reportsWithChanges,
    });

    const { getByText } = customRender(<ReportsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('+15.5%')).toBeTruthy();
  });
});
