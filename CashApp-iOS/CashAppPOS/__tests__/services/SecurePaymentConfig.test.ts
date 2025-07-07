/**
 * Test suite for Secure Payment Config Service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../src/config/api';
import SecurePaymentConfig from '../../src/services/SecurePaymentConfig';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../src/config/api', () => ({
  API_CONFIG: {
    FULL_API_URL: 'http://test.api'
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('SecurePaymentConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (SecurePaymentConfig as any).config = null;
    (SecurePaymentConfig as any).loading = false;
    (SecurePaymentConfig as any).loadingPromise = null;
  });

  describe('loadConfiguration', () => {
    it('should load configuration from backend successfully', async () => {
      // Arrange
      const mockToken = 'test_token_123';
      const mockResponse = {
        data: {
          methods: [
            { id: 'card', name: 'Card', enabled: true },
            { id: 'cash', name: 'Cash', enabled: true }
          ],
          fees: {
            card: { percentage: 1.4, fixed: 0.2, description: '1.4% + 20p' },
            cash: { percentage: 0, fixed: 0, description: 'No fees' }
          },
          publishableKeys: {
            stripe: 'pk_test_123'
          },
          primaryProvider: 'stripe'
        }
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(mockToken);
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Act
      const config = await SecurePaymentConfig.loadConfiguration();

      // Assert
      expect(config).toEqual({
        availableMethods: mockResponse.data.methods,
        fees: mockResponse.data.fees,
        publishableKeys: mockResponse.data.publishableKeys,
        primaryProvider: mockResponse.data.primaryProvider
      });
      expect(fetch).toHaveBeenCalledWith(
        'http://test.api/payments/methods',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token_123'
          }
        })
      );
    });

    it('should return cached configuration if not expired', async () => {
      // Arrange
      const cachedConfig = {
        config: {
          availableMethods: [{ id: 'cash', name: 'Cash', enabled: true }],
          fees: { cash: { percentage: 0, fixed: 0 } }
        },
        timestamp: Date.now() - 1000 // 1 second ago
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(cachedConfig));

      // Act
      const config = await SecurePaymentConfig.loadConfiguration();

      // Assert
      expect(config).toEqual(cachedConfig.config);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle authentication error', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const config = await SecurePaymentConfig.loadConfiguration();

      // Assert
      expect(config.availableMethods).toHaveLength(1);
      expect(config.availableMethods[0].id).toBe('cash');
    });

    it('should handle network error gracefully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('token');
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act
      const config = await SecurePaymentConfig.loadConfiguration();

      // Assert
      expect(config.availableMethods).toHaveLength(1);
      expect(config.availableMethods[0].id).toBe('cash');
    });

    it('should prevent concurrent loading', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('token');
      (fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: { methods: [], fees: {} } })
        }), 100))
      );

      // Act - Start two loads simultaneously
      const promise1 = SecurePaymentConfig.loadConfiguration();
      const promise2 = SecurePaymentConfig.loadConfiguration();

      // Assert - Should return same promise
      expect(promise1).toBe(promise2);
      expect(fetch).toHaveBeenCalledTimes(1);

      await promise1;
    });
  });

  describe('getPublishableKey', () => {
    it('should return publishable key for provider', async () => {
      // Arrange
      (SecurePaymentConfig as any).config = {
        publishableKeys: {
          stripe: 'pk_test_stripe',
          square: 'pk_test_square'
        }
      };

      // Act & Assert
      expect(SecurePaymentConfig.getPublishableKey('stripe')).toBe('pk_test_stripe');
      expect(SecurePaymentConfig.getPublishableKey('square')).toBe('pk_test_square');
      expect(SecurePaymentConfig.getPublishableKey('unknown')).toBeNull();
    });
  });

  describe('calculateFees', () => {
    beforeEach(() => {
      (SecurePaymentConfig as any).config = {
        fees: {
          card: { percentage: 1.4, fixed: 0.2 },
          cash: { percentage: 0, fixed: 0 },
          qr_code: { percentage: 1.2, fixed: 0 }
        }
      };
    });

    it('should calculate fees correctly for card payment', () => {
      const result = SecurePaymentConfig.calculateFees(100, 'card');
      
      expect(result.percentageFee).toBe(1.40);
      expect(result.fixedFee).toBe(0.20);
      expect(result.totalFee).toBe(1.60);
      expect(result.netAmount).toBe(98.40);
    });

    it('should calculate fees correctly for cash payment', () => {
      const result = SecurePaymentConfig.calculateFees(100, 'cash');
      
      expect(result.percentageFee).toBe(0);
      expect(result.fixedFee).toBe(0);
      expect(result.totalFee).toBe(0);
      expect(result.netAmount).toBe(100);
    });

    it('should handle unknown payment method', () => {
      const result = SecurePaymentConfig.calculateFees(100, 'unknown');
      
      expect(result.totalFee).toBe(0);
      expect(result.netAmount).toBe(100);
    });

    it('should round to 2 decimal places', () => {
      const result = SecurePaymentConfig.calculateFees(33.33, 'qr_code');
      
      expect(result.percentageFee).toBe(0.40); // 33.33 * 0.012 = 0.39996
      expect(result.totalFee).toBe(0.40);
      expect(result.netAmount).toBe(32.93);
    });
  });

  describe('validateAmount', () => {
    beforeEach(() => {
      (SecurePaymentConfig as any).config = {
        availableMethods: [
          { id: 'card', enabled: true, minAmount: 0.50, maxAmount: 10000 },
          { id: 'cash', enabled: true, minAmount: 0.01, maxAmount: 5000 }
        ]
      };
    });

    it('should validate amount within range', () => {
      expect(SecurePaymentConfig.validateAmount(100, 'card')).toEqual({
        valid: true
      });
    });

    it('should reject amount below minimum', () => {
      expect(SecurePaymentConfig.validateAmount(0.25, 'card')).toEqual({
        valid: false,
        error: 'Minimum amount is £0.50'
      });
    });

    it('should reject amount above maximum', () => {
      expect(SecurePaymentConfig.validateAmount(15000, 'card')).toEqual({
        valid: false,
        error: 'Maximum amount is £10000.00'
      });
    });

    it('should handle unknown payment method', () => {
      expect(SecurePaymentConfig.validateAmount(100, 'unknown')).toEqual({
        valid: false,
        error: 'Payment method not available'
      });
    });
  });

  describe('formatFeeDisplay', () => {
    beforeEach(() => {
      (SecurePaymentConfig as any).config = {
        fees: {
          card: { percentage: 1.4, fixed: 0.2, description: '1.4% + 20p' },
          cash: { percentage: 0, fixed: 0 },
          qr_code: { percentage: 1.2, fixed: 0 }
        }
      };
    });

    it('should format fee display with description', () => {
      expect(SecurePaymentConfig.formatFeeDisplay('card')).toBe('1.4% + 20p');
    });

    it('should format no fees correctly', () => {
      expect(SecurePaymentConfig.formatFeeDisplay('cash')).toBe('No fees');
    });

    it('should format percentage only fees', () => {
      expect(SecurePaymentConfig.formatFeeDisplay('qr_code')).toBe('1.2%');
    });

    it('should handle unknown method', () => {
      expect(SecurePaymentConfig.formatFeeDisplay('unknown')).toBe('Fee unavailable');
    });
  });

  describe('clearCache', () => {
    it('should clear cached configuration', async () => {
      // Arrange
      (SecurePaymentConfig as any).config = { test: 'data' };

      // Act
      await SecurePaymentConfig.clearCache();

      // Assert
      expect((SecurePaymentConfig as any).config).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@payment_config_cache');
    });
  });

  describe('isMethodAvailable', () => {
    it('should check if payment method is available', () => {
      // Arrange
      (SecurePaymentConfig as any).config = {
        availableMethods: [
          { id: 'card', enabled: true },
          { id: 'cash', enabled: true },
          { id: 'qr_code', enabled: false }
        ]
      };

      // Act & Assert
      expect(SecurePaymentConfig.isMethodAvailable('card')).toBe(true);
      expect(SecurePaymentConfig.isMethodAvailable('cash')).toBe(true);
      expect(SecurePaymentConfig.isMethodAvailable('qr_code')).toBe(false);
      expect(SecurePaymentConfig.isMethodAvailable('unknown')).toBe(false);
    });
  });
});