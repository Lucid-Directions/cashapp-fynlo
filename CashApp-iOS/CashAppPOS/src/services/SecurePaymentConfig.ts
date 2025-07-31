/**
 * Secure Payment Configuration Service
 *
 * Handles loading payment configuration from backend without exposing sensitive data
 * All credentials remain server-side, only public keys are sent to frontend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_CONFIG } from '../config/api';
import tokenManager from '../utils/tokenManager';

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
}

export interface FeeStructure {
  percentage: number;
  fixed: number;
  description: string;
}

export interface PaymentConfig {
  availableMethods: PaymentMethod[];
  fees: Record<string, FeeStructure>;
  publishableKeys?: Record<string, string>; // Only public keys, never secret keys
  primaryProvider?: string;
}

class SecurePaymentConfigService {
  private static instance: SecurePaymentConfigService;
  private config: PaymentConfig | null = null;
  private configCacheKey = '@payment_config_cache';
  private configCacheExpiry = 3600000; // 1 hour cache
  private loading = false;
  private loadingPromise: Promise<PaymentConfig> | null = null;

  private constructor() {}

  static getInstance(): SecurePaymentConfigService {
    if (!SecurePaymentConfigService.instance) {
      SecurePaymentConfigService.instance = new SecurePaymentConfigService();
    }
    return SecurePaymentConfigService.instance;
  }

  /**
   * Load payment configuration from backend
   * Uses caching to minimize API calls
   */
  async loadConfiguration(forceRefresh: boolean = false): Promise<PaymentConfig> {
    // Return existing promise if already loading
    if (this.loading && this.loadingPromise) {
      return this.loadingPromise;
    }

    // Return cached config if valid and not forcing refresh
    if (!forceRefresh && this.config) {
      return this.config;
    }

    // Check cache
    if (!forceRefresh) {
      const cached = await this.getCachedConfig();
      if (cached) {
        this.config = cached;
        return cached;
      }
    }

    // Start loading
    this.loading = true;
    this.loadingPromise = this.fetchConfiguration();

    try {
      const config = await this.loadingPromise;
      this.config = config;
      await this.cacheConfig(config);
      return config;
    } finally {
      this.loading = false;
      this.loadingPromise = null;
    }
  }

  /**
   * Fetch configuration from backend
   */
  private async fetchConfiguration(): Promise<PaymentConfig> {
    try {
      // Get auth token
      const token = await tokenManager.getTokenWithRefresh();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch payment methods and fees
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/payments/methods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load payment config: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;

      // Validate response structure
      if (!data.methods || !data.fees) {
        throw new Error('Invalid payment configuration response');
      }

      // Transform to internal format
      const config: PaymentConfig = {
        availableMethods: data.methods,
        fees: data.fees,
        publishableKeys: data.publishableKeys || {},
        primaryProvider: data.primaryProvider,
      };

      return config;
    } catch (error) {
      logger.error('Failed to fetch payment configuration:', error);

      // Return minimal config on error
      return {
        availableMethods: [
          {
            id: 'cash',
            name: 'Cash',
            icon: 'cash',
            enabled: true,
            minAmount: 0.01,
            maxAmount: 10000,
          },
        ],
        fees: {
          cash: {
            percentage: 0,
            fixed: 0,
            description: 'No fees',
          },
        },
      };
    }
  }

  /**
   * Get cached configuration
   */
  private async getCachedConfig(): Promise<PaymentConfig | null> {
    try {
      const cached = await AsyncStorage.getItem(this.configCacheKey);
      if (!cached) {
        return null;
      }

      const { config, timestamp } = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() - timestamp > this.configCacheExpiry) {
        await AsyncStorage.removeItem(this.configCacheKey);
        return null;
      }

      return config;
    } catch (error) {
      logger.error('Error reading cached config:', error);
      return null;
    }
  }

  /**
   * Cache configuration
   */
  private async cacheConfig(config: PaymentConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.configCacheKey,
        JSON.stringify({
          config,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      logger.error('Error caching config:', error);
    }
  }

  /**
   * Get publishable key for a provider
   * Only returns public keys, never secret keys
   */
  getPublishableKey(provider: string): string | null {
    if (!this.config || !this.config.publishableKeys) {
      return null;
    }
    return this.config.publishableKeys[provider] || null;
  }

  /**
   * Get available payment methods
   */
  getAvailableMethods(): PaymentMethod[] {
    return this.config?.availableMethods || [];
  }

  /**
   * Get fee structure for a payment method
   */
  getFeeStructure(method: string): FeeStructure | null {
    if (!this.config || !this.config.fees) {
      return null;
    }
    return this.config.fees[method] || null;
  }

  /**
   * Calculate fees for an amount and payment method
   */
  calculateFees(
    amount: number,
    method: string
  ): {
    percentageFee: number;
    fixedFee: number;
    totalFee: number;
    netAmount: number;
  } {
    const feeStructure = this.getFeeStructure(method);

    if (!feeStructure) {
      return {
        percentageFee: 0,
        fixedFee: 0,
        totalFee: 0,
        netAmount: amount,
      };
    }

    const percentageFee = amount * (feeStructure.percentage / 100);
    const fixedFee = feeStructure.fixed;
    const totalFee = percentageFee + fixedFee;
    const netAmount = amount - totalFee;

    // Round to 2 decimal places
    return {
      percentageFee: Math.round(percentageFee * 100) / 100,
      fixedFee: Math.round(fixedFee * 100) / 100,
      totalFee: Math.round(totalFee * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    };
  }

  /**
   * Format fee display for UI
   */
  formatFeeDisplay(method: string): string {
    const feeStructure = this.getFeeStructure(method);

    if (!feeStructure) {
      return 'Fee unavailable';
    }

    if (feeStructure.percentage === 0 && feeStructure.fixed === 0) {
      return 'No fees';
    }

    return (
      feeStructure.description ||
      `${feeStructure.percentage}%${
        feeStructure.fixed > 0 ? ` + £${feeStructure.fixed.toFixed(2)}` : ''
      }`
    );
  }

  /**
   * Clear cached configuration
   */
  async clearCache(): Promise<void> {
    this.config = null;
    await AsyncStorage.removeItem(this.configCacheKey);
  }

  /**
   * Check if a payment method is available
   */
  isMethodAvailable(methodId: string): boolean {
    const methods = this.getAvailableMethods();
    return methods.some((m) => m.id === methodId && m.enabled);
  }

  /**
   * Get primary payment provider
   */
  getPrimaryProvider(): string | null {
    return this.config?.primaryProvider || null;
  }

  /**
   * Validate payment amount for method
   */
  validateAmount(
    amount: number,
    method: string
  ): {
    valid: boolean;
    error?: string;
  } {
    const methods = this.getAvailableMethods();
    const methodConfig = methods.find((m) => m.id === method);

    if (!methodConfig) {
      return { valid: false, error: 'Payment method not available' };
    }

    if (amount < methodConfig.minAmount) {
      return {
        valid: false,
        error: `Minimum amount is £${methodConfig.minAmount.toFixed(2)}`,
      };
    }

    if (amount > methodConfig.maxAmount) {
      return {
        valid: false,
        error: `Maximum amount is £${methodConfig.maxAmount.toFixed(2)}`,
      };
    }

    return { valid: true };
  }
}

export default SecurePaymentConfigService.getInstance();
