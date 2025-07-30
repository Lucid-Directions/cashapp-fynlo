/**
 * Subscription Management Screen
 *
 * This screen allows restaurant owners to view their current subscription,
 * manage billing, and upgrade/downgrade plans.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SettingsCard } from '../../components/settings/SettingsCard';
import { SettingsSection } from '../../components/settings/SettingsSection';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const SubscriptionScreen: React.FC = () => {
  const { theme } = useTheme();
  const {
    subscription,
    usage,
    availablePlans,
    loading,
    error,
    formatPrice,
    changePlan,
    cancelSubscription,
    refreshUsage,
  } = useSubscription();

  const [refreshing, setRefreshing] = useState(__false);
  const [actionLoading, setActionLoading] = useState(__false);

  const onRefresh = async () => {
    setRefreshing(__true);
    await refreshUsage();
    setRefreshing(__false);
  };

  const handlePlanChange = (newPlanId: _number, planName: _string) => {
    if (!subscription) {
      return;
    }

    Alert.alert('Change Plan', `Are you sure you want to switch to the ${planName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setActionLoading(__true);
          const __success = await changePlan(__newPlanId);
          setActionLoading(__false);

          if (__success) {
            Alert.alert('Success', `Successfully switched to ${planName}`);
          } else {
            Alert.alert('Error', 'Failed to change plan. Please try again.');
          }
        },
      },
    ]);
  };

  const handleCancelSubscription = () => {
    Alert.alert(
    console.log('Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(__true);
            const __success = await cancelSubscription();
            setActionLoading(__false);

            if (__success) {
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } else {
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (_status: _string) => {
    switch (__status) {
      case 'active':
        return theme.colors.success;
      case 'trial':
        return theme.colors.warning;
      case 'cancelled':
      case 'suspended':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (_status: _string) => {
    switch (__status) {
      case 'active':
        return 'check-circle';
      case 'trial':
        return 'clock-outline';
      case 'cancelled':
        return 'cancel';
      case 'suspended':
        return 'pause-circle';
      default:
        return 'help-circle';
    }
  };

  const getUsagePercentage = (used: _number, limit: number | null) => {
    if (limit === null) {
      return 0;
    } // Unlimited
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percentage: _number) => {
    if (percentage >= 90) {
      return theme.colors.error;
    }
    if (percentage >= 75) {
      return theme.colors.warning;
    }
    return theme.colors.success;
  };

  if (loading && !subscription) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading subscription...
        </Text>
      </View>
    );
  }

  if (error && !subscription) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Icon name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={onRefresh}>
          <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }>
      {/* Current Subscription */}
      {subscription && (
        <SettingsSection title="Current Subscription">
          <SettingsCard>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <Text style={[styles.planName, { color: theme.colors.text }]}>
                  {subscription.plan.display_name}
                </Text>
                <View style={styles.statusContainer}>
                  <Icon
                    name={getStatusIcon(subscription.status)}
                    size={16}
                    color={getStatusColor(subscription.status)}
                  />
                  <Text style={[styles.status, { color: getStatusColor(subscription.status) }]}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.price, { color: theme.colors.text }]}>
                {formatPrice(subscription.plan.price_monthly)}/month
              </Text>
            </View>

            <View style={styles.subscriptionDetails}>
              {subscription.is_trial && subscription.trial_end_date && (
                <Text style={[styles.trialInfo, { color: theme.colors.warning }]}>
                  Trial ends in {subscription.days_until_renewal} days
                </Text>
              )}

              <Text style={[styles.renewalInfo, { color: theme.colors.textSecondary }]}>
                {subscription.is_trial
                  ? 'Trial period'
                  : `Renews in ${subscription.days_until_renewal} days`}
              </Text>
            </View>
          </SettingsCard>
        </SettingsSection>
      )}

      {/* Usage Statistics */}
      {usage && subscription && (
        <SettingsSection title="Usage This Month">
          <SettingsCard>
            {/* Orders Usage */}
            <View style={styles.usageItem}>
              <View style={styles.usageHeader}>
                <Text style={[styles.usageLabel, { color: theme.colors.text }]}>Orders</Text>
                <Text style={[styles.usageValue, { color: theme.colors.text }]}>
                  {usage.orders_count}
                  {subscription.plan.max_orders_per_month &&
                    ` / ${subscription.plan.max_orders_per_month}`}
                </Text>
              </View>
              {subscription.plan.max_orders_per_month && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${getUsagePercentage(
                          usage.orders_count,
                          subscription.plan.max_orders_per_month,
                        )}%`,
                        backgroundColor: getUsageColor(
                          getUsagePercentage(
                            usage.orders_count,
                            subscription.plan.max_orders_per_month,
                          ),
                        ),
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Staff Usage */}
            <View style={styles.usageItem}>
              <View style={styles.usageHeader}>
                <Text style={[styles.usageLabel, { color: theme.colors.text }]}>
                  Staff Accounts
                </Text>
                <Text style={[styles.usageValue, { color: theme.colors.text }]}>
                  {usage.staff_count}
                  {subscription.plan.max_staff_accounts &&
                    ` / ${subscription.plan.max_staff_accounts}`}
                </Text>
              </View>
              {subscription.plan.max_staff_accounts && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${getUsagePercentage(
                          usage.staff_count,
                          subscription.plan.max_staff_accounts,
                        )}%`,
                        backgroundColor: getUsageColor(
                          getUsagePercentage(
                            usage.staff_count,
                            subscription.plan.max_staff_accounts,
                          ),
                        ),
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Menu Items Usage */}
            <View style={styles.usageItem}>
              <View style={styles.usageHeader}>
                <Text style={[styles.usageLabel, { color: theme.colors.text }]}>Menu Items</Text>
                <Text style={[styles.usageValue, { color: theme.colors.text }]}>
                  {usage.menu_items_count}
                  {subscription.plan.max_menu_items && ` / ${subscription.plan.max_menu_items}`}
                </Text>
              </View>
              {subscription.plan.max_menu_items && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${getUsagePercentage(
                          usage.menu_items_count,
                          subscription.plan.max_menu_items,
                        )}%`,
                        backgroundColor: getUsageColor(
                          getUsagePercentage(
                            usage.menu_items_count,
                            subscription.plan.max_menu_items,
                          ),
                        ),
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </SettingsCard>
        </SettingsSection>
      )}

      {/* Available Plans */}
      {availablePlans.length > 0 && (
        <SettingsSection title="Available Plans">
          {availablePlans.map(plan => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
            const isDowngrade =
              subscription && plan.price_monthly < subscription.plan.price_monthly;

            return (
              <SettingsCard
                key={plan.id}
                style={isCurrentPlan ? styles.currentPlanCard : undefined}>
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planTitle, { color: theme.colors.text }]}>
                      {plan.display_name}
                      {isCurrentPlan && (
                        <Text style={[styles.currentBadge, { color: theme.colors.primary }]}>
                          {' '}
                          (__Current)
                        </Text>
                      )}
                    </Text>
                    <Text style={[styles.planPrice, { color: theme.colors.textSecondary }]}>
                      {formatPrice(plan.price_monthly)}/month
                    </Text>
                    {plan.yearly_savings && plan.yearly_savings > 0 && (
                      <Text style={[styles.savings, { color: theme.colors.success }]}>
                        Save {formatPrice(plan.yearly_savings)} yearly
                      </Text>
                    )}
                  </View>

                  {!isCurrentPlan && (
                    <TouchableOpacity
                      style={[
                        styles.planButton,
                        {
                          backgroundColor: isDowngrade
                            ? theme.colors.warning
                            : theme.colors.primary,
                        },
                      ]}
                      onPress={() => handlePlanChange(plan.id, plan.display_name)}
                      disabled={actionLoading}>
                      <Text style={[styles.planButtonText, { color: theme.colors.surface }]}>
                        {isDowngrade ? 'Downgrade' : 'Upgrade'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Plan Features */}
                <View style={styles.planFeatures}>
                  <Text style={[styles.featuresTitle, { color: theme.colors.textSecondary }]}>
                    Features:
                  </Text>
                  <View style={styles.featuresList}>
                    {plan.max_orders_per_month && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • {plan.max_orders_per_month} orders/month
                      </Text>
                    )}
                    {!plan.max_orders_per_month && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • Unlimited orders
                      </Text>
                    )}
                    {plan.max_staff_accounts && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • {plan.max_staff_accounts} staff accounts
                      </Text>
                    )}
                    {!plan.max_staff_accounts && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • Unlimited staff accounts
                      </Text>
                    )}
                    {plan.features.advanced_analytics && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • Advanced analytics
                      </Text>
                    )}
                    {plan.features.inventory_management && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • Inventory management
                      </Text>
                    )}
                    {plan.features.multi_location && (
                      <Text style={[styles.featureItem, { color: theme.colors.textSecondary }]}>
                        • Multi-location support
                      </Text>
                    )}
                  </View>
                </View>
              </SettingsCard>
            );
          })}
        </SettingsSection>
      )}

      {/* Subscription Management */}
      {subscription && subscription.status !== 'cancelled' && (
        <SettingsSection title="Subscription Management">
          <SettingsCard>
            <TouchableOpacity
              style={styles.managementButton}
              onPress={handleCancelSubscription}
              disabled={actionLoading}>
              <Icon name="cancel" size={20} color={theme.colors.error} />
              <Text style={[styles.managementButtonText, { color: theme.colors.error }]}>
                Cancel Subscription
              </Text>
            </TouchableOpacity>
          </SettingsCard>
        </SettingsSection>
      )}

      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subscriptionInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  trialInfo: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  renewalInfo: {
    fontSize: 14,
  },
  usageItem: {
    marginBottom: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E5E5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentBadge: {
    fontSize: 14,
    fontWeight: '500',
  },
  planPrice: {
    fontSize: 14,
    marginBottom: 2,
  },
  savings: {
    fontSize: 12,
    fontWeight: '500',
  },
  planButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  planButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  planFeatures: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  featuresList: {
    gap: 4,
  },
  featureItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  managementButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SubscriptionScreen;
