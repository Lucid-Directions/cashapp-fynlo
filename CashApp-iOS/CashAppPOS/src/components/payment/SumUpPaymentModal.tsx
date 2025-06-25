import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SumUpService from '../../services/SumUpService';

interface SumUpPaymentModalProps {
  visible: boolean;
  amount: number;
  currency?: string;
  title?: string;
  onClose: () => void;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

// Color scheme matching the app
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#FF3B30',
  text: '#333333',
  lightText: '#666666',
  white: '#FFFFFF',
  background: '#F5F5F5',
  border: '#DDDDDD',
};

const SumUpPaymentModal: React.FC<SumUpPaymentModalProps> = ({
  visible,
  amount,
  currency = 'GBP',
  title = 'Payment',
  onClose,
  onSuccess,
  onError,
}) => {
  const [processing, setProcessing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [merchantInfo, setMerchantInfo] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      checkSumUpStatus();
    }
  }, [visible]);

  const checkSumUpStatus = async () => {
    try {
      setCheckingStatus(true);
      
      // Check if SumUp is available
      if (!SumUpService.isAvailable()) {
        Alert.alert(
          'SumUp Not Available',
          'SumUp SDK is not properly configured. Please contact support.',
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }

      // Check login status
      const loggedIn = await SumUpService.isLoggedIn();
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        // Get merchant info
        const merchant = await SumUpService.getCurrentMerchant();
        setMerchantInfo(merchant);
      }
    } catch (error) {
      console.error('Failed to check SumUp status:', error);
      onError('Failed to initialize SumUp payment');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogin = async () => {
    try {
      setProcessing(true);
      const result = await SumUpService.presentLogin();
      
      if (result.success && result.isLoggedIn) {
        setIsLoggedIn(true);
        const merchant = await SumUpService.getCurrentMerchant();
        setMerchantInfo(merchant);
        Alert.alert('Login Successful', 'You are now logged in to SumUp.');
      } else if (result.cancelled) {
        // User cancelled login
      } else {
        Alert.alert('Login Failed', 'Failed to login to SumUp. Please try again.');
      }
    } catch (error) {
      console.error('SumUp login error:', error);
      Alert.alert('Login Error', 'An error occurred during login. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayment = async () => {
    try {
      setProcessing(true);

      if (!isLoggedIn) {
        Alert.alert('Not Logged In', 'Please login to SumUp first.');
        return;
      }

      const result = await SumUpService.processPayment({
        total: amount,
        currencyCode: currency,
        title,
        foreignTransactionId: `FYNLO-${Date.now()}`,
      });

      if (result.success) {
        onSuccess(result);
        onClose();
      } else {
        onError(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('SumUp payment error:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSettings = async () => {
    try {
      await SumUpService.presentCheckoutPreferences();
    } catch (error) {
      console.error('Failed to open settings:', error);
      Alert.alert('Settings Error', 'Failed to open SumUp settings.');
    }
  };

  if (checkingStatus) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Initializing SumUp...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Icon name="credit-card" size={24} color={Colors.primary} />
              <Text style={styles.title}>SumUp Payment</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Amount Display */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount to Charge</Text>
              <Text style={styles.amountValue}>
                {currency} {amount.toFixed(2)}
              </Text>
            </View>

            {/* Login Status */}
            <View style={styles.statusSection}>
              <View style={styles.statusRow}>
                <Icon 
                  name={isLoggedIn ? "check-circle" : "error"} 
                  size={20} 
                  color={isLoggedIn ? Colors.success : Colors.warning} 
                />
                <Text style={styles.statusText}>
                  {isLoggedIn ? 'Logged in to SumUp' : 'Not logged in'}
                </Text>
              </View>
              
              {merchantInfo && (
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantText}>
                    Merchant: {merchantInfo.merchantCode}
                  </Text>
                  <Text style={styles.merchantText}>
                    Currency: {merchantInfo.currency}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              {!isLoggedIn ? (
                <TouchableOpacity
                  style={[styles.button, styles.loginButton]}
                  onPress={handleLogin}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Icon name="login" size={20} color={Colors.white} />
                      <Text style={styles.buttonText}>Login to SumUp</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.settingsButton]}
                    onPress={handleSettings}
                    disabled={processing}
                  >
                    <Icon name="settings" size={20} color={Colors.text} />
                    <Text style={styles.settingsButtonText}>Settings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.paymentButton]}
                    onPress={handleProcessPayment}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Icon name="payment" size={20} color={Colors.white} />
                        <Text style={styles.buttonText}>Process Payment</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                Connect your SumUp card reader and follow the prompts on the device.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  merchantInfo: {
    marginLeft: 28,
    marginTop: 8,
  },
  merchantText: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  loginButton: {
    backgroundColor: Colors.primary,
  },
  settingsButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  infoSection: {
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default SumUpPaymentModal;