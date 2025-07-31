// TODO: Unused import - import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  _ActivityIndicator, // Will be replaced by LoadingView
  _Alert,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// import { generateEmployees, generateSalesHistory, EmployeeData } from '../../utils/mockDataGenerator'; // Removed
import ComingSoon from '../../components/feedback/ComingSoon'; // Added
import LoadingView from '../../components/feedback/LoadingView'; // Added
import Colors from '../../constants/Colors'; // Keep for now, though theme might override
import { useTheme } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService'; // Added
import { _EmployeeData } from '../../types'; // Updated import path

// Mock ENV flag (would typically come from an env config file)
const ENV = {
  FEATURE_REPORTS: true, // Set to true to enable, false to show ComingSoon
};

// Get screen dimensions for responsive design
const { width: screenWidth, height: _screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;
const isSmallDevice = screenWidth < 380;

// Responsive font sizes
const getFontSize = (base: number) => {
  if (isTablet) return base * 1.2;
  if (isSmallDevice) return base * 0.9;
  return base;
};

const ReportsScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  // const [employees, setEmployees] = useState<EmployeeData[]>([]); // Will come from reportDashboardData
  // const [salesData, setSalesData] = useState<any[]>([]); // Will come from reportDashboardData
  const [reportDashboardData, setReportDashboardData] = useState<any | null>(null); // New state for combined data
  const [isLoading, setIsLoading] = useState<boolean>(true); // Renamed from loading
  const [error, setError] = useState<string | null>(null); // Added

  useEffect(() => {
    if (ENV.FEATURE_REPORTS) {
      loadReportData();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming getReportsDashboardData returns an object with all necessary pre-calculated metrics and lists
      const dashboardData = await dataService.getReportsDashboardData();
      setReportDashboardData(dashboardData);
    } catch (e: unknown) {
      setError(e.message || 'Failed to load report data.');
      setReportDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations will now use reportDashboardData if it's not null
  // Or display placeholder/empty if reportDashboardData is null after loading without error.

  // Example of how metrics would be accessed (adjust based on actual structure from DataService)
  const todayMetrics = reportDashboardData?.todaySummary || {
    totalSales: 0,
    transactions: 0,
    averageOrder: 0,
  };

  const laborMetrics = reportDashboardData?.weeklyLabor || {
    totalActualHours: 0,
    totalLaborCost: 0,
    efficiency: 0,
  };

  const topItemsToday = reportDashboardData?.topItemsToday || []; // e.g., [{name: 'Tacos', count: 15}]
  const topPerformersToday = reportDashboardData?.topPerformersToday || []; // e.g., EmployeeData[]

  if (!ENV.FEATURE_REPORTS) {
    return <ComingSoon />;
  }

  if (isLoading) {
    return <LoadingView message="Loading Reports Dashboard..." />;
  }

  if (error || !reportDashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reports</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centeredError}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorTextHeader}>Error Loading Reports</Text>
          <Text style={styles.errorText}>{error || 'No report data available.'}</Text>
          <TouchableOpacity onPress={loadReportData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Today's Summary</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.success }]}>
                  £{todayMetrics.totalSales.toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Total Sales</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>
                  {todayMetrics.transactions}
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Orders</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.secondary }]}>
                  £{todayMetrics.averageOrder.toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Avg Order</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Labor Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>This Week's Labor</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.warning }]}>
                  {laborMetrics.totalActualHours}h
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Hours Worked</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.danger }]}>
                  £{laborMetrics.totalLaborCost.toFixed(0)}
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Labor Cost</Text>
              </View>
              <View style={styles.stat}>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color:
                        laborMetrics.efficiency >= 90
                          ? Colors.success
                          : laborMetrics.efficiency >= 80
                          ? Colors.warning
                          : Colors.danger,
                    },
                  ]}
                >
                  {laborMetrics.efficiency.toFixed(0)}%
                </Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Efficiency</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Items Today</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            {topItemsToday.length > 0 ? (
              topItemsToday.map((item: unknown, index: number) => (
                <Text key={index} style={[styles.itemText, { color: theme.colors.text }]}>
                  🍽️ {item.name} - {item.quantity} sold (£{item.revenue.toFixed(2)})
                </Text>
              ))
            ) : (
              <Text style={[styles.itemText, { color: Colors.darkGray }]}>
                No top items data for today.
              </Text>
            )}
          </View>
        </View>

        {/* Staff Performance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Top Performers Today
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            {topPerformersToday.length > 0 ? (
              topPerformersToday.slice(0, 3).map((employee: unknown, index: number) => {
                return (
                  <View key={index} style={styles.performerRow}>
                    <View style={styles.performerRank}>
                      <Text
                        style={[
                          styles.rankNumber,
                          { color: index === 0 ? Colors.warning : Colors.darkGray },
                        ]}
                      >
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={styles.performerInfo}>
                      <Text style={[styles.performerName, { color: theme.colors.text }]}>
                        {employee.name}
                      </Text>
                      <Text style={[styles.performerRole, { color: Colors.darkGray }]}>
                        {employee.role}
                      </Text>
                    </View>
                    <View style={styles.performerStats}>
                      <Text style={[styles.performerSales, { color: Colors.success }]}>
                        £{employee.sales.toFixed(0)}
                      </Text>
                      <Text style={[styles.performerHours, { color: Colors.darkGray }]}>
                        {employee.orders} orders
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.itemText, { color: Colors.darkGray }]}>
                No top performers data for today.
              </Text>
            )}
          </View>
        </View>

        {/* Reports Menu */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Available Reports</Text>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('SalesReport')}
          >
            <Icon name="trending-up" size={24} color={Colors.success} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Sales Report</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Daily, weekly, monthly sales
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('InventoryReport')}
          >
            <Icon name="inventory" size={24} color={Colors.warning} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>
                Inventory Report
              </Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Stock levels and costs
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('StaffReport')}
          >
            <Icon name="people" size={24} color={Colors.secondary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>
                Employee Performance
              </Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Performance metrics & costs
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('LaborReport')}
          >
            <Icon name="schedule" size={24} color={Colors.primary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>
                Schedule & Labor Report
              </Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Rota analysis & labor costs
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('CostAnalysisReport')}
          >
            <Icon name="analytics" size={24} color={Colors.warning} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Cost Analysis</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Labor vs revenue analysis
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('FinancialReport')}
          >
            <Icon name="account-balance" size={24} color={Colors.secondary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>
                Financial Report
              </Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>
                Profit, loss, and expenses
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        <View style={[styles.notice, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.noticeText, { color: Colors.darkGray }]}>
            Reports use real employee and sales data. {topPerformersToday.length} employees tracked.
          </Text>
        </View>
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
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: getFontSize(20),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: getFontSize(24),
    fontWeight: 'bold',
    color: Colors.success,
  },
  statLabel: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    marginTop: 4,
  },
  itemText: {
    fontSize: getFontSize(16),
    color: Colors.text,
    marginBottom: 8,
  },
  reportItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reportInfo: {
    flex: 1,
    marginLeft: 16,
  },
  reportTitle: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
  },
  reportDesc: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    marginTop: 2,
  },
  notice: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  noticeText: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    textAlign: 'center',
  },

  // New performer styles
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  performerRank: {
    width: 40,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
  },
  performerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  performerName: {
    fontSize: getFontSize(16),
    fontWeight: '600',
  },
  performerRole: {
    fontSize: getFontSize(12),
    marginTop: 2,
  },
  performerStats: {
    alignItems: 'flex-end',
  },
  performerSales: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
  },
  performerHours: {
    fontSize: getFontSize(12),
    marginTop: 2,
  },
  centeredError: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTextHeader: {
    // Added
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.danger, // Fallback, theme might override if available in error JSX
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    // Added
    fontSize: getFontSize(14),
    color: Colors.text, // Fallback
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    // Added
    backgroundColor: Colors.primary, // Fallback
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    color: Colors.white, // Fallback
    fontSize: getFontSize(16),
    fontWeight: '600',
  },
});

export default ReportsScreen;
