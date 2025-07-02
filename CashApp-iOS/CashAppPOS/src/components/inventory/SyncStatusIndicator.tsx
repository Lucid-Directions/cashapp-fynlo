/**
 * SyncStatusIndicator - Real-time sync status display with offline/online indicators
 * Shows connection status, pending changes, and provides manual sync controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors';
import useInventoryStore from '../../store/useInventoryStore';
import { inventoryOfflineSync } from '../../services/InventoryOfflineSync';

interface SyncStatusIndicatorProps {
  style?: any;
  showDetails?: boolean;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  style, 
  showDetails = false 
}) => {
  const { 
    syncStatus, 
    isRealTimeEnabled, 
    stockAlerts, 
    forceSync,
    clearStockAlert 
  } = useInventoryStore();
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const getStatusColor = (): string => {
    if (!isRealTimeEnabled) return Colors.darkGray;
    if (syncStatus.syncInProgress) return Colors.warning;
    if (syncStatus.failedActions > 0) return Colors.danger;
    if (syncStatus.pendingActions > 0) return Colors.warning;
    if (syncStatus.isOnline) return Colors.success;
    return Colors.darkGray;
  };

  const getStatusIcon = (): string => {
    if (!isRealTimeEnabled) return 'sync-disabled';
    if (syncStatus.syncInProgress) return 'sync';
    if (syncStatus.failedActions > 0) return 'sync-problem';
    if (syncStatus.pendingActions > 0) return 'sync';
    if (syncStatus.isOnline) return 'cloud-done';
    return 'cloud-off';
  };

  const getStatusText = (): string => {
    if (!isRealTimeEnabled) return 'Sync Disabled';
    if (syncStatus.syncInProgress) return 'Syncing...';
    if (syncStatus.failedActions > 0) return `${syncStatus.failedActions} Failed`;
    if (syncStatus.pendingActions > 0) return `${syncStatus.pendingActions} Pending`;
    if (syncStatus.isOnline) return 'Synced';
    return 'Offline';
  };

  const handleForceSync = async () => {
    if (isSyncing || !isRealTimeEnabled) return;

    try {
      setIsSyncing(true);
      await forceSync();
      Alert.alert('Sync Complete', 'All pending changes have been synchronized.');
    } catch (error) {
      Alert.alert('Sync Failed', 'Unable to sync changes. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSyncTime = (): string => {
    if (!syncStatus.lastSyncTime) return 'Never';
    
    const now = Date.now();
    const diff = now - syncStatus.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(syncStatus.lastSyncTime).toLocaleDateString();
  };

  const renderCompactView = () => (
    <TouchableOpacity 
      style={[styles.compactContainer, style]}
      onPress={() => setShowDetailModal(true)}
    >
      <Icon 
        name={getStatusIcon()} 
        size={16} 
        color={getStatusColor()}
        style={syncStatus.syncInProgress ? styles.spinning : undefined}
      />
      {showDetails && (
        <Text style={[styles.compactText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      )}
      {syncStatus.pendingActions > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{syncStatus.pendingActions}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDetailModal = () => (
    <Modal 
      visible={showDetailModal} 
      animationType="slide" 
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowDetailModal(false)}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Sync Status</Text>
          <TouchableOpacity 
            onPress={handleForceSync}
            disabled={isSyncing || !isRealTimeEnabled}
            style={[
              styles.syncButton,
              (!isRealTimeEnabled || isSyncing) && styles.syncButtonDisabled
            ]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Icon name="sync" size={20} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Status Overview */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Icon 
                name={getStatusIcon()} 
                size={24} 
                color={getStatusColor()}
                style={syncStatus.syncInProgress ? styles.spinning : undefined}
              />
              <Text style={[styles.statusTitle, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
            
            <View style={styles.statusDetails}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Connection:</Text>
                <Text style={[styles.statusValue, { 
                  color: syncStatus.isOnline ? Colors.success : Colors.danger 
                }]}>
                  {syncStatus.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Sync:</Text>
                <Text style={styles.statusValue}>{formatLastSyncTime()}</Text>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Real-time Sync:</Text>
                <Text style={[styles.statusValue, { 
                  color: isRealTimeEnabled ? Colors.success : Colors.darkGray 
                }]}>
                  {isRealTimeEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          </View>

          {/* Pending Actions */}
          {syncStatus.pendingActions > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Pending Changes ({syncStatus.pendingActions})
              </Text>
              <View style={styles.pendingCard}>
                <Icon name="schedule" size={20} color={Colors.warning} />
                <Text style={styles.pendingText}>
                  {syncStatus.pendingActions} change{syncStatus.pendingActions !== 1 ? 's' : ''} waiting to sync
                </Text>
              </View>
            </View>
          )}

          {/* Failed Actions */}
          {syncStatus.failedActions > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Failed Changes ({syncStatus.failedActions})
              </Text>
              <View style={[styles.pendingCard, { backgroundColor: Colors.danger + '10' }]}>
                <Icon name="error" size={20} color={Colors.danger} />
                <Text style={styles.pendingText}>
                  {syncStatus.failedActions} change{syncStatus.failedActions !== 1 ? 's' : ''} failed to sync
                </Text>
              </View>
            </View>
          )}

          {/* Conflict Actions */}
          {syncStatus.conflictActions > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Conflicts ({syncStatus.conflictActions})
              </Text>
              <View style={[styles.pendingCard, { backgroundColor: Colors.warning + '10' }]}>
                <Icon name="warning" size={20} color={Colors.warning} />
                <Text style={styles.pendingText}>
                  {syncStatus.conflictActions} change{syncStatus.conflictActions !== 1 ? 's' : ''} need manual resolution
                </Text>
              </View>
            </View>
          )}

          {/* Stock Alerts */}
          {stockAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Stock Alerts ({stockAlerts.length})
              </Text>
              {stockAlerts.map((alert, index) => (
                <View key={`${alert.sku}-${index}`} style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <Icon 
                      name={alert.alertType === 'OUT_OF_STOCK' ? 'error' : 'warning'} 
                      size={20} 
                      color={alert.priority === 'critical' ? Colors.danger : Colors.warning} 
                    />
                    <Text style={styles.alertTitle}>{alert.itemName}</Text>
                    <TouchableOpacity 
                      onPress={() => clearStockAlert(alert.sku)}
                      style={styles.alertClose}
                    >
                      <Icon name="close" size={16} color={Colors.darkGray} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.alertDescription}>
                    {alert.alertType.replace('_', ' ').toLowerCase()}: {alert.currentStock}g remaining
                    {alert.parLevel && ` (par level: ${alert.parLevel}g)`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Sync Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity 
              style={[
                styles.actionButton,
                (!isRealTimeEnabled || isSyncing) && styles.actionButtonDisabled
              ]}
              onPress={handleForceSync}
              disabled={!isRealTimeEnabled || isSyncing}
            >
              <Icon name="sync" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>
                Force Sync All Changes
              </Text>
            </TouchableOpacity>

            {syncStatus.failedActions > 0 && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: Colors.danger }]}
                onPress={async () => {
                  try {
                    await inventoryOfflineSync.clearFailedActions();
                    Alert.alert('Cleared', 'Failed actions have been cleared.');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to clear failed actions.');
                  }
                }}
              >
                <Icon name="delete" size={20} color={Colors.white} />
                <Text style={styles.actionButtonText}>
                  Clear Failed Actions
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <>
      {renderCompactView()}
      {renderDetailModal()}
    </>
  );
};

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    gap: 6,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  spinning: {
    // Note: React Native doesn't support CSS animations
    // In a real app, you'd use Animated API for rotation
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  syncButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: Colors.darkGray,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusDetails: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '10',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  pendingText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  alertCard: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  alertTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  alertClose: {
    padding: 4,
  },
  alertDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginLeft: 28,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.darkGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default SyncStatusIndicator;