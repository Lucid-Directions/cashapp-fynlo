import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import XeroCustomerSyncService from '../../services/XeroCustomerSyncService';
import XeroItemsSyncService from '../../services/XeroItemsSyncService';
import XeroSalesSyncService from '../../services/XeroSalesSyncService';
import XeroApiClient from '../../services/XeroApiClient';
import { Colors } from '../../design-system/theme';
import { XeroSyncStatus, XeroEntityType } from '../../types/xero';

interface SyncStatistics {
  customers: {
    totalMappings: number;
    lastSyncTime: Date | null;
    pendingSync: number;
  };
  items: {
    totalMappings: number;
    categoryMappings: number;
    lastSyncTime: Date | null;
    pendingSync: number;
  };
  sales: {
    totalMappings: number;
    syncedOrders: number;
    failedOrders: number;
    pendingOrders: number;
    lastSyncTime: Date | null;
  };
}

interface SyncOperation {
  id: string;
  type: XeroEntityType;
  status: XeroSyncStatus;
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  recordsSuccess: number;
  recordsFailed: number;
  error?: string;
}

interface ApiUsageInfo {
  remainingRequests: number;
  resetTime: number;
  dailyLimit: number;
  minuteLimit: number;
  queueLength: number;
  activeRequests: number;
  requestsThisMinute: number;
  requestsToday: number;
}

const XeroSyncDashboard: React.FC = () => {
  const navigation = useNavigation();
  const [statistics, setStatistics] = useState<SyncStatistics | null>(_null);
  const [apiUsage, setApiUsage] = useState<ApiUsageInfo | null>(_null);
  const [recentOperations, setRecentOperations] = useState<SyncOperation[]>([]);
  const [loading, setLoading] = useState(_true);
  const [refreshing, setRefreshing] = useState(_false);
  const [syncInProgress, setSyncInProgress] = useState(_false);
  const [selectedOperation, setSelectedOperation] = useState<SyncOperation | null>(_null);
  const [modalVisible, setModalVisible] = useState(_false);

  const customerSyncService = XeroCustomerSyncService.getInstance();
  const itemsSyncService = XeroItemsSyncService.getInstance();
  const salesSyncService = XeroSalesSyncService.getInstance();
  const apiClient = XeroApiClient.getInstance();

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    try {
      // Load statistics from all sync services
      const [customerStats, itemsStats, salesStats] = await Promise.all([
        customerSyncService.getSyncStatistics(),
        itemsSyncService.getSyncStatistics(),
        salesSyncService.getSyncStatistics(),
      ]);

      setStatistics({
        customers: customerStats,
        items: itemsStats,
        sales: salesStats,
      });

      // Load API usage information
      const rateLimitInfo = apiClient.getRateLimitInfo();
      const queueStatus = apiClient.getQueueStatus();

      setApiUsage({
        ...rateLimitInfo,
        ...queueStatus,
      });

      // Load recent operations (mock data for now)
      setRecentOperations([
        {
          id: '1',
          type: XeroEntityType.CONTACT,
          status: XeroSyncStatus.COMPLETED,
          startTime: new Date(Date.now() - 300000), // 5 minutes ago
          endTime: new Date(Date.now() - 280000),
          recordsProcessed: 15,
          recordsSuccess: 14,
          recordsFailed: 1,
        },
        {
          id: '2',
          type: XeroEntityType.ITEM,
          status: XeroSyncStatus.COMPLETED,
          startTime: new Date(Date.now() - 900000), // 15 minutes ago
          endTime: new Date(Date.now() - 870000),
          recordsProcessed: 8,
          recordsSuccess: 8,
          recordsFailed: 0,
        },
        {
          id: '3',
          type: XeroEntityType.INVOICE,
          status: XeroSyncStatus.FAILED,
          startTime: new Date(Date.now() - 1800000), // 30 minutes ago
          endTime: new Date(Date.now() - 1770000),
          recordsProcessed: 3,
          recordsSuccess: 1,
          recordsFailed: 2,
          error: 'Rate limit exceeded',
        },
      ]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to load sync dashboard data');
    }
  }, [customerSyncService, itemsSyncService, salesSyncService, apiClient]);

  /**
   * Handle manual sync trigger
   */
  const handleManualSync = (entityType: XeroEntityType) => {
    Alert.alert('Manual Sync', `Start manual synchronization for ${entityType}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start Sync',
        onPress: async () => {
          try {
            setSyncInProgress(_true);

            // This would trigger actual sync operations
            // For now, just simulate a sync
            await new Promise(resolve => setTimeout(_resolve, 3000));

            Alert.alert('Success', `${entityType} sync completed successfully`);
            await loadDashboardData();
          } catch (_error) {
            Alert.alert('Error', 'Manual sync failed');
          } finally {
            setSyncInProgress(_false);
          }
        },
      },
    ]);
  };

  /**
   * Handle refresh
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(_true);
    await loadDashboardData();
    setRefreshing(_false);
  }, [loadDashboardData]);

  /**
   * Format date for display
   */
  const formatDate = (date: Date | null) => {
    if (!date) {
      return 'Never';
    }
    return date.toLocaleString();
  };

  /**
   * Format duration
   */
  const formatDuration = (start: Date, end?: Date) => {
    if (!end) {
      return 'Running...';
    }
    const duration = end.getTime() - start.getTime();
    return `${Math.round(duration / 1000)}s`;
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: XeroSyncStatus) => {
    switch (_status) {
      case XeroSyncStatus.COMPLETED:
        return Colors.success;
      case XeroSyncStatus.FAILED:
        return Colors.error;
      case XeroSyncStatus.IN_PROGRESS:
        return Colors.warning;
      default:
        return Colors.textSecondary;
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: XeroSyncStatus) => {
    switch (_status) {
      case XeroSyncStatus.COMPLETED:
        return 'check-circle';
      case XeroSyncStatus.FAILED:
        return 'error';
      case XeroSyncStatus.IN_PROGRESS:
        return 'hourglass-empty';
      default:
        return 'help';
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      await loadDashboardData();
      setLoading(_false);
    };

    initializeDashboard();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(_loadDashboardData, 30000);
    return () => clearInterval(_interval);
  }, [loadDashboardData]);

  if (_loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading sync dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xero Sync Dashboard</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* API Usage Card */}
      {apiUsage && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="api" size={24} color={Colors.primary} />
            <Text style={styles.cardTitle}>API Usage</Text>
          </View>

          <View style={styles.apiUsageGrid}>
            <View style={styles.apiUsageItem}>
              <Text style={styles.apiUsageLabel}>Remaining Today</Text>
              <Text style={styles.apiUsageValue}>{apiUsage.remainingRequests}</Text>
            </View>
            <View style={styles.apiUsageItem}>
              <Text style={styles.apiUsageLabel}>Queue Length</Text>
              <Text style={styles.apiUsageValue}>{apiUsage.queueLength}</Text>
            </View>
            <View style={styles.apiUsageItem}>
              <Text style={styles.apiUsageLabel}>Active Requests</Text>
              <Text style={styles.apiUsageValue}>{apiUsage.activeRequests}</Text>
            </View>
            <View style={styles.apiUsageItem}>
              <Text style={styles.apiUsageLabel}>Requests/Min</Text>
              <Text style={styles.apiUsageValue}>
                {apiUsage.requestsThisMinute}/{apiUsage.minuteLimit}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Sync Statistics Cards */}
      {statistics && (
        <>
          {/* Customers */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="people" size={24} color={Colors.primary} />
              <Text style={styles.cardTitle}>Customer Sync</Text>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={() => handleManualSync(XeroEntityType.CONTACT)}
                disabled={syncInProgress}>
                <Icon name="sync" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Mappings</Text>
                <Text style={styles.statValue}>{statistics.customers.totalMappings}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Pending Sync</Text>
                <Text style={styles.statValue}>{statistics.customers.pendingSync}</Text>
              </View>
            </View>

            <Text style={styles.lastSyncText}>
              Last sync: {formatDate(statistics.customers.lastSyncTime)}
            </Text>
          </View>

          {/* Items */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="inventory" size={24} color={Colors.primary} />
              <Text style={styles.cardTitle}>Items Sync</Text>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={() => handleManualSync(XeroEntityType.ITEM)}
                disabled={syncInProgress}>
                <Icon name="sync" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Item Mappings</Text>
                <Text style={styles.statValue}>{statistics.items.totalMappings}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Category Mappings</Text>
                <Text style={styles.statValue}>{statistics.items.categoryMappings}</Text>
              </View>
            </View>

            <Text style={styles.lastSyncText}>
              Last sync: {formatDate(statistics.items.lastSyncTime)}
            </Text>
          </View>

          {/* Sales */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="receipt" size={24} color={Colors.primary} />
              <Text style={styles.cardTitle}>Sales Sync</Text>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={() => handleManualSync(XeroEntityType.INVOICE)}
                disabled={syncInProgress}>
                <Icon name="sync" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Synced Orders</Text>
                <Text style={styles.statValue}>{statistics.sales.syncedOrders}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Failed Orders</Text>
                <Text style={[styles.statValue, { color: Colors.error }]}>
                  {statistics.sales.failedOrders}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Pending Orders</Text>
                <Text style={styles.statValue}>{statistics.sales.pendingOrders}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Mappings</Text>
                <Text style={styles.statValue}>{statistics.sales.totalMappings}</Text>
              </View>
            </View>

            <Text style={styles.lastSyncText}>
              Last sync: {formatDate(statistics.sales.lastSyncTime)}
            </Text>
          </View>
        </>
      )}

      {/* Recent Operations */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="history" size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>Recent Operations</Text>
        </View>

        {recentOperations.map(operation => (
          <TouchableOpacity
            key={operation.id}
            style={styles.operationItem}
            onPress={() => {
              setSelectedOperation(_operation);
              setModalVisible(_true);
            }}>
            <View style={styles.operationHeader}>
              <Icon
                name={getStatusIcon(operation.status)}
                size={20}
                color={getStatusColor(operation.status)}
              />
              <Text style={styles.operationType}>{operation.type}</Text>
              <Text style={styles.operationTime}>{formatDate(operation.startTime)}</Text>
            </View>

            <View style={styles.operationStats}>
              <Text style={styles.operationStat}>Processed: {operation.recordsProcessed}</Text>
              <Text style={styles.operationStat}>Success: {operation.recordsSuccess}</Text>
              {operation.recordsFailed > 0 && (
                <Text style={[styles.operationStat, { color: Colors.error }]}>
                  Failed: {operation.recordsFailed}
                </Text>
              )}
              <Text style={styles.operationStat}>
                Duration: {formatDuration(operation.startTime, operation.endTime)}
              </Text>
            </View>

            {operation.error && (
              <Text style={styles.operationError} numberOfLines={1}>
                Error: {operation.error}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Operation Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(_false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOperation && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Operation Details</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(_false)}
                    style={styles.modalCloseButton}>
                    <Icon name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{selectedOperation.type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: getStatusColor(selectedOperation.status) },
                      ]}>
                      {selectedOperation.status}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Start Time:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedOperation.startTime)}
                    </Text>
                  </View>
                  {selectedOperation.endTime && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>End Time:</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(selectedOperation.endTime)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Records Processed:</Text>
                    <Text style={styles.detailValue}>{selectedOperation.recordsProcessed}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Successful:</Text>
                    <Text style={styles.detailValue}>{selectedOperation.recordsSuccess}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Failed:</Text>
                    <Text style={styles.detailValue}>{selectedOperation.recordsFailed}</Text>
                  </View>
                  {selectedOperation.error && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Error:</Text>
                      <Text style={[styles.detailValue, { color: Colors.error }]}>
                        {selectedOperation.error}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Sync Progress Indicator */}
      {syncInProgress && (
        <View style={styles.syncProgressOverlay}>
          <View style={styles.syncProgressContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.syncProgressText}>Synchronizing...</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
  syncButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiUsageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  apiUsageItem: {
    width: '48%',
    marginBottom: 12,
  },
  apiUsageLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  apiUsageValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    width: '48%',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  lastSyncText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  operationItem: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  operationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  operationType: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  operationTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  operationStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  operationStat: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  operationError: {
    fontSize: 12,
    color: Colors.error,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  syncProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncProgressContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  syncProgressText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text,
  },
});

export default XeroSyncDashboard;
