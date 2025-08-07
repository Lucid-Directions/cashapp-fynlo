/**
 * SyncStatusBar - Minimally intrusive status bar showing sync status
 * Always visible at the top/bottom of screens showing connection state and queue count
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Theme } from '../../design-system/theme';

interface SyncStatusBarProps {
  position?: 'top' | 'bottom';
  compact?: boolean;
  showDetails?: boolean;
  onPress?: () => void;
  style?: any;
}

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  position = 'top',
  compact = true,
  showDetails = false,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const {
    isOnline,
    isSyncing,
    queueSize,
    failedCount,
    conflictCount,
    canSync,
    triggerSync,
  } = useSyncStatus();

  // Animation for pulsing effect when syncing
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing, pulseAnim]);

  // Determine status display
  const statusDisplay = useMemo(() => {
    if (!isOnline) {
      return {
        color: theme.colors.danger[500],
        backgroundColor: theme.colors.danger[50],
        icon: 'cloud-off',
        text: 'Offline',
        description: queueSize > 0 ? `${queueSize} pending` : 'Working offline',
      };
    }

    if (isSyncing) {
      return {
        color: theme.colors.info[500],
        backgroundColor: theme.colors.info[50],
        icon: 'sync',
        text: 'Syncing',
        description: `Syncing ${queueSize} items...`,
      };
    }

    if (failedCount > 0) {
      return {
        color: theme.colors.warning[500],
        backgroundColor: theme.colors.warning[50],
        icon: 'warning',
        text: 'Sync Issues',
        description: `${failedCount} failed`,
      };
    }

    if (queueSize > 0) {
      return {
        color: theme.colors.warning[500],
        backgroundColor: theme.colors.warning[50],
        icon: 'cloud-upload',
        text: 'Pending',
        description: `${queueSize} to sync`,
      };
    }

    return {
      color: theme.colors.success[500],
      backgroundColor: theme.colors.success[50],
      icon: 'cloud-done',
      text: 'Synced',
      description: 'All data synced',
    };
  }, [isOnline, isSyncing, queueSize, failedCount, theme]);

  // Don't show if online and no pending items (unless explicitly set to always show)
  if (isOnline && queueSize === 0 && failedCount === 0 && !isSyncing && compact) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (canSync) {
      triggerSync();
    }
  };

  const containerStyles = [
    styles.container,
    position === 'bottom' && styles.containerBottom,
    {
      backgroundColor: statusDisplay.backgroundColor,
      borderColor: statusDisplay.color,
    },
    style,
  ];

  return (
    <Animated.View
      style={[
        containerStyles,
        isSyncing && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handlePress}
        activeOpacity={canSync || onPress ? 0.7 : 1}
        disabled={!canSync && !onPress}
      >
        <View style={styles.statusSection}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={statusDisplay.color} />
          ) : (
            <Icon name={statusDisplay.icon} size={20} color={statusDisplay.color} />
          )}
          <Text style={[styles.statusText, { color: statusDisplay.color }]}>
            {statusDisplay.text}
          </Text>
          {!compact && (
            <Text style={[styles.descriptionText, { color: statusDisplay.color }]}>
              • {statusDisplay.description}
            </Text>
          )}
        </View>

        {showDetails && (queueSize > 0 || failedCount > 0) && (
          <View style={styles.detailsSection}>
            {queueSize > 0 && (
              <View style={[styles.badge, { backgroundColor: statusDisplay.color }]}>
                <Text style={styles.badgeText}>{queueSize}</Text>
              </View>
            )}
            {failedCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.danger[500] }]}>
                <Text style={styles.badgeText}>{failedCount}</Text>
              </View>
            )}
          </View>
        )}

        {canSync && (
          <Icon 
            name="refresh" 
            size={18} 
            color={statusDisplay.color}
            style={styles.actionIcon}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 1000,
  },
  containerBottom: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 13,
    marginLeft: 8,
  },
  detailsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionIcon: {
    marginLeft: 8,
  },
});

export default SyncStatusBar;
