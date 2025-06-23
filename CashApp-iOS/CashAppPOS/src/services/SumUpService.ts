/**
 * SumUpService - Dedicated service for SumUp payment operations
 * Handles SumUp-specific functionality including checkout creation, payment processing,
 * fee calculations, and integration with SumUp's developer API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaymentRequest, PaymentResult } from './PaymentService';

export interface SumUpConfig {
  apiKey: string;
  merchantCode: string;
  affiliateKey: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
}

export interface SumUpCheckout {
  checkoutId: string;
  checkoutUrl: string;
  checkoutReference: string;
  amount: number;
  currency: string;
  status: 'created' | 'pending' | 'completed' | 'failed' | 'cancelled';
  expiresAt: string;
}

export interface SumUpFeeStructure {
  standardRate: number; // 1.69%
  highVolumeRate: number; // 0.69%
  monthlyFee: number; // £19
  volumeThreshold: number; // £2,714
  currency: string;
}

class SumUpServiceClass {
  private static instance: SumUpServiceClass;
  private config: SumUpConfig | null = null;
  private feeStructure: SumUpFeeStructure = {
    standardRate: 0.0169, // 1.69%
    highVolumeRate: 0.0069, // 0.69%
    monthlyFee: 19, // £19
    volumeThreshold: 2714, // £2,714
    currency: 'GBP',
  };

  private constructor() {}

  static getInstance(): SumUpServiceClass {
    if (!SumUpServiceClass.instance) {
      SumUpServiceClass.instance = new SumUpServiceClass();
    }
    return SumUpServiceClass.instance;
  }

  /**
   * Initialize SumUp service with configuration
   */
  async initialize(config: SumUpConfig): Promise<void> {
    this.config = config;
    await this.saveConfig(config);
  }

  /**
   * Create SumUp checkout for payment processing
   */
  async createCheckout(
    amount: number,
    currency: string = 'GBP',
    description?: string,
    returnUrl?: string
  ): Promise<SumUpCheckout> {
    try {
      if (!this.config) {
        throw new Error('SumUp service not initialized');
      }

      const checkoutData = {
        checkout_reference: this.generateCheckoutReference(),
        amount: amount,
        currency: currency,
        merchant_code: this.config.merchantCode,
        description: description || 'Fynlo POS Payment',
        return_url: returnUrl,
      };

      const response = await fetch(`${this.config.baseUrl}/v0.1/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create SumUp checkout');
      }

      const data = await response.json();
      
      return {
        checkoutId: data.id,
        checkoutUrl: data.checkout_url,
        checkoutReference: checkoutData.checkout_reference,
        amount: data.amount,
        currency: data.currency,
        status: 'created',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      };
    } catch (error) {
      console.error('Failed to create SumUp checkout:', error);
      throw error;
    }
  }

  /**
   * Process SumUp payment
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // For SumUp, we typically create a checkout and redirect
      const checkout = await this.createCheckout(
        request.amount,
        request.currency,
        request.description
      );

      // This would typically open the SumUp checkout URL
      // For now, we'll simulate a successful payment
      const fee = this.calculateFee(request.amount);

      return {
        success: true,
        transactionId: checkout.checkoutId,
        provider: 'sumup',
        amount: request.amount,
        fee: fee,
      };
    } catch (error) {
      console.error('SumUp payment processing failed:', error);
      return {
        success: false,
        provider: 'sumup',
        amount: request.amount,
        fee: 0,
        error: error instanceof Error ? error.message : 'SumUp payment failed',
      };
    }
  }

  /**
   * Calculate SumUp processing fee
   */
  calculateFee(amount: number, monthlyVolume?: number): number {
    const amountDecimal = amount;
    const volumeDecimal = monthlyVolume || 0;

    // Check if merchant qualifies for high volume rate
    if (volumeDecimal >= this.feeStructure.volumeThreshold) {
      const transactionFee = amountDecimal * this.feeStructure.highVolumeRate;
      // Add proportional monthly fee
      const monthlyFeePerTransaction = volumeDecimal > 0 
        ? this.feeStructure.monthlyFee / (volumeDecimal / amountDecimal)
        : 0;
      return transactionFee + monthlyFeePerTransaction;
    } else {
      // Standard rate for low volume
      return amountDecimal * this.feeStructure.standardRate;
    }
  }

  /**
   * Get SumUp fee structure information
   */
  getFeeStructure(): SumUpFeeStructure {
    return { ...this.feeStructure };
  }

  /**
   * Calculate monthly cost projection
   */
  calculateMonthlyCost(monthlyVolume: number): {
    totalCost: number;
    effectiveRate: number;
    structure: 'standard' | 'high_volume';
    savings?: number;
  } {
    const volume = monthlyVolume;
    
    if (volume >= this.feeStructure.volumeThreshold) {
      // High volume pricing
      const transactionFees = volume * this.feeStructure.highVolumeRate;
      const totalCost = transactionFees + this.feeStructure.monthlyFee;
      const effectiveRate = totalCost / volume;
      
      // Calculate savings vs standard rate
      const standardCost = volume * this.feeStructure.standardRate;
      const savings = standardCost - totalCost;
      
      return {
        totalCost,
        effectiveRate,
        structure: 'high_volume',
        savings,
      };
    } else {
      // Standard pricing
      const totalCost = volume * this.feeStructure.standardRate;
      const effectiveRate = this.feeStructure.standardRate;
      
      return {
        totalCost,
        effectiveRate,
        structure: 'standard',
      };
    }
  }

  /**
   * Check if SumUp is the optimal provider for given volume
   */
  isOptimalForVolume(monthlyVolume: number, compareRates: { [provider: string]: number }): boolean {
    const sumupCost = this.calculateMonthlyCost(monthlyVolume);
    const sumupRate = sumupCost.effectiveRate;
    
    // Compare with other providers
    const lowestCompetitorRate = Math.min(...Object.values(compareRates));
    
    return sumupRate <= lowestCompetitorRate;
  }

  /**
   * Get SumUp merchant dashboard URL
   */
  getMerchantDashboardUrl(): string {
    if (this.config?.environment === 'production') {
      return 'https://me.sumup.com/';
    } else {
      return 'https://me.sumup.com/developers';
    }
  }

  /**
   * Get SumUp integration status
   */
  async getIntegrationStatus(): Promise<{
    isConfigured: boolean;
    hasApiKeys: boolean;
    environment: string;
    merchantCode?: string;
  }> {
    const config = await this.loadConfig();
    
    return {
      isConfigured: !!config,
      hasApiKeys: !!(config?.apiKey && config?.merchantCode),
      environment: config?.environment || 'not_set',
      merchantCode: config?.merchantCode,
    };
  }

  /**
   * Validate SumUp API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }

      // Make a test API call to validate credentials
      const response = await fetch(`${this.config.baseUrl}/v0.1/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to validate SumUp credentials:', error);
      return false;
    }
  }

  /**
   * Generate unique checkout reference
   */
  private generateCheckoutReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `FYNLO_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Save SumUp configuration
   */
  private async saveConfig(config: SumUpConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('sumup_config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save SumUp config:', error);
      throw error;
    }
  }

  /**
   * Load SumUp configuration
   */
  async loadConfig(): Promise<SumUpConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('sumup_config');
      if (configString) {
        const config = JSON.parse(configString);
        this.config = config;
        return config;
      }
      return null;
    } catch (error) {
      console.error('Failed to load SumUp config:', error);
      return null;
    }
  }

  /**
   * Clear SumUp configuration
   */
  async clearConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem('sumup_config');
      this.config = null;
    } catch (error) {
      console.error('Failed to clear SumUp config:', error);
      throw error;
    }
  }
}

export const SumUpService = SumUpServiceClass.getInstance();
export default SumUpService;