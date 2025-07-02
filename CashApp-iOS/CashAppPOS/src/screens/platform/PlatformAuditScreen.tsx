import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Text } from '../../components/ui/Text';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../design-system/ThemeProvider';
import PlatformService, { AuditRecord } from '../../services/PlatformService';
import SimpleTextInput from '../../components/inputs/SimpleTextInput';

interface FilterOptions {
  configType?: string;
  configKey?: string;
  changedBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface AuditSummary {
  totalChanges: number;
  recentChanges: number;
  topChangers: Array<{ user: string; changes: number }>;
  topConfigs: Array<{ config: string; changes: number }>;
}

const PlatformAuditScreen: React.FC = () => {
  const { theme } = useTheme();
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const platformService = PlatformService.getInstance();

  useEffect(() => {
    loadAuditData();
  }, [filters]);

  const loadAuditData = async () => {
    try {
      setError(null);
      
      // Load audit records
      const records = await platformService.getAuditTrail(
        filters.configKey,
        undefined,
        100
      );
      
      // Generate mock summary data
      const mockSummary: AuditSummary = {
        totalChanges: 245,
        recentChanges: 18,
        topChangers: [
          { user: 'admin@fynlo.com', changes: 45 },
          { user: 'platform-admin', changes: 32 },
          { user: 'migration_script', changes: 156 },
        ],
        topConfigs: [
          { config: 'payment.fees.stripe', changes: 8 },
          { config: 'payment.fees.qr_code', changes: 6 },
          { config: 'business.max_discount', changes: 4 },
        ],
      };

      // Mock additional audit records for demonstration
      const mockRecords: AuditRecord[] = [
        {
          id: '1',
          config_type: 'platform',
          config_key: 'payment.fees.stripe',
          entity_id: 'platform-config-1',
          old_value: { percentage: 1.4, fixed_fee: 0.20 },
          new_value: { percentage: 1.45, fixed_fee: 0.20 },
          change_reason: 'Updated to reflect new Stripe pricing',
          change_source: 'admin_api',
          changed_by: 'admin@fynlo.com',
          changed_at: '2024-06-22T14:30:00Z',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (platform-admin)',
        },
        {
          id: '2',
          config_type: 'restaurant',
          config_key: 'payment.markup.qr_code',
          entity_id: 'restaurant-123',
          old_value: null,
          new_value: { percentage: 0.3 },
          change_reason: 'Restaurant requested higher markup for QR payments',
          change_source: 'restaurant_api',
          changed_by: 'restaurant-admin@example.com',
          changed_at: '2024-06-22T10:15:00Z',
          ip_address: '203.0.113.45',
          user_agent: 'Fynlo-Mobile/1.0',
        },
        {
          id: '3',
          config_type: 'migration',
          config_key: 'platform_settings_migration',
          entity_id: 'restaurant-456',
          old_value: { paymentFees: { stripe: 1.2 } },
          new_value: { migrated_to: 'platform_controlled' },
          change_reason: 'Automated migration to platform-controlled settings architecture',
          change_source: 'migration_script',
          changed_by: 'system',
          changed_at: '2024-06-21T09:00:00Z',
          ip_address: null,
          user_agent: null,
        },
      ];

      setAuditRecords([...mockRecords, ...records]);
      setSummary(mockSummary);
    } catch (err) {
      console.error('Failed to load audit data:', err);
      setError('Failed to load audit trail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAuditData();
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChangeTypeColor = (configType: string): string => {
    switch (configType) {
      case 'platform':
        return theme.colors.primary;
      case 'restaurant':
        return theme.colors.warning;
      case 'migration':
        return '#9B59B6';
      default:
        return theme.colors.textLight;
    }
  };

  const getChangeTypeIcon = (configType: string): string => {
    switch (configType) {
      case 'platform':
        return 'settings';
      case 'restaurant':
        return 'store';
      case 'migration':
        return 'sync';
      default:
        return 'edit';
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value.toString();
  };

  const toggleRecordExpansion = (recordId: string) => {
    setExpandedRecord(expandedRecord === recordId ? null : recordId);
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filter Audit Trail</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Configuration Type</Text>
            <View style={styles.filterButtons}>
              {['platform', 'restaurant', 'migration'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterButton,
                    filters.configType === type && styles.filterButtonActive
                  ]}
                  onPress={() => setFilters(prev => ({
                    ...prev,
                    configType: prev.configType === type ? undefined : type
                  }))}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filters.configType === type && styles.filterButtonTextActive
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <SimpleTextInput
              label="Configuration Key"
              value={filters.configKey || ''}
              onValueChange={(text) => setFilters(prev => ({ ...prev, configKey: text || undefined }))}
              placeholder="e.g., payment.fees.stripe"
              style={styles.filterInput}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.filterSection}>
            <SimpleTextInput
              label="Changed By"
              value={filters.changedBy || ''}
              onValueChange={(text) => setFilters(prev => ({ ...prev, changedBy: text || undefined }))}
              placeholder="User email or system"
              style={styles.filterInput}
              clearButtonMode="while-editing"
            />
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <Button
            title="Clear Filters"
            variant="secondary"
            onPress={() => setFilters({})}
            style={styles.modalButton}
          />
          <Button
            title="Apply Filters"
            onPress={() => setShowFilters(false)}
            style={styles.modalButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading audit trail...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={loadAuditData} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Audit Trail</Text>
          <Text style={styles.subtitle}>Configuration change history</Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Icon name="filter-list" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        {summary && (
          <>
            <View style={styles.summaryGrid}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.totalChanges}</Text>
                <Text style={styles.summaryLabel}>Total Changes</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.recentChanges}</Text>
                <Text style={styles.summaryLabel}>Last 24 Hours</Text>
              </Card>
            </View>

            <Card style={styles.topChangersCard}>
              <Text style={styles.cardTitle}>Top Contributors</Text>
              {summary.topChangers.map((changer, index) => (
                <View key={changer.user} style={styles.topChangerItem}>
                  <View style={styles.topChangerInfo}>
                    <Text style={styles.topChangerUser}>{changer.user}</Text>
                    <Text style={styles.topChangerCount}>{changer.changes} changes</Text>
                  </View>
                  <View style={styles.topChangerRank}>
                    <Text style={styles.topChangerRankText}>#{index + 1}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Active Filters */}
        {Object.keys(filters).length > 0 && (
          <Card style={styles.filtersCard}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Active Filters</Text>
              <TouchableOpacity onPress={() => setFilters({})}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterTags}>
              {filters.configType && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>Type: {filters.configType}</Text>
                </View>
              )}
              {filters.configKey && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>Key: {filters.configKey}</Text>
                </View>
              )}
              {filters.changedBy && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>User: {filters.changedBy}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Audit Records */}
        <Text style={styles.sectionTitle}>Change History</Text>
        {auditRecords.map((record) => (
          <Card key={record.id} style={styles.auditCard}>
            <TouchableOpacity
              style={styles.auditHeader}
              onPress={() => toggleRecordExpansion(record.id)}
            >
              <View style={styles.auditInfo}>
                <View style={styles.auditTitleRow}>
                  <Icon
                    name={getChangeTypeIcon(record.config_type)}
                    size={16}
                    color={getChangeTypeColor(record.config_type)}
                  />
                  <Text style={styles.auditConfigKey}>{record.config_key}</Text>
                  <View style={[styles.auditTypeBadge, { backgroundColor: getChangeTypeColor(record.config_type) }]}>
                    <Text style={styles.auditTypeBadgeText}>{record.config_type}</Text>
                  </View>
                </View>
                <Text style={styles.auditMetadata}>
                  {formatDateTime(record.changed_at)} • {record.changed_by}
                </Text>
                {record.change_reason && (
                  <Text style={styles.auditReason}>{record.change_reason}</Text>
                )}
              </View>
              <Icon
                name={expandedRecord === record.id ? 'expand-less' : 'expand-more'}
                size={24}
                color={theme.colors.textLight}
              />
            </TouchableOpacity>

            {expandedRecord === record.id && (
              <View style={styles.auditDetails}>
                <View style={styles.auditDetailSection}>
                  <Text style={styles.auditDetailLabel}>Previous Value:</Text>
                  <View style={styles.auditDetailValue}>
                    <Text style={styles.auditDetailText}>
                      {formatValue(record.old_value)}
                    </Text>
                  </View>
                </View>

                <View style={styles.auditDetailSection}>
                  <Text style={styles.auditDetailLabel}>New Value:</Text>
                  <View style={styles.auditDetailValue}>
                    <Text style={styles.auditDetailText}>
                      {formatValue(record.new_value)}
                    </Text>
                  </View>
                </View>

                <View style={styles.auditMetadataSection}>
                  <View style={styles.auditMetadataRow}>
                    <Text style={styles.auditMetadataLabel}>Source:</Text>
                    <Text style={styles.auditMetadataValue}>{record.change_source}</Text>
                  </View>
                  {record.ip_address && (
                    <View style={styles.auditMetadataRow}>
                      <Text style={styles.auditMetadataLabel}>IP Address:</Text>
                      <Text style={styles.auditMetadataValue}>{record.ip_address}</Text>
                    </View>
                  )}
                  {record.user_agent && (
                    <View style={styles.auditMetadataRow}>
                      <Text style={styles.auditMetadataLabel}>User Agent:</Text>
                      <Text style={styles.auditMetadataValue}>{record.user_agent}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </Card>
        ))}

        {auditRecords.length === 0 && (
          <Card style={styles.emptyCard}>
            <Icon name="history" size={48} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>No Audit Records</Text>
            <Text style={styles.emptyText}>
              No configuration changes found for the selected filters.
            </Text>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textLight,
  },
  filterButton: {
    padding: theme.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    marginVertical: theme.spacing.lg,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  topChangersCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  topChangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topChangerInfo: {
    flex: 1,
  },
  topChangerUser: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  topChangerCount: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  topChangerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topChangerRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  filtersCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  clearFiltersText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  filterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterTag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  filterTagText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  auditCard: {
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  auditInfo: {
    flex: 1,
  },
  auditTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  auditConfigKey: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  auditTypeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  auditTypeBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  auditMetadata: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  auditReason: {
    fontSize: 14,
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  auditDetails: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  auditDetailSection: {
    marginBottom: theme.spacing.md,
  },
  auditDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  auditDetailValue: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  auditDetailText: {
    fontSize: 12,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
  auditMetadataSection: {
    gap: theme.spacing.xs,
  },
  auditMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  auditMetadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    width: 80,
  },
  auditMetadataValue: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: theme.spacing.xl,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  filterSection: {
    marginTop: theme.spacing.lg,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalButton: {
    flex: 1,
  },
});

export default PlatformAuditScreen;