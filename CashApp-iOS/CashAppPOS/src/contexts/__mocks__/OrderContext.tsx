import React from 'react';

const mockOrderContext = {
  currentOrder: null,
  orderItems: [],
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  clearOrder: jest.fn(),
  submitOrder: jest.fn(() => Promise.resolve()),
  totalAmount: 0,
  itemCount: 0,
};

export const OrderContext = React.createContext(mockOrderContext);
export const OrderProvider = ({ children, value }: any) => (
  <OrderContext.Provider value={value || mockOrderContext}>{children}</OrderContext.Provider>
);
export const useOrder = () => mockOrderContext;
