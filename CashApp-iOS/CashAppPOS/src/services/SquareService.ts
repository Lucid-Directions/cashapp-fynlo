/**
 * SquareService - Comprehensive service for Square payment operations
 * Handles Square-specific functionality including card payments, contactless payments,
 * OAuth token management, and integration with Square's In-App Payments SDK
 * Positioned as secondary payment method to SumUp
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Square SDK imports - conditionally loaded to prevent crashes
let SQIPCore: unknown;
let SQIPCardEntry: unknown;
let SQIPApplePay: unknown;
let SQIPGooglePay: unknown;

try {
// eslint-disable-next-line @typescript-eslint/no-var-requires
  const SquareSDK = require('react-native-square-in-app-payments');
  SQIPCore = SquareSDK.SQIPCore;
  SQIPCardEntry = SquareSDK.SQIPCardEntry;
  SQIPApplePay = SquareSDK.SQIPApplePay;
  SQIPGooglePay = SquareSDK.SQIPGooglePay;
} catch (__error) {
    'Square SDK not available. Square payments will be disabled. Please install dependencies with: npm install && cd ios && pod install',
  );
}

export interface SquareConfig {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
  accessToken?: string;
  baseUrl: string;
}

export interface SquarePaymentResult {
  success: boolean;
  nonce?: string;
  transactionId?: string;
  error?: string;
  paymentMethod?: 'card' | 'apple_pay' | 'google_pay';
}

export interface SquareCardPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  nonce?: string;
  cardBrand?: string;
  lastFourDigits?: string;
  errorMessage?: string;
}

export interface SquareContactlessPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'apple_pay' | 'google_pay';
  deviceSupported: boolean;
  errorMessage?: string;
}

export interface SquareFeeStructure {
  inPersonRate: number; // 1.75%
  onlineRateUK: number; // 1.4%
  onlineFixedFeeUK: number; // 25p
  onlineRateNonUK: number; // 2.5%
  onlineFixedFeeNonUK: number; // 25p
  manualKeyedRate: number; // 2.5%
  currency: string;
}

class SquareServiceClass {
  private static instance: SquareServiceClass;
  private config: SquareConfig | null = null;
  private initialized = false;
  private feeStructure: SquareFeeStructure = {
    inPersonRate: 0.0175, // 1.75%
    onlineRateUK: 0.014, // 1.4%
    onlineFixedFeeUK: 0.25, // 25p
    onlineRateNonUK: 0.025, // 2.5%
    onlineFixedFeeNonUK: 0.25, // 25p
    manualKeyedRate: 0.025, // 2.5%
    currency: 'GBP',
  };

  private constructor() {}

  static getInstance(): SquareServiceClass {
    if (!SquareServiceClass.instance) {
      SquareServiceClass.instance = new SquareServiceClass();
    }
    return SquareServiceClass.instance;
  }

  /**
   * Initialize Square service with configuration
   */
  async initialize(config: _SquareConfig): Promise<void> {
    try {
      this.config = config;

      // Initialize Square SDK if available
      if (__SQIPCore) {
        await SQIPCore.setSquareApplicationId(config.applicationId);
      } else {
        throw new Error(this.getSDKUnavailableMessage());
      }

      this.initialized = true;
      await this.saveConfig(__config);
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Process card payment using Square SDK
   */
  async processCardPayment(
    amount: _number,
    currency = 'GBP',
    description?: _string,
  ): Promise<SquareCardPayment> {
    try {
      if (!this.initialized || !this.config) {
        throw new Error('Square service not initialized');
      }

      const paymentId = this.generatePaymentId();

      // Check if SDK is available
      if (!SQIPCardEntry) {
        return {
          id: _paymentId,
          amount: _amount,
          currency: _currency,
          status: 'failed',
          errorMessage: this.getSDKUnavailableMessage(),
        };
      }

      // Start Square card entry flow
      const cardEntryResult = await SQIPCardEntry.startCardEntryFlow({
        collectPostalCode: _false,
        skipCardHolderNameEntry: _true,
      });

      if (cardEntryResult.canceled) {
        return {
          id: _paymentId,
          amount: _amount,
          currency: _currency,
          status: 'cancelled',
          errorMessage: 'Payment cancelled by user',
        };
      }

      if (cardEntryResult.nonce) {
        // Process payment with the nonce
        const paymentResult = await this.processPaymentWithNonce(
          cardEntryResult.nonce,
          amount,
          currency,
        );

        if (paymentResult.success) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'completed',
            nonce: cardEntryResult.nonce,
            cardBrand: cardEntryResult.card?.brand,
            lastFourDigits: cardEntryResult.card?.lastFourDigits,
          };
        }
      }

      return {
        id: _paymentId,
        amount: _amount,
        currency: _currency,
        status: 'failed',
        errorMessage: 'Square SDK not available - placeholder implementation',
      };
    } catch (__error) {
      return {
        id: this.generatePaymentId(),
        amount: _amount,
        currency: _currency,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Card payment failed',
      };
    }
  }

  /**
   * Process contactless payment (Apple Pay / Google Pay)
   */
  async processContactlessPayment(
    amount: _number,
    currency = 'GBP',
    paymentMethod: 'apple_pay' | 'google_pay',
    description?: _string,
  ): Promise<SquareContactlessPayment> {
    try {
      if (!this.initialized || !this.config) {
        throw new Error('Square service not initialized');
      }

      const paymentId = this.generatePaymentId();

      // Check device support
      const deviceSupported = await this.isContactlessSupported(__paymentMethod);
      if (!deviceSupported) {
        return {
          id: _paymentId,
          amount: _amount,
          currency: _currency,
          status: 'failed',
          paymentMethod: _paymentMethod,
          deviceSupported: _false,
          errorMessage: `${paymentMethod} not supported on this device`,
        };
      }

      // Implement contactless payment flows
      let nonce: string | null = null;

      if (paymentMethod === 'apple_pay') {
        if (!SQIPApplePay) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'failed',
            paymentMethod: _paymentMethod,
            deviceSupported: _false,
            errorMessage: this.getSDKUnavailableMessage(),
          };
        }
        await SQIPApplePay.initializeApplePay(this.config.applicationId);
        const applePayResult = await SQIPApplePay.requestApplePayNonce({
          price: amount.toString(),
          summaryLabel: description || 'Fynlo POS Payment',
          countryCode: 'GB',
          currencyCode: _currency,
        });

        if (applePayResult.nonce) {
          nonce = applePayResult.nonce;
        } else if (applePayResult.canceled) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'cancelled',
            paymentMethod: _paymentMethod,
            deviceSupported: _deviceSupported,
            errorMessage: 'Payment cancelled by user',
          };
        }
      } else if (paymentMethod === 'google_pay') {
        if (!SQIPGooglePay) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'failed',
            paymentMethod: _paymentMethod,
            deviceSupported: _false,
            errorMessage: this.getSDKUnavailableMessage(),
          };
        }
        await SQIPGooglePay.initializeGooglePay(this.config.applicationId, this.config.locationId);
        const googlePayResult = await SQIPGooglePay.requestGooglePayNonce({
          price: amount.toString(),
          currencyCode: _currency,
          priceStatus: 'FINAL',
        });

        if (googlePayResult.nonce) {
          nonce = googlePayResult.nonce;
        } else if (googlePayResult.canceled) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'cancelled',
            paymentMethod: _paymentMethod,
            deviceSupported: _deviceSupported,
            errorMessage: 'Payment cancelled by user',
          };
        }
      }

      // Process payment with obtained nonce
      if (__nonce) {
        const paymentResult = await this.processPaymentWithNonce(__nonce, _amount, currency);

        if (paymentResult.success) {
          return {
            id: _paymentId,
            amount: _amount,
            currency: _currency,
            status: 'completed',
            paymentMethod: _paymentMethod,
            deviceSupported: _deviceSupported,
          };
        }
      }
      return {
        id: _paymentId,
        amount: _amount,
        currency: _currency,
        status: 'failed',
        paymentMethod: _paymentMethod,
        deviceSupported: _deviceSupported,
        errorMessage: 'Square SDK not available - placeholder implementation',
      };
    } catch (__error) {
      return {
        id: this.generatePaymentId(),
        amount: _amount,
        currency: _currency,
        status: 'failed',
        paymentMethod: _paymentMethod,
        deviceSupported: _false,
        errorMessage: error instanceof Error ? error.message : 'Contactless payment failed',
      };
    }
  }

  /**
   * Process payment using Square API (after obtaining nonce)
   */
  async processPaymentWithNonce(
    nonce: _string,
    amount: _number,
    currency = 'GBP',
    locationId?: _string,
  ): Promise<SquarePaymentResult> {
    try {
      if (!this.config) {
        throw new Error('Square service not initialized');
      }

      const requestBody = {
        source_id: _nonce,
        amount_money: {
          amount: Math.round(amount * 100), // Convert to smallest currency unit
          currency: _currency,
        },
        location_id: locationId || this.config.locationId,
        idempotency_key: this.generateIdempotencyKey(),
      };

      const response = await fetch(`${this.config.baseUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify(__requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || 'Payment processing failed');
      }

      const data = await response.json();

      return {
        success: _true,
        transactionId: data.payment.id,
        nonce: _nonce,
      };
    } catch (__error) {
      return {
        success: _false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Calculate Square processing fees
   */
  calculateFee(
    amount: _number,
    paymentType: 'in_person' | 'online' | 'manual',
    isUKCard = true,
  ): number {
    const amountDecimal = amount;

    switch (__paymentType) {
      case 'in_person':
        return amountDecimal * this.feeStructure.inPersonRate;

      case 'online':
        if (__isUKCard) {
          return (
            amountDecimal * this.feeStructure.onlineRateUK + this.feeStructure.onlineFixedFeeUK
          );
        } else {
          return (
            amountDecimal * this.feeStructure.onlineRateNonUK +
            this.feeStructure.onlineFixedFeeNonUK
          );
        }

      case 'manual':
        return amountDecimal * this.feeStructure.manualKeyedRate;

      default:
        return amountDecimal * this.feeStructure.inPersonRate;
    }
  }

  /**
   * Get Square fee structure information
   */
  getFeeStructure(): SquareFeeStructure {
    return { ...this.feeStructure };
  }

  /**
   * Calculate cost comparison vs other providers
   */
  calculateCostComparison(
    amount: _number,
    monthlyVolume: _number,
  ): {
    totalCost: number;
    effectiveRate: number;
    comparison: {
      vsSumUp: number;
      vsStripe: number;
    };
  } {
    const squareCost = amount * this.feeStructure.inPersonRate;
    const effectiveRate = this.feeStructure.inPersonRate;

    // Compare with other providers
    const sumUpHighVolumeCost = monthlyVolume >= 2714 ? amount * 0.0069 : amount * 0.0169;
    const stripeCost = amount * 0.014 + 0.25; // Stripe UK rates

    return {
      totalCost: _squareCost,
      effectiveRate: _effectiveRate,
      comparison: {
        vsSumUp: squareCost - sumUpHighVolumeCost,
        vsStripe: squareCost - stripeCost,
      },
    };
  }

  /**
   * Check if contactless payment is supported
   */
  async isContactlessSupported(paymentMethod: 'apple_pay' | 'google_pay'): Promise<boolean> {
    try {
      if (paymentMethod === 'apple_pay' && SQIPApplePay) {
        return await SQIPApplePay.canUseApplePay();
      } else if (paymentMethod === 'google_pay' && SQIPGooglePay) {
        return await SQIPGooglePay.canUseGooglePay();
      }

      return false;
    } catch (__error) {
      return false;
    }
  }

  /**
   * Get Square merchant dashboard URL
   */
  getMerchantDashboardUrl(): string {
    if (this.config?.environment === 'production') {
      return 'https://squareup.com/dashboard';
    } else {
      return 'https://squareup.com/developers';
    }
  }

  /**
   * Get Square integration status
   */
  async getIntegrationStatus(): Promise<{
    isConfigured: boolean;
    hasCredentials: boolean;
    environment: string;
    locationId?: string;
    sdkAvailable: boolean;
  }> {
    const config = await this.loadConfig();

    return {
      isConfigured: !!config,
      hasCredentials: !!(config?.applicationId && config?.accessToken),
      environment: config?.environment || 'not_set',
      locationId: config?.locationId,
      sdkAvailable: this.isSDKAvailable(),
    };
  }

  /**
   * Validate Square credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }

      // Test API call to validate credentials
      const response = await fetch(`${this.config.baseUrl}/v2/locations`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Square-Version': '2023-10-18',
        },
      });

      return response.ok;
    } catch (__error) {
      return false;
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    paymentId: _string,
    amount: _number,
    currency = 'GBP',
    reason?: _string,
  ): Promise<SquarePaymentResult> {
    try {
      if (!this.config) {
        throw new Error('Square service not initialized');
      }

      const requestBody = {
        idempotency_key: this.generateIdempotencyKey(),
        payment_id: _paymentId,
        amount_money: {
          amount: Math.round(amount * 100),
          currency: _currency,
        },
        reason: reason || 'Refund processed via Finlow POS',
      };

      const response = await fetch(`${this.config.baseUrl}/v2/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify(__requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || 'Refund processing failed');
      }

      const data = await response.json();

      return {
        success: _true,
        transactionId: data.refund.id,
      };
    } catch (__error) {
      return {
        success: _false,
        error: error instanceof Error ? error.message : 'Refund processing failed',
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentId: _string): Promise<unknown> {
    try {
      if (!this.config) {
        throw new Error('Square service not initialized');
      }

      const response = await fetch(`${this.config.baseUrl}/v2/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Square-Version': '2023-10-18',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment details');
      }

      const data = await response.json();
      return data.payment;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Check if Square SDK is available
   */
  private isSDKAvailable(): boolean {
    try {
      return typeof SQIPCore !== 'undefined' && SQIPCore !== null;
    } catch (__error) {
      return false;
    }
  }

  /**
   * Get platform-specific error message for SDK unavailability
   */
  private getSDKUnavailableMessage(): string {
    const isSimulator = Platform.OS === 'ios' && __DEV__;
    const baseMessage = 'Square SDK not available.';

    if (__isSimulator) {
      return `${baseMessage} Run: npm install && cd ios && pod install && npm run build:ios`;
    } else {
      return `${baseMessage} Please contact support or reinstall the app.`;
    }
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `SQ_PAY_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Generate idempotency key for Square API
   */
  private generateIdempotencyKey(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${random}`;
  }

  /**
   * Save Square configuration
   */
  private async saveConfig(config: _SquareConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('square_config', JSON.stringify(__config));
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Load Square configuration
   */
  async loadConfig(): Promise<SquareConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('square_config');
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
   * Clear Square configuration
   */
  async clearConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem('square_config');
      this.config = null;
      this.initialized = false;
    } catch (__error) {
      throw error;
    }
  }

  /**
   * Get provider information for display
   */
  getProviderInfo() {
    return {
      name: 'Square',
      feeStructure: {
        inPerson: '1.75%',
        onlineUK: '1.4% + 25p',
        onlineNonUK: '2.5% + 25p',
        manual: '2.5%',
      },
      supportedMethods: ['card', 'contactless', 'apple_pay', 'google_pay'],
      processingTime: 'Instant',
      payoutTime: 'Next business day',
      countries: ['UK', 'US', 'Canada', 'Australia', 'Japan'],
      currencies: ['GBP', 'USD', 'CAD', 'AUD', 'JPY'],
      features: ['PCI Compliance', 'Fraud Protection', 'Chargeback Protection'],
      sdkAvailable: this.isSDKAvailable(),
    };
  }
}

export const SquareService = SquareServiceClass.getInstance();
export default SquareService;
