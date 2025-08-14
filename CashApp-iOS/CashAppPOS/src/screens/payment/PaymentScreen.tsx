import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import QRCodePayment from '../../components/payment/QRCodePayment';
import NativeSumUpPayment from '../../components/payment/NativeSumUpPayment';
import PaymentService from '../../services/PaymentService';
// TODO: Unused import - import SquarePaymentProvider from '../../services/providers/SquarePaymentProvider';
// TODO: Unused import - import SumUpPaymentProvider from '../../services/providers/SumUpPaymentProvider';

import type { PaymentRequest, PaymentResult } from '../../services/PaymentService';
import NativeSumUpService from '../../services/NativeSumUpService';
import { useCartStore, isEnhancedCartEnabled } from '../../store/cartStoreAdapter';
import useSettingsStore from '../../store/useSettingsStore';
import { logger } from '../../utils/logger';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
  feeInfo: string;
}

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const cartStore = useCartStore(isEnhancedCartEnabled());
  const { cart, clearCart, serviceChargePercentage, addTransactionFee } = cartStore;
  const { paymentMethods, taxConfiguration } = useSettingsStore();
  const nativeSumUpService = NativeSumUpService.getInstance();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [_paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [optimalProvider, setOptimalProvider] = useState<string>('');
  const [showNativeSumUpPayment, setShowNativeSumUpPayment] = useState(false);
  const [currentPaymentRequest, setCurrentPaymentRequest] = useState<PaymentRequest | null>(null);

  // Calculate totals
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTax = (subtotal: number) => {
    if (!taxConfiguration.vatEnabled) return 0;
    return subtotal * (taxConfiguration.vatRate / 100);
  };

  const calculateServiceCharge = (subtotal: number) => {
    // Use the service charge percentage from the cart store, which may have been set in ServiceChargeSelectionScreen
    const chargePercentage = serviceChargePercentage ?? 0;
    return subtotal * (chargePercentage / 100);
  };

  const calculateTransactionFee = (total: number) => {
    // Only apply transaction fee for card payments when enabled
    if (!addTransactionFee) return 0;
    // Standard card processing fee: 2.9% + $0.30
    return total * 0.029 + 0.3;
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    const service = calculateServiceCharge(subtotal);
    const baseTotal = subtotal + tax + service;
    
    // Add transaction fee if enabled (typically for card payments)
    const transactionFee = calculateTransactionFee(baseTotal);
    return baseTotal + transactionFee;
  };

  // Payment methods with fee information - SumUp focused (Stripe/Square hidden as backups)
  const availablePaymentMethods: PaymentMethod[] = [
    {
      id: 'tapToPay',
      name: 'Tap to Pay',
      icon: 'contactless-payment',
      color: Colors.success,
      enabled: true,
      requiresAuth: false,
      feeInfo: '0.69% + £19/month',
    },
    {
      id: 'applePaySumUp',
      name: 'Apple Pay',
      icon: 'apple',
      color: Colors.darkGray,
      enabled: true,
      requiresAuth: false,
      feeInfo: '0.69% + £19/month',
    },
    {
      id: 'cardEntry',
      name: 'Manual Card',
      icon: 'credit-card',
      color: Colors.secondary,
      enabled: true,
      requiresAuth: false,
      feeInfo: '0.69% + £19/month',
    },
    {
      id: 'qrCode',
      name: 'QR Payment',
      icon: 'qr-code-scanner',
      color: Colors.primary,
      enabled: paymentMethods?.qrCode?.enabled ?? true,
      requiresAuth: paymentMethods?.qrCode?.requiresAuth ?? false,
      feeInfo: '0.69% + £19/month',
    },
    {
      id: 'cash',
      name: 'Cash',
      icon: 'payments',
      color: Colors.darkGray,
      enabled: paymentMethods?.cash?.enabled ?? true,
      requiresAuth: paymentMethods?.cash?.requiresAuth ?? false,
      feeInfo: 'No fees',
    },
    // Stripe and Square are hidden (backup providers only)
    // {
    //   id: 'stripe',
    //   name: 'Stripe',
    //   icon: 'credit-card',
    //   color: Colors.secondary,
    //   enabled: false, // Hidden from restaurant interface
    //   requiresAuth: false,
    //   feeInfo: '1.4% + 20p',
    // },
    // {
    //   id: 'square',
    //   name: 'Square',
    //   icon: 'contactless-payment',
    //   color: Colors.warning,
    //   enabled: false, // Hidden from restaurant interface
    //   requiresAuth: false,
    //   feeInfo: '1.75%',
    // },
  ];

  const enabledPaymentMethods = availablePaymentMethods.filter((m) => m.enabled);

  useEffect(() => {
    // Initialize PaymentService and get optimal provider
    initializePaymentService();
  }, []);

  useEffect(() => {
    // Auto-select optimal payment method (prioritize Tap to Pay for best user experience)
    if (enabledPaymentMethods.length > 0) {
      const tapToPayMethod = enabledPaymentMethods.find((m) => m.id === 'tapToPay');
      if (tapToPayMethod) {
        setSelectedPaymentMethod('tapToPay');
        setOptimalProvider('tapToPay');
      } else {
        // Fallback to first available SumUp method
        setSelectedPaymentMethod(enabledPaymentMethods[0].id);
        setOptimalProvider(enabledPaymentMethods[0].id);
      }
    }
  }, [enabledPaymentMethods]);

  const initializePaymentService = async () => {
    try {
      // Load configuration from storage or use defaults
      const config = await PaymentService.loadConfig();
      if (!config) {
        // Initialize with production config
        // NEVER use localhost - always use production infrastructure
        // NEVER hardcode API keys - they must come from backend
        const defaultConfig = {
          square: {
            applicationId: '', // Must be provided by backend
            locationId: '',
          },
          sumup: {
            affiliateKey: '', // Must be provided by backend - NEVER hardcode
          },
          backend: {
            baseUrl: 'https://fynlopos-9eg2c.ondigitalocean.app', // Production API
            apiKey: '', // Must come from auth token
          },
        };
        await PaymentService.initialize(defaultConfig);
      }

      // Get optimal provider for current amount
      const total = calculateGrandTotal();
      const provider = await PaymentService.getOptimalProvider(total);
      setOptimalProvider(provider);
    } catch (error) {
      logger.error('Failed to initialize payment service:', error);
    }
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    const method = availablePaymentMethods.find((m) => m.id === methodId);
    if (method?.requiresAuth) {
      Alert.alert(
        'Authorization Required',
        'Manager authorization is required for this payment method.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Authorize',
            onPress: () => {
              setSelectedPaymentMethod(methodId);
              processPaymentMethod(methodId);
            },
          },
        ]
      );
    } else {
      setSelectedPaymentMethod(methodId);
      processPaymentMethod(methodId);
    }
  };

  const processPaymentMethod = (methodId: string) => {
    switch (methodId) {
      case 'qrCode':
        setShowQRModal(true);
        break;
      case 'cash':
        processCashPayment();
        break;
      case 'tapToPay':
        // Use native Tap to Pay when available
        processSumUpPaymentMethod(methodId);
        break;
      case 'applePaySumUp':
      case 'cardEntry':
        // Other SumUp payment methods use React Native package
        processSumUpPaymentMethod(methodId);
        break;
      // Backup providers (hidden from UI)
      case 'square':
        processCardPayment(methodId);
        break;
      default:
        Alert.alert('Payment Method', `${methodId} payment not implemented yet`);
    }
  };

  const processCashPayment = () => {
    Alert.prompt(
      'Cash Payment',
      `Amount due: £${calculateGrandTotal().toFixed(2)}\nEnter cash received:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: (value) => {
            const received = parseFloat(value || '0');
            const total = calculateGrandTotal();

            if (received < total) {
              Alert.alert('Error', 'Insufficient cash received');
              return;
            }

            handleCashPayment(received);
          },
        },
      ],
      'plain-text'
    );
  };

  const handleCashPayment = async (receivedAmount: number) => {
    setProcessing(true);

    try {
      const request: PaymentRequest = {
        amount: calculateGrandTotal(),
        currency: 'GBP',
        orderId: `ORDER-${Date.now()}`,
        description: `Order with ${cart.length} items`,
      };

      const result = await PaymentService.processCashPayment(request, receivedAmount);

      if (result.success) {
        setPaymentResult(result);
        showPaymentSuccess(result);
      } else {
        Alert.alert('Payment Failed', result.error || 'Cash payment failed');
      }
    } catch (_error) {
      Alert.alert('Payment Error', 'Failed to process cash payment');
    } finally {
      setProcessing(false);
    }
  };

  // New SumUp Payment Method Handler
  const processSumUpPaymentMethod = async (methodId: string) => {
    setProcessing(true);

    try {
      const request: PaymentRequest = {
        amount: calculateGrandTotal(),
        currency: 'GBP',
        orderId: `ORDER-${Date.now()}`,
        description: `Order with ${cart.length} items`,
        metadata: { provider: 'sumup', method: methodId },
      };

      logger.info(`🏦 Processing SumUp ${methodId} payment for £${request.amount.toFixed(2)}`);
      // Pass the payment method to respect user's selection
      await processSumUpPayment(request, methodId);
    } catch (error) {
      logger.error(`❌ ${methodId} payment error:`, error);
      Alert.alert('Payment Error', `Failed to process ${methodId} payment`);
    } finally {
      setProcessing(false);
    }
  };

  // SumUp Payment Function - ALWAYS use Native SDK for ALL payment methods
  // This bypasses the problematic sumup-react-native-alpha package completely
  const processSumUpPayment = async (
    request: PaymentRequest,
    paymentMethod: string = 'tapToPay'
  ) => {
    try {
      logger.info('🏦 Starting NATIVE SumUp payment flow for method:', paymentMethod);

      // ALWAYS use native module for ALL SumUp payment methods
      // This avoids the problematic React Native package that shows demo alerts
      if (!nativeSumUpService.isAvailable()) {
        logger.error('❌ Native SumUp module not available on this device');
        Alert.alert(
          'Payment Not Available',
          'SumUp payment is not available on this device. Please ensure you are using a compatible iPhone.',
          [{ text: 'OK' }]
        );
        setProcessing(false);
        return;
      }

      // Always show the native payment component
      // The native component will handle checking Tap to Pay availability internally
      logger.info('📱 Using NATIVE SumUp SDK for payment');
      logger.info('💳 Payment method:', paymentMethod);
      
      // Set the current payment request and show the native SumUp component
      setCurrentPaymentRequest(request);
      setShowNativeSumUpPayment(true);
      
      logger.info('💳 Native SumUp modal will handle the payment flow');
      
      // DO NOT fall back to React Native package - it causes the demo alerts
      // The native module will handle all payment methods properly
      
    } catch (error) {
      logger.error('❌ SumUp payment error:', error);
      Alert.alert(
        'Payment Error',
        'Failed to initialize payment. Please try again or contact support.',
        [{ text: 'OK' }]
      );
      setProcessing(false);
    }
  };



  // Removed handleSumUpPaymentComplete - no longer using React Native package

  // Removed handleSumUpPaymentCancel - no longer using React Native package

  // Handle Native SumUp payment completion (Tap to Pay)
  const handleNativeSumUpPaymentComplete = (
    success: boolean,
    transactionCode?: string,
    error?: string
  ) => {
    setShowNativeSumUpPayment(false);
    setProcessing(false);

    if (success && transactionCode && currentPaymentRequest) {
      logger.info('🎉 Native SumUp Tap to Pay completed successfully!', transactionCode);

      // Calculate SumUp fee (0.69% for Tap to Pay as per pricing)
      const fee = currentPaymentRequest.amount * 0.0069;

      // Create a successful payment result
      const paymentResult: PaymentResult = {
        success: true,
        transactionId: transactionCode,
        amount: currentPaymentRequest.amount,
        fee,
        provider: 'sumup',
        error: undefined,
      };

      setPaymentResult(paymentResult);
      showPaymentSuccess(paymentResult);
      setCurrentPaymentRequest(null);
    } else {
      logger.error('❌ Native SumUp Tap to Pay failed:', error);
      Alert.alert('Payment Failed', error || 'Tap to Pay was not completed');
      setCurrentPaymentRequest(null);
    }
  };

  // Handle Native SumUp payment cancellation
  const handleNativeSumUpPaymentCancel = () => {
    setShowNativeSumUpPayment(false);
    setProcessing(false);
    setCurrentPaymentRequest(null);
    logger.info('❌ Native SumUp Tap to Pay cancelled by user');
  };

  const processCardPayment = async (provider: string) => {
    setProcessing(true);

    try {
      const request: PaymentRequest = {
        amount: calculateGrandTotal(),
        currency: 'GBP',
        orderId: `ORDER-${Date.now()}`,
        description: `Order with ${cart.length} items`,
        metadata: { provider },
      };

      // Route to appropriate payment provider
      logger.info(`Processing ${provider} payment for £${request.amount.toFixed(2)}`);

      if (provider === 'sumup') {
        // Process SumUp payment with card detection modal
        await processSumUpPayment(request);
      } else {
        // Process other payment providers
        const result = await PaymentService.processPayment(request);
        if (result.success) {
          setPaymentResult(result);
          showPaymentSuccess(result);
        } else {
          Alert.alert('Payment Failed', result.error || 'Card payment failed');
        }
      }
    } catch (_error) {
      Alert.alert('Payment Error', 'Failed to process card payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleQRPaymentComplete = (result: PaymentResult) => {
    setShowQRModal(false);
    setPaymentResult(result);
    if (result.success) {
      showPaymentSuccess(result);
    } else {
      Alert.alert('QR Payment Failed', result.error || 'QR payment failed');
    }
  };

  const showPaymentSuccess = (result: PaymentResult) => {
    Alert.alert(
      'Payment Successful',
      `Payment of £${result.amount.toFixed(2)} processed successfully via ${
        result.provider
      }!\n\nTransaction ID: ${result.transactionId}\nFee: £${result.fee.toFixed(2)}`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearCart();
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Payment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({cart.length} items)</Text>
              <Text style={styles.summaryValue}>£{calculateSubtotal().toFixed(2)}</Text>
            </View>

            {taxConfiguration.vatEnabled && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>VAT ({taxConfiguration.vatRate}%)</Text>
                <Text style={styles.summaryValue}>
                  £{calculateTax(calculateSubtotal()).toFixed(2)}
                </Text>
              </View>
            )}

            {serviceChargePercentage > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Service Charge ({serviceChargePercentage}%)
                </Text>
                <Text style={styles.summaryValue}>
                  £{calculateServiceCharge(calculateSubtotal()).toFixed(2)}
                </Text>
              </View>
            )}

            {addTransactionFee && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transaction Fee (2.9% + £0.30)</Text>
                <Text style={styles.summaryValue}>
                  £{calculateTransactionFee(calculateSubtotal() + calculateTax(calculateSubtotal()) + calculateServiceCharge(calculateSubtotal())).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{calculateGrandTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Optimal Provider Recommendation */}
        {optimalProvider && (
          <View style={styles.section}>
            <View style={styles.recommendationCard}>
              <Icon name="lightbulb" size={24} color={Colors.warning} />
              <View style={styles.recommendationText}>
                <Text style={styles.recommendationTitle}>Recommended</Text>
                <Text style={styles.recommendationSubtitle}>
                  {optimalProvider.toUpperCase()} offers the best rates for this transaction
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.paymentMethods}>
            {enabledPaymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === method.id && styles.paymentMethodActive,
                  method.id === optimalProvider && styles.recommendedMethod,
                ]}
                onPress={() => handlePaymentMethodSelect(method.id)}
              >
                <Icon
                  name={method.icon}
                  size={32}
                  color={selectedPaymentMethod === method.id ? Colors.white : method.color}
                />
                <Text
                  style={[
                    styles.paymentMethodName,
                    selectedPaymentMethod === method.id && styles.paymentMethodNameActive,
                  ]}
                >
                  {method.name}
                </Text>
                <Text
                  style={[
                    styles.paymentMethodFee,
                    selectedPaymentMethod === method.id && styles.paymentMethodFeeActive,
                  ]}
                >
                  {method.feeInfo}
                </Text>
                {method.id === optimalProvider && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>BEST</Text>
                  </View>
                )}
                {method.requiresAuth && (
                  <Icon
                    name="lock"
                    size={16}
                    color={selectedPaymentMethod === method.id ? Colors.white : Colors.warning}
                    style={styles.authIcon}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Provider Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee Comparison</Text>
          <View style={styles.feeComparison}>
            {enabledPaymentMethods.map((method) => {
              let fee = 0;
              const total = calculateGrandTotal();

              switch (method.id) {
                case 'tapToPay':
                case 'applePaySumUp':
                case 'cardEntry':
                case 'qrCode':
                  fee = total * 0.0069; // 0.69% SumUp high volume rate
                  break;
                case 'cash':
                  fee = 0;
                  break;
                case 'square':
                  fee = total * 0.0175; // 1.75%
                  break;
              }

              return (
                <View key={method.id} style={styles.feeRow}>
                  <Text style={styles.feeMethodName}>{method.name}</Text>
                  <Text style={styles.feeAmount}>£{fee.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* QR Payment Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <QRCodePayment
            request={{
              amount: calculateGrandTotal(),
              currency: 'GBP',
              orderId: `ORDER-${Date.now()}`,
              description: `Order with ${cart.length} items`,
            }}
            onPaymentComplete={handleQRPaymentComplete}
            onCancel={() => setShowQRModal(false)}
          />
        </View>
      </Modal>

      {/* Removed old SumUp React Native package component - now using native module only */}

      {/* Native SumUp Tap to Pay Component (Preferred - uses iPhone Tap to Pay) */}
      {showNativeSumUpPayment && currentPaymentRequest && (
        <NativeSumUpPayment
          amount={currentPaymentRequest.amount}
          currency={currentPaymentRequest.currency}
          title={currentPaymentRequest.description || 'Order Payment'}
          visible={showNativeSumUpPayment}
          onPaymentComplete={handleNativeSumUpPaymentComplete}
          onPaymentCancel={handleNativeSumUpPaymentCancel}
          useTapToPay={currentPaymentRequest.metadata?.method === 'tapToPay'}
        />
      )}

      {/* Processing Overlay */}
      {processing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.processingText}>Processing Payment...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  recommendationText: {
    marginLeft: 12,
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  recommendationSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  paymentMethod: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  paymentMethodActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  recommendedMethod: {
    borderColor: Colors.warning,
    borderWidth: 3,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
  },
  paymentMethodNameActive: {
    color: Colors.white,
  },
  paymentMethodFee: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  paymentMethodFeeActive: {
    color: Colors.white,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.warning,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  authIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  feeComparison: {
    paddingHorizontal: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  feeMethodName: {
    fontSize: 14,
    color: Colors.text,
  },
  feeAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  processingText: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 12,
  },
});

export default PaymentScreen;
