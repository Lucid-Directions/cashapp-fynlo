/**
 * usePaymentMethods - React hook for managing payment methods and processing
 * 
 * This hook provides a clean interface to the PaymentOrchestrator service,
 * managing state and providing convenient methods for React components.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import PaymentOrchestrator from '../services/PaymentOrchestrator';
import type {
  PaymentMethod,
  PaymentMethodType,
  PaymentResult,
  PaymentState,
  CustomerInfo,
} from '../types/payment';
import { logger } from '../utils/logger';

interface UsePaymentMethodsReturn {
  // Available payment methods
  availableMethods: PaymentMethod[];
  
  // Current payment state
  paymentState: PaymentState;
  isProcessing: boolean;
  
  // Selected method
  selectedMethod: PaymentMethodType | null;
  setSelectedMethod: (method: PaymentMethodType | null) => void;
  
  // Payment processing
  processPayment: (
    amount: number,
    currency?: string,
    reference?: string,
    customerInfo?: CustomerInfo
  ) => Promise<PaymentResult>;
  
  // Cancel current payment
  cancelPayment: () => Promise<void>;
  
  // Refresh available methods
  refreshMethods: () => Promise<void>;
  
  // Check if a specific method is available
  isMethodAvailable: (method: PaymentMethodType) => boolean;
  
  // Get recommended payment method
  getRecommendedMethod: () => PaymentMethodType | null;
}

export function usePaymentMethods(): UsePaymentMethodsReturn {
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  
  // Refs to maintain callbacks
  const stateUnsubscribe = useRef<(() => void) | null>(null);
  const methodsUnsubscribe = useRef<(() => void) | null>(null);

  // Subscribe to payment state changes (doesn't depend on any state)
  useEffect(() => {
    stateUnsubscribe.current = PaymentOrchestrator.onStateChange((state) => {
      logger.info('💳 Payment state changed:', state);
      setPaymentState(state);
      setIsProcessing(
        state === 'initializing' || 
        state === 'processing' || 
        state === 'confirming'
      );
    });

    return () => {
      if (stateUnsubscribe.current) {
        stateUnsubscribe.current();
      }
    };
  }, []);

  // Subscribe to method availability changes (depends on selectedMethod)
  useEffect(() => {
    methodsUnsubscribe.current = PaymentOrchestrator.onMethodsChange((methods) => {
      logger.info('📱 Available payment methods updated:', methods.map(m => m.id));
      setAvailableMethods(methods);
      
      // Auto-select first available method if none selected
      if (!selectedMethod && methods.length > 0) {
        const recommended = getRecommendedMethodInternal(methods);
        if (recommended) {
          setSelectedMethod(recommended);
        }
      }
    });

    return () => {
      if (methodsUnsubscribe.current) {
        methodsUnsubscribe.current();
      }
    };
  }, [selectedMethod]);

  // Initial refresh on mount
  useEffect(() => {
    PaymentOrchestrator.refreshAvailability();
  }, []);

  /**
   * Process payment with selected method
   */
  const processPayment = useCallback(async (
    amount: number,
    currency: string = 'GBP',
    reference?: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult> => {
    if (!selectedMethod) {
      Alert.alert(
        'No Payment Method',
        'Please select a payment method first',
        [{ text: 'OK' }]
      );
      return {
        success: false,
        method: 'cash',
        amount,
        currency,
        timestamp: new Date(),
        error: {
          code: 'NO_METHOD_SELECTED',
          message: 'No payment method selected',
          recoverable: true,
        },
      };
    }

    if (isProcessing) {
      logger.warn('⚠️ Payment already in progress');
      return {
        success: false,
        method: selectedMethod,
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

    try {
      logger.info(`💳 Processing ${selectedMethod} payment for ${currency} ${amount}`);
      setIsProcessing(true);
      
      const result = await PaymentOrchestrator.startPayment(
        selectedMethod,
        amount,
        currency,
        reference,
        customerInfo
      );
      
      if (result.success) {
        logger.info('✅ Payment successful:', result.transactionId);
      } else {
        logger.error('❌ Payment failed:', result.error);
        
        // Show user-friendly error
        if (result.error?.recoverable) {
          Alert.alert(
            'Payment Failed',
            result.error.message,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => processPayment(amount, currency, reference, customerInfo) },
            ]
          );
        } else {
          Alert.alert(
            'Payment Failed',
            result.error?.message || 'Unable to process payment',
            [{ text: 'OK' }]
          );
        }
      }
      
      return result;
    } catch (error) {
      logger.error('❌ Payment processing error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      Alert.alert('Payment Error', errorMessage, [{ text: 'OK' }]);
      
      return {
        success: false,
        method: selectedMethod,
        amount,
        currency,
        timestamp: new Date(),
        error: {
          code: 'PROCESSING_ERROR',
          message: errorMessage,
          recoverable: true,
        },
      };
    } finally {
      setIsProcessing(false);
    }
  }, [selectedMethod, isProcessing]);

  /**
   * Cancel current payment
   */
  const cancelPayment = useCallback(async () => {
    logger.info('🚫 Cancelling payment');
    await PaymentOrchestrator.cancelPayment();
    setIsProcessing(false);
    setPaymentState('cancelled');
  }, []);

  /**
   * Refresh available payment methods
   */
  const refreshMethods = useCallback(async () => {
    logger.info('🔄 Refreshing payment methods');
    await PaymentOrchestrator.refreshAvailability();
  }, []);

  /**
   * Check if a specific method is available
   */
  const isMethodAvailable = useCallback((method: PaymentMethodType): boolean => {
    return PaymentOrchestrator.isMethodAvailable(method);
  }, []);

  /**
   * Get recommended payment method based on priority
   */
  const getRecommendedMethodInternal = (methods: PaymentMethod[]): PaymentMethodType | null => {
    // Priority order: Tap to Pay > Apple Pay > Card > QR > Cash
    const priorityOrder: PaymentMethodType[] = ['sumup', 'apple_pay', 'qr_code', 'cash'];
    
    for (const methodId of priorityOrder) {
      const method = methods.find(m => m.id === methodId);
      if (method && method.available) {
        return method.id;
      }
    }
    
    // Return first available if none in priority list
    return methods.length > 0 ? methods[0].id : null;
  };

  const getRecommendedMethod = useCallback((): PaymentMethodType | null => {
    return getRecommendedMethodInternal(availableMethods);
  }, [availableMethods]);

  return {
    availableMethods,
    paymentState,
    isProcessing,
    selectedMethod,
    setSelectedMethod,
    processPayment,
    cancelPayment,
    refreshMethods,
    isMethodAvailable,
    getRecommendedMethod,
  };
}

export default usePaymentMethods;