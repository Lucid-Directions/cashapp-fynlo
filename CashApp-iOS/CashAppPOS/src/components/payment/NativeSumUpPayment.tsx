/**
 * NativeSumUpPayment - Direct native SumUp SDK implementation
 * 
 * This component bypasses the problematic sumup-react-native-alpha package
 * and uses the native iOS SumUp SDK directly through our bridge.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import NativeSumUpService from '../../services/NativeSumUpService';
import sumUpConfigService from '../../services/SumUpConfigService';
import { logger } from '../../utils/logger';

interface NativeSumUpPaymentProps {
  amount: number;
  currency: string;
  title: string;
  visible: boolean;
  onPaymentComplete: (success: boolean, transactionCode?: string, error?: string) => void;
  onPaymentCancel: () => void;
  useTapToPay?: boolean;
}

type PaymentStatus = 'initializing' | 'ready' | 'processing' | 'success' | 'failed' | 'cancelled';

const NativeSumUpPayment: React.FC<NativeSumUpPaymentProps> = ({
  amount,
  currency,
  title,
  visible,
  onPaymentComplete,
  onPaymentCancel,
  useTapToPay = true,
}) => {
  const { theme } = useTheme();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState('Initializing payment...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tapToPayAvailable, setTapToPayAvailable] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (visible) {
      initializePayment();
    }
  }, [visible]);

  const initializePayment = async () => {
    try {
      logger.info('🔧 Initializing native SumUp payment');
      setPaymentStatus('initializing');
      setStatusMessage('Setting up payment...');

      // Check if native module is available
      if (!NativeSumUpService.isAvailable()) {
        throw new Error('SumUp native module not available on this device');
      }

      // Get API key from config - try to fetch from backend first
      let config = await sumUpConfigService.initializeAndGetConfig();
      let apiKey = config.affiliateKey;
      
      // If no key from backend, try cached config
      if (!apiKey) {
        config = sumUpConfigService.getConfig();
        apiKey = config.affiliateKey;
      }

      if (!apiKey) {
        logger.error('❌ No SumUp API key available - backend configuration required');
        throw new Error('SumUp configuration not available. Please ensure backend is accessible and properly configured.');
      }
      
      // Never log API keys, even partially - security vulnerability
      logger.info('🔑 SumUp API key loaded from configuration');

      // Setup SDK if needed
      if (!NativeSumUpService.isSDKSetup()) {
        logger.info('🔧 Setting up SumUp SDK');
        await NativeSumUpService.setupSDK(apiKey);
      }

      // Check login status
      const loggedIn = await NativeSumUpService.isLoggedIn();
      setIsLoggedIn(loggedIn);

      if (!loggedIn) {
        logger.info('🔐 User not logged in, presenting login');
        const loginSuccess = await NativeSumUpService.presentLogin();
        if (!loginSuccess) {
          throw new Error('Login failed or was cancelled');
        }
        setIsLoggedIn(true);
      }

      // Check Tap to Pay availability if requested (SumUp SDK v6.0 best practice)
      if (useTapToPay) {
        const tapToPayStatus = await NativeSumUpService.checkTapToPayAvailability();
        logger.info('📱 Tap to Pay status:', tapToPayStatus);
        
        if (!tapToPayStatus.isAvailable) {
          // Tap to Pay not available on this device/merchant
          throw new Error('Tap to Pay on iPhone is not available. This device may not support it or it may not be enabled for your merchant account.');
        }
        
        if (!tapToPayStatus.isActivated) {
          logger.info('📱 Tap to Pay available but not activated, presenting activation');
          setStatusMessage('Please complete Tap to Pay activation...');
          const activationSuccess = await NativeSumUpService.presentTapToPayActivation();
          if (!activationSuccess) {
            throw new Error('Tap to Pay activation was cancelled or failed. Please try again.');
          }
          setTapToPayAvailable(true);
        } else {
          // Tap to Pay is available and activated
          setTapToPayAvailable(true);
          logger.info('✅ Tap to Pay is ready to use');
        }
      }

      setPaymentStatus('ready');
      setStatusMessage('Ready to process payment');

      // Automatically start payment
      await processPayment();
    } catch (error) {
      logger.error('❌ Payment initialization failed:', error);
      setPaymentStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Payment initialization failed');
      setStatusMessage('Failed to initialize payment');
    }
  };

  const processPayment = async () => {
    try {
      logger.info('💳 Processing Tap to Pay payment:', { amount, currency, title, useTapToPay });
      setPaymentStatus('processing');
      setStatusMessage(useTapToPay && tapToPayAvailable 
        ? 'Hold card or device near the top of your iPhone...' 
        : 'Processing payment...');

      const result = await NativeSumUpService.performCheckout(
        amount,
        currency,
        title,
        useTapToPay && tapToPayAvailable
      );

      if (result.success) {
        logger.info('✅ Payment successful:', result);
        setPaymentStatus('success');
        setStatusMessage('Payment successful!');
        
        // Small delay to show success state
        setTimeout(() => {
          onPaymentComplete(true, result.transactionCode);
        }, 1500);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      logger.error('❌ Payment processing failed:', error);
      setPaymentStatus('failed');
      const errorMsg = error instanceof Error ? error.message : 'Payment processing failed';
      setErrorMessage(errorMsg);
      setStatusMessage('Payment failed');
      
      // Check if it was cancelled
      if (errorMsg.toLowerCase().includes('cancel')) {
        setPaymentStatus('cancelled');
        setStatusMessage('Payment cancelled');
        onPaymentCancel();
      } else {
        onPaymentComplete(false, undefined, errorMsg);
      }
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    initializePayment();
  };

  const handleCancel = () => {
    logger.info('User cancelled payment');
    setPaymentStatus('cancelled');
    onPaymentCancel();
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <Icon name="check-circle" size={64} color={theme.colors.success} />;
      case 'failed':
        return <Icon name="error" size={64} color={theme.colors.danger[500]} />;
      case 'cancelled':
        return <Icon name="cancel" size={64} color={theme.colors.warning[500]} />;
      case 'processing':
        return <ActivityIndicator size="large" color={theme.colors.primary} />;
      default:
        return <Icon name="tap-and-play" size={64} color={theme.colors.primary} />;
    }
  };

  const formatAmount = (value: number) => {
    const symbol =
      currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    return `${symbol}${value.toFixed(2)}`;
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {paymentStatus === 'processing' && useTapToPay && tapToPayAvailable
              ? 'Tap to Pay'
              : 'SumUp Payment'}
          </Text>
        </View>

        <View style={styles.content}>
          {getStatusIcon()}

          <Text style={[styles.amount, { color: theme.colors.primary }]}>
            {formatAmount(amount)}
          </Text>

          <Text style={[styles.status, { color: theme.colors.textSecondary }]}>
            {statusMessage}
          </Text>

          {errorMessage && (
            <Text style={[styles.error, { color: theme.colors.danger[500] }]}>
              {errorMessage}
            </Text>
          )}

          {paymentStatus === 'processing' && useTapToPay && tapToPayAvailable && (
            <View style={styles.tapInstructions}>
              <Icon name="contactless-payment" size={48} color={theme.colors.primary} />
              <Text style={[styles.instructionText, { color: theme.colors.textSecondary }]}>
                Hold customer's card or device near the top of your iPhone
              </Text>
              <View style={styles.paymentAnimation}>
                <Icon name="credit-card" size={32} color={theme.colors.primary} />
                <Icon name="arrow-downward" size={20} color={theme.colors.textSecondary} />
                <Icon name="phone-iphone" size={32} color={theme.colors.text} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {paymentStatus === 'failed' && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={[styles.buttonText, { color: theme.colors.background }]}>Retry</Text>
            </TouchableOpacity>
          )}

          {(paymentStatus === 'initializing' || paymentStatus === 'ready') && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === 'ios' && !isLoggedIn && (
          <TouchableOpacity
            style={[styles.loginHint, { backgroundColor: theme.colors.info[100] }]}
            onPress={async () => {
              try {
                logger.info('🔐 User tapped login hint');
                const loginSuccess = await NativeSumUpService.presentLogin();
                if (loginSuccess) {
                  logger.info('✅ Login successful from hint');
                  setIsLoggedIn(true);
                  // Retry payment initialization after successful login
                  initializePayment();
                } else {
                  logger.warn('⚠️ Login was cancelled or failed');
                }
              } catch (error) {
                logger.error('❌ Login error from hint:', error);
                Alert.alert(
                  'Login Failed',
                  'Unable to complete login. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Icon name="info" size={20} color={theme.colors.info[700]} />
            <Text style={[styles.loginHintText, { color: theme.colors.info[700] }]}>
              Tap here to login to SumUp
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: 30,
    alignItems: 'center',
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  tapInstructions: {
    marginTop: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  loginHintText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  paymentAnimation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
});

export default NativeSumUpPayment;