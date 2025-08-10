/**
 * SquareCardPaymentScreen - Card payment processing using Square SDK
 * Handles card entry, validation, and payment processing through Square In-App Payments
 * Part of the Square secondary payment method integration
 */

import React, { useState, useEffect, useCallback } from 'react';

import { logger } from '../../utils/logger';

import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  BackHandler,
} from 'react-native';

import { Button } from '../../components/ui';
import { useTheme } from '../../design-system/ThemeProvider';
import SquareService from '../../services/SquareService';

// Square SDK imports - conditionally loaded
let SQIPCardEntry: unknown;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQIPCardEntry = require('react-native-square-in-app-payments').SQIPCardEntry;
} catch (_error) {
  logger.warn('Square SDK not available in SquareCardPaymentScreen');
}

interface SquareCardPaymentScreenProps {
  navigation: unknown;
  route: {
    params: {
      amount: number;
      currency?: string;
      description?: string;
      onPaymentComplete: (result: unknown) => void;
      onPaymentCancelled: () => void;
    };
  };
}

interface PaymentState {
  loading: boolean;
  processing: boolean;
  cardValid: boolean;
  errorMessage: string | null;
  paymentNonce: string | null;
}

const SquareCardPaymentScreen: React.FC<SquareCardPaymentScreenProps> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const {
    amount,
    currency = 'GBP',
    description,
    onPaymentComplete,
    onPaymentCancelled,
  } = route.params;

  const [paymentState, setPaymentState] = useState<PaymentState>({
    loading: true,
    processing: false,
    cardValid: false,
    errorMessage: null,
    paymentNonce: null,
  });

  const [squareInitialized, setSquareInitialized] = useState(false);

  // Initialize Square SDK
  useEffect(() => {
    initializeSquare();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  const initializeSquare = async () => {
    try {
      setPaymentState((prev) => ({ ...prev, loading: true }));

      // Check if Square is properly initialized
      const status = await SquareService.getIntegrationStatus();
      if (!status.isConfigured || !status.hasCredentials) {
        throw new Error('Square payment service not properly configured');
      }

      // Square SDK is now available
      setSquareInitialized(true);
      setPaymentState((prev) => ({
        ...prev,
        loading: false,
        errorMessage: null,
      }));
    } catch (error) {
      logger.error('Failed to initialize Square:', error);
      setPaymentState((prev) => ({
        ...prev,
        loading: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to initialize payment',
      }));
    }
  };

  const handleBackPress = useCallback(() => {
    if (paymentState.processing) {
      Alert.alert(
        'Payment in Progress',
        'Please wait for the payment to complete before going back.',
        [{ text: 'OK' }]
      );
      return true;
    }
    handleCancelPayment();
    return true;
  }, [paymentState.processing]);

  const handleCancelPayment = () => {
    Alert.alert('Cancel Payment', 'Are you sure you want to cancel this payment?', [
      { text: 'Continue Payment', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          onPaymentCancelled();
          navigation.goBack();
        },
      },
    ]);
  };

  const handleCardInputChange = (cardValid: boolean) => {
    setPaymentState((prev) => ({
      ...prev,
      cardValid,
      errorMessage: null,
    }));
  };

  const processPayment = async () => {
    try {
      setPaymentState((prev) => ({ ...prev, processing: true, errorMessage: null }));

      // TODO: Get card nonce from Square SDK when available
      // const cardResult = await SQIPCardEntry.completeCardEntry();
      // const nonce = cardResult.nonce;

      // For now, simulate the payment process
      const paymentResult = await SquareService.processCardPayment(amount, currency, description);

      if (paymentResult.status === 'completed') {
        // Success - navigate back with result
        onPaymentComplete({
          success: true,
          paymentMethod: 'square_card',
          transactionId: paymentResult.id,
          amount,
          currency,
        });
        navigation.goBack();
      } else {
        // Payment failed
        setPaymentState((prev) => ({
          ...prev,
          processing: false,
          errorMessage: paymentResult.errorMessage || 'Payment failed',
        }));
      }
    } catch (error) {
      logger.error('Payment processing failed:', error);
      setPaymentState((prev) => ({
        ...prev,
        processing: false,
        errorMessage: error instanceof Error ? error.message : 'Payment processing failed',
      }));
    }
  };

  const renderCardEntry = () => {
    if (!squareInitialized) {
      return (
        <View style={[styles.cardContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
            Initializing Square Card Entry...
          </Text>
        </View>
      );
    }

    if (!SQIPCardEntry) {
      return (
        <View style={[styles.cardContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
            Square Card Entry
          </Text>
          <Text style={[styles.placeholderSubtext, { color: theme.colors.textSecondary }]}>
            Square SDK is not available. Please rebuild the app with proper framework embedding.
          </Text>
        </View>
      );
    }

    return (
      <SQIPCardEntry
        style={styles.cardEntry}
        onCardInputChange={handleCardInputChange}
        onCardEntryError={(error) => {
          setPaymentState((prev) => ({ ...prev, errorMessage: error.message }));
        }}
      />
    );
  };

  const renderErrorMessage = () => {
    if (!paymentState.errorMessage) return null;

    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '15' }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {paymentState.errorMessage}
        </Text>
      </View>
    );
  };

  const renderPaymentInfo = () => (
    <View style={[styles.paymentInfo, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.paymentLabel, { color: theme.colors.textSecondary }]}>
        Payment Amount
      </Text>
      <Text style={[styles.paymentAmount, { color: theme.colors.text }]}>
        {currency} {amount.toFixed(2)}
      </Text>
      {description && (
        <Text style={[styles.paymentDescription, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      )}
    </View>
  );

  const renderSecurityInfo = () => (
    <View style={styles.securityInfo}>
      <Text style={[styles.securityText, { color: theme.colors.textSecondary }]}>
        🔒 Your payment is secured by Square's PCI-compliant infrastructure
      </Text>
    </View>
  );

  if (paymentState.loading) {
    return (
      <View
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Initializing Square Payment
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Square Card Payment</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Enter your card details to complete payment
        </Text>
      </View>

      {/* Payment Information */}
      {renderPaymentInfo()}

      {/* Card Entry */}
      <View style={styles.cardSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Card Details</Text>
        {renderCardEntry()}
      </View>

      {/* Error Message */}
      {renderErrorMessage()}

      {/* Security Info */}
      {renderSecurityInfo()}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Cancel"
          onPress={handleCancelPayment}
          variant="outline"
          disabled={paymentState.processing}
          style={[styles.button, styles.cancelButton]}
        />
        <Button
          title={paymentState.processing ? 'Processing...' : `Pay ${currency} ${amount.toFixed(2)}`}
          onPress={processPayment}
          disabled={!paymentState.cardValid || paymentState.processing}
          loading={paymentState.processing}
          style={[styles.button, styles.payButton]}
        />
      </View>
    </View>
  );
};

const { _width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  paymentInfo: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paymentDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  cardSection: {
    flex: 1,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardContainer: {
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  cardEntry: {
    height: 120,
    borderRadius: 12,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  securityInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  securityText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
  },
  cancelButton: {
    // Styled via variant prop
  },
  payButton: {
    // Primary button styling applied by default
  },
});

export default SquareCardPaymentScreen;
