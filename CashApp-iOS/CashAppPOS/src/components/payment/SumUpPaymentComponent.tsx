import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';
import type { InitPaymentSheetProps, InitPaymentSheetResult } from 'sumup-react-native-alpha';
import SumUpCompatibilityService from '../../services/SumUpCompatibilityService';
import sumUpConfigService from '../../services/SumUpConfigService';

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

// Inner component that uses the useSumUp hook
const SumUpPaymentSheet: React.FC<SumUpPaymentComponentProps> = ({
  amount,
  currency,
  title,
  onPaymentComplete,
  onPaymentCancel,
}) => {
  const sumUpHooks = useSumUp();
  const { initPaymentSheet, presentPaymentSheet } = sumUpHooks;
  const [isInitialized, setIsInitialized] = useState(false);

  console.log('🔧 SumUp hooks received:', {
    sumUpHooks: sumUpHooks,
    initPaymentSheet: typeof initPaymentSheet,
    presentPaymentSheet: typeof presentPaymentSheet,
  });

  useEffect(() => {
    console.log('🔧 SumUpPaymentSheet useEffect triggered with:', { amount, currency, title });

    // Add a small delay to ensure SumUp provider is fully initialized
    const initTimer = setTimeout(() => {
      initializeSumUp();
    }, 100);

    return () => {
      if (initTimer) {
        clearTimeout(initTimer);
      }
    };
  }, [amount, currency, title]);

  const initializeSumUp = async () => {
    try {
      console.log('🔧 Initializing SumUp payment sheet...', {
        amount,
        currency,
        title,
      });

      // Check SumUp compatibility first
      const compatibilityService = SumUpCompatibilityService.getInstance();
      const compatibility = await compatibilityService.checkCompatibility();

      if (!compatibility.isSupported) {
        console.warn('⚠️ SumUp not supported:', compatibility.fallbackMessage);
        runOnMainThread(() => {
          compatibilityService.showCompatibilityError(compatibility);
          onPaymentComplete(false, undefined, compatibility.fallbackMessage);
        });
        return;
      }

      // Check if useSumUp hook is properly initialized
      if (!initPaymentSheet || !presentPaymentSheet) {
        console.error('❌ SumUp hooks not available:', {
          initPaymentSheet: !!initPaymentSheet,
          presentPaymentSheet: !!presentPaymentSheet,
          initPaymentSheetType: typeof initPaymentSheet,
          presentPaymentSheetType: typeof presentPaymentSheet,
        });
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
            ],
          );
        });
        return;
      }

      console.log('🔧 Preparing SumUp payment with params:', { amount, currency, title });

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
        console.error('❌ Invalid amount for SumUp payment:', params.amount);
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, 'Invalid payment amount');
        });
        return;
      }

      console.log('🔧 Calling initPaymentSheet with params:', params);
      const result: InitPaymentSheetResult = await initPaymentSheet(params);

      console.log('🔧 InitPaymentSheet result:', result);

      if (result.error) {
        console.error('❌ SumUp initialization failed:', result.error);
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, result.error.message);
        });
        return;
      }

      console.log('✅ SumUp payment sheet initialized successfully');
      runOnMainThread(() => {
        setIsInitialized(true);
      });

      // Automatically present the payment sheet on main thread
      console.log('🔧 About to call presentPayment...');
      runOnMainThread(() => {
        presentPayment();
      });
    } catch (error) {
      console.error('❌ SumUp initialization error:', error);
      runOnMainThread(() => {
        onPaymentComplete(false, undefined, error?.message || 'Initialization failed');
      });
    }
  };

  const presentPayment = async () => {
    try {
      console.log('💳 presentPayment called, isInitialized:', isInitialized);

      if (!isInitialized) {
        console.warn('⚠️ SumUp not initialized, cannot present payment sheet');
        return;
      }

      if (!presentPaymentSheet) {
        console.error('❌ presentPaymentSheet function not available');
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, 'presentPaymentSheet not available');
        });
        return;
      }

      console.log('💳 Presenting SumUp payment sheet...');
      const result = await presentPaymentSheet();

      console.log('💳 PresentPaymentSheet result:', result);

      if (result.error) {
        console.error('❌ Payment failed:', result.error);
        runOnMainThread(() => {
          onPaymentComplete(false, undefined, result.error.message);
        });
        return;
      }

      if (result.paymentResult) {
        console.log('✅ Payment successful:', result.paymentResult);
        runOnMainThread(() => {
          onPaymentComplete(true, result.paymentResult.transactionCode, undefined);
        });
      } else {
        console.log('❌ Payment cancelled by user');
        runOnMainThread(() => {
          onPaymentCancel();
        });
      }
    } catch (error) {
      console.error('❌ Payment presentation error:', error);
      runOnMainThread(() => {
        onPaymentComplete(false, undefined, error?.message || 'Payment failed');
      });
    }
  };

  return <View style={styles.hidden} />;
};

// Main component that provides the SumUp context
const SumUpPaymentComponent: React.FC<SumUpPaymentComponentProps> = props => {
  console.log('🔧 SumUpPaymentComponent rendered with props:', {
    amount: props.amount,
    currency: props.currency,
    title: props.title,
  });

  // SumUp provider configuration - will be fetched from backend
  const [sumUpConfig, setSumUpConfig] = useState<{ appId: string; environment: string } | null>(
    null,
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Fetch SumUp configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('🔄 Fetching SumUp configuration from backend...');
        const config = await sumUpConfigService.fetchConfiguration();

        setSumUpConfig({
          appId: config.appId,
          environment: config.environment,
        });
        setIsLoadingConfig(false);
        console.log('✅ SumUp configuration loaded successfully');
      } catch (error) {
        console.error('❌ Failed to fetch SumUp configuration:', error);
        setConfigError(error?.message || 'Failed to load payment configuration');
        setIsLoadingConfig(false);

        // Call the error callback
        runOnMainThread(() => {
          props.onPaymentComplete(false, undefined, 'Failed to load payment configuration');
        });
      }
    };

    fetchConfig();
  }, []);

  // Show loading or error states
  if (isLoadingConfig) {
    console.log('⏳ Waiting for SumUp configuration...');
    return <View style={styles.hidden} />;
  }

  if (configError || !sumUpConfig) {
    console.error('❌ Cannot proceed without SumUp configuration:', configError);
    return <View style={styles.hidden} />;
  }

  // Wrap in error boundary for safer initialization
  try {
    // Note: The affiliateKey is now securely stored on the backend
    // and not exposed to the mobile app
    return (
      <SumUpProvider
        affiliateKey="" // Empty string as the SDK requires this prop but we don't use it
        sumUpAppId={sumUpConfig.appId}>
        <SumUpPaymentSheet {...props} />
      </SumUpProvider>
    );
  } catch (error) {
    console.error('❌ SumUpProvider initialization failed:', error);
    // Fallback to show error to user
    runOnMainThread(() => {
      props.onPaymentComplete(false, undefined, 'SumUp provider initialization failed');
    });
    return <View style={styles.hidden} />;
  }
};

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -1000,
    top: -1000,
    width: 1,
    height: 1,
  },
});

export default SumUpPaymentComponent;
