import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeProvider';
import SumUpService, { SumUpContactlessPayment } from '../../services/SumUpService';

const { width: screenWidth } = Dimensions.get('window');

type ContactlessPaymentRouteProp = RouteProp<{
  ContactlessPayment: {
    amount: number;
    currency: string;
    description?: string;
    onSuccess: (payment: SumUpContactlessPayment) => void;
    onCancel: () => void;
  };
}, 'ContactlessPayment'>;

const ContactlessPaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ContactlessPaymentRouteProp>();
  const { theme } = useTheme();
  
  const { amount, currency, description, onSuccess, onCancel } = route.params;
  
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'detecting' | 'processing' | 'success' | 'error'>('waiting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 second timeout
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Start pulse animation
    startPulseAnimation();
    
    // Start countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);
  
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  const startProgressAnimation = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
  };
  
  const handleStartPayment = async () => {
    try {
      setPaymentStatus('detecting');
      setErrorMessage('');
      startProgressAnimation();
      
      const payment = await SumUpService.processContactlessPayment(
        amount,
        currency,
        description
      );
      
      if (payment.status === 'completed') {
        setPaymentStatus('success');
        setTimeout(() => {
          onSuccess(payment);
          navigation.goBack();
        }, 2000);
      } else {
        setPaymentStatus('error');
        setErrorMessage(payment.errorMessage || 'Payment failed');
      }
    } catch (error) {
      setPaymentStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Payment failed');
    }
  };
  
  const handleCancel = () => {
    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'Continue', style: 'cancel' },
        { 
          text: 'Cancel Payment', 
          style: 'destructive',
          onPress: () => {
            onCancel();
            navigation.goBack();
          }
        },
      ]
    );
  };
  
  const handleTimeout = () => {
    setPaymentStatus('error');
    setErrorMessage('Payment timeout. Please try again.');
  };
  
  const handleRetry = () => {
    setPaymentStatus('waiting');
    setErrorMessage('');
    setTimeRemaining(60);
    progressAnim.setValue(0);
  };
  
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'detecting':
      case 'processing':
        return 'nfc';
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error';
      default:
        return 'nfc';
    }
  };
  
  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'detecting':
      case 'processing':
        return '#2196F3';
      default:
        return theme.colors.primary;
    }
  };
  
  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'waiting':
        return 'Tap the NFC icon to start payment';
      case 'detecting':
        return 'Hold your card or device near the phone';
      case 'processing':
        return 'Processing payment...';
      case 'success':
        return 'Payment successful!';
      case 'error':
        return errorMessage || 'Payment failed';
      default:
        return 'Ready for contactless payment';
    }
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
      justifyContent: 'center',
      padding: 20,
    },
    amountContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    amountLabel: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    amount: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    nfcContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    nfcIcon: {
      marginBottom: 20,
    },
    statusMessage: {
      fontSize: 18,
      textAlign: 'center',
      color: theme.colors.text,
      marginBottom: 10,
    },
    progressContainer: {
      width: 200,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      marginTop: 20,
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
    },
    timerContainer: {
      alignItems: 'center',
      marginTop: 30,
    },
    timerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 40,
      left: 20,
      right: 20,
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Icon name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contactless Payment</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amount}>
            {currency === 'GBP' ? '£' : currency}{amount.toFixed(2)}
          </Text>
        </View>
        
        {/* NFC Icon and Status */}
        <View style={styles.nfcContainer}>
          <TouchableOpacity 
            onPress={paymentStatus === 'waiting' ? handleStartPayment : undefined}
            disabled={paymentStatus !== 'waiting'}
          >
            <Animated.View 
              style={[
                styles.nfcIcon, 
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <Icon 
                name={getStatusIcon()} 
                size={120} 
                color={getStatusColor()} 
              />
            </Animated.View>
          </TouchableOpacity>
          
          <Text style={styles.statusMessage}>
            {getStatusMessage()}
          </Text>
          
          {(paymentStatus === 'detecting' || paymentStatus === 'processing') && (
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}
        </View>
        
        {/* Timer */}
        {paymentStatus === 'waiting' && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>
      
      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        {paymentStatus === 'error' && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        
        {paymentStatus !== 'success' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default ContactlessPaymentScreen;