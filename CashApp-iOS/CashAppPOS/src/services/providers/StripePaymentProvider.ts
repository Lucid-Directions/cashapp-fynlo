import { 
  StripeProvider, 
  initStripe, 
  createPaymentMethod, 
  confirmPayment,
  PaymentMethod,
  PaymentIntent,
} from '@stripe/stripe-react-native';

export interface StripeConfig {
  publishableKey: string;
  merchantId: string;
  urlScheme?: string;
}

export interface StripePaymentResult {
  success: boolean;
  paymentMethod?: PaymentMethod.Result;
  paymentIntent?: PaymentIntent.Result;
  error?: string;
}

class StripePaymentProviderClass {
  private initialized = false;
  private config: StripeConfig | null = null;

  async initialize(config: StripeConfig): Promise<void> {
    try {
      this.config = config;
      
      await initStripe({
        publishableKey: config.publishableKey,
        merchantIdentifier: config.merchantId,
        urlScheme: config.urlScheme || 'fynlo-pos',
      });

      this.initialized = true;
      console.log('Stripe initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      throw error;
    }
  }

  async createPaymentMethod(
    cardDetails: {
      number: string;
      expiryMonth: number;
      expiryYear: number;
      cvc: string;
    }
  ): Promise<StripePaymentResult> {
    try {
      if (!this.initialized) {
        throw new Error('Stripe not initialized');
      }

      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
        card: cardDetails,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentMethod,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment method',
      };
    }
  }

  async confirmPayment(
    clientSecret: string, 
    paymentMethodId: string
  ): Promise<StripePaymentResult> {
    try {
      if (!this.initialized) {
        throw new Error('Stripe not initialized');
      }

      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          paymentMethodId,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentIntent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment confirmation failed',
      };
    }
  }

  /**
   * Calculate Stripe fees (1.4% + 20p)
   */
  calculateFee(amount: number): number {
    const percentage = 0.014; // 1.4%
    const fixed = 0.20; // 20p
    return (amount * percentage) + fixed;
  }

  /**
   * Check if Stripe is available and configured
   */
  isAvailable(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'Stripe',
      feeStructure: '1.4% + 20p',
      supportedMethods: ['card', 'apple_pay', 'google_pay'],
      processingTime: 'Instant',
    };
  }
}

export const StripePaymentProvider = new StripePaymentProviderClass();
export default StripePaymentProvider;