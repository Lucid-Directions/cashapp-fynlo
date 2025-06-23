import { StripeProvider } from '@stripe/stripe-react-native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  provider: string;
  amount: number;
  fee: number;
  error?: string;
}

export interface QRPaymentData {
  qrPaymentId: string;
  qrCodeData: string;
  qrCodeSVG: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  expiresAt: string;
  status: string;
}

export interface PaymentProviderConfig {
  stripe: {
    publishableKey: string;
    merchantId: string;
  };
  square: {
    applicationId: string;
    locationId: string;
  };
  sumup: {
    affiliateKey: string;
  };
  backend: {
    baseUrl: string;
    apiKey: string;
  };
}

class PaymentServiceClass {
  private config: PaymentProviderConfig | null = null;
  private stripeInitialized = false;

  async initialize(config: PaymentProviderConfig): Promise<void> {
    this.config = config;
    
    // Initialize Stripe
    try {
      if (config.stripe.publishableKey) {
        // Note: Stripe initialization would typically happen at app level
        // This is just marking that we have the keys
        this.stripeInitialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  /**
   * Get available payment methods prioritized with SumUp first
   */
  async getAvailablePaymentMethods(): Promise<Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    enabled: boolean;
    requiresAuth: boolean;
    feeInfo: string;
    isRecommended?: boolean;
  }>> {
    return [
      {
        id: 'sumup',
        name: 'SumUp',
        icon: 'credit-card',
        color: '#00D4AA',
        enabled: true,
        requiresAuth: true,
        feeInfo: '0.69% (High volume) • 1.69% (Standard)',
        isRecommended: true,
      },
      {
        id: 'qr_code',
        name: 'QR Code',
        icon: 'qr-code-scanner',
        color: '#0066CC',
        enabled: true,
        requiresAuth: false,
        feeInfo: '1.2%',
      },
      {
        id: 'cash',
        name: 'Cash',
        icon: 'money',
        color: '#00A651',
        enabled: true,
        requiresAuth: false,
        feeInfo: 'No processing fee',
      },
      {
        id: 'stripe',
        name: 'Card (Stripe)',
        icon: 'credit-card',
        color: '#635BFF',
        enabled: true,
        requiresAuth: true,
        feeInfo: '1.4% + 20p',
      },
      {
        id: 'square',
        name: 'Square',
        icon: 'crop-square',
        color: '#3E4348',
        enabled: true,
        requiresAuth: true,
        feeInfo: '1.75%',
      },
    ];
  }

  /**
   * Get optimal payment provider based on transaction amount and volume
   */
  async getOptimalProvider(amount: number): Promise<string> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/optimal-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.provider;
    } catch (error) {
      console.error('Failed to get optimal provider:', error);
      // Fallback to SumUp as primary, then QR code
      return 'sumup';
    }
  }

  /**
   * Process payment using the backend multi-provider system
   */
  async processPayment(request: PaymentRequest, paymentMethodId?: string): Promise<PaymentResult> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
        body: JSON.stringify({
          ...request,
          payment_method_id: paymentMethodId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.transaction_id,
        provider: data.provider,
        amount: data.amount,
        fee: data.fee,
      };
    } catch (error) {
      console.error('Payment processing failed:', error);
      return {
        success: false,
        provider: 'unknown',
        amount: request.amount,
        fee: 0,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Generate QR code payment
   */
  async generateQRPayment(request: PaymentRequest): Promise<QRPaymentData> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/qr/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
        body: JSON.stringify({
          order_id: request.orderId,
          amount: request.amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        qrPaymentId: data.qr_payment_id,
        qrCodeData: data.qr_code_data,
        qrCodeSVG: data.qr_code_image,
        amount: data.amount,
        feeAmount: data.fee_amount,
        netAmount: data.net_amount,
        expiresAt: data.expires_at,
        status: data.status,
      };
    } catch (error) {
      console.error('QR payment generation failed:', error);
      throw error;
    }
  }

  /**
   * Check QR payment status
   */
  async checkQRPaymentStatus(qrPaymentId: string): Promise<{ status: string; expired: boolean }> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/qr/${qrPaymentId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        status: data.data.status,
        expired: data.data.expired,
      };
    } catch (error) {
      console.error('QR payment status check failed:', error);
      throw error;
    }
  }

  /**
   * Confirm QR payment
   */
  async confirmQRPayment(qrPaymentId: string): Promise<PaymentResult> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/qr/${qrPaymentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.data.payment_id,
        provider: 'qr_code',
        amount: 0, // Will be filled from QR payment data
        fee: 0,
      };
    } catch (error) {
      console.error('QR payment confirmation failed:', error);
      return {
        success: false,
        provider: 'qr_code',
        amount: 0,
        fee: 0,
        error: error instanceof Error ? error.message : 'QR payment confirmation failed',
      };
    }
  }

  /**
   * Process cash payment
   */
  async processCashPayment(request: PaymentRequest, receivedAmount: number): Promise<PaymentResult> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const changeAmount = receivedAmount - request.amount;
      if (changeAmount < 0) {
        throw new Error('Insufficient cash received');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
        body: JSON.stringify({
          order_id: request.orderId,
          amount: request.amount,
          received_amount: receivedAmount,
          change_amount: changeAmount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.payment_id,
        provider: 'cash',
        amount: data.amount,
        fee: data.fee_amount,
      };
    } catch (error) {
      console.error('Cash payment processing failed:', error);
      return {
        success: false,
        provider: 'cash',
        amount: request.amount,
        fee: 0,
        error: error instanceof Error ? error.message : 'Cash payment failed',
      };
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(transactionId: string, amount?: number): Promise<PaymentResult> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/refund/${transactionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
        body: JSON.stringify({
          amount: amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.refund_id,
        provider: data.provider,
        amount: data.amount,
        fee: data.fee,
      };
    } catch (error) {
      console.error('Refund processing failed:', error);
      return {
        success: false,
        provider: 'unknown',
        amount: amount || 0,
        fee: 0,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(startDate: string, endDate: string): Promise<any> {
    try {
      if (!this.config) {
        throw new Error('PaymentService not initialized');
      }

      const response = await fetch(`${this.config.backend.baseUrl}/api/v1/payments/analytics?start_date=${startDate}&end_date=${endDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.backend.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get payment analytics:', error);
      throw error;
    }
  }

  /**
   * Store payment configuration
   */
  async saveConfig(config: PaymentProviderConfig): Promise<void> {
    try {
      await AsyncStorage.setItem('payment_config', JSON.stringify(config));
      this.config = config;
    } catch (error) {
      console.error('Failed to save payment config:', error);
      throw error;
    }
  }

  /**
   * Load payment configuration
   */
  async loadConfig(): Promise<PaymentProviderConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('payment_config');
      if (configString) {
        const config = JSON.parse(configString);
        await this.initialize(config);
        return config;
      }
      return null;
    } catch (error) {
      console.error('Failed to load payment config:', error);
      return null;
    }
  }
}

export const PaymentService = new PaymentServiceClass();
export default PaymentService;