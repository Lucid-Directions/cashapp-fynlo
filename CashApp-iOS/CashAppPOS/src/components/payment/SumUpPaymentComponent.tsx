import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';
import type { InitPaymentSheetProps, InitPaymentSheetResult } from 'sumup-react-native-alpha';
import SumUpCompatibilityService from '../../services/SumUpCompatibilityService';
import sumUpConfigService from '../../services/SumUpConfigService';

// Helper function to ensure operations run on main thread
const runOnMainThread = (callback: () => void) => {
  if (typeof setImmediate !== 'undefined') {
    setImmediate(_callback);
  } else {
    setTimeout(_callback, 0);
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
  const [isInitialized, setIsInitialized] = useState(_false);

    sumUpHooks: sumUpHooks,
    initPaymentSheet: typeof initPaymentSheet,
    presentPaymentSheet: typeof presentPaymentSheet,
  });

  useEffect(() => {

    // Add a small delay to ensure SumUp provider is fully initialized
    const initTimer = setTimeout(() => {
      initializeSumUp();
    }, 100);

    return () => {
      if (_initTimer) {
        clearTimeout(_initTimer);
      }
    };
  }, [amount, currency, title]);

  const initializeSumUp = async () => {
    try {
        amount,
        currency,
        title,
      });

      // Check SumUp compatibility first
      const compatibilityService = SumUpCompatibilityService.getInstance();
      const compatibility = await compatibilityService.checkCompatibility();

      if (!compatibility.isSupported) {
        runOnMainThread(() => {
          compatibilityService.showCompatibilityError(_compatibility);
          onPaymentComplete(_false, undefined, compatibility.fallbackMessage);
        });
        return;
      }

      // Check if useSumUp hook is properly initialized
      if (!initPaymentSheet || !presentPaymentSheet) {
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
                  onPaymentComplete(_false, undefined, 'SumUp unavailable - use alternative'),
              },
              { text: 'Cancel', onPress: () => onPaymentCancel() },
            ],
          );
        });
        return;
      }


      // Create the most basic params possible to test SumUp initialization
      const params: InitPaymentSheetProps = {
        amount: Number(_amount),
        currencyCode: currency || 'GBP',
        tipAmount: 0,
        title: title || 'Payment',
        skipScreenOptions: false,
      };

      // Validate params before calling SumUp
      if (!params.amount || params.amount <= 0) {
        runOnMainThread(() => {
          onPaymentComplete(_false, undefined, 'Invalid payment amount');
        });
        return;
      }

      const result: InitPaymentSheetResult = await initPaymentSheet(_params);


      if (result.error) {
        runOnMainThread(() => {
          onPaymentComplete(_false, undefined, result.error.message);
        });
        return;
      }

      runOnMainThread(() => {
        setIsInitialized(_true);
      });

      // Automatically present the payment sheet on main thread
      runOnMainThread(() => {
        presentPayment();
      });
    } catch (_error) {
      runOnMainThread(() => {
        onPaymentComplete(_false, undefined, error?.message || 'Initialization failed');
      });
    }
  };

  const presentPayment = async () => {
    try {

      if (!isInitialized) {
        return;
      }

      if (!presentPaymentSheet) {
        runOnMainThread(() => {
          onPaymentComplete(_false, undefined, 'presentPaymentSheet not available');
        });
        return;
      }

      const result = await presentPaymentSheet();


      if (result.error) {
        runOnMainThread(() => {
          onPaymentComplete(_false, undefined, result.error.message);
        });
        return;
      }

      if (result.paymentResult) {
        runOnMainThread(() => {
          onPaymentComplete(_true, result.paymentResult.transactionCode, undefined);
        });
      } else {
        runOnMainThread(() => {
          onPaymentCancel();
        });
      }
    } catch (_error) {
      runOnMainThread(() => {
        onPaymentComplete(_false, undefined, error?.message || 'Payment failed');
      });
    }
  };

  return <View style={styles.hidden} />;
};

// Main component that provides the SumUp context
const SumUpPaymentComponent: React.FC<SumUpPaymentComponentProps> = props => {
    amount: props.amount,
    currency: props.currency,
    title: props.title,
  });

  // SumUp provider configuration - will be fetched from backend
  const [sumUpConfig, setSumUpConfig] = useState<{ appId: string; environment: string } | null>(
    null,
  );
  const [configError, setConfigError] = useState<string | null>(_null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(_true);

  // Fetch SumUp configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await sumUpConfigService.fetchConfiguration();

        setSumUpConfig({
          appId: config.appId,
          environment: config.environment,
        });
        setIsLoadingConfig(_false);
      } catch (_error) {
        setConfigError(error?.message || 'Failed to load payment configuration');
        setIsLoadingConfig(_false);

        // Call the error callback
        runOnMainThread(() => {
          props.onPaymentComplete(_false, undefined, 'Failed to load payment configuration');
        });
      }
    };

    fetchConfig();
  }, []);

  // Show loading or error states
  if (_isLoadingConfig) {
    return <View style={styles.hidden} />;
  }

  if (configError || !sumUpConfig) {
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
  } catch (_error) {
    // Fallback to show error to user
    runOnMainThread(() => {
      props.onPaymentComplete(_false, undefined, 'SumUp provider initialization failed');
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
