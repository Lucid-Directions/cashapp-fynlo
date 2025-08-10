import React from 'react';

const mockDataContext = {
  menuItems: [],
  categories: [],
  orders: [],
  tables: [],
  employees: [],
  isLoading: false,
  error: null,
  fetchMenuItems: jest.fn(() => Promise.resolve()),
  fetchOrders: jest.fn(() => Promise.resolve()),
  refreshData: jest.fn(() => Promise.resolve()),
};

export const DataContext = React.createContext(mockDataContext);
export const DataProvider = ({ children, value }: any) => (
  <DataContext.Provider value={value || mockDataContext}>{children}</DataContext.Provider>
);
export const useData = () => mockDataContext;
