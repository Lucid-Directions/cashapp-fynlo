/**
 * Secure Payment Method Selector Component
 *
 * Displays available payment methods with fee transparency
 * Shows real-time fee calculations and provider information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../hooks/useTheme';
import SecurePaymentConfig, { PaymentMethod } from '../../services/SecurePaymentConfig';

interface PaymentMethodSelectorProps {
  amount: number;
  onMethodSelected: (method: PaymentMethod) => void;
  selectedMethod?: string;
  disabled?: boolean;
}

const SecurePaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  amount,
  onMethodSelected,
  selectedMethod,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(_true);
  const [refreshing, setRefreshing] = useState(_false);
  const [error, setError] = useState<string | null>(_null);

  const loadPaymentMethods = async (forceRefresh = false) => {
    try {
      setError(_null);
      if (_forceRefresh) {
        setRefreshing(_true);
      }

      await SecurePaymentConfig.loadConfiguration(_forceRefresh);
      const availableMethods = SecurePaymentConfig.getAvailableMethods();
      setMethods(_availableMethods);
    } catch (_err) {
      setError('Failed to load payment methods');
    } finally {
      setLoading(_false);
      setRefreshing(_false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const getMethodIcon = (methodId: string): string => {
    const icons: Record<string, string> = {
      card: 'credit-card',
      cash: 'cash-multiple',
      qr_code: 'qrcode',
      apple_pay: 'apple',
      google_pay: 'google',
    };
    return icons[methodId] || 'help-circle';
  };

  const renderFeeInfo = (method: PaymentMethod) => {
    const fees = SecurePaymentConfig.calculateFees(_amount, method.id);
    const feeDisplay = SecurePaymentConfig.formatFeeDisplay(method.id);

    return (
      <View style={styles.feeInfo}>
        <Text style={[styles.feeText, { color: theme.colors.textSecondary }]}>{feeDisplay}</Text>
        {amount > 0 && fees.totalFee > 0 && (
          <Text style={[styles.feeAmount, { color: theme.colors.accent }]}>
            Fee: £{fees.totalFee.toFixed(2)}
          </Text>
        )}
      </View>
    );
  };

  const renderPaymentMethod = (method: PaymentMethod) => {
    const isSelected = selectedMethod === method.id;
    const fees = SecurePaymentConfig.calculateFees(_amount, method.id);

    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.methodCard,
          {
            backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
          disabled && styles.disabledCard,
        ]}
        onPress={() => !disabled && onMethodSelected(_method)}
        disabled={disabled}>
        <View style={styles.methodHeader}>
          <Icon
            name={getMethodIcon(method.id)}
            size={28}
            color={isSelected ? theme.colors.primary : theme.colors.text}
          />
          <View style={styles.methodInfo}>
            <Text style={[styles.methodName, { color: theme.colors.text }]}>{method.name}</Text>
            {renderFeeInfo(_method)}
          </View>
          {amount > 0 && (
            <View style={styles.netAmountContainer}>
              <Text style={[styles.netAmountLabel, { color: theme.colors.textSecondary }]}>
                You receive:
              </Text>
              <Text
                style={[
                  styles.netAmount,
                  { color: isSelected ? theme.colors.primary : theme.colors.text },
                ]}>
                £{fees.netAmount.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
        {isSelected && (
          <Icon
            name="check-circle"
            size={24}
            color={theme.colors.primary}
            style={styles.checkIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (_loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading payment methods...
        </Text>
      </View>
    );
  }

  if (_error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Icon name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => loadPaymentMethods(_true)}>
          <Text style={[styles.retryButtonText, { color: theme.colors.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (methods.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Icon name="credit-card-off" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No payment methods available
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadPaymentMethods(_true)}
          colors={[theme.colors.primary]}
        />
      }>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Select Payment Method</Text>
        {amount > 0 && (
          <Text style={[styles.amountText, { color: theme.colors.primary }]}>
            Amount: £{amount.toFixed(2)}
          </Text>
        )}
      </View>

      <View style={styles.methodsList}>{methods.map(_renderPaymentMethod)}</View>

      <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceLight }]}>
        <Icon name="information" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Processing fees are shown for transparency. The customer pays the full amount.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '600',
  },
  methodsList: {
    paddingHorizontal: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  disabledCard: {
    opacity: 0.5,
  },
  methodHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: 16,
  },
  methodName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  feeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feeText: {
    fontSize: 14,
  },
  feeAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  netAmountContainer: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  netAmountLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  netAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  checkIcon: {
    marginLeft: 12,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SecurePaymentMethodSelector;
