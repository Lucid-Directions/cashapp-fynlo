import React from 'react';

const mockPaymentContext = {
  processPayment: jest.fn(() => Promise.resolve({ success: true })),
  refundPayment: jest.fn(() => Promise.resolve({ success: true })),
  isProcessing: false,
  lastTransaction: null,
};

export const PaymentContext = React.createContext(mockPaymentContext);
export const PaymentProvider = ({ children, value }: any) => (
  <PaymentContext.Provider value={value || mockPaymentContext}>
    {children}
  </PaymentContext.Provider>
);
export const usePayment = () => mockPaymentContext;
