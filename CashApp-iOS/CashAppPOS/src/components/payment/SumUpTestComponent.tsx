import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SumUpProvider, useSumUp } from 'sumup-react-native-alpha';
import sumUpConfigService from '../../services/SumUpConfigService';

interface SumUpTestProps {
  onResult: (message: string) => void;
}

const SumUpTestInner: React.FC<SumUpTestProps> = ({ onResult }) => {
  const sumUpHooks = useSumUp();

  useEffect(() => {
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


      const result = await sumUpHooks.initPaymentSheet({
        amount: 1.0,
        currencyCode: 'GBP',
        tipAmount: 0,
        title: 'Test Payment',
        skipScreenOptions: false,
      });


      if (result.error) {
        Alert.alert('SumUp Init Failed', result.error.message);
        onResult(`❌ Init failed: ${result.error.message}`);
      } else {
        Alert.alert('Success', 'SumUp initialized successfully!');
        onResult('✅ SumUp initialization successful');
      }
    } catch (_error) {
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
        This will test if SumUp SDK is properly configured without actually presenting the payment
        sheet.
      </Text>
    </View>
  );
};

const SumUpTestComponent: React.FC<SumUpTestProps> = props => {
  const [sumUpConfig, setSumUpConfig] = useState<{ appId: string; environment: string } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(_true);
  const [error, setError] = useState<string | null>(_null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await sumUpConfigService.fetchConfiguration();
        setSumUpConfig({
          appId: config.appId,
          environment: config.environment,
        });
        setIsLoading(_false);
      } catch (_err) {
        setError(err?.message || 'Failed to load configuration');
        setIsLoading(_false);
        props.onResult('❌ Failed to load SumUp configuration');
      }
    };

    fetchConfig();
  }, []);

  if (_isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.info}>Loading SumUp configuration...</Text>
      </View>
    );
  }

  if (error || !sumUpConfig) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>SumUp Configuration Error</Text>
        <Text style={styles.info}>{error || 'Configuration not available'}</Text>
      </View>
    );
  }

  return (
    <SumUpProvider
      affiliateKey="" // Empty string as the SDK requires this prop but we don't use it
      sumUpAppId={sumUpConfig.appId}>
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
