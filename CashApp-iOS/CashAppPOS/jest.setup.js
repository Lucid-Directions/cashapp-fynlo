// Mock contexts
jest.mock('./src/contexts/DataContext', () => require('./src/contexts/__mocks__/DataContext'));
jest.mock('./src/contexts/OrderContext', () => require('./src/contexts/__mocks__/OrderContext'));
jest.mock('./src/contexts/PaymentContext', () => require('./src/contexts/__mocks__/PaymentContext'));
