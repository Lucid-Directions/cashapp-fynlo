/**
 * WebSocketStatus - Visual indicator for WebSocket connection status
 * Shows connection state, reconnection attempts, and manual reconnect option
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useWebSocketStatus } from '../hooks/useWebSocketStatus';
import { Colors, Typography } from '../design-system/theme';

interface WebSocketStatusProps {
  compact?: boolean;
  showDetails?: boolean;
  style?: any;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  compact = false,
  showDetails = true,
  style 
}) => {
  const {
    status,
    attemptNumber,
    maxAttempts,
    nextRetryTime,
    canManualReconnect,
    manualReconnect,
    lastConnectedTime,
    lastDisconnectedTime,
  } = useWebSocketStatus();

  // Get status display properties
  const statusDisplay = useMemo(() => {
    switch (status) {
      case 'connected':
        return {
          color: Colors.success,
          icon: 'wifi',
          text: 'Connected',
          shortText: 'Live',
        };
      case 'connecting':
        return {
          color: Colors.warning,
          icon: 'wifi-tethering',
          text: 'Connecting...',
          shortText: 'Connecting',
        };
      case 'reconnecting':
        return {
          color: Colors.warning,
          icon: 'sync',
          text: 'Reconnecting...',
          shortText: 'Reconnecting',
        };
      case 'disconnected':
        return {
          color: Colors.error,
          icon: 'wifi-off',
          text: 'Disconnected',
          shortText: 'Offline',
        };
    }
  }, [status]);

  // Format time elapsed
  const formatTimeElapsed = (date: Date | null) => {
    if (\!date) return null;
    
    const elapsed = Date.now() - date.getTime();
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) return seconds + 's ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  };

  // Compact view
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { borderColor: statusDisplay.color }, style]}
        onPress={canManualReconnect ? manualReconnect : undefined}
        disabled={\!canManualReconnect}
        activeOpacity={canManualReconnect ? 0.7 : 1}
      >
        {status === 'connecting' || status === 'reconnecting' ? (
          <ActivityIndicator size="small" color={statusDisplay.color} />
        ) : (
          <Icon name={statusDisplay.icon} size={16} color={statusDisplay.color} />
        )}
        <Text style={[styles.compactText, { color: statusDisplay.color }]}>
          {statusDisplay.shortText}
        </Text>
        {nextRetryTime \!== null && (
          <Text style={[styles.countdownText, { color: statusDisplay.color }]}>
            ({nextRetryTime}s)
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // Full view
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.statusIndicator}>
          {status === 'connecting' || status === 'reconnecting' ? (
            <ActivityIndicator size="small" color={statusDisplay.color} />
          ) : (
            <Icon name={statusDisplay.icon} size={24} color={statusDisplay.color} />
          )}
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {statusDisplay.text}
            </Text>
            {status === 'reconnecting' && attemptNumber > 0 && (
              <Text style={styles.attemptText}>
                Attempt {attemptNumber}/{maxAttempts}
              </Text>
            )}
          </View>
        </View>
        
        {nextRetryTime \!== null && (
          <View style={styles.countdownContainer}>
            <Icon name="schedule" size={16} color={Colors.textSecondary} />
            <Text style={styles.countdownText}>
              {nextRetryTime}s
            </Text>
          </View>
        )}
      </View>

      {showDetails && (
        <View style={styles.details}>
          {lastConnectedTime && status \!== 'connected' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last connected:</Text>
              <Text style={styles.detailValue}>
                {formatTimeElapsed(lastConnectedTime)}
              </Text>
            </View>
          )}
          
          {lastDisconnectedTime && status === 'connected' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Connected for:</Text>
              <Text style={styles.detailValue}>
                {formatTimeElapsed(lastDisconnectedTime)}
              </Text>
            </View>
          )}
        </View>
      )}

      {canManualReconnect && (
        <TouchableOpacity
          style={styles.reconnectButton}
          onPress={manualReconnect}
          activeOpacity={0.7}
        >
          <Icon name="refresh" size={20} color={Colors.white} />
          <Text style={styles.reconnectButtonText}>
            Reconnect Now
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  compactText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  attemptText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.neutral[100],
    borderRadius: 12,
  },
  countdownText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.caption,
    color: Colors.text,
  },
  reconnectButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  reconnectButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});

export default WebSocketStatus;
EOF < /dev/null