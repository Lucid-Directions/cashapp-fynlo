/**
 * PaymentOrchestrator - Central coordinator for all payment methods
 * 
 * This service manages the lifecycle of payment processing, ensures only one
 * payment is active at a time, and provides a unified interface for all payment methods.
 */

import { Platform } from 'react-native';

import type {
  PaymentMethod,
  PaymentMethodType,
  PaymentResult,
  PaymentError,
  PaymentState,
  PaymentSession,
  PaymentConfig,
  PaymentProvider,
  CustomerInfo,
} from '../types/payment';
import { logger } from '../utils/logger';

// Import payment providers
import ApplePayService from './ApplePayService';
import NativeSumUpService from './NativeSumUpService';
import SumUpCompatibilityService from './SumUpCompatibilityService';

class PaymentOrchestrator {
  private static instance: PaymentOrchestrator;
  
  // Payment state
  private availableMethods: Map<PaymentMethodType, PaymentMethod> = new Map();
  private providers: Map<PaymentMethodType, PaymentProvider> = new Map();
  private currentSession: PaymentSession | null = null;
  private isProcessing: boolean = false;
  
  // Configuration
  private config: PaymentConfig = {
    enabledMethods: ['cash', 'sumup', 'apple_pay', 'qr_code'],
    defaultMethod: 'sumup',
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 1000,
    requireCustomerInfo: false,
    enableTips: true,
    enableSplitPayment: false,
  };

  // Callbacks
  private stateChangeListeners: Set<(state: PaymentState) => void> = new Set();
  private methodChangeListeners: Set<(methods: PaymentMethod[]) => void> = new Set();

  private constructor() {
    logger.info('💳 PaymentOrchestrator initialized');
    this.initializeProviders();
  }

  static getInstance(): PaymentOrchestrator {
    if (!PaymentOrchestrator.instance) {
      PaymentOrchestrator.instance = new PaymentOrchestrator();
    }
    return PaymentOrchestrator.instance;
  }

  /**
   * Initialize all payment providers
   */
  private async initializeProviders() {
    logger.info('🔧 Initializing payment providers');

    // Initialize available payment methods
    this.availableMethods.set('cash', {
      id: 'cash',
      name: 'Cash',
      icon: 'payments',
      color: '#4CAF50',
      enabled: true,
      available: true,
      requiresAuth: false,
      requiresHardware: false,
    });

    // Check SumUp availability
    await this.checkSumUpAvailability();

    // Check Apple Pay availability
    await this.checkApplePayAvailability();

    // QR Code is always available
    this.availableMethods.set('qr_code', {
      id: 'qr_code',
      name: 'QR Code',
      icon: 'qr-code-2',
      color: '#9C27B0',
      enabled: true,
      available: true,
      requiresAuth: false,
      requiresHardware: false,
    });

    this.notifyMethodChange();
  }

  /**
   * Check SumUp availability (native or compatibility)
   */
  private async checkSumUpAvailability() {
    try {
      // First check native module
      const nativeAvailable = NativeSumUpService.isAvailable();
      
      if (nativeAvailable) {
        logger.info('✅ Native SumUp module available');
        this.availableMethods.set('sumup', {
          id: 'sumup',
          name: 'Card (Tap to Pay)',
          icon: 'tap-and-play',
          color: '#00B3E6',
          enabled: true,
          available: true,
          requiresAuth: true,
          requiresHardware: false,
          processingFee: 1.69,
        });
        return;
      }

      // Fallback to compatibility check
      const compatibilityService = SumUpCompatibilityService.getInstance();
      const compatible = await compatibilityService.shouldAttemptSumUp();
      
      if (compatible) {
        logger.info('✅ SumUp compatibility check passed (fallback UI needed)');
        // Mark as available but note that it requires special handling
        this.availableMethods.set('sumup', {
          id: 'sumup',
          name: 'Card Payment',
          icon: 'credit-card',
          color: '#00B3E6',
          enabled: true,
          available: false, // Set to false since orchestrator can't handle it directly
          requiresAuth: true,
          requiresHardware: true,
          processingFee: 1.69,
        });
        
        // Store compatibility flag for UI to check
        (this.availableMethods.get('sumup') as any).requiresFallbackUI = true;
      } else {
        logger.warn('⚠️ SumUp not available on this device');
      }
    } catch (error) {
      logger.error('❌ Failed to check SumUp availability:', error);
    }
  }

  /**
   * Check Apple Pay availability
   */
  private async checkApplePayAvailability() {
    try {
      if (Platform.OS !== 'ios') {
        logger.info('⚠️ Apple Pay not available on non-iOS platform');
        return;
      }

      const available = await ApplePayService.canMakePayments();
      
      if (available) {
        logger.info('✅ Apple Pay available');
        this.availableMethods.set('apple_pay', {
          id: 'apple_pay',
          name: 'Apple Pay',
          icon: 'phone-iphone',
          color: '#000000',
          enabled: true,
          available: true,
          requiresAuth: false,
          requiresHardware: false,
          processingFee: 2.9,
        });
      } else {
        logger.warn('⚠️ Apple Pay not available on this device');
      }
    } catch (error) {
      logger.error('❌ Failed to check Apple Pay availability:', error);
    }
  }

  /**
   * Get all available payment methods
   */
  getAvailableMethods(): PaymentMethod[] {
    return Array.from(this.availableMethods.values()).filter(method => 
      method.available && this.config.enabledMethods.includes(method.id)
    );
  }

  /**
   * Get a specific payment method
   */
  getMethod(methodId: PaymentMethodType): PaymentMethod | null {
    return this.availableMethods.get(methodId) || null;
  }

  /**
   * Check if a payment method is available
   */
  isMethodAvailable(methodId: PaymentMethodType): boolean {
    const method = this.availableMethods.get(methodId);
    return method ? method.available && method.enabled : false;
  }

  /**
   * Get current payment session
   */
  getCurrentSession(): PaymentSession | null {
    return this.currentSession;
  }

  /**
   * Check if payment is in progress
   */
  isPaymentInProgress(): boolean {
    return this.isProcessing;
  }

  /**
   * Start a payment session
   */
  async startPayment(
    method: PaymentMethodType,
    amount: number,
    currency: string = 'GBP',
    reference?: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult> {
    // Check if payment is already in progress
    if (this.isProcessing) {
      logger.warn('⚠️ Payment already in progress');
      return {
        success: false,
        method,
        amount,
        currency,
        timestamp: new Date(),
        error: {
          code: 'PAYMENT_IN_PROGRESS',
          message: 'Another payment is already being processed',
          recoverable: false,
        },
      };
    }

    // Check if method is available
    if (!this.isMethodAvailable(method)) {
      logger.error(`❌ Payment method ${method} not available`);
      return {
        success: false,
        method,
        amount,
        currency,
        timestamp: new Date(),
        error: {
          code: 'METHOD_NOT_AVAILABLE',
          message: `Payment method ${method} is not available`,
          recoverable: false,
        },
      };
    }

    // Create payment session
    this.currentSession = {
      id: `PAY-${Date.now()}`,
      state: 'initializing',
      method,
      amount,
      currency,
      startedAt: new Date(),
      attempts: 0,
    };

    this.isProcessing = true;
    this.notifyStateChange('initializing');

    try {
      logger.info(`💳 Starting ${method} payment for ${currency} ${amount}`);
      
      // Process payment based on method
      let result: PaymentResult;
      
      switch (method) {
        case 'cash':
          result = await this.processCashPayment(amount, currency, reference);
          break;
          
        case 'sumup':
          result = await this.processSumUpPayment(amount, currency, reference, customerInfo);
          break;
          
        case 'apple_pay':
          result = await this.processApplePayPayment(amount, currency, reference, customerInfo);
          break;
          
        case 'qr_code':
          result = await this.processQRPayment(amount, currency, reference, customerInfo);
          break;
          
        default:
          throw new Error(`Unsupported payment method: ${method}`);
      }

      // Update session
      this.currentSession.state = result.success ? 'completed' : 'failed';
      this.currentSession.completedAt = new Date();
      if (result.error) {
        this.currentSession.lastError = result.error;
      }

      this.notifyStateChange(this.currentSession.state);
      
      return result;
    } catch (error) {
      logger.error(`❌ Payment failed:`, error);
      
      const paymentError: PaymentError = {
        code: 'PAYMENT_FAILED',
        message: error instanceof Error ? error.message : 'Payment processing failed',
        recoverable: true,
      };

      if (this.currentSession) {
        this.currentSession.state = 'failed';
        this.currentSession.lastError = paymentError;
        this.currentSession.completedAt = new Date();
      }

      this.notifyStateChange('failed');

      return {
        success: false,
        method,
        amount,
        currency,
        timestamp: new Date(),
        error: paymentError,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel current payment
   */
  async cancelPayment(): Promise<void> {
    if (!this.currentSession || !this.isProcessing) {
      logger.warn('⚠️ No active payment to cancel');
      return;
    }

    logger.info('🚫 Cancelling payment');
    
    this.currentSession.state = 'cancelled';
    this.currentSession.completedAt = new Date();
    this.isProcessing = false;
    
    this.notifyStateChange('cancelled');
  }

  /**
   * Process cash payment
   */
  private async processCashPayment(
    amount: number,
    currency: string,
    reference?: string
  ): Promise<PaymentResult> {
    this.notifyStateChange('processing');
    
    // Cash payment is instant
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      method: 'cash',
      transactionId: `CASH-${Date.now()}`,
      amount,
      currency,
      timestamp: new Date(),
      metadata: {
        reference,
        paymentType: 'cash',
      },
    };
  }

  /**
   * Process SumUp payment
   */
  private async processSumUpPayment(
    amount: number,
    currency: string,
    reference?: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult> {
    this.notifyStateChange('processing');
    
    try {
      // Use native service if available
      if (NativeSumUpService.isAvailable()) {
        const result = await NativeSumUpService.performCheckout(
          amount,
          currency,
          reference || `Order-${Date.now()}`,
          true // Use Tap to Pay
        );
        
        return {
          success: result.success,
          method: 'sumup',
          transactionId: result.transactionCode,
          amount,
          currency,
          timestamp: new Date(),
          error: result.error ? {
            code: 'SUMUP_ERROR',
            message: result.error,
            recoverable: true,
          } : undefined,
          metadata: result.transactionInfo,
        };
      }
      
      // Fallback to compatibility service (sumup-react-native-alpha)
      // This would require the SumUpPaymentComponent to be rendered
      // For now, return an error indicating manual UI is needed
      logger.warn('⚠️ Native SumUp not available, fallback UI required');
      
      return {
        success: false,
        method: 'sumup',
        amount,
        currency,
        timestamp: new Date(),
        error: {
          code: 'SUMUP_FALLBACK_REQUIRED',
          message: 'Please use the SumUp payment screen for this transaction',
          recoverable: true,
          suggestedAction: 'Use alternative payment UI',
        },
        metadata: {
          requiresFallbackUI: true,
        },
      };
    } catch (error) {
      logger.error('❌ SumUp payment error:', error);
      throw error;
    }
  }

  /**
   * Process Apple Pay payment
   */
  private async processApplePayPayment(
    amount: number,
    currency: string,
    reference?: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult> {
    this.notifyStateChange('processing');
    
    try {
      const result = await ApplePayService.processPayment(amount, currency);
      
      return {
        success: result.success,
        method: 'apple_pay',
        transactionId: result.transactionId,
        amount,
        currency,
        timestamp: new Date(),
        error: result.error ? {
          code: 'APPLE_PAY_ERROR',
          message: result.error,
          recoverable: true,
        } : undefined,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process QR Code payment
   */
  private async processQRPayment(
    amount: number,
    currency: string,
    reference?: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult> {
    this.notifyStateChange('processing');
    
    // QR payment would generate a code and wait for confirmation
    // This is a placeholder implementation
    return {
      success: true,
      method: 'qr_code',
      transactionId: `QR-${Date.now()}`,
      amount,
      currency,
      timestamp: new Date(),
      metadata: {
        reference,
        qrCode: `fynlo://pay/${amount}/${currency}/${Date.now()}`,
      },
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: PaymentState) => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => this.stateChangeListeners.delete(callback);
  }

  /**
   * Subscribe to method availability changes
   */
  onMethodsChange(callback: (methods: PaymentMethod[]) => void): () => void {
    this.methodChangeListeners.add(callback);
    // Send current methods immediately
    callback(this.getAvailableMethods());
    return () => this.methodChangeListeners.delete(callback);
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(state: PaymentState) {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Notify method change listeners
   */
  private notifyMethodChange() {
    const methods = this.getAvailableMethods();
    this.methodChangeListeners.forEach(listener => {
      try {
        listener(methods);
      } catch (error) {
        logger.error('Error in method change listener:', error);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PaymentConfig>) {
    this.config = { ...this.config, ...config };
    this.notifyMethodChange();
  }

  /**
   * Refresh payment methods availability
   */
  async refreshAvailability() {
    logger.info('🔄 Refreshing payment methods availability');
    await this.initializeProviders();
  }
}

export default PaymentOrchestrator.getInstance();
export { PaymentOrchestrator };