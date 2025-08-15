import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Design System
import { useTheme } from '../../design-system/ThemeProvider';
import type { Theme } from '../../design-system/theme';

// Components
import PaymentStatusOverlay, { PaymentStatus } from '../../components/payment/PaymentStatusOverlay';
import NativeSumUpPayment from '../../components/payment/NativeSumUpPayment';
import QRCodePayment from '../../components/payment/QRCodePayment';
import SumUpDiagnostics from '../../components/diagnostics/SumUpDiagnostics';

// Services
import PaymentService from '../../services/PaymentService';
import OrderService from '../../services/OrderService';
import NativeSumUpService from '../../services/NativeSumUpService';
import { logger } from '../../utils/logger';

// Stores
import useAppStore from '../../store/useAppStore';
import useSettingsStore from '../../store/useSettingsStore';
import { useAuth } from '../../contexts/AuthContext';

// Types
import type { Order, OrderItem } from '@fynlo/shared';
import type { PaymentRequest, PaymentResult } from '../../services/PaymentService';

// Define navigation params
type PaymentProcessingScreenParams = {
  paymentMethod: 'sumup' | 'stripe' | 'square' | 'qr_code' | 'cash';
  amount: number;
  orderData: {
    items: OrderItem[];
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    tableId?: string;
    tableName?: string;
    orderType?: 'dine_in' | 'takeout' | 'pickup' | 'delivery';
    notes?: string;
  };
  onComplete?: (result: PaymentResult) => void;
  onCancel?: () => void;
};

type NavigationParams = {
  PaymentProcessing: PaymentProcessingScreenParams;
};

type PaymentProcessingScreenRouteProp = RouteProp<NavigationParams, 'PaymentProcessing'>;
type PaymentProcessingScreenNavigationProp = StackNavigationProp<NavigationParams, 'PaymentProcessing'>;
const PaymentProcessingScreen: React.FC = () => {
  const navigation = useNavigation<PaymentProcessingScreenNavigationProp>();
  const route = useRoute<PaymentProcessingScreenRouteProp>();
  const theme = useTheme();
  const styles = createStyles(theme);
  
  // Get params with defaults
  const {
    paymentMethod = 'cash',
    amount = 0,
    orderData = { items: [] },
    onComplete,
    onCancel,
  } = route.params || {};

  // Services & Stores
  const { user } = useAuth();
  const paymentService = PaymentService;
  const orderService = OrderService;
  // NativeSumUpService is already a singleton instance
  const sumUpService = NativeSumUpService;
  const { clearCart, addTransactionFee } = useAppStore();
  const { taxConfiguration, paymentMethods } = useSettingsStore();

  // State
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(true);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [sumUpError, setSumUpError] = useState<string | null>(null);
  
  // Refs to prevent double processing
  const isProcessingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (processing) {
        Alert.alert(
          'Payment in Progress',
          'Are you sure you want to cancel the payment?',
          [
            { text: 'Continue Payment', style: 'cancel' },
            { text: 'Cancel Payment', style: 'destructive', onPress: handleCancelPayment },
          ]
        );
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [processing]);

  // Initialize payment on mount
  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      logger.info('Initializing payment:', { paymentMethod, amount, orderData });
      
      // Validate inputs
      if (\!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (\!orderData.items || orderData.items.length === 0) {
        throw new Error('No items in order');
      }

      // Set initial status based on payment method
      switch (paymentMethod) {
        case 'sumup':
          setPaymentStatus('initializing');
          setStatusMessage('Connecting to SumUp terminal...');
          // SumUp component will handle the rest
          break;
          
        case 'qr_code':
          setPaymentStatus('initializing');
          setStatusMessage('Generating QR code...');
          // QR component will handle the rest
          break;
          
        case 'cash':
          setPaymentStatus('waiting_for_card');
          setStatusMessage('Enter cash received amount');
          setShowCashModal(true);
          break;
          
        case 'stripe':
        case 'square':
          setPaymentStatus('initializing');
          setStatusMessage('Initializing payment...');
          // Will be implemented when providers are ready
          processCardPayment();
          break;
          
        default:
          throw new Error('Unsupported payment method');
      }
    } catch (error) {
      logger.error('Failed to initialize payment:', error);
      handlePaymentError(error);
    }
  };

  const processCardPayment = async () => {
    if (isProcessingRef.current || hasCompletedRef.current) {
      logger.warn('Payment already processing or completed');
      return;
    }

    isProcessingRef.current = true;
    setProcessing(true);
    setPaymentStatus('processing');

    try {
      // Create payment request with timestamp
      const timestamp = new Date().getTime();
      const paymentRequest: PaymentRequest = {
        amount,
        currency: 'GBP',
        orderId: 'ORDER-' + timestamp,
        description: 'Order with items',
        metadata: {
          customerId: orderData.customerId,
          customerName: orderData.customerName,
          tableId: orderData.tableId,
          items: orderData.items,
        },
      };

      logger.info('Processing card payment:', paymentRequest);

      // TODO: Implement actual Stripe/Square payment processing
      // For now, simulate a successful payment
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockResult: PaymentResult = {
        success: true,
        transactionId: 'TXN-' + timestamp,
        provider: paymentMethod,
        amount,
        fee: amount * 0.029, // 2.9% fee
      };

      await handlePaymentSuccess(mockResult);
    } catch (error) {
      logger.error('Card payment failed:', error);
      handlePaymentError(error);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
  };

  const processCashPayment = async () => {
    if (isProcessingRef.current || hasCompletedRef.current) {
      logger.warn('Payment already processing or completed');
      return;
    }

    if (cashReceived < amount) {
      Alert.alert(
        'Insufficient Cash',
        'Amount due: £' + amount.toFixed(2) + '\nCash received: £' + cashReceived.toFixed(2),
        [{ text: 'OK' }]
      );
      return;
    }

    isProcessingRef.current = true;
    setProcessing(true);
    setPaymentStatus('processing');
    setShowCashModal(false);

    try {
      const change = cashReceived - amount;
      const timestamp = new Date().getTime();
      
      // Create cash payment result
      const cashResult: PaymentResult = {
        success: true,
        transactionId: 'CASH-' + timestamp,
        provider: 'cash',
        amount,
        fee: 0,
      };

      // Show change if any
      if (change > 0) {
        setStatusMessage('Change due: £' + change.toFixed(2));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await handlePaymentSuccess(cashResult);
    } catch (error) {
      logger.error('Cash payment failed:', error);
      handlePaymentError(error);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = async (result: PaymentResult) => {
    if (hasCompletedRef.current) {
      logger.warn('Payment already completed');
      return;
    }

    hasCompletedRef.current = true;
    setPaymentResult(result);
    setPaymentStatus('success');
    setStatusMessage('Payment successful\!');

    try {
      // Create order in backend
      const orderCreated = await createOrder(result);
      logger.info('Order created:', orderCreated);

      // Clear cart
      clearCart();

      // Show success for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Call completion callback
      if (onComplete) {
        onComplete(result);
      }

      // Navigate back or to receipt screen
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error) {
      logger.error('Failed to create order after payment:', error);
      // Payment was successful but order creation failed
      // Still treat as success but show warning
      Alert.alert(
        'Order Creation Failed',
        'Payment was successful but order creation failed. Please contact support.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handlePaymentError = (error: unknown) => {
    logger.error('Payment error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Payment failed';
    setPaymentStatus('failed');
    setStatusMessage(errorMessage);
    setPaymentResult({
      success: false,
      provider: paymentMethod,
      amount,
      fee: 0,
      error: errorMessage,
    });

    // Show error for 3 seconds then allow retry
    setTimeout(() => {
      setShowPaymentOverlay(false);
    }, 3000);
  };

  const handleCancelPayment = () => {
    if (processing && paymentMethod \!== 'cash') {
      Alert.alert(
        'Cancel Payment',
        'Are you sure you want to cancel this payment?',
        [
          { text: 'Continue Payment', style: 'cancel' },
          {
            text: 'Cancel',
            style: 'destructive',
            onPress: () => {
              if (onCancel) {
                onCancel();
              }
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      if (onCancel) {
        onCancel();
      }
      navigation.goBack();
    }
  };

  const createOrder = async (paymentResult: PaymentResult): Promise<Order> => {
    // Calculate VAT correctly
    // Assuming 'amount' includes VAT (VAT-inclusive pricing)
    const vatRate = (taxConfiguration.vatRate || 0) / 100;
    const serviceTaxRate = (taxConfiguration.serviceTaxRate || 0) / 100;
    
    // Calculate the subtotal (amount without VAT)
    // If total includes VAT: subtotal = total / (1 + vatRate)
    const subtotal = amount / (1 + vatRate);
    
    // Calculate the actual VAT amount
    // VAT = subtotal * vatRate
    const taxAmount = subtotal * vatRate;
    
    // Calculate service charge (typically on subtotal, not total)
    // This depends on business logic - adjust if needed
    const serviceCharge = subtotal * serviceTaxRate;
    
    // Verify the calculation
    // Note: With service charge, the total would be: subtotal + taxAmount + serviceCharge
    // But typically the 'amount' passed here is the final total including all charges
    // So we need to adjust our calculation if service charge is already included
    
    const orderRequest = {
      items: orderData.items,
      customer_id: orderData.customerId,
      customer_name: orderData.customerName || 'Walk-in Customer',
      customer_email: orderData.customerEmail,
      table_id: orderData.tableId,
      table_name: orderData.tableName,
      order_type: orderData.orderType || 'dine_in',
      payment_method: paymentMethod,
      payment_status: 'paid' as const,
      transaction_id: paymentResult.transactionId,
      subtotal: subtotal,
      tax_amount: taxAmount,
      service_charge: serviceCharge,
      total_amount: amount,
      notes: orderData.notes,
    };

    // Log the calculation for debugging
    logger.info('Order calculation:', {
      amount: amount,
      vatRate: vatRate * 100 + '%',
      subtotal: subtotal.toFixed(2),
      tax_amount: taxAmount.toFixed(2),
      service_charge: serviceCharge.toFixed(2),
      verification: (subtotal + taxAmount).toFixed(2) + ' should equal ' + amount.toFixed(2) + ' (without service charge)'
    });

    return await orderService.createOrder(orderRequest);
  };

  const getPaymentMethodInfo = () => {
    const methodConfig = paymentMethods.find(m => m.id === paymentMethod);
    return {
      name: methodConfig?.name || paymentMethod,
      icon: methodConfig?.icon || 'payment',
      color: methodConfig?.color || theme.colors.primary,
    };
  };

  const renderPaymentContent = () => {
    switch (paymentMethod) {
      case 'sumup':
        logger.info('🎯 PaymentProcessingScreen: Mounting NativeSumUpPayment component');
        
        // Check if module is available first
        if (!sumUpService.isAvailable()) {
          logger.error('❌ SumUp module not available');
          setSumUpError('SumUp module not available');
          setShowDiagnostics(true);
          
          return (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={60} color={theme.colors.error} />
              <Text style={styles.errorTitle}>SumUp Not Available</Text>
              <Text style={styles.errorText}>
                The SumUp payment module is not available on this device.
                {'\n'}This may be due to:
                {'\n'}• Native module not registered
                {'\n'}• iOS configuration issue
                {'\n'}• Device compatibility
              </Text>
              
              <SumUpDiagnostics />
              
              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.retryButton]}
                  onPress={() => {
                    setSumUpError(null);
                    setShowDiagnostics(false);
                    initializePayment();
                  }}
                >
                  <Icon name="refresh" size={20} color={theme.colors.onPrimary} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.alternativeButton]}
                  onPress={() => {
                    // Switch to QR code payment as fallback
                    navigation.setParams({ ...route.params, paymentMethod: 'qr_code' });
                  }}
                >
                  <Icon name="qr-code" size={20} color={theme.colors.primary} />
                  <Text style={styles.alternativeButtonText}>Use QR Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        
        return (
          <NativeSumUpPayment
            amount={amount}
            currency="GBP"
            title={`Payment for ${orderData.customerName || 'Customer'}`}
            visible={true}
            onPaymentComplete={(success, transactionCode, error) => {
              logger.info('💳 NativeSumUpPayment completed:', { success, transactionCode, error });
              if (success && transactionCode) {
                handlePaymentSuccess({
                  success: true,
                  transactionId: transactionCode,
                  provider: 'sumup',
                  amount,
                  fee: amount * 0.0069, // 0.69% fee
                });
              } else {
                setSumUpError(error || 'Payment failed');
                setShowDiagnostics(true);
                handlePaymentError(new Error(error || 'Payment failed'));
              }
            }}
            onPaymentCancel={handleCancelPayment}
            useTapToPay={true}
          />
        );

      case 'qr_code':
        return (
          <QRCodePayment
            amount={amount}
            orderItems={orderData.items}
            customerName={orderData.customerName || 'Customer'}
            onSuccess={(transactionData) => {
              handlePaymentSuccess({
                success: true,
                transactionId: transactionData.id,
                provider: 'qr_code',
                amount,
                fee: amount * 0.012, // 1.2% fee
              });
            }}
            onCancel={handleCancelPayment}
          />
        );

      case 'cash':
        if (showCashModal) {
          return (
            <View style={styles.cashModal}>
              <Text style={styles.cashTitle}>Cash Payment</Text>
              <Text style={styles.cashAmount}>Amount Due: £{amount.toFixed(2)}</Text>
              
              <View style={styles.cashInputContainer}>
                <Text style={styles.cashLabel}>Cash Received:</Text>
                <View style={styles.cashButtons}>
                  <TouchableOpacity
                    style={styles.cashButton}
                    onPress={() => setCashReceived(amount)}
                  >
                    <Text style={styles.cashButtonText}>Exact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cashButton}
                    onPress={() => setCashReceived(Math.ceil(amount / 5) * 5)}
                  >
                    <Text style={styles.cashButtonText}>£{Math.ceil(amount / 5) * 5}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cashButton}
                    onPress={() => setCashReceived(Math.ceil(amount / 10) * 10)}
                  >
                    <Text style={styles.cashButtonText}>£{Math.ceil(amount / 10) * 10}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cashButton}
                    onPress={() => setCashReceived(Math.ceil(amount / 20) * 20)}
                  >
                    <Text style={styles.cashButtonText}>£{Math.ceil(amount / 20) * 20}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {cashReceived > 0 && (
                <Text style={styles.changeText}>
                  Change: £{Math.max(0, cashReceived - amount).toFixed(2)}
                </Text>
              )}

              <View style={styles.cashActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancelPayment}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.confirmButton,
                    cashReceived < amount && styles.disabledButton,
                  ]}
                  onPress={processCashPayment}
                  disabled={cashReceived < amount}
                >
                  <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        break;

      default:
        return (
          <View style={styles.unsupportedContainer}>
            <Icon name="error-outline" size={60} color={theme.colors.error} />
            <Text style={styles.unsupportedText}>
              {paymentMethod} payment is being processed...
            </Text>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
          </View>
        );
    }

    return null;
  };

  const methodInfo = getPaymentMethodInfo();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCancelPayment}
            disabled={processing && paymentMethod \!== 'cash'}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Process Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <View style={styles.paymentMethodBadge}>
            <Icon name={methodInfo.icon} size={24} color={methodInfo.color} />
            <Text style={styles.paymentMethodText}>{methodInfo.name}</Text>
          </View>
          <Text style={styles.amountText}>£{amount.toFixed(2)}</Text>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {orderData.items.map((item, index) => (
            <View key={item.id + '-' + index} style={styles.orderItem}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={styles.itemPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Payment Content */}
        <View style={styles.paymentContent}>
          {renderPaymentContent()}
        </View>

        {/* Retry Button (shown on failure) */}
        {paymentStatus === 'failed' && \!showPaymentOverlay && (
          <View style={styles.retryContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={initializePayment}
            >
              <Icon name="refresh" size={24} color={theme.colors.onPrimary} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Payment Status Overlay */}
      <PaymentStatusOverlay
        visible={showPaymentOverlay && paymentMethod \!== 'cash'}
        status={paymentStatus}
        amount={amount}
        currency="GBP"
        paymentMethod={methodInfo.name}
        message={statusMessage}
        onCancel={handleCancelPayment}
        canCancel={\!processing || paymentMethod === 'cash'}
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  paymentInfo: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  paymentMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  orderSummary: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemName: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  paymentContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  cashModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  cashTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  cashAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  cashInputContainer: {
    marginBottom: theme.spacing.lg,
  },
  cashLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  cashButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cashButton: {
    width: '48%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cashButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  changeText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.success,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  cashActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  unsupportedText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  retryContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.spacing.sm,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onPrimary,
    marginLeft: theme.spacing.sm,
  },
  errorContainer: {
    flex: 1,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 20,
  },
  errorActions: {
    width: '100%',
    marginTop: theme.spacing.xl,
  },
  alternativeButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  alternativeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
});

export default PaymentProcessingScreen;