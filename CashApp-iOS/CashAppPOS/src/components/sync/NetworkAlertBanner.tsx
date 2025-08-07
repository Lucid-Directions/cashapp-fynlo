/**
 * NetworkAlertBanner - Alert banner for offline mode and sync issues
 * Shows prominent alerts when offline or when sync errors occur
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSyncStatus, useNetworkStatus } from '../../hooks/useSyncStatus';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Theme } from '../../design-system/theme';

const { width: screenWidth } = Dimensions.get('window');

interface NetworkAlertBannerProps {
  position?: 'top' | 'bottom';
  autoHide?: boolean;
  autoHideDelay?: number;
  onDismiss?: () => void;
  style?: any;
}

const NetworkAlertBanner: React.FC<NetworkAlertBannerProps> = ({
  position = 'top',
  autoHide = false,
  autoHideDelay = 5000,
  onDismiss,
  style,
}) => {
  const { theme } = useTheme();
  const { isOnline, networkType } = useNetworkStatus();
  const {
    queueSize,
    failedCount,
    conflictCount,
    isSyncing,
    canSync,
    triggerSync,
    retryFailed,
  } = useSyncStatus();

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = React.useState(false);
  const [dismissedOffline, setDismissedOffline] = React.useState(false);
  const autoHideTimer = useRef<NodeJS.Timeout>();

  // Determine if banner should be shown
  const shouldShowBanner = React.useMemo(() => {
    // Show when offline (unless dismissed)
    if (!isOnline && !dismissedOffline) return true;
    
    // Show when there are failed items
    if (failedCount > 0) return true;
    
    // Show when there are conflicts
    if (conflictCount > 0) return true;
    
    // Show when queue is getting large (>10 items)
    if (queueSize > 10 && !isSyncing) return true;
    
    return false;
  }, [isOnline, dismissedOffline, failedCount, conflictCount, queueSize, isSyncing]);

  // Get banner content based on priority
  const bannerContent = React.useMemo(() => {
    if (!isOnline) {
      return {
        type: 'offline',
        severity: 'warning',
        icon: 'wifi-off',
        title: 'Working Offline',
        message: queueSize > 0 
          ? `${queueSize} changes will sync when connection is restored`
          : 'Changes will be saved locally until connection is restored',
        action: null,
        color: theme.colors.warning[500],
        backgroundColor: theme.colors.warning[50],
      };
    }

    if (conflictCount > 0) {
      return {
        type: 'conflict',
        severity: 'error',
        icon: 'error',
        title: 'Sync Conflicts',
        message: `${conflictCount} conflicts need resolution`,
        action: { label: 'Review', onPress: () => {} }, // TODO: Navigate to conflicts screen
        color: theme.colors.danger[500],
        backgroundColor: theme.colors.danger[50],
      };
    }

    if (failedCount > 0) {
      return {
        type: 'failed',
        severity: 'error',
        icon: 'sync-problem',
        title: 'Sync Failed',
        message: `${failedCount} items failed to sync`,
        action: { label: 'Retry', onPress: retryFailed },
        color: theme.colors.danger[500],
        backgroundColor: theme.colors.danger[50],
      };
    }

    if (queueSize > 10) {
      return {
        type: 'pending',
        severity: 'info',
        icon: 'cloud-upload',
        title: 'Pending Sync',
        message: `${queueSize} changes waiting to sync`,
        action: canSync ? { label: 'Sync Now', onPress: triggerSync } : null,
        color: theme.colors.info[500],
        backgroundColor: theme.colors.info[50],
      };
    }

    return null;
  }, [
    isOnline,
    queueSize,
    failedCount,
    conflictCount,
    canSync,
    triggerSync,
    retryFailed,
    theme,
  ]);

  // Handle banner visibility animation
  useEffect(() => {
    if (shouldShowBanner && bannerContent) {
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Setup auto-hide timer
      if (autoHide && bannerContent.type !== 'offline') {
        autoHideTimer.current = setTimeout(() => {
          hideBanner();
        }, autoHideDelay);
      }
    } else {
      hideBanner();
    }

    return () => {
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
    };
  }, [shouldShowBanner, bannerContent, autoHide, autoHideDelay]);

  // Reset dismissed state when coming back online
  useEffect(() => {
    if (isOnline) {
      setDismissedOffline(false);
    }
  }, [isOnline]);

  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: position === 'top' ? -100 : 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
    });
  };

  const handleDismiss = () => {
    if (bannerContent?.type === 'offline') {
      setDismissedOffline(true);
    }
    hideBanner();
    onDismiss?.();
  };

  if (!isVisible || !bannerContent) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' && styles.containerBottom,
        {
          backgroundColor: bannerContent.backgroundColor,
          borderColor: bannerContent.color,
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Icon
          name={bannerContent.icon}
          size={24}
          color={bannerContent.color}
          style={styles.icon}
        />
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: bannerContent.color }]}>
            {bannerContent.title}
          </Text>
          <Text style={[styles.message, { color: bannerContent.color }]}>
            {bannerContent.message}
          </Text>
        </View>

        <View style={styles.actions}>
          {bannerContent.action && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: bannerContent.color }]}
              onPress={bannerContent.action.onPress}
              activeOpacity={0.8}
            >
              <Text style={styles.actionText}>
                {bannerContent.action.label}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Icon name="close" size={20} color={bannerContent.color} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar for pending items */}
      {queueSize > 0 && isSyncing && (
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar,
              { 
                backgroundColor: bannerContent.color,
                width: '50%', // TODO: Calculate actual progress
              }
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 2,
    zIndex: 9999,
    elevation: 10,
  },
  containerBottom: {
    top: undefined,
    bottom: 0,
    borderBottomWidth: 0,
    borderTopWidth: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#000',
  },
});

export default NetworkAlertBanner;
EOF < /dev/null