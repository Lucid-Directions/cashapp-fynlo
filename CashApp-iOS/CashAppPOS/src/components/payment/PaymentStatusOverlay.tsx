import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {
  ICON_SIZES,
  MODAL_DIMENSIONS,
  ANIMATION_DURATIONS,
  ANIMATION_CONFIG,
  OPACITY,
  PROGRESS_BAR,
  FONT_SIZES,
  LETTER_SPACING,
} from '../../design-system/constants';
import type { Theme } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

const { width: screenWidth } = Dimensions.get('window');

export type PaymentStatus =
  | 'initializing'
  | 'processing'
  | 'waiting_for_card'
  | 'completing'
  | 'success'
  | 'failed';

interface PaymentStatusOverlayProps {
  visible: boolean;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  message?: string;
  onCancel?: () => void;
  canCancel?: boolean;
  testID?: string;
}

const PaymentStatusOverlay: React.FC<PaymentStatusOverlayProps> = ({
  visible,
  status,
  amount,
  currency,
  paymentMethod,
  message,
  onCancel,
  canCancel = true,
  testID = 'payment-status-overlay',
}) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successCheckAnim = useRef(new Animated.Value(0)).current;

  // Start animations when visible changes
  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATIONS.normal,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: ANIMATION_CONFIG.spring.friction,
          tension: ANIMATION_CONFIG.spring.tension,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION_DURATIONS.fast,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: ANIMATION_DURATIONS.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  // Processing animation (rotating)
  useEffect(() => {
    if (status === 'processing' || status === 'initializing' || status === 'completing') {
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: ANIMATION_DURATIONS.verySlow,
          useNativeDriver: true,
        })
      );
      rotation.start();
      return () => rotation.stop();
    }
  }, [status, rotateAnim]);

  // Pulse animation for waiting states
  useEffect(() => {
    if (status === 'waiting_for_card') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: ANIMATION_DURATIONS.verySlow,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: ANIMATION_DURATIONS.verySlow,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status, pulseAnim]);

  // Success animation
  useEffect(() => {
    if (status === 'success') {
      Animated.spring(successCheckAnim, {
        toValue: 1,
        friction: ANIMATION_CONFIG.spring.friction,
        tension: ANIMATION_CONFIG.spring.tension,
        useNativeDriver: true,
      }).start();
    } else {
      successCheckAnim.setValue(0);
    }
  }, [status, successCheckAnim]);

  // Memoize formatted amount to prevent recalculation
  const formattedAmount = useMemo(() => {
    const currencySymbol =
      currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
    return currencySymbol + amount.toFixed(2);
  }, [amount, currency]);

  // Memoize status message
  const statusMessage = useMemo(() => {
    if (message) return message;

    switch (status) {
      case 'initializing':
        return 'Initializing payment...';
      case 'processing':
        return 'Processing payment...';
      case 'waiting_for_card':
        return 'Please tap, insert or swipe card';
      case 'completing':
        return 'Completing transaction...';
      case 'success':
        return 'Payment successful!';
      case 'failed':
        return 'Payment failed';
      default:
        return 'Processing...';
    }
  }, [status, message]);

  // Memoize status color
  const statusColor = useMemo(() => {
    switch (status) {
      case 'success':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  }, [status, theme]);

  // Memoize whether to show cancel button
  const showCancelButton = useMemo(
    () => canCancel && status !== 'success' && status !== 'failed' && status !== 'completing',
    [canCancel, status]
  );

  // Memoize spin interpolation
  const spin = useMemo(
    () =>
      rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [rotateAnim]
  );

  // Memoize success scale interpolation
  const successScale = useMemo(
    () =>
      successCheckAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [successCheckAnim]
  );

  // Memoize the status icon component
  const statusIcon = useMemo(() => {
    switch (status) {
      case 'initializing':
        return (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Icon name="settings" size={ICON_SIZES.xxl} color={theme.colors.primary} />
          </Animated.View>
        );

      case 'processing':
      case 'completing':
        return (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Icon name="sync" size={ICON_SIZES.xxl} color={theme.colors.primary} />
          </Animated.View>
        );

      case 'waiting_for_card':
        return (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Icon name="credit-card" size={ICON_SIZES.xxl} color={theme.colors.primary} />
          </Animated.View>
        );

      case 'success':
        return (
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <Icon name="check-circle" size={ICON_SIZES.xxxl} color={theme.colors.success} />
          </Animated.View>
        );

      case 'failed':
        return <Icon name="error" size={ICON_SIZES.xxxl} color={theme.colors.error} />;

      default:
        return <ActivityIndicator size="large" color={theme.colors.primary} />;
    }
  }, [status, spin, pulseAnim, successScale, theme]);

  // Memoize cancel handler
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <Modal transparent visible={visible} animationType="none" testID={testID}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.content}>
            {/* Status Icon */}
            <View style={styles.iconContainer}>{statusIcon}</View>

            {/* Amount Display */}
            <Text style={[styles.amount, { color: statusColor }]}>{formattedAmount}</Text>

            {/* Payment Method */}
            <Text style={styles.paymentMethod}>{paymentMethod}</Text>

            {/* Status Message */}
            <Text style={styles.statusMessage}>{statusMessage}</Text>

            {/* Progress Bar for processing states */}
            {(status === 'processing' || status === 'initializing' || status === 'completing') && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        transform: [
                          {
                            translateX: pulseAnim.interpolate({
                              inputRange: [1, 1.1],
                              outputRange: [0, 20],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Cancel Button */}
            {showCancelButton && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                testID={`${testID}-cancel-button`}
              >
                <Text style={styles.cancelButtonText}>Cancel Payment</Text>
              </TouchableOpacity>
            )}

            {/* Success/Failure Actions */}
            {status === 'success' && (
              <View style={styles.successMessage}>
                <Icon name="done" size={ICON_SIZES.sm} color={theme.colors.success} />
                <Text style={styles.successText}>Transaction Complete</Text>
              </View>
            )}

            {status === 'failed' && onCancel && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleCancel}
                testID={`${testID}-retry-button`}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: `rgba(0, 0, 0, ${OPACITY.overlay})`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: Math.min(screenWidth * 0.85, MODAL_DIMENSIONS.medium.width),
      backgroundColor: theme.colors.background,
      borderRadius: theme.spacing.lg,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    content: {
      padding: theme.spacing.xl,
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: theme.spacing.lg,
      height: ICON_SIZES.xxxl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    amount: {
      fontSize: FONT_SIZES.xxxl,
      fontWeight: 'bold',
      marginBottom: theme.spacing.xs,
      letterSpacing: LETTER_SPACING.tight,
    },
    paymentMethod: {
      fontSize: FONT_SIZES.md,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
      textTransform: 'capitalize',
    },
    statusMessage: {
      fontSize: FONT_SIZES.lg,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    progressBarContainer: {
      width: '100%',
      marginBottom: theme.spacing.lg,
    },
    progressBarBackground: {
      height: PROGRESS_BAR.height,
      backgroundColor: theme.colors.border,
      borderRadius: PROGRESS_BAR.borderRadius,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      width: '100%',
    },
    cancelButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: theme.spacing.md,
    },
    cancelButtonText: {
      color: theme.colors.textSecondary,
      fontSize: FONT_SIZES.md,
      fontWeight: '500',
    },
    retryButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    retryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
    successMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    successText: {
      color: theme.colors.success,
      fontSize: FONT_SIZES.md,
      fontWeight: '500',
      marginLeft: theme.spacing.sm,
    },
  });

export default PaymentStatusOverlay;
