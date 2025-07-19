/**
 * Comprehensive Security Test Suite
 * Tests all security implementations from Day 12
 */

import { LoggingService } from '../../services/LoggingService';
import { SecureStorageService } from '../../services/SecureStorageService';
import { InputValidationService, ValidationOptions } from '../../services/InputValidationService';
import { useInputValidation } from '../../hooks/useInputValidation';
import { renderHook, act } from '@testing-library/react-hooks';
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

describe('Security Test Suite', () => {
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
        creditCard: '4111111111111111',
        email: 'user@example.com',
      };

      LoggingService.info('User data', sensitiveData);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][1];
      
      expect(loggedData).toContain('[REDACTED]');
      expect(loggedData).not.toContain('secret123');
      expect(loggedData).not.toContain('jwt-token-123');
      expect(loggedData).not.toContain('4111111111111111');
      
      consoleSpy.mockRestore();
    });

    it('should handle circular references safely', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        LoggingService.info('Circular reference test', circularObj);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should respect log levels', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      
      // In production, debug logs should not appear
      process.env.NODE_ENV = 'production';
      LoggingService.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      // Errors should always appear
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      LoggingService.error('Error message');
      expect(errorSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('SecureStorageService Security Tests', () => {
    it('should encrypt data before storage', async () => {
      const testData = { secret: 'sensitive-info' };
      const key = 'test-key';

      await SecureStorageService.setItem(key, testData);

      // Check that AsyncStorage was called with encrypted data
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const storedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      
      // Verify it's not plain text
      expect(storedData).not.toContain('sensitive-info');
      expect(storedData).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 pattern
    });

    it('should decrypt data on retrieval', async () => {
      const testData = { secret: 'sensitive-info' };
      const key = 'test-key';

      // Mock encrypted data
      const mockEncrypted = 'U2FsdGVkX1+encrypted+data==';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(mockEncrypted);

      // Mock keychain to return encryption key
      const Keychain = require('react-native-keychain');
      Keychain.getInternetCredentials.mockResolvedValueOnce({
        password: 'encryption-key-123',
      });

      // For this test, we'll verify the service attempts decryption
      const result = await SecureStorageService.getItem(key);
      
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(key);
      expect(Keychain.getInternetCredentials).toHaveBeenCalled();
    });

    it('should handle sensitive keys specially', async () => {
      const sensitiveKeys = ['password', 'token', 'apiKey', 'pin'];
      
      for (const key of sensitiveKeys) {
        await SecureStorageService.setItem(key, 'sensitive-value');
        
        // Verify keychain was used for sensitive keys
        const Keychain = require('react-native-keychain');
        expect(Keychain.setInternetCredentials).toHaveBeenCalled();
      }
    });
  });

  describe('InputValidationService Security Tests', () => {
    it('should prevent XSS attacks', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload=alert("XSS")>',
      ];

      xssPayloads.forEach(payload => {
        const result = InputValidationService.sanitizeText(payload);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).not.toContain('<script>');
        expect(result.sanitized).not.toContain('javascript:');
        expect(result.sanitized).not.toContain('onerror');
        expect(result.sanitized).not.toContain('<iframe');
        expect(result.sanitized).not.toContain('<svg');
      });
    });

    it('should prevent SQL injection', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users WHERE 1=1;",
        "' UNION SELECT * FROM passwords --",
      ];

      sqlPayloads.forEach(payload => {
        const result = InputValidationService.sanitizeText(payload);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).not.toContain("'");
        expect(result.sanitized).not.toContain(";");
        expect(result.sanitized).not.toContain("--");
      });
    });

    it('should validate email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@company.co.uk',
        'name+tag@domain.com',
      ];

      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user@domain',
        '<script>@hack.com',
      ];

      validEmails.forEach(email => {
        const result = InputValidationService.validateEmail(email);
        expect(result.isValid).toBe(true);
      });

      invalidEmails.forEach(email => {
        const result = InputValidationService.validateEmail(email);
        expect(result.isValid).toBe(false);
      });
    });

    it('should validate UK phone numbers', () => {
      const validPhones = [
        '07123456789',
        '+447123456789',
        '01234567890',
        '+441234567890',
      ];

      const invalidPhones = [
        '123',
        'not-a-phone',
        '07123',
        '+1234567890', // Non-UK
      ];

      validPhones.forEach(phone => {
        const result = InputValidationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(true);
      });

      invalidPhones.forEach(phone => {
        const result = InputValidationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
      });
    });

    it('should enforce length limits', () => {
      const longString = 'a'.repeat(1000);
      const options: ValidationOptions = { maxLength: 100 };

      const result = InputValidationService.sanitizeText(longString, options);
      expect(result.sanitized.length).toBe(100);
      expect(result.errors).toContain('Input exceeds maximum length of 100 characters');
    });

    it('should handle null and undefined safely', () => {
      expect(() => {
        InputValidationService.sanitizeText(null as any);
        InputValidationService.sanitizeText(undefined as any);
        InputValidationService.validateEmail(null as any);
        InputValidationService.validateEmail(undefined as any);
      }).not.toThrow();
    });
  });

  describe('useInputValidation Hook Security Tests', () => {
    it('should validate input in real-time', async () => {
      const { result } = renderHook(() => 
        useInputValidation('email', { required: true })
      );

      // Initially empty
      expect(result.current.error).toBe('This field is required');

      // Set invalid email
      act(() => {
        result.current.setValue('not-an-email');
      });

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.error).toBe('Please enter a valid email address');

      // Set valid email
      act(() => {
        result.current.setValue('user@example.com');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.error).toBe('');
      expect(result.current.value).toBe('user@example.com');
    });

    it('should sanitize malicious input', async () => {
      const { result } = renderHook(() => 
        useInputValidation('text', { sanitize: true })
      );

      const maliciousInput = '<script>alert("hack")</script>Hello';
      
      act(() => {
        result.current.setValue(maliciousInput);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.value).not.toContain('<script>');
      expect(result.current.value).toContain('Hello');
    });
  });

  describe('Integration Security Tests', () => {
    it('should handle complete authentication flow securely', async () => {
      // Test login with sanitized inputs
      const maliciousEmail = 'user@example.com<script>alert("XSS")</script>';
      const maliciousPassword = "password'; DROP TABLE users; --";

      const emailResult = InputValidationService.validateEmail(maliciousEmail);
      const passwordResult = InputValidationService.sanitizeText(maliciousPassword, {
        minLength: 8,
        noTrim: true,
      });

      // Email should be rejected due to script tag
      expect(emailResult.isValid).toBe(false);

      // Password should be sanitized
      expect(passwordResult.sanitized).not.toContain("'");
      expect(passwordResult.sanitized).not.toContain(";");
    });

    it('should securely store and retrieve authentication tokens', async () => {
      const token = 'jwt.token.here';
      const refreshToken = 'refresh.token.here';

      // Store tokens securely
      await SecureStorageService.setItem('authToken', token);
      await SecureStorageService.setItem('refreshToken', refreshToken);

      // Verify they were encrypted
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      
      // Neither call should contain plain tokens
      calls.forEach(call => {
        expect(call[1]).not.toContain('jwt.token.here');
        expect(call[1]).not.toContain('refresh.token.here');
      });
    });

    it('should log security events appropriately', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Log failed login attempt
      LoggingService.warn('Failed login attempt', {
        email: 'user@example.com',
        ip: '192.168.1.1',
        timestamp: new Date().toISOString(),
      });

      // Log security violation
      LoggingService.error('Security violation detected', {
        type: 'SQL_INJECTION_ATTEMPT',
        input: "'; DROP TABLE users; --",
        source: 'login_form',
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      // Verify sensitive data is not exposed
      const warnCall = warnSpy.mock.calls[0][1];
      const errorCall = errorSpy.mock.calls[0][1];
      
      expect(warnCall).not.toContain('192.168.1.1'); // IP should be sanitized
      expect(errorCall).toContain('SQL_INJECTION_ATTEMPT');

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Performance Security Tests', () => {
    it('should handle large inputs without DoS', () => {
      const largeInput = 'a'.repeat(100000); // 100k characters
      
      const startTime = Date.now();
      const result = InputValidationService.sanitizeText(largeInput, {
        maxLength: 1000,
      });
      const endTime = Date.now();

      // Should complete quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.sanitized.length).toBe(1000);
    });

    it('should prevent regex DoS attacks', () => {
      // Malicious regex patterns that could cause DoS
      const maliciousInputs = [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
        '(((((((((((((((((((((((((((((',
        'a+a+a+a+a+a+a+a+a+a+a+a+a+a+',
      ];

      maliciousInputs.forEach(input => {
        const startTime = Date.now();
        InputValidationService.sanitizeText(input);
        const endTime = Date.now();

        // Should complete quickly
        expect(endTime - startTime).toBeLessThan(50);
      });
    });
  });
});