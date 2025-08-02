/**
 * SquareService - Comprehensive service for Square payment operations
 * Handles Square-specific functionality including card payments, contactless payments,
 * OAuth token management, and integration with Square's In-App Payments SDK
 * Positioned as secondary payment method to SumUp
 */

import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { _PaymentRequest, _PaymentResult } from './PaymentService';

// Square SDK imports - conditionally loaded to prevent crashes
let SQIPCore: unknown;
let SQIPCardEntry: unknown;
let SQIPApplePay: unknown;
let SQIPGooglePay: unknown;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SquareSDK = require('react-native-square-in-app-payments');
  SQIPCore = SquareSDK.SQIPCore;
  SQIPCardEntry = SquareSDK.SQIPCardEntry;
  SQIPApplePay = SquareSDK.SQIPApplePay;
  SQIPGooglePay = SquareSDK.SQIPGooglePay;
} catch (_error) {
  logger.warn(
    'Square SDK not available. Square payments will be disabled. Please install dependencies with: npm install && cd ios && pod install'
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
  private initialized: boolean = false;
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
  async initialize(config: SquareConfig): Promise<void> {
    try {
      this.config = config;

      // Initialize Square SDK if available
      if (SQIPCore) {
        await SQIPCore.setSquareApplicationId(config.applicationId);
      } else {
        throw new Error(this.getSDKUnavailableMessage());
      }

      this.initialized = true;
      await this.saveConfig(config);
      logger.info('Square service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Square service:', error);
      throw error;
    }
  }

  /**
   * Process card payment using Square SDK
   */
  async processCardPayment(
    amount: number,
    currency: string = 'GBP',
    description?: string
  ): Promise<SquareCardPayment> {
    try {
      if (!this.initialized || !this.config) {
        throw new Error('Square service not initialized');
      }

      const paymentId = this.generatePaymentId();

      // Check if SDK is available
      if (!SQIPCardEntry) {
        return {
          id: paymentId,
          amount,
          currency,
          status: 'failed',
          errorMessage: this.getSDKUnavailableMessage(),
        };
      }

      // Start Square card entry flow
      const cardEntryResult = await SQIPCardEntry.startCardEntryFlow({
        collectPostalCode: false,
        skipCardHolderNameEntry: true,
      });

      if (cardEntryResult.canceled) {
        return {
          id: paymentId,
          amount,
          currency,
          status: 'cancelled',
          errorMessage: 'Payment cancelled by user',
        };
      }

      if (cardEntryResult.nonce) {
        // Process payment with the nonce
        const paymentResult = await this.processPaymentWithNonce(
          cardEntryResult.nonce,
          amount,
          currency
        );

        if (paymentResult.success) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'completed',
            nonce: cardEntryResult.nonce,
            cardBrand: cardEntryResult.card?.brand,
            lastFourDigits: cardEntryResult.card?.lastFourDigits,
          };
        }
      }

      return {
        id: paymentId,
        amount,
        currency,
        status: 'failed',
        errorMessage: 'Square SDK not available - placeholder implementation',
      };
    } catch (error) {
      logger.error('Square card payment failed:', error);
      return {
        id: this.generatePaymentId(),
        amount,
        currency,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Card payment failed',
      };
    }
  }

  /**
   * Process contactless payment (Apple Pay / Google Pay)
   */
  async processContactlessPayment(
    amount: number,
    currency: string = 'GBP',
    paymentMethod: 'apple_pay' | 'google_pay',
    description?: string
  ): Promise<SquareContactlessPayment> {
    try {
      if (!this.initialized || !this.config) {
        throw new Error('Square service not initialized');
      }

      const paymentId = this.generatePaymentId();

      // Check device support
      const deviceSupported = await this.isContactlessSupported(paymentMethod);
      if (!deviceSupported) {
        return {
          id: paymentId,
          amount,
          currency,
          status: 'failed',
          paymentMethod,
          deviceSupported: false,
          errorMessage: `${paymentMethod} not supported on this device`,
        };
      }

      // Implement contactless payment flows
      let nonce: string | null = null;

      if (paymentMethod === 'apple_pay') {
        if (!SQIPApplePay) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'failed',
            paymentMethod,
            deviceSupported: false,
            errorMessage: this.getSDKUnavailableMessage(),
          };
        }
        await SQIPApplePay.initializeApplePay(this.config.applicationId);
        const applePayResult = await SQIPApplePay.requestApplePayNonce({
          price: amount.toString(),
          summaryLabel: description || 'Fynlo POS Payment',
          countryCode: 'GB',
          currencyCode: currency,
        });

        if (applePayResult.nonce) {
          nonce = applePayResult.nonce;
        } else if (applePayResult.canceled) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'cancelled',
            paymentMethod,
            deviceSupported,
            errorMessage: 'Payment cancelled by user',
          };
        }
      } else if (paymentMethod === 'google_pay') {
        if (!SQIPGooglePay) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'failed',
            paymentMethod,
            deviceSupported: false,
            errorMessage: this.getSDKUnavailableMessage(),
          };
        }
        await SQIPGooglePay.initializeGooglePay(this.config.applicationId, this.config.locationId);
        const googlePayResult = await SQIPGooglePay.requestGooglePayNonce({
          price: amount.toString(),
          currencyCode: currency,
          priceStatus: 'FINAL',
        });

        if (googlePayResult.nonce) {
          nonce = googlePayResult.nonce;
        } else if (googlePayResult.canceled) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'cancelled',
            paymentMethod,
            deviceSupported,
            errorMessage: 'Payment cancelled by user',
          };
        }
      }

      // Process payment with obtained nonce
      if (nonce) {
        const paymentResult = await this.processPaymentWithNonce(nonce, amount, currency);

        if (paymentResult.success) {
          return {
            id: paymentId,
            amount,
            currency,
            status: 'completed',
            paymentMethod,
            deviceSupported,
          };
        }
      }
      return {
        id: paymentId,
        amount,
        currency,
        status: 'failed',
        paymentMethod,
        deviceSupported,
        errorMessage: 'Square SDK not available - placeholder implementation',
      };
    } catch (error) {
      logger.error('Square contactless payment failed:', error);
      return {
        id: this.generatePaymentId(),
        amount,
        currency,
        status: 'failed',
        paymentMethod,
        deviceSupported: false,
        errorMessage: error instanceof Error ? error.message : 'Contactless payment failed',
      };
    }
  }

  /**
   * Process payment using Square API (after obtaining nonce)
   */
  async processPaymentWithNonce(
    nonce: string,
    amount: number,
    currency: string = 'GBP',
    locationId?: string
  ): Promise<SquarePaymentResult> {
    try {
      if (!this.config) {
        throw new Error('Square service not initialized');
      }

      const requestBody = {
        source_id: nonce,
        amount_money: {
          amount: Math.round(amount * 100), // Convert to smallest currency unit
          currency,
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
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || 'Payment processing failed');
      }

      const data = await response.json();

      return {
        success: true,
        transactionId: data.payment.id,
        nonce,
      };
    } catch (error) {
      logger.error('Square payment processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  /**
   * Calculate Square processing fees
   */
  calculateFee(
    amount: number,
    paymentType: 'in_person' | 'online' | 'manual',
    isUKCard: boolean = true
  ): number {
    const amountDecimal = amount;

    switch (paymentType) {
      case 'in_person':
        return amountDecimal * this.feeStructure.inPersonRate;

      case 'online':
        if (isUKCard) {
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
    amount: number,
    monthlyVolume: number
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
      totalCost: squareCost,
      effectiveRate,
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
    } catch (error) {
      logger.error('Failed to check contactless support:', error);
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
    } catch (error) {
      logger.error('Failed to validate Square credentials:', error);
      return false;
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    paymentId: string,
    amount: number,
    currency: string = 'GBP',
    reason?: string
  ): Promise<SquarePaymentResult> {
    try {
      if (!this.config) {
        throw new Error('Square service not initialized');
      }

      const requestBody = {
        idempotency_key: this.generateIdempotencyKey(),
        payment_id: paymentId,
        amount_money: {
          amount: Math.round(amount * 100),
          currency,
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
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || 'Refund processing failed');
      }

      const data = await response.json();

      return {
        success: true,
        transactionId: data.refund.id,
      };
    } catch (error) {
      logger.error('Square refund processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund processing failed',
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentId: string): Promise<unknown> {
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
    } catch (error) {
      logger.error('Failed to get Square payment details:', error);
      throw error;
    }
  }

  /**
   * Check if Square SDK is available
   */
  private isSDKAvailable(): boolean {
    try {
      return typeof SQIPCore !== 'undefined' && SQIPCore !== null;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get platform-specific error message for SDK unavailability
   */
  private getSDKUnavailableMessage(): string {
    const isSimulator = Platform.OS === 'ios' && __DEV__;
    const baseMessage = 'Square SDK not available.';

    if (isSimulator) {
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
  private async saveConfig(config: SquareConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('square_config', JSON.stringify(config));
    } catch (error) {
      logger.error('Failed to save Square config:', error);
      throw error;
    }
  }

  /**
   * Load Square configuration
   */
  async loadConfig(): Promise<SquareConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('square_config');
      if (configString) {
        const config = JSON.parse(configString);
        this.config = config;
        return config;
      }
      return null;
    } catch (error) {
      logger.error('Failed to load Square config:', error);
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
    } catch (error) {
      logger.error('Failed to clear Square config:', error);
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
