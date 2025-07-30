/**
 * Mock Data Fixtures for Testing
 * Centralized test data for consistent testing across the application
 */

import { MenuItem, OrderItem, Order, User, PosSession, Category } from '../../types';

// Menu Items
export const mockMenuItems: MenuItem[] = [
  {
    id: 1,
    name: 'Classic Burger',
    price: 12.99,
    category: 'Main',
    emoji: '🍔',
    available: true,
    description: 'Delicious beef burger with all the fixings',
    barcode: '1234567890123',
  },
  {
    id: 2,
    name: 'Caesar Salad',
    price: 9.99,
    category: 'Salads',
    emoji: '🥗',
    available: true,
    description: 'Fresh romaine lettuce with caesar dressing',
  },
  {
    id: 3,
    name: 'Margherita Pizza',
    price: 15.99,
    category: 'Main',
    emoji: '🍕',
    available: true,
    description: 'Traditional pizza with tomato, mozzarella, and basil',
  },
  {
    id: 4,
    name: 'Chicken Wings',
    price: 11.99,
    category: 'Appetizers',
    emoji: '🍗',
    available: false, // Unavailable item for testing
    description: 'Spicy buffalo wings with ranch dressing',
  },
  {
    id: 5,
    name: 'French Fries',
    price: 4.99,
    category: 'Sides',
    emoji: '🍟',
    available: true,
    description: 'Crispy golden fries',
  },
];

// Categories
export const mockCategories: Category[] = [
  { id: 1, name: 'Main', active: true, color: '#E74C3C' },
  { id: 2, name: 'Appetizers', active: true, color: '#F39C12' },
  { id: 3, name: 'Salads', active: true, color: '#27AE60' },
  { id: 4, name: 'Sides', active: true, color: '#3498DB' },
  { id: 5, name: 'Desserts', active: true, color: '#9B59B6' },
  { id: 6, name: 'Drinks', active: true, color: '#1ABC9C' },
];

// Order Items
export const mockOrderItems: OrderItem[] = [
  {
    id: 1,
    name: 'Classic Burger',
    price: 12.99,
    quantity: 2,
    emoji: '🍔',
    modifications: ['No onions', 'Extra cheese'],
    notes: 'Well done',
  },
  {
    id: 2,
    name: 'French Fries',
    price: 4.99,
    quantity: 1,
    emoji: '🍟',
  },
  {
    id: 3,
    name: 'Caesar Salad',
    price: 9.99,
    quantity: 1,
    emoji: '🥗',
    modifications: ['Dressing on the side'],
  },
];

// Orders
export const mockOrders: Order[] = [
  {
    id: 1,
    items: [mockOrderItems[0], mockOrderItems[1]],
    subtotal: 30.97,
    tax: 2.48,
    total: 33.45,
    customerName: 'John Doe',
    tableNumber: 5,
    createdAt: new Date('2024-01-15T12:30:00Z'),
    status: 'preparing',
    paymentMethod: 'card',
    notes: 'Customer has food allergies',
  },
  {
    id: 2,
    items: [mockOrderItems[2]],
    subtotal: 9.99,
    tax: 0.8,
    total: 10.79,
    customerName: 'Jane Smith',
    tableNumber: 3,
    createdAt: new Date('2024-01-15T11:45:00Z'),
    status: 'ready',
    paymentMethod: 'cash',
  },
  {
    id: 3,
    items: mockOrderItems,
    subtotal: 37.96,
    tax: 3.04,
    total: 41.0,
    tableNumber: 7,
    createdAt: new Date('2024-01-15T10:15:00Z'),
    status: 'completed',
    paymentMethod: 'apple_pay',
  },
  {
    id: 4,
    items: [mockOrderItems[0]],
    subtotal: 25.98,
    tax: 2.08,
    total: 28.06,
    customerName: 'Bob Wilson',
    tableNumber: 2,
    createdAt: new Date('2024-01-15T13:00:00Z'),
    status: 'cancelled',
    paymentMethod: 'card',
    notes: 'Customer cancelled due to wait time',
  },
];

// Users
export const mockUsers: User[] = [
  {
    id: 1,
    name: 'John Manager',
    email: 'john@fynlo.com',
    role: 'manager',
    isActive: true,
    avatar: 'https://example.com/avatar1.jpg',
  },
  {
    id: 2,
    name: 'Sarah Cashier',
    email: 'sarah@fynlo.com',
    role: 'cashier',
    isActive: true,
  },
  {
    id: 3,
    name: 'Mike Admin',
    email: 'mike@fynlo.com',
    role: 'admin',
    isActive: true,
  },
  {
    id: 4,
    name: 'Lisa Former',
    email: 'lisa@fynlo.com',
    role: 'cashier',
    isActive: false, // Inactive user for testing
  },
];

// POS Sessions
export const mockSessions: PosSession[] = [
  {
    id: 1,
    userId: 1,
    userName: 'John Manager',
    startTime: new Date('2024-01-15T09:00:00Z'),
    endTime: new Date('2024-01-15T17:00:00Z'),
    isActive: false,
    startingCash: 200.0,
    endingCash: 450.0,
    totalSales: 1250.0,
    ordersCount: 45,
  },
  {
    id: 2,
    userId: 2,
    userName: 'Sarah Cashier',
    startTime: new Date('2024-01-16T09:00:00Z'),
    isActive: true,
    startingCash: 150.0,
    totalSales: 325.75,
    ordersCount: 12,
  },
];

// API Response Mocks
export const mockApiResponses = {
  loginSuccess: {
    success: true,
    data: {
      user: mockUsers[0],
      session: mockSessions[1],
      token: 'mock-jwt-token-12345',
    },
  },

  loginFailure: {
    success: false,
    error: 'Invalid credentials',
  },

  productsSuccess: {
    success: true,
    data: mockMenuItems,
  },

  categoriesSuccess: {
    success: true,
    data: mockCategories,
  },

  ordersSuccess: {
    success: true,
    data: mockOrders,
  },

  orderCreateSuccess: {
    success: true,
    data: mockOrders[0],
  },

  paymentSuccess: {
    success: true,
    data: {
      transactionId: 'txn_12345',
      status: 'completed',
      amount: 33.45,
    },
  },

  paymentFailure: {
    success: false,
    error: 'Payment declined',
  },

  networkError: {
    success: false,
    error: 'Network connection failed',
  },
};

// Form Data
export const mockFormData = {
  validLogin: {
    username: 'sarah@fynlo.com',
    password: 'password123',
  },

  invalidLogin: {
    username: 'wrong@example.com',
    password: 'wrongpassword',
  },

  forgotPassword: {
    email: 'sarah@fynlo.com',
  },

  orderCustomer: {
    name: 'Test Customer',
    table: '5',
  },
};

// Test Scenarios
export const testScenarios = {
  emptyCart: {
    cart: [],
    total: 0,
    itemCount: 0,
  },

  singleItemCart: {
    cart: [mockOrderItems[0]],
    total: 25.98, // 2 items * 12.99
    itemCount: 2,
  },

  multipleItemsCart: {
    cart: mockOrderItems,
    total: 37.96,
    itemCount: 4,
  },

  offlineMode: {
    isOnline: false,
    showOfflineIndicator: true,
  },

  loadingState: {
    isLoading: true,
    error: null,
  },

  errorState: {
    isLoading: false,
    error: 'Something went wrong',
  },
};

// Performance Test Data
export const performanceTestData = {
  largeMenuItems: Array.from({ length: 100 }, (_, index) => ({
    id: index + 1,
    name: `Menu Item ${index + 1}`,
    price: Math.round((Math.random() * 20 + 5) * 100) / 100,
    category: mockCategories[index % mockCategories.length].name,
    emoji: '🍽️',
    available: Math.random() > 0.1, // 90% available
  })),

  largeOrderHistory: Array.from({ length: 500 }, (_, index) => ({
    id: index + 1,
    items: [mockOrderItems[index % mockOrderItems.length]],
    subtotal: Math.round(Math.random() * 50 * 100) / 100,
    tax: Math.round(Math.random() * 5 * 100) / 100,
    total: Math.round(Math.random() * 55 * 100) / 100,
    createdAt: new Date(Date.now() - index * 1000 * 60 * 5), // 5 minutes apart
    status: ['preparing', 'ready', 'completed'][index % 3] as unknown,
    paymentMethod: ['cash', 'card', 'apple_pay'][index % 3] as unknown,
  })),
};

export default {
  mockMenuItems,
  mockCategories,
  mockOrderItems,
  mockOrders,
  mockUsers,
  mockSessions,
  mockApiResponses,
  mockFormData,
  testScenarios,
  performanceTestData,
};
