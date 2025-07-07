/**
 * Secure Payment Orchestrator Service
 * 
 * Handles payment processing through the secure backend API
 * Coordinates between UI, payment config, and backend services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import SecurePaymentConfig from './SecurePaymentConfig';
import { Alert } from 'react-native';

export interface PaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: 'card' | 'cash' | 'qr_code' | 'apple_pay' | 'google_pay';
  paymentDetails: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  provider?: string;
  amount?: number;
  fees?: {
    percentageFee: number;
    fixedFee: number;
    totalFee: number;
    ratePercentage: number;
  };
  netAmount?: number;
  status?: string;
  completedAt?: string;
  error?: string;
  errorCode?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: string;
  provider?: string;
  amount: number;
  currency: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

class SecurePaymentOrchestratorService {
  private static instance: SecurePaymentOrchestratorService;
  private processingPayment = false;
  private currentPaymentId: string | null = null;

  private constructor() {}

  static getInstance(): SecurePaymentOrchestratorService {
    if (!SecurePaymentOrchestratorService.instance) {
      SecurePaymentOrchestratorService.instance = new SecurePaymentOrchestratorService();
    }
    return SecurePaymentOrchestratorService.instance;
  }

  /**
   * Process a payment through the secure backend
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (this.processingPayment) {
      return {
        success: false,
        error: 'Another payment is already being processed',
        errorCode: 'PAYMENT_IN_PROGRESS'
      };
    }

    this.processingPayment = true;
    this.currentPaymentId = null;

    try {
      // Validate payment method availability
      const isAvailable = await SecurePaymentConfig.isMethodAvailable(request.paymentMethod);
      if (!isAvailable) {
        return {
          success: false,
          error: 'Payment method not available',
          errorCode: 'METHOD_UNAVAILABLE'
        };
      }

      // Validate amount
      const amountValidation = SecurePaymentConfig.validateAmount(request.amount, request.paymentMethod);
      if (!amountValidation.valid) {
        return {
          success: false,
          error: amountValidation.error,
          errorCode: 'INVALID_AMOUNT'
        };
      }

      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        return {
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED'
        };
      }

      // Prepare request body
      const requestBody = {
        order_id: request.orderId,
        amount: request.amount,
        payment_method: request.paymentMethod,
        payment_details: this.sanitizePaymentDetails(request.paymentDetails),
        metadata: request.metadata
      };

      // Process payment through backend
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/payments/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 429) {
          return {
            success: false,
            error: 'Too many payment attempts. Please wait a moment.',
            errorCode: 'RATE_LIMITED'
          };
        }

        if (response.status === 403) {
          return {
            success: false,
            error: 'Insufficient permissions',
            errorCode: 'PERMISSION_DENIED'
          };
        }

        return {
          success: false,
          error: result.message || 'Payment processing failed',
          errorCode: result.error_code || 'PAYMENT_FAILED'
        };
      }

      // Extract payment result
      const paymentData = result.data || result;
      this.currentPaymentId = paymentData.payment_id;

      return {
        success: true,
        paymentId: paymentData.payment_id,
        transactionId: paymentData.transaction_id,
        provider: paymentData.provider,
        amount: paymentData.amount,
        fees: paymentData.fees,
        netAmount: paymentData.net_amount,
        status: paymentData.status,
        completedAt: paymentData.completed_at
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      
      if (error instanceof TypeError && error.message.includes('Network')) {
        return {
          success: false,
          error: 'Network error. Please check your connection.',
          errorCode: 'NETWORK_ERROR'
        };
      }

      return {
        success: false,
        error: 'Payment processing failed. Please try again.',
        errorCode: 'UNEXPECTED_ERROR'
      };
    } finally {
      this.processingPayment = false;
    }
  }

  /**
   * Process a refund through the secure backend
   */
  async processRefund(request: RefundRequest): Promise<PaymentResult> {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        return {
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED'
        };
      }

      // Prepare request body
      const requestBody = {
        transaction_id: request.transactionId,
        amount: request.amount,
        reason: request.reason
      };

      // Process refund through backend
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          return {
            success: false,
            error: 'Only managers and above can process refunds',
            errorCode: 'PERMISSION_DENIED'
          };
        }

        return {
          success: false,
          error: result.message || 'Refund processing failed',
          errorCode: result.error_code || 'REFUND_FAILED'
        };
      }

      const refundData = result.data || result;

      return {
        success: true,
        paymentId: refundData.refund_id,
        status: refundData.status
      };

    } catch (error) {
      console.error('Refund processing error:', error);
      
      return {
        success: false,
        error: 'Refund processing failed. Please try again.',
        errorCode: 'UNEXPECTED_ERROR'
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Get payment status
      const response = await fetch(`${API_CONFIG.FULL_API_URL}/payments/status/${paymentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get payment status: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;

      return {
        paymentId: data.payment_id,
        status: data.status,
        provider: data.provider,
        amount: data.amount,
        currency: data.currency,
        createdAt: data.created_at,
        completedAt: data.completed_at,
        errorMessage: data.error_message
      };

    } catch (error) {
      console.error('Error getting payment status:', error);
      return null;
    }
  }

  /**
   * Format payment error for display
   */
  formatPaymentError(error: string, errorCode?: string): string {
    // Map common error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'PAYMENT_IN_PROGRESS': 'Another payment is already being processed',
      'METHOD_UNAVAILABLE': 'This payment method is not available',
      'INVALID_AMOUNT': error, // Use the specific validation error
      'AUTH_REQUIRED': 'Please log in to process payments',
      'RATE_LIMITED': 'Too many payment attempts. Please wait a moment.',
      'PERMISSION_DENIED': 'You do not have permission to process payments',
      'NETWORK_ERROR': 'Network error. Please check your connection.',
      'CARD_DECLINED': 'Card was declined. Please try another card.',
      'INSUFFICIENT_FUNDS': 'Insufficient funds',
      'EXPIRED_CARD': 'Card has expired',
      'INVALID_CARD': 'Invalid card details',
      'PROCESSING_ERROR': 'Payment processing error. Please try again.',
    };

    return errorMessages[errorCode || ''] || error || 'Payment failed. Please try again.';
  }

  /**
   * Calculate and display fees before payment
   */
  calculateFeesForDisplay(amount: number, paymentMethod: string): {
    fees: ReturnType<typeof SecurePaymentConfig.calculateFees>;
    feeDisplay: string;
    totalWithFees: number;
  } {
    const fees = SecurePaymentConfig.calculateFees(amount, paymentMethod);
    const feeDisplay = SecurePaymentConfig.formatFeeDisplay(paymentMethod);
    const totalWithFees = amount; // Fees are typically added on top for the merchant

    return {
      fees,
      feeDisplay,
      totalWithFees
    };
  }

  /**
   * Show payment confirmation dialog
   */
  async showPaymentConfirmation(
    amount: number,
    paymentMethod: string,
    onConfirm: () => void,
    onCancel: () => void
  ): Promise<void> {
    const { fees, feeDisplay, totalWithFees } = this.calculateFeesForDisplay(amount, paymentMethod);
    
    const message = fees.totalFee > 0 
      ? `Amount: £${amount.toFixed(2)}\nPayment Method: ${this.formatPaymentMethod(paymentMethod)}\nProcessing Fee: ${feeDisplay}\nYou will receive: £${fees.netAmount.toFixed(2)}`
      : `Amount: £${amount.toFixed(2)}\nPayment Method: ${this.formatPaymentMethod(paymentMethod)}\nNo processing fees`;

    Alert.alert(
      'Confirm Payment',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel
        },
        {
          text: 'Confirm',
          style: 'default',
          onPress: onConfirm
        }
      ]
    );
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    const methodNames: Record<string, string> = {
      'card': 'Credit/Debit Card',
      'cash': 'Cash',
      'qr_code': 'QR Code',
      'apple_pay': 'Apple Pay',
      'google_pay': 'Google Pay'
    };

    return methodNames[method] || method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Sanitize payment details to remove sensitive information
   */
  private sanitizePaymentDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Remove sensitive fields that should never be sent to backend
    const sensitiveFields = [
      'card_number',
      'cvv',
      'cvc',
      'pin',
      'full_card_number',
      'security_code'
    ];

    sensitiveFields.forEach(field => {
      delete sanitized[field];
    });

    // Mask card numbers if present
    if (sanitized.masked_card_number && sanitized.masked_card_number.length > 4) {
      sanitized.masked_card_number = `****${sanitized.masked_card_number.slice(-4)}`;
    }

    return sanitized;
  }

  /**
   * Check if currently processing a payment
   */
  isProcessing(): boolean {
    return this.processingPayment;
  }

  /**
   * Get current payment ID if processing
   */
  getCurrentPaymentId(): string | null {
    return this.currentPaymentId;
  }

  /**
   * Cancel current payment (if possible)
   */
  async cancelCurrentPayment(): Promise<boolean> {
    // In most cases, payments cannot be cancelled once submitted
    // This is mainly for UI state management
    if (this.processingPayment && this.currentPaymentId) {
      // Could potentially implement payment cancellation here
      // For now, just reset the state
      this.processingPayment = false;
      this.currentPaymentId = null;
      return true;
    }
    return false;
  }
}

export default SecurePaymentOrchestratorService.getInstance();