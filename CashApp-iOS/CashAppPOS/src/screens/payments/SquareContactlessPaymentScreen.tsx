/**
 * SquareContactlessPaymentScreen - Contactless payment processing using Square SDK
 * Handles Apple Pay and Google Pay integration through Square In-App Payments
 * Part of the Square secondary payment method integration
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';
import { Button } from '../../components/ui';
import SquareService from '../../services/SquareService';

// Square SDK imports - conditionally loaded
let _SQIPApplePay: unknown;
let _SQIPGooglePay: unknown;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SquareSDK = require('react-native-square-in-app-payments');
  _SQIPApplePay = SquareSDK._SQIPApplePay;
  _SQIPGooglePay = SquareSDK._SQIPGooglePay;
} catch (__error) {
  // Error handled silently
}

interface SquareContactlessPaymentScreenProps {
  navigation: unknown;
  route: {
    params: {
      amount: number;
      currency?: string;
      description?: string;
      onPaymentComplete: (result: _unknown) => void;
      onPaymentCancelled: () => void;
    };
  };
}

interface ContactlessState {
  loading: boolean;
  processing: boolean;
  applePaySupported: boolean;
  googlePaySupported: boolean;
  errorMessage: string | null;
}

const SquareContactlessPaymentScreen: React.FC<SquareContactlessPaymentScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useTheme();
  const {
    amount,
    currency = 'GBP',
    description,
    onPaymentComplete,
    onPaymentCancelled,
  } = route.params;

  const [contactlessState, setContactlessState] = useState<ContactlessState>({
    loading: _true,
    processing: _false,
    applePaySupported: _false,
    googlePaySupported: _false,
    errorMessage: _null,
  });

  // Initialize contactless payment support
  useEffect(() => {
    initializeContactlessSupport();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', _handleBackPress);
    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeContactlessSupport = async () => {
    try {
      setContactlessState(prev => ({ ...prev, loading: true }));

      // Check Square service status
      const status = await SquareService.getIntegrationStatus();
      if (!status.isConfigured || !status.hasCredentials) {
        throw new Error('Square payment service not properly configured');
      }

      // Check device support for contactless payments
      const applePaySupported =
        Platform.OS === 'ios' && (await SquareService.isContactlessSupported('apple_pay'));
      const googlePaySupported =
        Platform.OS === 'android' && (await SquareService.isContactlessSupported('google_pay'));

      if (!applePaySupported && !googlePaySupported) {
        throw new Error('Contactless payments not supported on this device');
      }

      setContactlessState(prev => ({
        ...prev,
        loading: _false,
        applePaySupported,
        googlePaySupported,
        errorMessage: _null,
      }));
    } catch (__error) {
      setContactlessState(prev => ({
        ...prev,
        loading: _false,
        errorMessage:
          error instanceof Error ? error.message : 'Failed to initialize contactless payments',
      }));
    }
  };

  const _handleBackPress = useCallback(() => {
    if (contactlessState.processing) {
      Alert.alert(
        'Payment in Progress',
        'Please wait for the payment to complete before going back.',
        [{ text: 'OK' }],
      );
      return true;
    }
    handleCancelPayment();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactlessState.processing]);

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

  const processApplePayPayment = async () => {
    try {
      setContactlessState(prev => ({ ...prev, processing: _true, errorMessage: null }));

      // TODO: Implement Apple Pay when SDK is available
      // const applePayResult = await SQIPApplePay.requestApplePayNonce({
      //   price: amount.toString(),
      //   summaryLabel: description || 'Fynlo POS Payment',
      //   countryCode: 'GB',
      //   currencyCode: _currency,
      // });

      // Process payment with Square service
      const paymentResult = await SquareService.processContactlessPayment(
        amount,
        currency,
        'apple_pay',
        description,
      );

      if (paymentResult.status === 'completed') {
        onPaymentComplete({
          success: _true,
          paymentMethod: 'square_apple_pay',
          transactionId: paymentResult.id,
          amount: _amount,
          currency: _currency,
        });
        navigation.goBack();
      } else {
        setContactlessState(prev => ({
          ...prev,
          processing: _false,
          errorMessage: paymentResult.errorMessage || 'Apple Pay payment failed',
        }));
      }
    } catch (__error) {
      setContactlessState(prev => ({
        ...prev,
        processing: _false,
        errorMessage: error instanceof Error ? error.message : 'Apple Pay payment failed',
      }));
    }
  };

  const processGooglePayPayment = async () => {
    try {
      setContactlessState(prev => ({ ...prev, processing: _true, errorMessage: null }));

      // TODO: Implement Google Pay when SDK is available
      // const googlePayResult = await SQIPGooglePay.requestGooglePayNonce({
      //   price: amount.toString(),
      //   currencyCode: _currency,
      //   priceStatus: 'FINAL',
      // });

      // Process payment with Square service
      const paymentResult = await SquareService.processContactlessPayment(
        amount,
        currency,
        'google_pay',
        description,
      );

      if (paymentResult.status === 'completed') {
        onPaymentComplete({
          success: _true,
          paymentMethod: 'square_google_pay',
          transactionId: paymentResult.id,
          amount: _amount,
          currency: _currency,
        });
        navigation.goBack();
      } else {
        setContactlessState(prev => ({
          ...prev,
          processing: _false,
          errorMessage: paymentResult.errorMessage || 'Google Pay payment failed',
        }));
      }
    } catch (__error) {
      setContactlessState(prev => ({
        ...prev,
        processing: _false,
        errorMessage: error instanceof Error ? error.message : 'Google Pay payment failed',
      }));
    }
  };

  const handleFallbackToCard = () => {
    navigation.replace('SquareCardPayment', {
      amount,
      currency,
      description,
      onPaymentComplete,
      onPaymentCancelled,
    });
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

  const renderPaymentMethods = () => {
    if (!contactlessState.applePaySupported && !contactlessState.googlePaySupported) {
      return (
        <View style={styles.noSupportContainer}>
          <Text style={[styles.noSupportText, { color: theme.colors.textSecondary }]}>
            Contactless payments not supported on this device
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.paymentMethodsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Choose Payment Method
        </Text>

        {contactlessState.applePaySupported && (
          <Button
            title="Pay with Apple Pay"
            onPress={processApplePayPayment}
            disabled={contactlessState.processing}
            loading={contactlessState.processing}
            style={[styles.paymentMethodButton, { backgroundColor: '#000' }]}
            textStyle={{ color: '#fff' }}
            icon="🍎"
          />
        )}

        {contactlessState.googlePaySupported && (
          <Button
            title="Pay with Google Pay"
            onPress={processGooglePayPayment}
            disabled={contactlessState.processing}
            loading={contactlessState.processing}
            style={[styles.paymentMethodButton, { backgroundColor: '#4285F4' }]}
            textStyle={{ color: '#fff' }}
            icon="🔷"
          />
        )}

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>

        <Button
          title="Pay with Card"
          onPress={handleFallbackToCard}
          variant="outline"
          disabled={contactlessState.processing}
          style={styles.cardFallbackButton}
          icon="💳"
        />
      </View>
    );
  };

  const renderErrorMessage = () => {
    if (!contactlessState.errorMessage) {
      return null;
    }

    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '15' }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {contactlessState.errorMessage}
        </Text>
      </View>
    );
  };

  const renderSecurityInfo = () => (
    <View style={styles.securityInfo}>
      <Text style={[styles.securityText, { color: theme.colors.textSecondary }]}>
        🔒 Contactless payments are secured with device biometrics and Square's PCI-compliant
        infrastructure
      </Text>
    </View>
  );

  if (contactlessState.loading) {
    return (
      <View
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Checking Contactless Support
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Square Contactless Payment
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Use your device's contactless payment method
        </Text>
      </View>

      {/* Payment Information */}
      {renderPaymentInfo()}

      {/* Payment Methods */}
      {renderPaymentMethods()}

      {/* Error Message */}
      {renderErrorMessage()}

      {/* Security Info */}
      {renderSecurityInfo()}

      {/* Cancel Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Cancel Payment"
          onPress={handleCancelPayment}
          variant="outline"
          disabled={contactlessState.processing}
          style={styles.cancelButton}
        />
      </View>
    </View>
  );
};

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
  paymentMethodsContainer: {
    flex: 1,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentMethodButton: {
    height: 56,
    borderRadius: 12,
    marginBottom: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  cardFallbackButton: {
    height: 48,
    borderRadius: 12,
  },
  noSupportContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noSupportText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
    padding: 16,
  },
  cancelButton: {
    height: 48,
  },
});

export default SquareContactlessPaymentScreen;
