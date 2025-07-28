/**
 * Test suite for Secure Payment Orchestrator Service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import SecurePaymentOrchestrator from '../../src/services/SecurePaymentOrchestrator';
import SecurePaymentConfig from '../../src/services/SecurePaymentConfig';
import { API_CONFIG } from '../../src/config/api';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn()
  }
}));
jest.mock('../../src/services/SecurePaymentConfig');
jest.mock('../../src/config/api', () => ({
  API_CONFIG: {
    FULL_API_URL: 'http://test.api'
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('SecurePaymentOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset orchestrator state
    (SecurePaymentOrchestrator as any).processingPayment = false;
    (SecurePaymentOrchestrator as any).currentPaymentId = null;
  });

  describe('processPayment', () => {
    const mockPaymentRequest = {
      orderId: 'order_123',
      amount: 100.50,
      paymentMethod: 'card' as const,
      paymentDetails: { source: 'tok_visa' }
    };

    it('should process payment successfully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(true);
      (SecurePaymentConfig.validateAmount as jest.Mock).mockReturnValue({ valid: true });
      
      const mockResponse = {
        data: {
          payment_id: 'pay_123',
          transaction_id: 'txn_123',
          provider: 'stripe',
          amount: 100.50,
          fees: {
            percentageFee: 1.41,
            fixedFee: 0.20,
            totalFee: 1.61,
            ratePercentage: 1.4
          },
          net_amount: 98.89,
          status: 'completed',
          completed_at: '2025-01-07T10:00:00Z'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay_123');
      expect(result.transactionId).toBe('txn_123');
      expect(result.netAmount).toBe(98.89);
      expect(fetch).toHaveBeenCalledWith(
        'http://test.api/payments/process',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer auth_token'
          },
          body: JSON.stringify({
            order_id: 'order_123',
            amount: 100.50,
            payment_method: 'card',
            payment_details: { source: 'tok_visa' },
            metadata: undefined
          })
        })
      );
    });

    it('should prevent concurrent payment processing', async () => {
      // Arrange
      (SecurePaymentOrchestrator as any).processingPayment = true;

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PAYMENT_IN_PROGRESS');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate payment method availability', async () => {
      // Arrange
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('METHOD_UNAVAILABLE');
    });

    it('should validate payment amount', async () => {
      // Arrange
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(true);
      (SecurePaymentConfig.validateAmount as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Amount too high'
      });

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount too high');
      expect(result.errorCode).toBe('INVALID_AMOUNT');
    });

    it('should handle authentication errors', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(true);
      (SecurePaymentConfig.validateAmount as jest.Mock).mockReturnValue({ valid: true });

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AUTH_REQUIRED');
    });

    it('should handle rate limiting', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(true);
      (SecurePaymentConfig.validateAmount as jest.Mock).mockReturnValue({ valid: true });
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Rate limited' })
      });

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RATE_LIMITED');
      expect(result.error).toContain('Too many payment attempts');
    });

    it('should handle network errors', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      (SecurePaymentConfig.isMethodAvailable as jest.Mock).mockResolvedValue(true);
      (SecurePaymentConfig.validateAmount as jest.Mock).mockReturnValue({ valid: true });
      
      (fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

      // Act
      const result = await SecurePaymentOrchestrator.processPayment(mockPaymentRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.error).toContain('Network error');
    });
  });

  describe('sanitizePaymentDetails', () => {
    it('should remove sensitive fields', () => {
      // Arrange
      const details = {
        card_number: '4111111111111111',
        cvv: '123',
        pin: '1234',
        source: 'tok_visa',
        customer_email: 'test@example.com'
      };

      // Act
      const sanitized = (SecurePaymentOrchestrator as any).sanitizePaymentDetails(details);

      // Assert
      expect(sanitized.card_number).toBeUndefined();
      expect(sanitized.cvv).toBeUndefined();
      expect(sanitized.pin).toBeUndefined();
      expect(sanitized.source).toBe('tok_visa');
      expect(sanitized.customer_email).toBe('test@example.com');
    });

    it('should mask card numbers', () => {
      // Arrange
      const details = {
        masked_card_number: '4111111111111111'
      };

      // Act
      const sanitized = (SecurePaymentOrchestrator as any).sanitizePaymentDetails(details);

      // Assert
      expect(sanitized.masked_card_number).toBe('****1111');
    });
  });

  describe('processRefund', () => {
    const mockRefundRequest = {
      transactionId: 'txn_123',
      amount: 50.00,
      reason: 'Customer request'
    };

    it('should process refund successfully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      
      const mockResponse = {
        data: {
          refund_id: 'ref_123',
          status: 'pending'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Act
      const result = await SecurePaymentOrchestrator.processRefund(mockRefundRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('ref_123');
      expect(result.status).toBe('pending');
    });

    it('should handle permission denied for refunds', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Insufficient permissions' })
      });

      // Act
      const result = await SecurePaymentOrchestrator.processRefund(mockRefundRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PERMISSION_DENIED');
      expect(result.error).toContain('Only managers and above');
    });
  });

  describe('showPaymentConfirmation', () => {
    it('should show confirmation dialog with fees', async () => {
      // Arrange
      const mockFees = {
        percentageFee: 1.40,
        fixedFee: 0.20,
        totalFee: 1.60,
        netAmount: 98.40
      };
      
      (SecurePaymentConfig.calculateFees as jest.Mock).mockReturnValue(mockFees);
      (SecurePaymentConfig.formatFeeDisplay as jest.Mock).mockReturnValue('1.4% + 20p');

      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      // Act
      await SecurePaymentOrchestrator.showPaymentConfirmation(
        100,
        'card',
        onConfirm,
        onCancel
      );

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Confirm Payment',
        expect.stringContaining('Amount: £100.00'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Confirm' })
        ])
      );
    });

    it('should show no fees for cash payment', async () => {
      // Arrange
      const mockFees = {
        percentageFee: 0,
        fixedFee: 0,
        totalFee: 0,
        netAmount: 100
      };
      
      (SecurePaymentConfig.calculateFees as jest.Mock).mockReturnValue(mockFees);
      (SecurePaymentConfig.formatFeeDisplay as jest.Mock).mockReturnValue('No fees');

      // Act
      await SecurePaymentOrchestrator.showPaymentConfirmation(
        100,
        'cash',
        jest.fn(),
        jest.fn()
      );

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Confirm Payment',
        expect.stringContaining('No processing fees'),
        expect.any(Array)
      );
    });
  });

  describe('formatPaymentError', () => {
    it('should format known error codes', () => {
      expect(SecurePaymentOrchestrator.formatPaymentError('', 'CARD_DECLINED'))
        .toBe('Card was declined. Please try another card.');
      
      expect(SecurePaymentOrchestrator.formatPaymentError('', 'INSUFFICIENT_FUNDS'))
        .toBe('Insufficient funds');
      
      expect(SecurePaymentOrchestrator.formatPaymentError('', 'NETWORK_ERROR'))
        .toBe('Network error. Please check your connection.');
    });

    it('should use provided error message for unknown codes', () => {
      expect(SecurePaymentOrchestrator.formatPaymentError('Custom error', 'UNKNOWN'))
        .toBe('Custom error');
    });

    it('should provide default message when no error provided', () => {
      expect(SecurePaymentOrchestrator.formatPaymentError('', ''))
        .toBe('Payment failed. Please try again.');
    });
  });

  describe('getPaymentStatus', () => {
    it('should retrieve payment status successfully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      
      const mockResponse = {
        data: {
          payment_id: 'pay_123',
          status: 'completed',
          provider: 'stripe',
          amount: 100.50,
          currency: 'GBP',
          created_at: '2025-01-07T10:00:00Z',
          completed_at: '2025-01-07T10:01:00Z'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Act
      const status = await SecurePaymentOrchestrator.getPaymentStatus('pay_123');

      // Assert
      expect(status).toEqual({
        paymentId: 'pay_123',
        status: 'completed',
        provider: 'stripe',
        amount: 100.50,
        currency: 'GBP',
        createdAt: '2025-01-07T10:00:00Z',
        completedAt: '2025-01-07T10:01:00Z',
        errorMessage: undefined
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('auth_token');
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act
      const status = await SecurePaymentOrchestrator.getPaymentStatus('pay_123');

      // Assert
      expect(status).toBeNull();
    });
  });

  describe('State management', () => {
    it('should track processing state', () => {
      expect(SecurePaymentOrchestrator.isProcessing()).toBe(false);
      expect(SecurePaymentOrchestrator.getCurrentPaymentId()).toBeNull();
    });

    it('should cancel current payment', async () => {
      // Arrange
      (SecurePaymentOrchestrator as any).processingPayment = true;
      (SecurePaymentOrchestrator as any).currentPaymentId = 'pay_123';

      // Act
      const result = await SecurePaymentOrchestrator.cancelCurrentPayment();

      // Assert
      expect(result).toBe(true);
      expect(SecurePaymentOrchestrator.isProcessing()).toBe(false);
      expect(SecurePaymentOrchestrator.getCurrentPaymentId()).toBeNull();
    });
  });
});