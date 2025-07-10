/**
 * Feature Gate Component
 * 
 * This component conditionally renders children based on subscription features
 * and displays upgrade prompts when features are not available.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSubscription, FeatureGateResult } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  onUpgradePress?: () => void;
  silentMode?: boolean; // Don't show any UI when blocked
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  onUpgradePress,
  silentMode = false
}) => {
  const { theme } = useTheme();
  const { hasFeature } = useSubscription();
  const [gateResult, setGateResult] = useState<FeatureGateResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFeatureAccess();
  }, [feature]);

  const checkFeatureAccess = async () => {
    setLoading(true);
    try {
      const result = await hasFeature(feature);
      setGateResult(result);
    } catch (error) {
      console.error('Feature gate check failed:', error);
      setGateResult({
        hasAccess: false,
        reason: 'Failed to check feature access',
        upgradeRequired: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePress = () => {
    if (onUpgradePress) {
      onUpgradePress();
    } else {
      Alert.alert(
        'Upgrade Required',
        `To access ${feature}, please upgrade your subscription plan.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => {/* Navigate to plans */ } }
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Checking access...
        </Text>
      </View>
    );
  }

  if (!gateResult) {
    return silentMode ? null : (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Unable to verify feature access
        </Text>
      </View>
    );
  }

  if (gateResult.hasAccess) {
    return <>{children}</>;
  }

  // Feature is blocked
  if (silentMode) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <View style={[styles.upgradeContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.upgradeContent}>
        <Icon 
          name="lock" 
          size={24} 
          color={theme.colors.warning} 
          style={styles.lockIcon}
        />
        <Text style={[styles.upgradeTitle, { color: theme.colors.text }]}>
          Premium Feature
        </Text>
        <Text style={[styles.upgradeMessage, { color: theme.colors.textSecondary }]}>
          {gateResult.reason || `This feature requires a subscription upgrade.`}
        </Text>
        {gateResult.requiredPlans && gateResult.requiredPlans.length > 0 && (
          <Text style={[styles.planInfo, { color: theme.colors.textSecondary }]}>
            Available in: {gateResult.requiredPlans.join(', ')} plans
          </Text>
        )}
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleUpgradePress}
        >
          <Text style={[styles.upgradeButtonText, { color: theme.colors.surface }]}>
            Upgrade Plan
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface UsageLimitGateProps {
  limitType: string;
  increment?: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLimitWarning?: boolean;
  warningThreshold?: number; // Show warning when usage is above this percentage
  onLimitReached?: () => void;
  silentMode?: boolean;
}

export const UsageLimitGate: React.FC<UsageLimitGateProps> = ({
  limitType,
  increment = 1,
  children,
  fallback,
  showLimitWarning = true,
  warningThreshold = 80,
  onLimitReached,
  silentMode = false
}) => {
  const { theme } = useTheme();
  const { checkUsageLimit } = useSubscription();
  const [limitResult, setLimitResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLimit();
  }, [limitType, increment]);

  const checkLimit = async () => {
    setLoading(true);
    try {
      const result = await checkUsageLimit(limitType, increment);
      setLimitResult(result);
    } catch (error) {
      console.error('Usage limit check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitReached = () => {
    if (onLimitReached) {
      onLimitReached();
    } else {
      Alert.alert(
        'Usage Limit Reached',
        `You've reached your ${limitType} limit. Please upgrade your plan to continue.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade Plan', onPress: () => {/* Navigate to plans */ } }
        ]
      );
    }
  };

  if (loading) {
    return silentMode ? null : (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Checking usage...
        </Text>
      </View>
    );
  }

  if (!limitResult) {
    return silentMode ? null : (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Unable to check usage limits
        </Text>
      </View>
    );
  }

  // If this action would put us over the limit, block it
  if (limitResult.overLimit) {
    if (silentMode) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={[styles.upgradeContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}>
        <View style={styles.upgradeContent}>
          <Icon 
            name="alert-circle" 
            size={24} 
            color={theme.colors.error} 
            style={styles.lockIcon}
          />
          <Text style={[styles.upgradeTitle, { color: theme.colors.text }]}>
            Usage Limit Reached
          </Text>
          <Text style={[styles.upgradeMessage, { color: theme.colors.textSecondary }]}>
            You've reached your {limitType} limit ({limitResult.currentUsage}/{limitResult.limit}).
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleLimitReached}
          >
            <Text style={[styles.upgradeButtonText, { color: theme.colors.surface }]}>
              Upgrade Plan
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show warning if approaching limit
  const shouldShowWarning = showLimitWarning && 
    limitResult.percentageUsed >= warningThreshold && 
    limitResult.limit !== null;

  if (shouldShowWarning && !silentMode) {
    return (
      <View>
        <View style={[styles.warningContainer, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning }]}>
          <Icon 
            name="alert" 
            size={16} 
            color={theme.colors.warning} 
            style={styles.warningIcon}
          />
          <Text style={[styles.warningText, { color: theme.colors.warning }]}>
            {limitResult.remaining} {limitType} remaining ({Math.round(limitResult.percentageUsed)}% used)
          </Text>
        </View>
        {children}
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  upgradeContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    margin: 8,
  },
  upgradeContent: {
    alignItems: 'center',
  },
  lockIcon: {
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  upgradeMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  planInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  upgradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  warningIcon: {
    marginRight: 6,
  },
  warningText: {
    fontSize: 12,
    flex: 1,
  },
});

export default FeatureGate;