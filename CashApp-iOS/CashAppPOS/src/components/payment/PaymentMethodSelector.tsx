/**
 * PaymentMethodSelector - Unified payment method selection UI
 * 
 * This component displays available payment methods and allows users to select
 * their preferred payment option with clear visual feedback.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import type { PaymentMethod, PaymentMethodType } from '../../types/payment';

interface PaymentMethodSelectorProps {
  methods: PaymentMethod[];
  selectedMethod: PaymentMethodType | null;
  onMethodSelect: (method: PaymentMethodType) => void;
  isProcessing?: boolean;
  showFees?: boolean;
  compact?: boolean;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  methods,
  selectedMethod,
  onMethodSelect,
  isProcessing = false,
  showFees = true,
  compact = false,
}) => {
  const { theme } = useTheme();

  const renderMethodCard = (method: PaymentMethod) => {
    const isSelected = selectedMethod === method.id;
    const isDisabled = isProcessing || !method.available;

    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.methodCard,
          compact ? styles.methodCardCompact : {},
          {
            backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            opacity: isDisabled ? 0.5 : 1,
          },
        ]}
        onPress={() => !isDisabled && onMethodSelect(method.id)}
        disabled={isDisabled}
      >
        <View style={styles.methodContent}>
          <View style={styles.methodIcon}>
            <Icon
              name={method.icon}
              size={compact ? 24 : 32}
              color={isSelected ? theme.colors.background : method.color}
            />
          </View>
          
          <View style={styles.methodInfo}>
            <Text
              style={[
                styles.methodName,
                {
                  color: isSelected ? theme.colors.background : theme.colors.text,
                  fontSize: compact ? 14 : 16,
                },
              ]}
            >
              {method.name}
            </Text>
            
            {showFees && method.processingFee && !compact && (
              <Text
                style={[
                  styles.methodFee,
                  {
                    color: isSelected 
                      ? theme.colors.background 
                      : theme.colors.textSecondary,
                  },
                ]}
              >
                {method.processingFee}% fee
              </Text>
            )}
            
            {!method.available && (
              <Text
                style={[
                  styles.unavailableText,
                  {
                    color: isSelected 
                      ? theme.colors.background 
                      : theme.colors.danger[500],
                  },
                ]}
              >
                Not available
              </Text>
            )}
          </View>
          
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Icon
                name="check-circle"
                size={24}
                color={theme.colors.background}
              />
            </View>
          )}
          
          {method.requiresAuth && !isSelected && (
            <Icon
              name="lock-outline"
              size={20}
              color={theme.colors.textSecondary}
              style={styles.authIcon}
            />
          )}
        </View>
        
        {isProcessing && isSelected && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator
              size="small"
              color={theme.colors.background}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (methods.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface }]}>
        <Icon
          name="payment"
          size={48}
          color={theme.colors.textSecondary}
        />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No payment methods available
        </Text>
      </View>
    );
  }

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.compactContainer}
      >
        {methods.map(renderMethodCard)}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Select Payment Method
      </Text>
      
      <View style={styles.methodsGrid}>
        {methods.map(renderMethodCard)}
      </View>
      
      {showFees && (
        <View style={[styles.feeInfo, { backgroundColor: theme.colors.info[100] }]}>
          <Icon
            name="info-outline"
            size={16}
            color={theme.colors.info[700]}
          />
          <Text style={[styles.feeInfoText, { color: theme.colors.info[700] }]}>
            Processing fees apply to card and digital payments
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  compactContainer: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  methodCard: {
    flex: 1,
    minWidth: '45%',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    position: 'relative',
  },
  methodCardCompact: {
    flex: 0,
    minWidth: 120,
    padding: 12,
    marginHorizontal: 6,
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  methodFee: {
    fontSize: 12,
  },
  unavailableText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  authIcon: {
    marginLeft: 8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  feeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  feeInfoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});

export default PaymentMethodSelector;