import React, { useState, useEffect, useRef } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';

import QRPaymentErrorBoundary from '../../components/payment/QRPaymentErrorBoundary';
import { useTheme } from '../../design-system/ThemeProvider';
import SumUpService from '../../services/SumUpService';

import type { SumUpQRPayment } from '../../services/SumUpService';
import type { RouteProp } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

type QRCodePaymentRouteProp = RouteProp<
  {
    QRCodePayment: {
      amount: number;
      currency: string;
      description?: string;
      onSuccess: (payment: SumUpQRPayment) => void;
      onCancel: () => void;
    };
  },
  'QRCodePayment'
>;

const QRCodePaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<QRCodePaymentRouteProp>();
  const { theme } = useTheme();

  const { amount, currency, description, onSuccess, onCancel } = route.params;

  const [qrPayment, setQrPayment] = useState<SumUpQRPayment | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    'loading' | 'waiting' | 'scanning' | 'completed' | 'expired' | 'failed'
  >('loading');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    initializeQRPayment();

    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      // Clean up all timers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const initializeQRPayment = async () => {
    try {
      // Check if component is still mounted
      if (!isMountedRef.current) return;

      setPaymentStatus('loading');
      setErrorMessage('');

      const payment = await SumUpService.createQRPayment(amount, currency, description);

      // Ensure component is still mounted before updating state
      if (!isMountedRef.current) return;

      setQrPayment(payment);
      setPaymentStatus('waiting');

      // Calculate time remaining until expiration
      const expiresAt = new Date(payment.expiresAt);
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(timeLeft);

      // Start countdown timer
      startCountdownTimer(timeLeft);

      // Start polling for payment status
      startStatusPolling(payment);
    } catch (error) {
      console.error('❌ QR Payment initialization failed:', error);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setPaymentStatus('failed');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to create QR payment');
      }
    }
  };

  const startCountdownTimer = (initialTime: number) => {
    let timeLeft = initialTime;

    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      // Check if component is still mounted
      if (!isMountedRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      timeLeft -= 1;
      setTimeRemaining(timeLeft);

      if (timeLeft <= 0) {
        setPaymentStatus('expired');

        // Clean up intervals
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);
  };

  const startStatusPolling = (payment: SumUpQRPayment) => {
    // Clear any existing polling first
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        // Check if component is still mounted
        if (!isMountedRef.current) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }

        const updatedPayment = await SumUpService.pollQRPaymentStatus(payment);

        // Double-check if component is still mounted before state updates
        if (!isMountedRef.current) return;

        setQrPayment(updatedPayment);
        setPaymentStatus(updatedPayment.status);

        if (updatedPayment.status === 'completed') {
          // Payment successful - clean up intervals
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          setTimeout(() => {
            // Final check before calling callbacks
            if (isMountedRef.current) {
              onSuccess(updatedPayment);
              navigation.goBack();
            }
          }, 2000);
        } else if (updatedPayment.status === 'failed' || updatedPayment.status === 'expired') {
          // Payment failed or expired - clean up intervals
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (error) {
        console.error('❌ Failed to poll QR payment status:', error);

        // Only update state if mounted
        if (isMountedRef.current) {
          setErrorMessage('Failed to check payment status');
        }
      }
    }, payment.pollInterval || 2000);
  };

  const handleCancel = () => {
    Alert.alert('Cancel Payment', 'Are you sure you want to cancel this payment?', [
      { text: 'Continue', style: 'cancel' },
      {
        text: 'Cancel Payment',
        style: 'destructive',
        onPress: () => {
          // Clean up all timers
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Mark as unmounted to prevent further state updates
          isMountedRef.current = false;

          onCancel();
          navigation.goBack();
        },
      },
    ]);
  };

  const handleRetry = () => {
    try {
      // Clean up existing timers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Reset error state
      setErrorMessage('');

      // Reinitialize payment
      initializeQRPayment();
    } catch (error) {
      console.error('❌ Failed to retry QR payment:', error);
      setErrorMessage('Failed to retry payment. Please try again.');
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'loading':
        return 'Generating QR code...';
      case 'waiting':
        return 'Scan with your banking app';
      case 'scanning':
        return 'Customer scanning QR code...';
      case 'completed':
        return 'Payment successful!';
      case 'expired':
        return 'QR code expired';
      case 'failed':
        return errorMessage || 'Payment failed';
      default:
        return 'Ready for payment';
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'completed':
        return '#4CAF50';
      case 'failed':
      case 'expired':
        return '#F44336';
      case 'scanning':
        return '#FF9800';
      default:
        return theme.colors.primary;
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      padding: 20,
    },
    amountContainer: {
      alignItems: 'center',
      marginBottom: 30,
    },
    amountLabel: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    amount: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    qrContainer: {
      alignItems: 'center',
      padding: 20,
      borderRadius: 16,
      marginBottom: 30,
      ...require('../../utils/ShadowUtils').createOptimizedShadow('medium', 'white'),
    },
    loadingContainer: {
      width: 200,
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    statusIcon: {
      marginBottom: 10,
    },
    statusMessage: {
      fontSize: 18,
      textAlign: 'center',
      color: theme.colors.text,
      marginBottom: 10,
    },
    instructions: {
      fontSize: 14,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 20,
    },
    timerIcon: {
      marginRight: 8,
    },
    timerText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    buttonContainer: {
      padding: 20,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <QRPaymentErrorBoundary
      onReset={() => {
        // Reset component state and retry QR generation
        setPaymentStatus('loading');
        setErrorMessage('');
        setQrPayment(null);
        initializeQRPayment();
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QR Code Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount to Pay</Text>
            <Text style={styles.amount}>
              {currency === 'GBP' ? '£' : currency}
              {amount.toFixed(2)}
            </Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {paymentStatus === 'loading' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : qrPayment ? (
              <QRCode value={qrPayment.qrCode} size={200} backgroundColor="white" color="black" />
            ) : null}
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusIcon}>
              {paymentStatus === 'completed' && (
                <Icon name="check-circle" size={48} color="#4CAF50" />
              )}
              {(paymentStatus === 'failed' || paymentStatus === 'expired') && (
                <Icon name="error" size={48} color="#F44336" />
              )}
              {paymentStatus === 'scanning' && (
                <Icon name="qr-code-scanner" size={48} color="#FF9800" />
              )}
            </View>

            <Text style={[styles.statusMessage, { color: getStatusColor() }]}>
              {getStatusMessage()}
            </Text>

            {paymentStatus === 'waiting' && (
              <Text style={styles.instructions}>
                Open your banking app and scan this QR code to complete the payment
              </Text>
            )}

            {(paymentStatus === 'waiting' || paymentStatus === 'scanning') && timeRemaining > 0 && (
              <View style={styles.timerContainer}>
                <Icon
                  name="schedule"
                  size={16}
                  color={theme.colors.textSecondary}
                  style={styles.timerIcon}
                />
                <Text style={styles.timerText}>Expires in {formatTime(timeRemaining)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Buttons */}
        <View style={styles.buttonContainer}>
          {(paymentStatus === 'failed' || paymentStatus === 'expired') && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Generate New QR Code</Text>
            </TouchableOpacity>
          )}

          {paymentStatus !== 'completed' && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel Payment</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </QRPaymentErrorBoundary>
  );
};

export default QRCodePaymentScreen;
