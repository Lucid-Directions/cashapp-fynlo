/**
 * PlatformPaymentFees - Component for displaying platform-controlled payment fees
 * Shows effective fees, platform vs restaurant markup, and override capabilities
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import SettingsCard from '../settings/SettingsCard';
import { useTheme } from '../../design-system/ThemeProvider';
import PlatformPaymentService, { PlatformPaymentMethod, PaymentFeeDisplayInfo } from '../../services/PlatformPaymentService';

interface PlatformPaymentFeesProps {
  restaurantId?: string;
  userRole: 'restaurant_owner' | 'restaurant_manager' | 'platform_owner' | 'staff';
  onFeeUpdate?: (method: string, newFee: number) => void;
  showOverrideControls?: boolean;
  testAmount?: number;
}

const PlatformPaymentFees: React.FC<PlatformPaymentFeesProps> = ({
  restaurantId,
  userRole,
  onFeeUpdate,
  showOverrideControls = false,
  testAmount = 100,
}) => {
  const { theme } = useTheme();
  const [paymentMethods, setPaymentMethods] = useState<PlatformPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRestaurantOverrides, setHasRestaurantOverrides] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const [markupValues, setMarkupValues] = useState<Record<string, string>>({});

  const platformPaymentService = PlatformPaymentService.getInstance();

  useEffect(() => {
    loadPaymentFees();
    checkRestaurantOverrides();
  }, [restaurantId, testAmount]);

  const loadPaymentFees = async () => {
    try {
      setError(null);
      const methods = await platformPaymentService.getPaymentMethodsWithFees(testAmount, restaurantId);
      setPaymentMethods(methods);

      // Initialize markup values
      const initialMarkup: Record<string, string> = {};
      methods.forEach(method => {
        if (method.effectiveFee) {
          initialMarkup[method.id] = method.effectiveFee.restaurant_markup.toString();
        }
      });
      setMarkupValues(initialMarkup);
    } catch (err) {
      console.error('Failed to load payment fees:', err);
      setError('Failed to load payment fee information');
    } finally {
      setLoading(false);
    }
  };

  const checkRestaurantOverrides = async () => {
    if (!restaurantId) return;

    try {
      const hasOverrides = await platformPaymentService.hasRestaurantFeeOverrides(restaurantId);
      setHasRestaurantOverrides(hasOverrides);
    } catch (error) {
      console.error('Failed to check restaurant overrides:', error);
    }
  };

  const handleMarkupUpdate = async (paymentMethod: string, markupPercentage: number) => {
    if (!restaurantId) {
      Alert.alert('Error', 'Restaurant ID is required to update fee markup');
      return;
    }

    if (markupPercentage < 0 || markupPercentage > 2.0) {
      Alert.alert('Invalid Markup', 'Markup must be between 0% and 2.0%');
      return;
    }

    try {
      const success = await platformPaymentService.updateRestaurantFeeMarkup(
        restaurantId,
        paymentMethod,
        markupPercentage
      );

      if (success) {
        Alert.alert(
          'Markup Updated',
          markupPercentage > 0.5 
            ? 'Fee markup updated and submitted for platform approval.'
            : 'Fee markup updated successfully.'
        );
        
        // Reload fees to show updated values
        loadPaymentFees();
        onFeeUpdate?.(paymentMethod, markupPercentage);
      } else {
        Alert.alert('Error', 'Failed to update fee markup');
      }
    } catch (error) {
      console.error('Failed to update markup:', error);
      Alert.alert('Error', 'An error occurred while updating the fee markup');
    }
  };

  const toggleMethodExpansion = (methodId: string) => {
    setExpandedMethod(expandedMethod === methodId ? null : methodId);
  };

  const getFeeStatusColor = (method: PlatformPaymentMethod): string => {
    if (!method.effectiveFee) return theme.colors.textLight;
    
    if (method.effectiveFee.effective_fee === 0) return theme.colors.success;
    if (method.effectiveFee.restaurant_markup > 0) return theme.colors.warning;
    return theme.colors.primary;
  };

  const getFeeStatusIcon = (method: PlatformPaymentMethod): string => {
    if (!method.effectiveFee) return 'help';
    
    if (method.effectiveFee.effective_fee === 0) return 'check-circle';
    if (method.effectiveFee.restaurant_markup > 0) return 'edit';
    return 'info';
  };

  const canEditMarkup = (): boolean => {
    return (userRole === 'restaurant_owner' || userRole === 'restaurant_manager') && 
           showOverrideControls && 
           !!restaurantId;
  };

  if (loading) {
    return (
      <Card style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading payment fees...</Text>
        </View>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={24} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={loadPaymentFees} style={styles.retryButton} />
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.headerCard}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment Processing Fees</Text>
          <Text style={styles.subtitle}>
            Based on £{testAmount.toFixed(2)} transaction amount
          </Text>
        </View>

        {hasRestaurantOverrides && (
          <View style={styles.overrideNotice}>
            <Icon name="edit" size={16} color={theme.colors.warning} />
            <Text style={styles.overrideText}>
              This restaurant has custom fee adjustments
            </Text>
          </View>
        )}

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <Icon name="info" size={16} color={theme.colors.primary} />
            <Text style={styles.legendText}>Platform Fee</Text>
          </View>
          <View style={styles.legendItem}>
            <Icon name="edit" size={16} color={theme.colors.warning} />
            <Text style={styles.legendText}>Restaurant Markup</Text>
          </View>
          <View style={styles.legendItem}>
            <Icon name="check-circle" size={16} color={theme.colors.success} />
            <Text style={styles.legendText}>No Fee</Text>
          </View>
        </View>
      </Card>

      {paymentMethods.map((method) => (
        <Card key={method.id} style={styles.methodCard}>
          <TouchableOpacity
            style={styles.methodHeader}
            onPress={() => toggleMethodExpansion(method.id)}
          >
            <View style={styles.methodInfo}>
              <View style={[styles.methodIcon, { backgroundColor: method.color }]}>
                <Icon name={method.icon} size={20} color="white" />
              </View>
              <View style={styles.methodDetails}>
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodFee}>{method.feeInfo}</Text>
              </View>
            </View>
            <View style={styles.methodStatus}>
              <Icon 
                name={getFeeStatusIcon(method)} 
                size={20} 
                color={getFeeStatusColor(method)} 
              />
              <Icon 
                name={expandedMethod === method.id ? 'expand-less' : 'expand-more'} 
                size={20} 
                color={theme.colors.textLight} 
              />
            </View>
          </TouchableOpacity>

          {expandedMethod === method.id && method.effectiveFee && (
            <View style={styles.expandedContent}>
              <View style={styles.feeBreakdown}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Platform Fee:</Text>
                  <Text style={styles.feeValue}>
                    £{method.effectiveFee.platform_fee.toFixed(2)}
                  </Text>
                </View>
                
                {method.effectiveFee.restaurant_markup > 0 && (
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Restaurant Markup:</Text>
                    <Text style={[styles.feeValue, { color: theme.colors.warning }]}>
                      {method.effectiveFee.restaurant_markup.toFixed(2)}% 
                      (+£{((testAmount * method.effectiveFee.restaurant_markup) / 100).toFixed(2)})
                    </Text>
                  </View>
                )}
                
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Fee:</Text>
                  <Text style={styles.totalValue}>
                    £{method.effectiveFee.effective_fee.toFixed(2)} 
                    ({method.effectiveFee.fee_percentage.toFixed(2)}%)
                  </Text>
                </View>
              </View>

              {canEditMarkup() && (
                <View style={styles.markupEditor}>
                  <Text style={styles.markupLabel}>Restaurant Markup (%):</Text>
                  <View style={styles.markupInputContainer}>
                    <TextInput
                      style={styles.markupInput}
                      value={markupValues[method.id] || '0'}
                      onChangeText={(text) => 
                        setMarkupValues(prev => ({ ...prev, [method.id]: text }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                    />
                    <Button
                      title="Update"
                      onPress={() => {
                        const markup = parseFloat(markupValues[method.id] || '0');
                        if (!isNaN(markup)) {
                          handleMarkupUpdate(method.id, markup);
                        }
                      }}
                      style={styles.updateButton}
                      size="small"
                    />
                  </View>
                  <Text style={styles.markupNote}>
                    Maximum 2.0%. Markups over 0.5% require platform approval.
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>
      ))}

      {userRole === 'platform_owner' && (
        <Card style={styles.adminCard}>
          <View style={styles.adminHeader}>
            <Icon name="admin-panel-settings" size={24} color={theme.colors.primary} />
            <Text style={styles.adminTitle}>Platform Admin Controls</Text>
          </View>
          <Text style={styles.adminText}>
            As a platform owner, you can modify base payment processing fees 
            in the Platform Settings section.
          </Text>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  overrideNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  overrideText: {
    marginLeft: theme.spacing.xs,
    fontSize: 13,
    color: '#856404',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendText: {
    marginLeft: theme.spacing.xs,
    fontSize: 12,
    color: theme.colors.textLight,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textLight,
  },
  errorContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    marginVertical: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  methodCard: {
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  methodFee: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  methodStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  feeBreakdown: {
    marginBottom: theme.spacing.md,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  feeLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  totalRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  markupEditor: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  markupLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  markupInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  markupInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  updateButton: {
    minWidth: 80,
  },
  markupNote: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  adminCard: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: '#F8F9FA',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  adminTitle: {
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  adminText: {
    fontSize: 14,
    color: theme.colors.textLight,
    lineHeight: 20,
  },
});

export default PlatformPaymentFees;