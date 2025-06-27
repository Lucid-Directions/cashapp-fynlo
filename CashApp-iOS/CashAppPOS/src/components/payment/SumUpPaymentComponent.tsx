import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';
import type { InitPaymentSheetProps, InitPaymentSheetResult } from 'sumup-react-native-alpha';

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
  const { initPaymentSheet, presentPaymentSheet } = useSumUp();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeSumUp();
  }, [amount, currency, title]);

  const initializeSumUp = async () => {
    try {
      console.log('🔧 Initializing SumUp payment sheet...', {
        amount,
        currency,
        title,
      });

      const params: InitPaymentSheetProps = {
        amount,
        currencyCode: currency,
        tipAmount: 0,
        title: title,
        skipScreenOptions: false,
        language: 'en', // English language
        // Add other required parameters based on the package documentation
      };

      const result: InitPaymentSheetResult = await initPaymentSheet(params);
      
      if (result.error) {
        console.error('❌ SumUp initialization failed:', result.error);
        onPaymentComplete(false, undefined, result.error.message);
        return;
      }

      console.log('✅ SumUp payment sheet initialized successfully');
      setIsInitialized(true);
      
      // Automatically present the payment sheet
      presentPayment();
    } catch (error) {
      console.error('❌ SumUp initialization error:', error);
      onPaymentComplete(false, undefined, error?.message || 'Initialization failed');
    }
  };

  const presentPayment = async () => {
    try {
      if (!isInitialized) {
        console.warn('⚠️ SumUp not initialized, cannot present payment sheet');
        return;
      }

      console.log('💳 Presenting SumUp payment sheet...');
      const result = await presentPaymentSheet();

      if (result.error) {
        console.error('❌ Payment failed:', result.error);
        onPaymentComplete(false, undefined, result.error.message);
        return;
      }

      if (result.paymentResult) {
        console.log('✅ Payment successful:', result.paymentResult);
        onPaymentComplete(
          true, 
          result.paymentResult.transactionCode,
          undefined
        );
      } else {
        console.log('❌ Payment cancelled by user');
        onPaymentCancel();
      }
    } catch (error) {
      console.error('❌ Payment presentation error:', error);
      onPaymentComplete(false, undefined, error?.message || 'Payment failed');
    }
  };

  return <View style={styles.hidden} />;
};

// Main component that provides the SumUp context
const SumUpPaymentComponent: React.FC<SumUpPaymentComponentProps> = (props) => {
  return (
    <SumUpProvider
      affiliateKey="sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"
      sumUpAppId="com.anonymous.cashapppos"
    >
      <SumUpPaymentSheet {...props} />
    </SumUpProvider>
  );
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