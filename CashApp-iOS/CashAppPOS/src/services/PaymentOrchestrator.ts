import { PaymentRequest, PaymentResult } from './PaymentService';
import SumUpPaymentProvider from './providers/SumUpPaymentProvider';
import SquarePaymentProvider from './providers/SquarePaymentProvider';
import StripePaymentProvider from './providers/StripePaymentProvider';
import QRCodePayment from '../components/payment/QRCodePayment';
import { Alert } from 'react-native';
import { PaymentFeeCalculator } from './PaymentFeeCalculator';
import useSettingsStore from '../store/useSettingsStore';

export interface PaymentProvider {
  id: string;
  name: string;
  priority: number;
  isAvailable: () => Promise<boolean>;
  processPayment: (request: PaymentRequest) => Promise<PaymentResult>;
  calculateFee: (amount: number) => number;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
  feeInfo: string;
  provider: PaymentProvider | null;
  type: 'tap' | 'card' | 'qr' | 'cash' | 'wallet';
}

class PaymentOrchestratorService {
  private static instance: PaymentOrchestratorService;
  private providers: Map<string, PaymentProvider> = new Map();
  private feeCalculator: PaymentFeeCalculator;
  
  private constructor() {
    this.feeCalculator = new PaymentFeeCalculator();
    this.initializeProviders();
  }
  
  static getInstance(): PaymentOrchestratorService {
    if (!PaymentOrchestratorService.instance) {
      PaymentOrchestratorService.instance = new PaymentOrchestratorService();
    }
    return PaymentOrchestratorService.instance;
  }
  
  private initializeProviders() {
    // Primary: SumUp (lowest fees for high volume)
    this.providers.set('sumup', {
      id: 'sumup',
      name: 'SumUp',
      priority: 1,
      isAvailable: async () => {
        try {
          return SumUpPaymentProvider.isAvailable();
        } catch {
          return false;
        }
      },
      processPayment: async (request: PaymentRequest): Promise<PaymentResult> => {
        const result = await SumUpPaymentProvider.processPayment(
          request.amount,
          request.currency || 'GBP',
          request.orderId
        );
        
        // Convert SumUpPaymentResult to PaymentResult
        const fee = SumUpPaymentProvider.calculateFee(
          request.amount,
          useSettingsStore.getState().businessInfo?.monthlyVolume || 0
        );
        
        return {
          success: result.success,
          error: result.error,
          transactionId: result.transactionCode,
          provider: 'sumup',
          amount: request.amount,
          fee: fee
        };
      },
      calculateFee: (amount: number) => {
        const monthlyVolume = useSettingsStore.getState().businessInfo?.monthlyVolume || 0;
        return SumUpPaymentProvider.calculateFee(amount, monthlyVolume);
      }
    });
    
    // Backup 1: Square
    this.providers.set('square', {
      id: 'square',
      name: 'Square',
      priority: 2,
      isAvailable: async () => {
        try {
          return SquarePaymentProvider.isAvailable();
        } catch {
          return false;
        }
      },
      processPayment: async (request: PaymentRequest): Promise<PaymentResult> => {
        const result = await SquarePaymentProvider.presentCardEntry();
        if (result.success && result.nonce) {
          const paymentResult = await SquarePaymentProvider.processPayment(
            result.nonce,
            request.amount,
            request.currency || 'GBP'
          );
          
          const fee = SquarePaymentProvider.calculateFee(request.amount);
          
          return {
            success: paymentResult.success,
            error: paymentResult.error,
            transactionId: result.nonce,
            provider: 'square',
            amount: request.amount,
            fee: fee
          };
        }
        
        return {
          success: false,
          error: result.error || 'Square payment failed',
          provider: 'square',
          amount: request.amount,
          fee: 0
        };
      },
      calculateFee: (amount: number) => {
        return SquarePaymentProvider.calculateFee(amount);
      }
    });
    
    // Backup 2: Stripe
    this.providers.set('stripe', {
      id: 'stripe',
      name: 'Stripe',
      priority: 3,
      isAvailable: async () => {
        try {
          return StripePaymentProvider.isAvailable();
        } catch {
          return false;
        }
      },
      processPayment: async (request: PaymentRequest): Promise<PaymentResult> => {
        // This would need to be integrated with your backend to create payment intent
        // and then confirm it with Stripe
        const fee = StripePaymentProvider.calculateFee(request.amount);
        
        return {
          success: false,
          error: 'Stripe integration requires backend setup',
          provider: 'stripe',
          amount: request.amount,
          fee: fee
        };
      },
      calculateFee: (amount: number) => {
        return StripePaymentProvider.calculateFee(amount);
      }
    });
  }
  
  /**
   * Get available payment methods with dynamic fee calculation
   */
  async getAvailablePaymentMethods(): Promise<PaymentMethodConfig[]> {
    const settings = useSettingsStore.getState();
    const paymentMethods = settings.paymentMethods;
    
    const methods: PaymentMethodConfig[] = [
      {
        id: 'tapToPay',
        name: 'Tap to Pay',
        icon: 'contactless-payment',
        color: '#00D4AA',
        enabled: true,
        requiresAuth: false,
        feeInfo: '0.69% + £19/month',
        provider: this.providers.get('sumup') || null,
        type: 'tap'
      },
      {
        id: 'applePaySumUp',
        name: 'Apple Pay',
        icon: 'apple',
        color: '#000000',
        enabled: true,
        requiresAuth: false,
        feeInfo: '0.69% + £19/month',
        provider: this.providers.get('sumup') || null,
        type: 'wallet'
      },
      {
        id: 'cardEntry',
        name: 'Manual Card',
        icon: 'credit-card',
        color: '#0066CC',
        enabled: true,
        requiresAuth: false,
        feeInfo: '0.69% + £19/month',
        provider: this.providers.get('sumup') || null,
        type: 'card'
      },
      {
        id: 'qrCode',
        name: 'QR Payment',
        icon: 'qr-code-scanner',
        color: '#00A651',
        enabled: paymentMethods?.qrCode?.enabled ?? true,
        requiresAuth: paymentMethods?.qrCode?.requiresAuth ?? false,
        feeInfo: '1.2%',
        provider: null, // QR has its own component
        type: 'qr'
      },
      {
        id: 'cash',
        name: 'Cash',
        icon: 'payments',
        color: '#666666',
        enabled: paymentMethods?.cash?.enabled ?? true,
        requiresAuth: paymentMethods?.cash?.requiresAuth ?? false,
        feeInfo: 'No fees',
        provider: null, // Cash is handled locally
        type: 'cash'
      }
    ];
    
    // Filter enabled methods and check provider availability
    const availableMethods: PaymentMethodConfig[] = [];
    for (const method of methods) {
      if (method.enabled) {
        if (method.provider) {
          const isAvailable = await method.provider.isAvailable();
          if (isAvailable) {
            availableMethods.push(method);
          }
        } else {
          // Methods without providers (QR, Cash) are always available when enabled
          availableMethods.push(method);
        }
      }
    }
    
    return availableMethods;
  }
  
  /**
   * Process payment with automatic fallback
   */
  async processPayment(
    methodId: string,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    console.log(`[PaymentOrchestrator] Processing payment with method: ${methodId}`);
    
    // Handle special cases (QR and Cash)
    if (methodId === 'qrCode' || methodId === 'cash') {
      return {
        success: false,
        error: 'QR and Cash payments should be handled by their respective components',
        provider: methodId,
        amount: request.amount,
        fee: 0
      };
    }
    
    // Map method IDs to provider IDs
    const methodToProvider: { [key: string]: string } = {
      'tapToPay': 'sumup',
      'applePaySumUp': 'sumup',
      'cardEntry': 'sumup',
      'stripe': 'stripe',
      'square': 'square'
    };
    
    const primaryProviderId = methodToProvider[methodId];
    if (!primaryProviderId) {
      return {
        success: false,
        error: `Unknown payment method: ${methodId}`,
        provider: 'unknown',
        amount: request.amount,
        fee: 0
      };
    }
    
    // Try primary provider
    const primaryProvider = this.providers.get(primaryProviderId);
    if (primaryProvider) {
      const isAvailable = await primaryProvider.isAvailable();
      if (isAvailable) {
        console.log(`[PaymentOrchestrator] Attempting payment with ${primaryProvider.name}`);
        const result = await primaryProvider.processPayment(request);
        
        if (result.success) {
          console.log(`[PaymentOrchestrator] Payment successful with ${primaryProvider.name}`);
          return result;
        } else {
          console.log(`[PaymentOrchestrator] Payment failed with ${primaryProvider.name}: ${result.error}`);
        }
      }
    }
    
    // Fallback logic: Try providers in order of priority
    console.log('[PaymentOrchestrator] Primary provider failed, attempting fallbacks...');
    
    const sortedProviders = Array.from(this.providers.values())
      .filter(p => p.id !== primaryProviderId)
      .sort((a, b) => a.priority - b.priority);
    
    for (const provider of sortedProviders) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        console.log(`[PaymentOrchestrator] Attempting fallback with ${provider.name}`);
        
        // Show user that we're falling back
        Alert.alert(
          'Payment Provider Unavailable',
          `${primaryProvider?.name || 'Primary provider'} is not available. Trying ${provider.name}...`,
          [{ text: 'OK' }]
        );
        
        const result = await provider.processPayment(request);
        if (result.success) {
          console.log(`[PaymentOrchestrator] Payment successful with fallback provider ${provider.name}`);
          return result;
        }
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: 'All payment providers are currently unavailable. Please try again later or use an alternative payment method.',
      provider: 'none',
      amount: request.amount,
      fee: 0
    };
  }
  
  /**
   * Calculate fees for a specific payment method
   */
  calculateFees(methodId: string, amount: number): {
    processingFee: number;
    platformFee: number;
    totalFee: number;
    feePercentage: number;
  } {
    const methodToProvider: { [key: string]: string } = {
      'tapToPay': 'sumup',
      'applePaySumUp': 'sumup',
      'cardEntry': 'sumup',
      'stripe': 'stripe',
      'square': 'square',
      'qrCode': 'qr',
      'cash': 'cash'
    };
    
    const providerId = methodToProvider[methodId];
    
    // Get base processing fee
    let processingFee = 0;
    const provider = this.providers.get(providerId);
    if (provider) {
      processingFee = provider.calculateFee(amount);
    } else if (providerId === 'qr') {
      processingFee = amount * 0.012; // 1.2%
    }
    
    // Calculate platform fee
    const platformFee = this.feeCalculator.calculatePlatformFee(amount, methodId);
    
    const totalFee = processingFee + platformFee;
    const feePercentage = amount > 0 ? (totalFee / amount) * 100 : 0;
    
    return {
      processingFee,
      platformFee,
      totalFee,
      feePercentage
    };
  }
  
  /**
   * Initialize all payment providers
   */
  async initialize(): Promise<void> {
    console.log('[PaymentOrchestrator] Initializing payment providers...');
    
    const settings = useSettingsStore.getState();
    const { paymentProviders } = settings;
    
    // Initialize SumUp
    if (paymentProviders?.sumup?.enabled) {
      try {
        await SumUpPaymentProvider.initialize({
          affiliateKey: paymentProviders.sumup.affiliateKey || 'sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU',
          environment: paymentProviders.sumup.environment || 'production'
        });
        console.log('[PaymentOrchestrator] SumUp initialized successfully');
      } catch (error) {
        console.error('[PaymentOrchestrator] Failed to initialize SumUp:', error);
      }
    }
    
    // Initialize Square
    if (paymentProviders?.square?.enabled) {
      try {
        await SquarePaymentProvider.initialize({
          applicationId: paymentProviders.square.applicationId || '',
          locationId: paymentProviders.square.locationId || '',
          environment: paymentProviders.square.environment || 'sandbox'
        });
        console.log('[PaymentOrchestrator] Square initialized successfully');
      } catch (error) {
        console.error('[PaymentOrchestrator] Failed to initialize Square:', error);
      }
    }
    
    // Initialize Stripe
    if (paymentProviders?.stripe?.enabled) {
      try {
        await StripePaymentProvider.initialize({
          publishableKey: paymentProviders.stripe.publishableKey || '',
          merchantId: paymentProviders.stripe.merchantId || '',
          urlScheme: 'fynlo-pos'
        });
        console.log('[PaymentOrchestrator] Stripe initialized successfully');
      } catch (error) {
        console.error('[PaymentOrchestrator] Failed to initialize Stripe:', error);
      }
    }
  }
}

export default PaymentOrchestratorService;