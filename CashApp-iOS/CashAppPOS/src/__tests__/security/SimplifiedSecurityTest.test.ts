/**
 * Simplified Security Test Suite
 * Tests security implementations from Day 12
 */

import loggingService from '../../services/LoggingService';
import secureStorage from '../../services/SecureStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn().mockResolvedValue(true),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn().mockResolvedValue(true),
}));

describe('Simplified Security Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LoggingService Security Tests', () => {
    it('should sanitize sensitive data in logs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const sensitiveData = {
        password: 'secret123',
        token: 'jwt-token-123',
        apiKey: 'api-key-456',
      };

      loggingService.info('User data', sensitiveData);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.stringify(consoleSpy.mock.calls[0]);
      
      expect(loggedData).toContain('[REDACTED]');
      expect(loggedData).not.toContain('secret123');
      expect(loggedData).not.toContain('jwt-token-123');
      expect(loggedData).not.toContain('api-key-456');
      
      consoleSpy.mockRestore();
    });

    it('should handle circular references safely', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        loggingService.info('Circular reference test', circularObj);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should respect log levels in production', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      
      // In production, debug logs should not appear
      process.env.NODE_ENV = 'production';
      loggingService.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      // Info logs should appear in production
      loggingService.info('Info message');
      expect(consoleSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should log errors with stack traces', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = new Error('Test error');
      loggingService.error('Error occurred', error);

      expect(errorSpy).toHaveBeenCalled();
      const loggedData = JSON.stringify(errorSpy.mock.calls[0]);
      expect(loggedData).toContain('Test error');
      
      errorSpy.mockRestore();
    });
  });

  describe('SecureStorageService Security Tests', () => {
    it('should encrypt data before storage', async () => {
      const testData = { secret: 'sensitive-info' };
      const key = 'test-key';

      await secureStorage.setItem(key, testData);

      // Check that AsyncStorage was called with encrypted data
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const storedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      
      // Verify it's not plain text
      expect(storedData).not.toContain('sensitive-info');
      expect(storedData).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 pattern
    });

    it('should handle sensitive keys specially', async () => {
      const sensitiveKeys = ['password', 'token', 'apiKey', 'pin'];
      
      for (const key of sensitiveKeys) {
        await secureStorage.setItem(key, 'sensitive-value');
        
        // Verify keychain was used for sensitive keys
        const Keychain = require('react-native-keychain');
        expect(Keychain.setInternetCredentials).toHaveBeenCalled();
      }
    });

    it('should clear storage items', async () => {
      const key = 'test-key';
      
      await secureStorage.removeItem(key);
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('should handle errors gracefully', async () => {
      // Mock AsyncStorage to throw error
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(
        secureStorage.setItem('key', 'value')
      ).rejects.toThrow('Storage error');
    });
  });

  describe('Integration Security Tests', () => {
    it('should log security events appropriately', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Log failed login attempt
      loggingService.warn('Failed login attempt', {
        email: 'user@example.com',
        ip: '192.168.1.1',
        timestamp: new Date().toISOString(),
      });

      // Log security violation
      loggingService.error('Security violation detected', {
        type: 'SQL_INJECTION_ATTEMPT',
        input: "'; DROP TABLE users; --",
        source: 'login_form',
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      // Verify sensitive data is properly handled
      const warnCall = JSON.stringify(warnSpy.mock.calls[0]);
      const errorCall = JSON.stringify(errorSpy.mock.calls[0]);
      
      expect(errorCall).toContain('SQL_INJECTION_ATTEMPT');

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should securely store and handle authentication tokens', async () => {
      const token = 'jwt.token.here';
      const refreshToken = 'refresh.token.here';

      // Store tokens securely
      await secureStorage.setItem('authToken', token);
      await secureStorage.setItem('refreshToken', refreshToken);

      // Verify they were encrypted
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      
      // Neither call should contain plain tokens
      calls.forEach(call => {
        expect(call[1]).not.toContain('jwt.token.here');
        expect(call[1]).not.toContain('refresh.token.here');
      });
    });
  });

  describe('Performance Security Tests', () => {
    it('should handle large data efficiently', async () => {
      const largeData = { data: 'x'.repeat(10000) }; // 10k characters
      
      const startTime = Date.now();
      await secureStorage.setItem('large-data', largeData);
      const endTime = Date.now();

      // Should complete quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should sanitize data without blocking', () => {
      const startTime = Date.now();
      
      // Test with potentially malicious patterns
      const testData = {
        script: '<script>alert("test")</script>',
        sql: "'; DROP TABLE users; --",
        large: 'a'.repeat(1000),
      };

      loggingService.info('Performance test', testData);
      
      const endTime = Date.now();
      
      // Should complete very quickly (under 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});