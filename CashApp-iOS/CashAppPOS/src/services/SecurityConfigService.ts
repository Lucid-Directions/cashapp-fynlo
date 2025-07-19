/**
 * Security Configuration Service
 * 
 * Centralized service for managing all security-related configurations
 * Ensures no hardcoded API keys or secrets in the codebase
 */

import { API_CONFIG } from '../config/api';
import secureStorage from './SecureStorageService';
import { info, warn, error as logError } from './LoggingService';
import tokenManager from '../utils/tokenManager';

interface SecurityConfig {
  // Payment Provider Keys (only public keys)
  stripePublishableKey?: string;
  sumUpAffiliateKey?: string;
  squareApplicationId?: string;
  
  // API Configuration
  apiBaseUrl: string;
  apiTimeout: number;
  
  // Security Settings
  sessionTimeout: number;
  maxLoginAttempts: number;
  tokenRefreshBuffer: number;
  
  // Feature Flags
  enableBiometricAuth: boolean;
  enableSecureStorage: boolean;
  enableCertificatePinning: boolean;
}

class SecurityConfigService {
  private static instance: SecurityConfigService;
  private config: SecurityConfig | null = null;
  private configCacheKey = '@security_config';
  private configExpiryMs = 3600000; // 1 hour
  
  private defaultConfig: SecurityConfig = {
    apiBaseUrl: API_CONFIG.BASE_URL,
    apiTimeout: 30000,
    sessionTimeout: 3600000, // 1 hour
    maxLoginAttempts: 5,
    tokenRefreshBuffer: 300000, // 5 minutes
    enableBiometricAuth: true,
    enableSecureStorage: true,
    enableCertificatePinning: false
  };

  private constructor() {}

  static getInstance(): SecurityConfigService {
    if (!SecurityConfigService.instance) {
      SecurityConfigService.instance = new SecurityConfigService();
    }
    return SecurityConfigService.instance;
  }

  /**
   * Load security configuration from backend
   * All sensitive keys remain server-side
   */
  async loadConfig(forceRefresh: boolean = false): Promise<SecurityConfig> {
    try {
      // Check cache first
      if (!forceRefresh && this.config) {
        return this.config;
      }

      // Try to load from secure storage
      const cached = await secureStorage.getItem<{
        config: SecurityConfig;
        timestamp: number;
      }>(this.configCacheKey);

      if (!forceRefresh && cached && (Date.now() - cached.timestamp < this.configExpiryMs)) {
        this.config = cached.config;
        info('Loaded security config from cache', undefined, 'SecurityConfig');
        return this.config;
      }

      // Fetch from backend
      const token = await tokenManager.getValidToken();
      if (!token) {
        warn('No valid token for loading security config', undefined, 'SecurityConfig');
        return this.defaultConfig;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/config/security`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Failed to load security config: ${response.status}`);
      }

      const data = await response.json();
      this.config = {
        ...this.defaultConfig,
        ...data.config
      };

      // Cache the configuration
      await secureStorage.setItem(this.configCacheKey, {
        config: this.config,
        timestamp: Date.now()
      }, { encrypt: true });

      info('Security config loaded successfully', undefined, 'SecurityConfig');
      return this.config;
    } catch (err) {
      logError('Failed to load security config', err, 'SecurityConfig');
      return this.defaultConfig;
    }
  }

  /**
   * Get specific configuration value
   */
  async getConfig<K extends keyof SecurityConfig>(key: K): Promise<SecurityConfig[K]> {
    const config = await this.loadConfig();
    return config[key];
  }

  /**
   * Get payment provider configuration
   * Only returns public keys, never secret keys
   */
  async getPaymentConfig(provider: 'stripe' | 'sumup' | 'square') {
    const config = await this.loadConfig();
    
    switch (provider) {
      case 'stripe':
        return {
          publishableKey: config.stripePublishableKey,
          // Never include secret key
        };
      
      case 'sumup':
        return {
          affiliateKey: config.sumUpAffiliateKey,
          // API key is server-side only
        };
      
      case 'square':
        return {
          applicationId: config.squareApplicationId,
          // Access token is server-side only
        };
      
      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  }

  /**
   * Validate API requests have proper security headers
   */
  getSecureHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
      'X-Platform': 'ios',
      'X-Request-ID': this.generateRequestId(),
    };

    if (includeAuth) {
      const token = tokenManager.getCachedToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate if a key should be encrypted
   */
  shouldEncryptKey(key: string): boolean {
    const sensitivePatterns = [
      'token',
      'auth',
      'password',
      'credential',
      'secret',
      'api_key',
      'apikey',
      'payment',
      'card',
      'bank',
      'pin',
      'cvv',
      'ssn'
    ];

    const lowerKey = key.toLowerCase();
    return sensitivePatterns.some(pattern => lowerKey.includes(pattern));
  }

  /**
   * Clear all security-related data
   */
  async clearSecurityData(): Promise<void> {
    try {
      await secureStorage.removeItem(this.configCacheKey);
      await tokenManager.clearTokens();
      this.config = null;
      info('Security data cleared', undefined, 'SecurityConfig');
    } catch (err) {
      logError('Failed to clear security data', err, 'SecurityConfig');
    }
  }

  /**
   * Validate if biometric authentication is available and enabled
   */
  async isBiometricAuthEnabled(): Promise<boolean> {
    const config = await this.loadConfig();
    return config.enableBiometricAuth;
  }

  /**
   * Get session configuration
   */
  async getSessionConfig() {
    const config = await this.loadConfig();
    return {
      timeout: config.sessionTimeout,
      maxAttempts: config.maxLoginAttempts,
      tokenRefreshBuffer: config.tokenRefreshBuffer
    };
  }

  /**
   * Validate API response for security issues
   */
  validateResponse(response: Response): boolean {
    // Check for security headers
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];

    for (const header of securityHeaders) {
      if (!response.headers.get(header)) {
        warn(`Missing security header: ${header}`, undefined, 'SecurityConfig');
      }
    }

    // Validate response status
    if (response.status === 401) {
      warn('Unauthorized response received', undefined, 'SecurityConfig');
      tokenManager.clearTokens();
      return false;
    }

    return true;
  }
}

// Export singleton instance
const securityConfig = SecurityConfigService.getInstance();

// Export convenience functions
export const loadSecurityConfig = (forceRefresh?: boolean) =>
  securityConfig.loadConfig(forceRefresh);

export const getSecurityConfig = <K extends keyof SecurityConfig>(key: K) =>
  securityConfig.getConfig(key);

export const getPaymentConfig = (provider: 'stripe' | 'sumup' | 'square') =>
  securityConfig.getPaymentConfig(provider);

export const getSecureHeaders = (includeAuth?: boolean) =>
  securityConfig.getSecureHeaders(includeAuth);

export const clearSecurityData = () =>
  securityConfig.clearSecurityData();

export const isBiometricAuthEnabled = () =>
  securityConfig.isBiometricAuthEnabled();

export const getSessionConfig = () =>
  securityConfig.getSessionConfig();

export const validateResponse = (response: Response) =>
  securityConfig.validateResponse(response);

export default securityConfig;