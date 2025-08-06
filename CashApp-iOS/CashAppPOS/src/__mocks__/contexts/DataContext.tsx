import React from 'react';

export const DataContext = React.createContext({
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
});

export const DataProvider = ({ children, value }: any) => (
  <DataContext.Provider value={value || {}}>
    {children}
  </DataContext.Provider>
);

export const useData = () => React.useContext(DataContext);
