import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService';
import LoadingView from '../../components/feedback/LoadingView';
import ComingSoon from '../../components/feedback/ComingSoon';

// Mock ENV flag
const ENV = {
  FEATURE_REPORTS: true, // Set to true to enable, false to show ComingSoon
};

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  mediumGray: '#BDC3C7',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

interface StaffMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  totalSales: number;
  transactionsHandled: number;
  averageOrderValue: number;
  hoursWorked: number;
  efficiency: number;
  customerRating: number;
  shiftsCompleted: number;
  performance: 'excellent' | 'good' | 'average' | 'needs_improvement';
}

const StaffReportDetailScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [staffData, setStaffData] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedMetric, setSelectedMetric] = useState('sales');

  const handleExportReport = () => {
    Alert.alert('Export Staff Report', 'Choose export format', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'PDF Report',
        onPress: () => Alert.alert('PDF Export', 'Staff performance PDF coming soon'),
      },
      { text: 'CSV Data', onPress: () => Alert.alert('CSV Export', 'Staff data CSV coming soon') },
      {
        text: 'Email Summary',
        onPress: () => Alert.alert('Email Report', 'Email functionality coming soon'),
      },
    ]);
  };

  useEffect(() => {
    if (ENV.FEATURE_REPORTS) {
      loadStaffData();
    } else {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  const loadStaffData = async () => {
    // Modified
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming getStaffReportDetail returns data in StaffMember[] shape for the selectedPeriod
      // and that this data is already processed (e.g., sorted, metrics calculated).
      const data = await dataService.getStaffReportDetail(selectedPeriod);
      setStaffData(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load staff report.');
      setStaffData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // The complex data transformation logic previously here (extracting staff from sales history, calculating metrics)
  // is now assumed to be handled by the backend or DataService.getStaffReportDetail.
  // For this refactor, we assume the service provides the necessary StaffMember[] structure with pre-calculated metrics.

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent':
        return Colors.success;
      case 'good':
        return Colors.primary;
      case 'average':
        return Colors.warning;
      case 'needs_improvement':
        return Colors.danger;
      default:
        return Colors.lightText;
    }
  };

  const getPerformanceIcon = (performance: string) => {
    switch (performance) {
      case 'excellent':
        return 'star';
      case 'good':
        return 'thumb-up';
      case 'average':
        return 'trending-flat';
      case 'needs_improvement':
        return 'trending-down';
      default:
        return 'help';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'manager':
        return 'supervisor-account';
      case 'cashier':
        return 'point-of-sale';
      case 'cook':
        return 'restaurant';
      case 'server':
        return 'room-service';
      default:
        return 'person';
    }
  };

  const getTopPerformer = () => {
    if (staffData.length === 0) {
      return null;
    }

    switch (selectedMetric) {
      case 'sales':
        return staffData.reduce((prev, current) =>
          prev.totalSales > current.totalSales ? prev : current,
        );
      case 'transactions':
        return staffData.reduce((prev, current) =>
          prev.transactionsHandled > current.transactionsHandled ? prev : current,
        );
      case 'efficiency':
        return staffData.reduce((prev, current) =>
          prev.efficiency > current.efficiency ? prev : current,
        );
      default:
        return staffData[0];
    }
  };

  const getStaffStats = () => {
    const totalSales = staffData.reduce((sum, staff) => sum + staff.totalSales, 0);
    const totalTransactions = staffData.reduce((sum, staff) => sum + staff.transactionsHandled, 0);
    const totalHours = staffData.reduce((sum, staff) => sum + staff.hoursWorked, 0);
    const averageRating =
      staffData.length > 0
        ? staffData.reduce((sum, staff) => sum + staff.customerRating, 0) / staffData.length
        : 0;

    return { totalSales, totalTransactions, totalHours, averageRating };
  };

  const topPerformer = staffData.length > 0 ? getTopPerformer() : null;
  const stats = getStaffStats(); // This will use staffData, which might be empty

  if (!ENV.FEATURE_REPORTS) {
    return <ComingSoon />;
  }

  if (isLoading) {
    return <LoadingView message="Loading Staff Report..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Staff Report</Text>
          <View style={{ width: 24 }} />
          {/* Placeholder for balance */}
        </View>
        <View style={styles.centeredError}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorTextHeader}>Error Loading Report</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadStaffData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handling for when staffData is empty after loading (no error)
  // but still want to show the period selector etc.
  const renderContent = () => {
    if (staffData.length === 0) {
      return (
        <View style={styles.centeredError}>
          <Icon name="people-outline" size={64} color={Colors.mediumGray} />
          <Text style={styles.errorTextHeader}>No Staff Data</Text>
          <Text style={styles.errorText}>
            There is no staff data available for the selected period.
          </Text>
        </View>
      );
    }
    return (
      <>
        {/* Top Performer */}
        {topPerformer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performer ({selectedMetric})</Text>
            <View style={styles.topPerformerCard}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.avatarText}>{topPerformer.avatar}</Text>
                </View>
                <View style={styles.crownIcon}>
                  <Icon name="emoji-events" size={20} color={Colors.warning} />
                </View>
              </View>

              <View style={styles.performerInfo}>
                <Text style={styles.performerName}>{topPerformer.name}</Text>
                <Text style={styles.performerRole}>{topPerformer.role}</Text>

                <View style={styles.performerStats}>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {formatCurrency(topPerformer.totalSales)}
                    </Text>
                    <Text style={styles.performerStatLabel}>Sales</Text>
                  </View>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {topPerformer.transactionsHandled}
                    </Text>
                    <Text style={styles.performerStatLabel}>Orders</Text>
                  </View>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {topPerformer.efficiency.toFixed(1)}/h
                    </Text>
                    <Text style={styles.performerStatLabel}>Efficiency</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Metric Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sort by Performance</Text>
          <View style={styles.metricSelector}>
            {['sales', 'transactions', 'efficiency'].map(metric => (
              <TouchableOpacity
                key={metric}
                style={[
                  styles.metricButton,
                  selectedMetric === metric && styles.metricButtonActive,
                ]}
                onPress={() => setSelectedMetric(metric)}>
                <Text
                  style={[styles.metricText, selectedMetric === metric && styles.metricTextActive]}>
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Staff List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Performance</Text>

          {staffData
            .sort((a, b) => {
              switch (selectedMetric) {
                case 'sales':
                  return b.totalSales - a.totalSales;
                case 'transactions':
                  return b.transactionsHandled - a.transactionsHandled;
                case 'efficiency':
                  return b.efficiency - a.efficiency;
                default:
                  return 0;
              }
            })
            .map((staff, index) => (
              <View key={staff.id} style={styles.staffCard}>
                <View style={styles.staffHeader}>
                  <View style={styles.staffBasicInfo}>
                    <View style={[styles.avatar, { backgroundColor: Colors.secondary }]}>
                      <Text style={styles.avatarText}>{staff.avatar}</Text>
                    </View>

                    <View style={styles.staffDetails}>
                      <View style={styles.staffNameRow}>
                        <Text style={styles.staffName}>{staff.name}</Text>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>#{index + 1}</Text>
                        </View>
                      </View>

                      <View style={styles.staffRoleRow}>
                        <Icon name={getRoleIcon(staff.role)} size={16} color={Colors.lightText} />
                        <Text style={styles.staffRole}>{staff.role}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.performanceIndicator}>
                    <Icon
                      name={getPerformanceIcon(staff.performance)}
                      size={20}
                      color={getPerformanceColor(staff.performance)}
                    />
                    <Text
                      style={[
                        styles.performanceText,
                        { color: getPerformanceColor(staff.performance) },
                      ]}>
                      {staff.performance.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.staffMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Sales</Text>
                    <Text style={styles.metricValue}>{formatCurrency(staff.totalSales)}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Orders</Text>
                    <Text style={styles.metricValue}>{staff.transactionsHandled}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Avg Order</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(staff.averageOrderValue)}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Hours</Text>
                    <Text style={styles.metricValue}>{staff.hoursWorked.toFixed(1)}h</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Efficiency</Text>
                    <Text style={styles.metricValue}>{formatCurrency(staff.efficiency)}/h</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Rating</Text>
                    <Text style={styles.metricValue}>{staff.customerRating.toFixed(1)}★</Text>
                  </View>
                </View>

                {/* Performance Bar */}
                <View style={styles.performanceBarContainer}>
                  <Text style={styles.performanceBarLabel}>Performance Score</Text>
                  <View style={styles.performanceBar}>
                    <View
                      style={[
                        styles.performanceBarFill,
                        {
                          width: `${Math.min((staff.efficiency / 150) * 100, 100)}%`, // Example logic
                          backgroundColor: getPerformanceColor(staff.performance),
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Report</Text>
        <TouchableOpacity style={styles.headerAction} onPress={handleExportReport}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['today', 'week', 'month'].map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(period)}>
            <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Overall Stats */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{staffData.length}</Text>
            <Text style={styles.summaryLabel}>Active Staff</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatCurrency(stats.totalSales)}</Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{Math.round(stats.totalHours)}h</Text>
            <Text style={styles.summaryLabel}>Hours Worked</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.averageRating.toFixed(1)}★</Text>
            <Text style={styles.summaryLabel}>Avg Rating</Text>
          </View>
        </View>

        {/* Top Performer */}
        {topPerformer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performer ({selectedMetric})</Text>
            <View style={styles.topPerformerCard}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.avatarText}>{topPerformer.avatar}</Text>
                </View>
                <View style={styles.crownIcon}>
                  <Icon name="emoji-events" size={20} color={Colors.warning} />
                </View>
              </View>

              <View style={styles.performerInfo}>
                <Text style={styles.performerName}>{topPerformer.name}</Text>
                <Text style={styles.performerRole}>{topPerformer.role}</Text>

                <View style={styles.performerStats}>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {formatCurrency(topPerformer.totalSales)}
                    </Text>
                    <Text style={styles.performerStatLabel}>Sales</Text>
                  </View>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {topPerformer.transactionsHandled}
                    </Text>
                    <Text style={styles.performerStatLabel}>Orders</Text>
                  </View>
                  <View style={styles.performerStat}>
                    <Text style={styles.performerStatValue}>
                      {topPerformer.efficiency.toFixed(1)}/h
                    </Text>
                    <Text style={styles.performerStatLabel}>Efficiency</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Metric Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sort by Performance</Text>
          <View style={styles.metricSelector}>
            {['sales', 'transactions', 'efficiency'].map(metric => (
              <TouchableOpacity
                key={metric}
                style={[
                  styles.metricButton,
                  selectedMetric === metric && styles.metricButtonActive,
                ]}
                onPress={() => setSelectedMetric(metric)}>
                <Text
                  style={[styles.metricText, selectedMetric === metric && styles.metricTextActive]}>
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Staff List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Performance</Text>

          {staffData
            .sort((a, b) => {
              switch (selectedMetric) {
                case 'sales':
                  return b.totalSales - a.totalSales;
                case 'transactions':
                  return b.transactionsHandled - a.transactionsHandled;
                case 'efficiency':
                  return b.efficiency - a.efficiency;
                default:
                  return 0;
              }
            })
            .map((staff, index) => (
              <View key={staff.id} style={styles.staffCard}>
                <View style={styles.staffHeader}>
                  <View style={styles.staffBasicInfo}>
                    <View style={[styles.avatar, { backgroundColor: Colors.secondary }]}>
                      <Text style={styles.avatarText}>{staff.avatar}</Text>
                    </View>

                    <View style={styles.staffDetails}>
                      <View style={styles.staffNameRow}>
                        <Text style={styles.staffName}>{staff.name}</Text>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>#{index + 1}</Text>
                        </View>
                      </View>

                      <View style={styles.staffRoleRow}>
                        <Icon name={getRoleIcon(staff.role)} size={16} color={Colors.lightText} />
                        <Text style={styles.staffRole}>{staff.role}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.performanceIndicator}>
                    <Icon
                      name={getPerformanceIcon(staff.performance)}
                      size={20}
                      color={getPerformanceColor(staff.performance)}
                    />
                    <Text
                      style={[
                        styles.performanceText,
                        { color: getPerformanceColor(staff.performance) },
                      ]}>
                      {staff.performance.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.staffMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Sales</Text>
                    <Text style={styles.metricValue}>{formatCurrency(staff.totalSales)}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Orders</Text>
                    <Text style={styles.metricValue}>{staff.transactionsHandled}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Avg Order</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(staff.averageOrderValue)}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Hours</Text>
                    <Text style={styles.metricValue}>{staff.hoursWorked.toFixed(1)}h</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Efficiency</Text>
                    <Text style={styles.metricValue}>{formatCurrency(staff.efficiency)}/h</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Rating</Text>
                    <Text style={styles.metricValue}>{staff.customerRating.toFixed(1)}★</Text>
                  </View>
                </View>

                {/* Performance Bar */}
                <View style={styles.performanceBarContainer}>
                  <Text style={styles.performanceBarLabel}>Performance Score</Text>
                  <View style={styles.performanceBar}>
                    <View
                      style={[
                        styles.performanceBarFill,
                        {
                          width: `${Math.min((staff.efficiency / 150) * 100, 100)}%`,
                          backgroundColor: getPerformanceColor(staff.performance),
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerAction: {
    padding: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  periodTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 2,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.lightText,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  topPerformerCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  crownIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  performerRole: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 12,
  },
  performerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performerStat: {
    alignItems: 'center',
  },
  performerStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  performerStatLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  metricSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
  },
  metricButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricButtonActive: {
    backgroundColor: Colors.primary,
  },
  metricText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  metricTextActive: {
    color: Colors.white,
  },
  staffCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  staffBasicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  staffDetails: {
    marginLeft: 12,
    flex: 1,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  rankBadge: {
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  staffRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  staffRole: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 4,
  },
  performanceIndicator: {
    alignItems: 'center',
  },
  performanceText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  staffMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  performanceBarContainer: {
    marginTop: 8,
  },
  performanceBarLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 6,
  },
  performanceBar: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  spacer: {
    height: 40,
  },
  centeredError: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  errorTextHeader: {
    // Added
    fontSize: 18, // Using fixed size as getFontSize might not be defined in this scope
    fontWeight: 'bold',
    color: Colors.danger,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    // Added
    fontSize: 14, // Using fixed size
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    // Added
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    color: Colors.white,
    fontSize: 16, // Using fixed size
    fontWeight: '600',
  },
});

export default StaffReportDetailScreen;
