import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Chart from '../../components/analytics/Chart';
import { AnalyticsService, AnalyticsData } from '../../services/AnalyticsService';

// Fynlo POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

const PlatformAnalyticsScreen: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const analyticsService = AnalyticsService.getInstance();

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const data = await analyticsService.getAnalyticsData(selectedPeriod);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const handleExportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      Alert.alert('Exporting', 'Generating export file...');
      const result = await analyticsService.exportData(format, selectedPeriod);
      Alert.alert('Export Complete', `File exported: ${result.filename}`);
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export data');
    }
  };

  const handleCustomReport = async () => {
    try {
      Alert.alert('Generating Report', 'Creating custom report...');
      const report = await analyticsService.generateCustomReport(
        ['revenue', 'transactions', 'avgOrderValue'],
        ['1', '2', '3', '4'],
        { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() }
      );
      Alert.alert('Report Generated', `Report ID: ${report.reportId}`);
    } catch (error) {
      Alert.alert('Report Failed', 'Failed to generate custom report');
    }
  };

  const handleAnalyticsAction = (action: string) => {
    switch (action) {
      case 'Custom Reports':
        handleCustomReport();
        break;
      case 'Data Export':
        Alert.alert(
          'Export Data',
          'Choose export format:',
          [
            { text: 'CSV', onPress: () => handleExportData('csv') },
            { text: 'JSON', onPress: () => handleExportData('json') },
            { text: 'PDF', onPress: () => handleExportData('pdf') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        break;
      case 'Forecasting':
        Alert.alert('Forecasting', 'Advanced forecasting tools coming soon');
        break;
      case 'Benchmarking':
        Alert.alert('Benchmarking', 'Industry benchmarking tools coming soon');
        break;
      default:
        Alert.alert('Analytics', `${action} functionality available`);
    }
  };

  if (loading && !analyticsData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Analytics</Text>
        <Text style={styles.headerSubtitle}>Cross-restaurant insights</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['today', 'week', 'month', 'year'].map(period => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period as any)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Revenue Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue Analytics</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Total Platform Revenue</Text>
              <TouchableOpacity onPress={() => handleAnalyticsAction('Revenue Details')}>
                <Icon name="more-vert" size={20} color={Colors.mediumGray} />
              </TouchableOpacity>
            </View>
            <Text style={styles.largeValue}>£{analyticsData?.revenue.total.toLocaleString()}</Text>
            <Text style={styles.changeText}>+{analyticsData?.revenue.growth}% from last {selectedPeriod}</Text>
            
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>£{analyticsData?.revenue.commission.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Commission Earned</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{analyticsData?.revenue.avgCommissionRate}%</Text>
                <Text style={styles.metricLabel}>Avg Commission</Text>
              </View>
            </View>
          </View>

          {/* Revenue Trend Chart */}
          {analyticsData && (
            <Chart
              title="Revenue Trend"
              type="line"
              data={analyticsData.revenue.byPeriod.map(item => ({
                label: item.period,
                value: item.value,
                color: Colors.primary,
              }))}
              height={200}
            />
          )}
        </View>

        {/* Performance Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Analytics</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Top Performing Restaurants</Text>
              <TouchableOpacity onPress={() => handleAnalyticsAction('Performance Rankings')}>
                <Icon name="leaderboard" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            
            {analyticsData?.performance.rankings.slice(0, 3).map((restaurant, index) => (
              <View key={index} style={styles.rankingItem}>
                <View style={styles.rankingNumber}>
                  <Text style={styles.rankingNumberText}>{restaurant.rank}</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingName}>{restaurant.name}</Text>
                  <Text style={[styles.rankingGrowth, { color: restaurant.growth > 0 ? Colors.success : Colors.danger }]}>
                    {restaurant.growth > 0 ? '+' : ''}{restaurant.growth}%
                  </Text>
                </View>
                <Text style={styles.rankingRevenue}>£{restaurant.revenue.toLocaleString()}</Text>
              </View>
            ))}
          </View>

          {/* Performance Comparison Chart */}
          {analyticsData && (
            <Chart
              title="Restaurant Performance Comparison"
              type="bar"
              data={analyticsData.performance.rankings.map(item => ({
                label: item.name.replace('Fynlo ', ''),
                value: item.score,
                color: item.score >= 90 ? Colors.success : item.score >= 80 ? Colors.primary : Colors.warning,
              }))}
              height={250}
            />
          )}
        </View>

        {/* Transaction Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Analytics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="receipt" size={24} color={Colors.secondary} />
              <Text style={styles.statValue}>{analyticsData?.transactions.total.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Transactions</Text>
              <Text style={styles.statChange}>+{analyticsData?.transactions.growth}%</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="trending-up" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>£{analyticsData?.transactions.avgValue}</Text>
              <Text style={styles.statLabel}>Avg Transaction</Text>
              <Text style={styles.statChange}>+3.1%</Text>
            </View>
          </View>

          {/* Payment Methods Chart */}
          {analyticsData && (
            <Chart
              title="Payment Methods Distribution"
              type="pie"
              data={analyticsData.transactions.byPaymentMethod.map(item => ({
                label: item.method,
                value: item.percentage,
                color: item.method === 'Card' ? Colors.primary : 
                       item.method === 'Contactless' ? Colors.secondary :
                       item.method === 'Mobile Pay' ? Colors.success : 
                       Colors.mediumGray,
              }))}
              height={200}
            />
          )}

          {/* Transaction Trend Chart */}
          {analyticsData && (
            <Chart
              title="Transaction Volume Trend"
              type="line"
              data={analyticsData.transactions.byPeriod.map(item => ({
                label: item.period,
                value: item.value,
                color: Colors.secondary,
              }))}
              height={200}
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analytics Tools</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleAnalyticsAction('Custom Reports')}
            >
              <Icon name="assessment" size={32} color={Colors.primary} />
              <Text style={styles.toolText}>Custom Reports</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleAnalyticsAction('Data Export')}
            >
              <Icon name="download" size={32} color={Colors.secondary} />
              <Text style={styles.toolText}>Data Export</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleAnalyticsAction('Forecasting')}
            >
              <Icon name="timeline" size={32} color={Colors.warning} />
              <Text style={styles.toolText}>Forecasting</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleAnalyticsAction('Benchmarking')}
            >
              <Icon name="compare" size={32} color={Colors.danger} />
              <Text style={styles.toolText}>Benchmarking</Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  largeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  changeText: {
    fontSize: 14,
    color: Colors.success,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  rankingNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankingNumberText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  rankingInfo: {
    flex: 1,
  },
  rankingName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  rankingGrowth: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 2,
  },
  rankingRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 4,
  },
  statChange: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 4,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PlatformAnalyticsScreen;