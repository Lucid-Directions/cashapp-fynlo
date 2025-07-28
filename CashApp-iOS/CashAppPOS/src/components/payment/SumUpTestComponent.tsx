import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';

interface SumUpTestProps {
  onResult: (message: string) => void;
}

const SumUpTestInner: React.FC<SumUpTestProps> = ({ onResult }) => {
  const sumUpHooks = useSumUp();
  
  useEffect(() => {
    console.log('🧪 SumUp Test - Hooks available:', {
      hasHooks: !!sumUpHooks,
      initPaymentSheet: typeof sumUpHooks?.initPaymentSheet,
      presentPaymentSheet: typeof sumUpHooks?.presentPaymentSheet,
    });
    
    if (sumUpHooks?.initPaymentSheet && sumUpHooks?.presentPaymentSheet) {
      onResult('✅ SumUp hooks are available and working');
    } else {
      onResult('❌ SumUp hooks are missing or not working');
    }
  }, [sumUpHooks]);

  const testSumUpInit = async () => {
    try {
      if (!sumUpHooks?.initPaymentSheet) {
        Alert.alert('Error', 'SumUp initPaymentSheet not available');
        return;
      }

      console.log('🧪 Testing SumUp initialization...');
      
      const result = await sumUpHooks.initPaymentSheet({
        amount: 1.00,
        currencyCode: 'GBP',
        tipAmount: 0,
        title: 'Test Payment',
        skipScreenOptions: false,
      });

      console.log('🧪 SumUp init result:', result);
      
      if (result.error) {
        Alert.alert('SumUp Init Failed', result.error.message);
        onResult(`❌ Init failed: ${result.error.message}`);
      } else {
        Alert.alert('Success', 'SumUp initialized successfully!');
        onResult('✅ SumUp initialization successful');
      }
    } catch (error) {
      console.error('🧪 SumUp test error:', error);
      Alert.alert('Test Error', error?.toString() || 'Unknown error');
      onResult(`❌ Test error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SumUp SDK Test</Text>
      
      <TouchableOpacity style={styles.testButton} onPress={testSumUpInit}>
        <Text style={styles.buttonText}>Test SumUp Initialization</Text>
      </TouchableOpacity>
      
      <Text style={styles.info}>
        This will test if SumUp SDK is properly configured without actually presenting the payment sheet.
      </Text>
    </View>
  );
};

const SumUpTestComponent: React.FC<SumUpTestProps> = (props) => {
  return (
    <SumUpProvider
      affiliateKey="sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"
      sumUpAppId="com.anonymous.cashapppos"
    >
      <SumUpTestInner {...props} />
    </SumUpProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SumUpTestComponent;