import React from 'react';

export const OrderContext = React.createContext({
  currentOrder: null,
  orderItems: [],
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  clearOrder: jest.fn(),
  submitOrder: jest.fn(() => Promise.resolve()),
  totalAmount: 0,
  itemCount: 0,
});

export const OrderProvider = ({ children, value }: any) => (
  <OrderContext.Provider value={value || {}}>
    {children}
  </OrderContext.Provider>
);

export const useOrder = () => React.useContext(OrderContext);
