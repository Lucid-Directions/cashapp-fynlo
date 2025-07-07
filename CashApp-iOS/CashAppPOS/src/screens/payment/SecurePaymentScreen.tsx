/**
 * Secure Payment Screen
 * 
 * Integrates secure payment configuration, method selection, and processing
 * Shows fee transparency and handles all payment flows through the backend
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import SecurePaymentMethodSelector from '../../components/payment/SecurePaymentMethodSelector';
import SecurePaymentOrchestrator from '../../services/SecurePaymentOrchestrator';
import SecurePaymentConfig, { PaymentMethod } from '../../services/SecurePaymentConfig';
import CashPaymentModal from '../../components/payment/CashPaymentModal';
import QRCodePayment from '../../components/payment/QRCodePayment';

interface RouteParams {
  orderId: string;
  amount: number;
  orderItems?: any[];
}

const SecurePaymentScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    // Load payment configuration on mount
    SecurePaymentConfig.loadConfiguration();
  }, []);

  const handleMethodSelected = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const handleProcessPayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    // Handle special payment methods
    if (selectedMethod.id === 'cash') {
      setShowCashModal(true);
      return;
    }

    if (selectedMethod.id === 'qr_code') {
      setShowQRCode(true);
      return;
    }

    // Show fee confirmation
    const { fees, feeDisplay } = SecurePaymentOrchestrator.calculateFeesForDisplay(
      params.amount,
      selectedMethod.id
    );

    SecurePaymentOrchestrator.showPaymentConfirmation(
      params.amount,
      selectedMethod.id,
      () => processCardPayment(),
      () => {} // User cancelled
    );
  };

  const processCardPayment = async () => {
    setProcessing(true);

    try {
      const result = await SecurePaymentOrchestrator.processPayment({
        orderId: params.orderId,
        amount: params.amount,
        paymentMethod: selectedMethod!.id as any,
        paymentDetails: {
          // Payment details would come from payment provider SDK
          // For now, we'll use mock data
          provider_transaction_id: `MOCK_${Date.now()}`,
        },
        metadata: {
          orderItems: params.orderItems,
        }
      });

      if (result.success) {
        // Navigate to success screen
        navigation.navigate('PaymentSuccess' as never, {
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          amount: params.amount,
          fees: result.fees,
          netAmount: result.netAmount,
          provider: result.provider,
        } as never);
      } else {
        // Show error
        const errorMessage = SecurePaymentOrchestrator.formatPaymentError(
          result.error || 'Payment failed',
          result.errorCode
        );
        
        Alert.alert('Payment Failed', errorMessage, [
          { text: 'OK' }
        ]);
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCashPayment = async (cashReceived: number, change: number) => {
    setShowCashModal(false);
    setProcessing(true);

    try {
      const result = await SecurePaymentOrchestrator.processPayment({
        orderId: params.orderId,
        amount: params.amount,
        paymentMethod: 'cash',
        paymentDetails: {
          cash_received: cashReceived,
          change_given: change,
        }
      });

      if (result.success) {
        navigation.navigate('PaymentSuccess' as never, {
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          amount: params.amount,
          fees: result.fees,
          netAmount: result.netAmount,
          provider: 'cash',
          cashReceived,
          change,
        } as never);
      } else {
        Alert.alert('Error', result.error || 'Cash payment failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process cash payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleQRPayment = async (transactionId: string) => {
    setShowQRCode(false);
    setProcessing(true);

    try {
      const result = await SecurePaymentOrchestrator.processPayment({
        orderId: params.orderId,
        amount: params.amount,
        paymentMethod: 'qr_code',
        paymentDetails: {
          qr_transaction_id: transactionId,
        }
      });

      if (result.success) {
        navigation.navigate('PaymentSuccess' as never, {
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          amount: params.amount,
          fees: result.fees,
          netAmount: result.netAmount,
          provider: 'qr_code',
        } as never);
      } else {
        Alert.alert('Error', result.error || 'QR payment failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process QR payment');
    } finally {
      setProcessing(false);
    }
  };

  const renderOrderSummary = () => {
    const fees = selectedMethod
      ? SecurePaymentConfig.calculateFees(params.amount, selectedMethod.id)
      : null;

    return (
      <View style={[styles.orderSummary, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Order Summary
        </Text>
        
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Order Total
          </Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            £{params.amount.toFixed(2)}
          </Text>
        </View>

        {fees && fees.totalFee > 0 && (
          <>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Processing Fee
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.accent }]}>
                -£{fees.totalFee.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.text, fontWeight: '600' }]}>
                You Receive
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.primary, fontWeight: '700' }]}>
                £{fees.netAmount.toFixed(2)}
              </Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Payment
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {renderOrderSummary()}
        
        <SecurePaymentMethodSelector
          amount={params.amount}
          onMethodSelected={handleMethodSelected}
          selectedMethod={selectedMethod?.id}
          disabled={processing}
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.payButton,
            {
              backgroundColor: selectedMethod ? theme.colors.primary : theme.colors.disabled,
            },
            processing && styles.disabledButton
          ]}
          onPress={handleProcessPayment}
          disabled={!selectedMethod || processing}
        >
          {processing ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <>
              <Icon
                name="credit-card-check"
                size={24}
                color={theme.colors.onPrimary}
              />
              <Text style={[styles.payButtonText, { color: theme.colors.onPrimary }]}>
                Process Payment
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <CashPaymentModal
        visible={showCashModal}
        amount={params.amount}
        onClose={() => setShowCashModal(false)}
        onConfirm={handleCashPayment}
      />

      {showQRCode && (
        <QRCodePayment
          amount={params.amount}
          orderId={params.orderId}
          onSuccess={handleQRPayment}
          onCancel={() => setShowQRCode(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  orderSummary: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  footer: {
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SecurePaymentScreen;