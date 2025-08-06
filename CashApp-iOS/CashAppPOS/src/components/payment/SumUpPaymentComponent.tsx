import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextStyle,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';
import type { InitPaymentSheetProps, InitPaymentSheetResult } from 'sumup-react-native-alpha';

import { useTheme } from '../../design-system/ThemeProvider';
import SumUpCompatibilityService from '../../services/SumUpCompatibilityService';
import sumUpConfigService from '../../services/SumUpConfigService';
import { logger } from '../../utils/logger';
import Modal from '../ui/Modal';

// Type guard for error objects
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Type guard for objects with message property
function hasMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

// Safe error message extraction
function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Helper function to ensure operations run on main thread
const runOnMainThread = (callback: () => void) => {
  if (typeof setImmediate !== 'undefined') {
    setImmediate(callback);
  } else {
    setTimeout(callback, 0);
  }
};

interface SumUpPaymentComponentProps {
  amount: number;
  currency: string;
  title: string;
  onPaymentComplete: (success: boolean, transactionCode?: string, error?: string) => void;
  onPaymentCancel: () => void;
}

// Payment status states
type PaymentStatus = 'initializing' | 'ready' | 'processing' | 'success' | 'failed' | 'cancelled';

// Inner component that uses the useSumUp hook
const SumUpPaymentSheet: React.FC<SumUpPaymentComponentProps> = ({
  amount,
  currency,
  title,
  onPaymentComplete,
  onPaymentCancel,
}) => {
  const { theme } = useTheme();
  const sumUpHooks = useSumUp();
  const { initPaymentSheet, presentPaymentSheet } = sumUpHooks;
  const [isInitialized, setIsInitialized] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState('Initializing payment...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  logger.info('🔧 SumUp hooks received:', {
    sumUpHooks,
    initPaymentSheet: typeof initPaymentSheet,
    presentPaymentSheet: typeof presentPaymentSheet,
  });

  useEffect(() => {
    logger.info('🔧 SumUpPaymentSheet useEffect triggered with:', { amount, currency, title });

    // Add a small delay to ensure SumUp provider is fully initialized
    const initTimer = setTimeout(() => {
      initializeSumUp();
    }, 100);

    return () => {
      if (initTimer) clearTimeout(initTimer);
    };
  }, [amount, currency, title]);

  const initializeSumUp = async () => {
    try {
      logger.info('🔧 Initializing SumUp payment sheet...', {
        amount,
        currency,
        title,
      });

      setPaymentStatus('initializing');
      setStatusMessage('Setting up payment terminal...');

      // Check SumUp compatibility first
      const compatibilityService = SumUpCompatibilityService.getInstance();
      const compatibility = await compatibilityService.checkCompatibility();

      if (!compatibility.isSupported) {
        logger.warn('⚠️ SumUp not supported:', compatibility.fallbackMessage);
        setPaymentStatus('failed');
        setErrorMessage(compatibility.fallbackMessage);
        runOnMainThread(() => {
          compatibilityService.showCompatibilityError(compatibility);
          onPaymentComplete(false, undefined, compatibility.fallbackMessage);
        });
        return;
      }

      // Check if useSumUp hook is properly initialized
      if (!initPaymentSheet || !presentPaymentSheet) {
        logger.error('❌ SumUp hooks not available:', {
          initPaymentSheet: !!initPaymentSheet,
          presentPaymentSheet: !!presentPaymentSheet,
          initPaymentSheetType: typeof initPaymentSheet,
          presentPaymentSheetType: typeof presentPaymentSheet,
        });

        setPaymentStatus('failed');
        setErrorMessage('Payment system not available');

        runOnMainThread(() => {
          Alert.alert(
            'SumUp Not Available',
            'SumUp payment system is not properly initialized. This is likely due to missing Apple entitlements for Tap to Pay on iPhone.\n\nPlease use an alternative payment method.',
            [
              {
                text: 'Use QR Payment',
                onPress: () =>
                  onPaymentComplete(false, undefined, 'SumUp unavailable - use alternative'),
              },
              { text: 'Cancel', onPress: () => onPaymentCancel() },
            ]
          );
        });
        return;
      }

      logger.info('🔧 Preparing SumUp payment with params:', { amount, currency, title });

      // Create the most basic params possible to test SumUp initialization
      const params: InitPaymentSheetProps = {
        amount: Number(amount),
        currencyCode: currency || 'GBP',
        tipAmount: 0,
        title: title || 'Payment',
        skipScreenOptions: false,
      };

      // Validate params before calling SumUp
      if (!params.amount || params.amount <= 0) {
        logger.error('❌ Invalid amount for SumUp payment:', params.amount);
        setPaymentStatus('failed');
        setErrorMessage('Invalid payment amount');
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, 'Invalid payment amount');
        });
        return;
      }

      logger.info('🔧 Calling initPaymentSheet with params:', params);
      const result: InitPaymentSheetResult = await initPaymentSheet(params);

      logger.info('🔧 InitPaymentSheet result:', result);

      if (result.error) {
        logger.error('❌ SumUp initialization failed:', result.error);
        setPaymentStatus('failed');
        setErrorMessage(result.error.message);
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, result.error.message);
        });
        return;
      }

      logger.info('✅ SumUp payment sheet initialized successfully');
      runOnMainThread(() => {
        setIsInitialized(true);
        setPaymentStatus('ready');
        setStatusMessage('Tap card or device to pay');
      });

      // Automatically present the payment sheet on main thread
      logger.info('🔧 About to call presentPayment...');
      runOnMainThread(() => {
        presentPayment();
      });
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logger.error('❌ SumUp initialization error:', errorMsg);
      setPaymentStatus('failed');
      setErrorMessage(errorMsg);
      runOnMainThread(() => {
        onPaymentComplete(false, undefined, errorMsg);
      });
    }
  };

  const presentPayment = async () => {
    try {
      logger.info('💳 presentPayment called, isInitialized:', isInitialized);

      if (!isInitialized) {
        logger.warn('⚠️ SumUp not initialized, cannot present payment sheet');
        return;
      }

      if (!presentPaymentSheet) {
        logger.error('❌ presentPaymentSheet function not available');
        setPaymentStatus('failed');
        setErrorMessage('Payment sheet not available');
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, 'presentPaymentSheet not available');
        });
        return;
      }

      setPaymentStatus('processing');
      setStatusMessage('Processing payment...');

      logger.info('💳 Presenting SumUp payment sheet...');
      const result = await presentPaymentSheet();

      logger.info('💳 PresentPaymentSheet result:', result);

      if (result.error) {
        logger.error('❌ Payment failed:', result.error);
        setPaymentStatus('failed');
        setErrorMessage(result.error.message);
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, result.error.message);
        });
        return;
      }

      if (result.paymentResult) {
        logger.info('✅ Payment successful:', result.paymentResult);
        setPaymentStatus('success');
        setStatusMessage('Payment successful!');
        runOnMainThread(() => {
          onPaymentComplete(true, result.paymentResult.transactionCode, undefined);
        });
      } else {
        logger.info('❌ Payment cancelled by user');
        setPaymentStatus('cancelled');
        setStatusMessage('Payment cancelled');
        runOnMainThread(() => {
          onPaymentCancel();
        });
      }
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logger.error('❌ Payment presentation error:', errorMsg);
      setPaymentStatus('failed');
      setErrorMessage(errorMsg);
      runOnMainThread(() => {
        onPaymentComplete(false, undefined, errorMsg);
      });
    }
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
    const formattedValue = value.toFixed(2);
    return symbol + formattedValue;
  };

  return (
    <Modal
      visible={true}
      onClose={handleCancel}
      title="SumUp Payment"
      size="md"
      position="center"
      closable={paymentStatus !== 'processing'}
      dismissOnBackdrop={false}
    >
      <View style={styles.container}>
        {/* Payment Amount Display */}
        <View style={[styles.amountContainer, { backgroundColor: theme.colors.neutral[50] }]}>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            Amount to Pay
          </Text>
          <Text style={[styles.amountValue, { color: theme.colors.text }]}>
            {formatAmount(amount)}
          </Text>
        </View>

        {/* Status Icon */}
        <View style={styles.iconContainer}>{getStatusIcon()}</View>

        {/* Status Message */}
        <View style={styles.messageContainer}>
          <Text
            style={[
              styles.statusMessage,
              {
                color: paymentStatus === 'failed' ? theme.colors.danger[500] : theme.colors.text,
                fontSize: theme.typography.fontSize.lg,
              },
            ]}
          >
            {statusMessage}
          </Text>

          {errorMessage && (
            <Text style={[styles.errorMessage, { color: theme.colors.danger[500] }]}>
              {errorMessage}
            </Text>
          )}

          {paymentStatus === 'ready' && (
            <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
              Present card or device to the payment terminal
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        {paymentStatus !== 'processing' && paymentStatus !== 'success' && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: theme.colors.neutral[100],
                  borderRadius: theme.borderRadius.lg,
                },
              ]}
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                {paymentStatus === 'failed' ? 'Close' : 'Cancel Payment'}
              </Text>
            </TouchableOpacity>

            {paymentStatus === 'failed' && (
              <TouchableOpacity
                style={[
                  styles.retryButton,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.borderRadius.lg,
                  },
                ]}
                onPress={initializeSumUp}
              >
                <Text style={[styles.buttonText, { color: theme.colors.white }]}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Processing Indicator */}
        {paymentStatus === 'processing' && (
          <View style={styles.processingContainer}>
            <Text style={[styles.processingText, { color: theme.colors.textSecondary }]}>
              Please wait while we process your payment...
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Main component that provides the SumUp context
const SumUpPaymentComponent: React.FC<SumUpPaymentComponentProps> = (props) => {
  const { theme } = useTheme();

  logger.info('🔧 SumUpPaymentComponent rendered with props:', {
    amount: props.amount,
    currency: props.currency,
    title: props.title,
  });

  // SumUp provider configuration - will be fetched from backend
  const [sumUpConfig, setSumUpConfig] = useState<{ appId: string; environment: string } | null>(
    null
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Fetch SumUp configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        logger.info('🔄 Fetching SumUp configuration from backend...');
        const config = await sumUpConfigService.fetchConfiguration();

        setSumUpConfig({
          appId: config.appId,
          environment: config.environment,
        });
        setIsLoadingConfig(false);
        logger.info('✅ SumUp configuration loaded successfully');
      } catch (error: unknown) {
        const errorMsg = getErrorMessage(error);
        logger.error('❌ Failed to fetch SumUp configuration:', errorMsg);
        setConfigError(errorMsg);
        setIsLoadingConfig(false);

        // Call the error callback
        runOnMainThread(() => {
          props.onPaymentComplete(false, undefined, 'Failed to load payment configuration');
        });
      }
    };

    fetchConfig();
  }, []);

  // Show loading state with proper UI
  if (isLoadingConfig) {
    logger.info('⏳ Waiting for SumUp configuration...');
    return (
      <Modal
        visible={true}
        onClose={props.onPaymentCancel}
        title="Loading Payment"
        size="sm"
        position="center"
        closable={true}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading payment configuration...
          </Text>
        </View>
      </Modal>
    );
  }

  // Show error state with proper UI
  if (configError || !sumUpConfig) {
    logger.error('❌ Cannot proceed without SumUp configuration:', configError);
    return (
      <Modal
        visible={true}
        onClose={props.onPaymentCancel}
        title="Configuration Error"
        size="sm"
        position="center"
        closable={true}
      >
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={theme.colors.danger[500]} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            Payment Configuration Error
          </Text>
          <Text style={[styles.errorDescription, { color: theme.colors.textSecondary }]}>
            {configError || 'Failed to load payment configuration'}
          </Text>
          <TouchableOpacity
            style={[
              styles.errorButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.lg,
              },
            ]}
            onPress={props.onPaymentCancel}
          >
            <Text style={[styles.buttonText, { color: theme.colors.white }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Wrap in error boundary for safer initialization
  try {
    // Note: The affiliateKey is now securely stored on the backend
    // and not exposed to the mobile app
    return (
      <SumUpProvider
        affiliateKey="" // Empty string as the SDK requires this prop but we don't use it
        sumUpAppId={sumUpConfig.appId}
      >
        <SumUpPaymentSheet {...props} />
      </SumUpProvider>
    );
  } catch (error) {
    logger.error('❌ SumUpProvider initialization failed:', error);
    // Fallback to show error to user
    runOnMainThread(() => {
      props.onPaymentComplete(false, undefined, 'SumUp provider initialization failed');
    });
    return (
      <Modal
        visible={true}
        onClose={props.onPaymentCancel}
        title="Initialization Error"
        size="sm"
        position="center"
        closable={true}
      >
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={theme.colors.danger[500]} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            Payment System Error
          </Text>
          <Text style={[styles.errorDescription, { color: theme.colors.textSecondary }]}>
            Failed to initialize payment system
          </Text>
          <TouchableOpacity
            style={[
              styles.errorButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.lg,
              },
            ]}
            onPress={props.onPaymentCancel}
          >
            <Text style={[styles.buttonText, { color: theme.colors.white }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }
};

interface Styles {
  container: ViewStyle;
  amountContainer: ViewStyle;
  amountLabel: TextStyle;
  amountValue: TextStyle;
  iconContainer: ViewStyle;
  messageContainer: ViewStyle;
  statusMessage: TextStyle;
  errorMessage: TextStyle;
  helpText: TextStyle;
  buttonContainer: ViewStyle;
  cancelButton: ViewStyle;
  retryButton: ViewStyle;
  buttonText: TextStyle;
  processingContainer: ViewStyle;
  processingText: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  errorContainer: ViewStyle;
  errorTitle: TextStyle;
  errorDescription: TextStyle;
  errorButton: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  amountContainer: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  iconContainer: {
    marginVertical: 30,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  retryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    marginTop: 20,
  },
  processingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  errorDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
});

export default SumUpPaymentComponent;
