import React from 'react';

export const PaymentContext = React.createContext({
  processPayment: jest.fn(() => Promise.resolve({ success: true })),
  refundPayment: jest.fn(() => Promise.resolve({ success: true })),
  isProcessing: false,
  lastTransaction: null,
});

export const PaymentProvider = ({ children, value }: any) => (
  <PaymentContext.Provider value={value || {}}>{children}</PaymentContext.Provider>
);

export const usePayment = () => React.useContext(PaymentContext);
