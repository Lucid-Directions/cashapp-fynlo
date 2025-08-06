import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorHandler, ErrorType, ErrorSeverity } from '../../src/utils/errorHandler';
import { logger } from '../../src/utils/logger';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('handleError', () => {
    it('should handle basic error', async () => {
      await errorHandler.handleError(
        new Error('Test error'),
        ErrorType.SYSTEM,
        ErrorSeverity.MEDIUM
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[SYSTEM] Test error'),
        expect.any(Object)
      );
    });

    it('should store error in AsyncStorage', async () => {
      await errorHandler.handleError(
        new Error('Test error'),
        ErrorType.NETWORK,
        ErrorSeverity.HIGH
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_errors', expect.any(String));
    });

    it('should categorize errors correctly', async () => {
      await errorHandler.handleError(
        new Error('Critical error'),
        ErrorType.PAYMENT,
        ErrorSeverity.CRITICAL
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[PAYMENT] Critical error'),
        expect.any(Object)
      );
    });
  });

  describe('handleNetworkError', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');

      await errorHandler.handleNetworkError(timeoutError, {}, 'api_call');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should determine severity correctly', async () => {
      const unauthorizedError = new Error('Unauthorized access');

      await errorHandler.handleNetworkError(unauthorizedError);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('handleValidationError', () => {
    it('should handle validation errors', async () => {
      await errorHandler.handleValidationError(
        'email',
        'Invalid email format',
        'invalid@',
        'user_form'
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[VALIDATION]'),
        expect.any(Object)
      );
    });
  });

  describe('handlePaymentError', () => {
    it('should handle payment errors with high severity', async () => {
      const paymentError = new Error('Card declined');

      await errorHandler.handlePaymentError(paymentError, {
        amount: 50.0,
        cardNumber: '1234****',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[PAYMENT]'),
        expect.any(Object)
      );
    });

    it('should sanitize payment data', async () => {
      const paymentData = {
        amount: 50.0,
        cardNumber: '1234567890123456',
        cvv: '123',
        pin: '1234',
      };

      await errorHandler.handlePaymentError(new Error('Payment failed'), paymentData);

      // Verify sensitive data is not stored
      const storedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsedData = JSON.parse(storedData);

      expect(parsedData[0].metadata.paymentData).not.toHaveProperty('cardNumber');
      expect(parsedData[0].metadata.paymentData).not.toHaveProperty('cvv');
      expect(parsedData[0].metadata.paymentData).not.toHaveProperty('pin');
    });
  });

  describe('getStoredErrors', () => {
    it('should retrieve stored errors', async () => {
      const mockErrors = [
        {
          id: 'error1',
          message: 'Test error',
          type: ErrorType.SYSTEM,
          severity: ErrorSeverity.MEDIUM,
          timestamp: new Date(),
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockErrors));

      const errors = await errorHandler.getStoredErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');
    });

    it('should return empty array when no errors stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const errors = await errorHandler.getStoredErrors();

      expect(errors).toEqual([]);
    });
  });

  describe('clearStoredErrors', () => {
    it('should clear all stored errors', async () => {
      await errorHandler.clearStoredErrors();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('app_errors');
    });
  });

  describe('getErrorStats', () => {
    beforeEach(async () => {
      // Clear any existing errors
      await errorHandler.clearStoredErrors();
    });

    it('should return correct error statistics', async () => {
      // Add some test errors
      await errorHandler.handleError(new Error('Error 1'), ErrorType.NETWORK, ErrorSeverity.HIGH);
      await errorHandler.handleError(
        new Error('Error 2'),
        ErrorType.PAYMENT,
        ErrorSeverity.CRITICAL
      );
      await errorHandler.handleError(new Error('Error 3'), ErrorType.NETWORK, ErrorSeverity.MEDIUM);

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byType[ErrorType.NETWORK]).toBeGreaterThan(0);
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should attempt recovery for storage errors', async () => {
      await errorHandler.handleError(
        new Error('Storage failed'),
        ErrorType.STORAGE,
        ErrorSeverity.MEDIUM
      );

      // Should trigger recovery attempt - logger.info will be called
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('Error Formatting', () => {
    it('should generate unique error IDs', async () => {
      await errorHandler.handleError(new Error('Error 1'), ErrorType.SYSTEM, ErrorSeverity.LOW);
      await errorHandler.handleError(new Error('Error 2'), ErrorType.SYSTEM, ErrorSeverity.LOW);

      const errors = await errorHandler.getStoredErrors();

      expect(errors[0].id).not.toBe(errors[1].id);
      expect(errors[0].id).toMatch(/^error_\d+_[a-z0-9]+$/);
    });

    it('should include stack trace for Error objects', async () => {
      const error = new Error('Test error with stack');

      await errorHandler.handleError(error, ErrorType.SYSTEM, ErrorSeverity.MEDIUM);

      const errors = await errorHandler.getStoredErrors();
      expect(errors[0].stackTrace).toBeTruthy();
    });

    it('should handle string errors', async () => {
      await errorHandler.handleError('String error message', ErrorType.SYSTEM, ErrorSeverity.LOW);

      const errors = await errorHandler.getStoredErrors();
      expect(errors[0].message).toBe('String error message');
      expect(errors[0].stackTrace).toBeUndefined();
    });
  });

  describe('Performance', () => {
    it('should handle high volume of errors efficiently', async () => {
      const startTime = Date.now();

      // Generate many errors quickly
      const promises = Array.from({ length: 50 }, (_, i) =>
        errorHandler.handleError(new Error(`Error ${i}`), ErrorType.SYSTEM, ErrorSeverity.LOW)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    it('should limit stored errors to prevent memory issues', async () => {
      // Add more errors than the limit
      const promises = Array.from({ length: 150 }, (_, i) =>
        errorHandler.handleError(new Error(`Error ${i}`), ErrorType.SYSTEM, ErrorSeverity.LOW)
      );

      await Promise.all(promises);

      const errors = await errorHandler.getStoredErrors();

      // Should be limited to max size (100)
      expect(errors.length).toBeLessThanOrEqual(100);
    });
  });
});