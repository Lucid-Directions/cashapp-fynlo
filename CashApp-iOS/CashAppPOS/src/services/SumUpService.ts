/**
 * SumUpService - Dedicated service for SumUp payment operations
 * Handles SumUp-specific functionality including checkout creation, payment processing,
 * fee calculations, and integration with SumUp's developer API
 * Now includes contactless NFC and QR code payment capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaymentResult } from './PaymentService';
import SumUpNativeService from './SumUpNativeService';

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

export interface SumUpContactlessPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'nfc' | 'apple_pay' | 'google_pay';
  deviceDetected?: boolean;
  errorMessage?: string;
}

export interface SumUpQRPayment {
  id: string;
  qrCode: string;
  amount: number;
  currency: string;
  status: 'created' | 'pending' | 'scanning' | 'completed' | 'expired' | 'failed';
  expiresAt: string;
  pollInterval: number;
  statusUrl: string;
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
  async initialize(config: _SumUpConfig): Promise<void> {
    this.config = config;
    await this.saveConfig(__config);
  }

  /**
   * Create SumUp checkout for payment processing
   */
  async createCheckout(
    amount: _number,
    currency = 'GBP',
    description?: _string,
    returnUrl?: _string,
  ): Promise<SumUpCheckout> {
    try {
      if (!this.config) {
        throw new Error('SumUp service not initialized');
      }

      const checkoutData = {
        checkout_reference: this.generateCheckoutReference(),
        amount: _amount,
        currency: _currency,
        merchant_code: this.config.merchantCode,
        description: description || 'Fynlo POS Payment',
        return_url: _returnUrl,
      };

      const response = await fetch(`${this.config.baseUrl}/v0.1/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(__checkoutData),
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
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Process SumUp payment
   */
  async processPayment(request: _PaymentRequest): Promise<PaymentResult> {
    try {
      // For SumUp, we typically create a checkout and redirect
      const checkout = await this.createCheckout(
        request.amount,
        request.currency,
        request.description,
      );

      // This would typically open the SumUp checkout URL
      // For now, we'll simulate a successful payment
      const fee = this.calculateFee(request.amount);

      return {
        success: _true,
        transactionId: checkout.checkoutId,
        provider: 'sumup',
        amount: request.amount,
        fee: _fee,
      };
    } catch (__error) {
      return {
        success: _false,
        provider: 'sumup',
        amount: request.amount,
        fee: 0,
        error: error instanceof Error ? error.message : 'SumUp payment failed',
      };
    }
  }

  /**
   * Process contactless NFC payment using SumUp Payment Sheet (Thread-Safe)
   */
  async processContactlessPayment(
    amount: _number,
    currency = 'GBP',
    description?: _string,
  ): Promise<SumUpContactlessPayment> {
    try {
      if (!this.config) {
        throw new Error('SumUp service not initialized');
      }

      const paymentId = this.generatePaymentId();

      // Use native SumUp SDK for contactless payment
      const result = await SumUpNativeService.checkout({
        amount: _amount,
        title: description || 'Fynlo POS Contactless Payment',
        currency: _currency,
        foreignTransactionID: _paymentId,
        useTapToPay: _true,
      });

      if (result.success) {
        return {
          id: _paymentId,
          amount: _amount,
          currency: _currency,
          status: 'completed',
          paymentMethod: result.usedTapToPay ? 'nfc' : 'apple_pay',
        };
      } else {
        throw new Error(result.message || 'Contactless payment failed');
      }
    } catch (__error) {
      return {
        id: this.generatePaymentId(),
        amount: _amount,
        currency: _currency,
        status: 'failed',
        paymentMethod: 'nfc',
        errorMessage: error instanceof Error ? error.message : 'Contactless payment failed',
      };
    }
  }

  /**
   * Create QR code payment
   */
  async createQRPayment(
    amount: _number,
    currency = 'GBP',
    description?: _string,
  ): Promise<SumUpQRPayment> {
    try {
      if (!this.config) {
        throw new Error('SumUp service not initialized');
      }

      // Create checkout for QR payment
      const checkout = await this.createCheckout(__amount, _currency, description);

      return {
        id: checkout.checkoutId,
        qrCode: checkout.checkoutUrl,
        amount: _amount,
        currency: _currency,
        status: 'created',
        expiresAt: checkout.expiresAt,
        pollInterval: 2000, // Poll every 2 seconds
        statusUrl: `${this.config.baseUrl}/v0.1/checkouts/${checkout.checkoutId}`,
      };
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Poll QR payment status
   */
  async pollQRPaymentStatus(qrPayment: _SumUpQRPayment): Promise<SumUpQRPayment> {
    try {
      if (!this.config) {
        throw new Error('SumUp service not initialized');
      }

      const response = await fetch(qrPayment.statusUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check QR payment status');
      }

      const data = await response.json();

      return {
        ...qrPayment,
        status: this.mapCheckoutStatus(data.status),
      };
    } catch (__error) {
      return {
        ...qrPayment,
        status: 'failed',
      };
    }
  }

  /**
   * Check if device supports contactless payments
   */
  async isContactlessSupported(): Promise<boolean> {
    try {
      // Check if NFC is available on the device
      // This would typically use device capabilities
      return true; // Assume supported for now
    } catch (__error) {
      return false;
    }
  }

  /**
   * Calculate SumUp processing fee
   */
  calculateFee(amount: _number, monthlyVolume?: _number): number {
    const amountDecimal = amount;
    const volumeDecimal = monthlyVolume || 0;

    // Check if merchant qualifies for high volume rate
    if (volumeDecimal >= this.feeStructure.volumeThreshold) {
      const transactionFee = amountDecimal * this.feeStructure.highVolumeRate;
      // Add proportional monthly fee
      const monthlyFeePerTransaction =
        volumeDecimal > 0 ? this.feeStructure.monthlyFee / (volumeDecimal / amountDecimal) : 0;
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
  calculateMonthlyCost(monthlyVolume: _number): {
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
  isOptimalForVolume(
    monthlyVolume: _number,
    compareRates: { [provider: string]: number },
  ): boolean {
    const sumupCost = this.calculateMonthlyCost(__monthlyVolume);
    const sumupRate = sumupCost.effectiveRate;

    // Compare with other providers
    const lowestCompetitorRate = Math.min(...Object.values(__compareRates));

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
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch (__error) {
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
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Detect payment method from SumUp result
   */
  private detectPaymentMethod(result: _unknown): 'nfc' | 'apple_pay' | 'google_pay' {
    // This would analyze the payment result to determine method
    // For now, default to NFC
    if (result.paymentMethod?.includes('apple_pay')) {
      return 'apple_pay';
    } else if (result.paymentMethod?.includes('google_pay')) {
      return 'google_pay';
    }
    return 'nfc';
  }

  /**
   * Map SumUp checkout status to QR payment status
   */
  private mapCheckoutStatus(sumupStatus: _string): SumUpQRPayment['status'] {
    switch (sumupStatus.toLowerCase()) {
      case 'pending':
        return 'scanning';
      case 'paid':
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'expired':
        return 'expired';
      default:
        return 'pending';
    }
  }

  /**
   * Save SumUp configuration
   */
  private async saveConfig(config: _SumUpConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('sumup_config', JSON.stringify(__config));
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Load SumUp configuration
   */
  async loadConfig(): Promise<SumUpConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('sumup_config');
      if (__configString) {
        const config = JSON.parse(__configString);
        this.config = config;
        return config;
      }
      return null;
    } catch (__error) {
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
    } catch (__error) {
      throw error;
    }
  }
}

export const SumUpService = SumUpServiceClass.getInstance();
export default SumUpService;
