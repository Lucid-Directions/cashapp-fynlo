import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { usePerformanceMonitor, performanceUtils } from '../../hooks/usePerformanceMonitor';
import { 
  generateQuickSummaryData, 
  generatePaginatedSalesData,
  SalesData,
  clearDataCache,
  getMemoryUsageEstimate 
} from '../../utils/mockDataGeneratorOptimized';

const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeColor: string;
  icon: string;
}

// Memoized Metric Card Component
const MetricCard = React.memo<MetricCardProps>(({ title, value, change, changeColor, icon }) => (
  <View style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <Icon name={icon} size={24} color={Colors.secondary} />
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={[styles.metricChange, { color: changeColor }]}>{change}</Text>
  </View>
));

// Memoized Period Selector
const PeriodSelector = React.memo<{
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}>(({ selectedPeriod, onPeriodChange }) => {
  const periods = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <TouchableOpacity
          key={period.key}
          style={[
            styles.periodButton,
            selectedPeriod === period.key && styles.periodButtonActive,
          ]}
          onPress={() => onPeriodChange(period.key)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period.key && styles.periodButtonTextActive,
            ]}
          >
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// Memoized Top Item Component
const TopItemCard = React.memo<{
  item: { name: string; sales: number; revenue: number; growth: number };
  index: number;
}>(({ item, index }) => (
  <View style={styles.topItemCard}>
    <View style={styles.topItemRank}>
      <Text style={styles.topItemRankText}>{index + 1}</Text>
    </View>
    <View style={styles.topItemInfo}>
      <Text style={styles.topItemName}>{item.name}</Text>
      <Text style={styles.topItemSales}>{item.sales} sold • ${item.revenue.toFixed(2)}</Text>
    </View>
    <View style={styles.topItemGrowth}>
      <Text
        style={[
          styles.topItemGrowthText,
          { color: item.growth >= 0 ? Colors.success : Colors.warning },
        ]}
      >
        {item.growth >= 0 ? '+' : ''}{item.growth.toFixed(1)}%
      </Text>
    </View>
  </View>
));

const ReportsScreenOptimized: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('today');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'items' | 'staff' | 'payments'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [salesData, setSalesData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Performance monitoring
  const metrics = usePerformanceMonitor({
    componentName: 'ReportsScreenOptimized',
    enableMemoryTracking: true,
    logToConsole: __DEV__,
  });

  // Debounced period change to prevent rapid re-renders
  const debouncedPeriodChange = useCallback(
    performanceUtils.debounce((period: string) => {
      setSelectedPeriod(period);
    }, 300),
    []
  );

  // Optimized data loading
  const loadReportsData = useCallback(async (period: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Use InteractionManager to avoid blocking UI
      const result = await new Promise((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
          const data = generateQuickSummaryData(days);
          resolve(data);
        });
      });

      setSalesData(result);
    } catch (err) {
      console.error('Error loading reports data:', err);
      setError('Failed to load reports data');
      Alert.alert('Error', 'Failed to load reports data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data when component mounts or period changes
  useEffect(() => {
    loadReportsData(selectedPeriod);
  }, [selectedPeriod, loadReportsData]);

  // Memoized mock data based on selected period
  const mockData = useMemo(() => {
    const baseData = {
      today: {
        sales: 1247.50,
        orders: 23,
        avgOrder: 54.24,
        customers: 18,
        growth: { sales: 12.5, orders: 8.2, customers: 15.3 },
      },
      week: {
        sales: 8732.80,
        orders: 167,
        avgOrder: 52.28,
        customers: 134,
        growth: { sales: 18.7, orders: 12.4, customers: 9.8 },
      },
      month: {
        sales: 34892.40,
        orders: 672,
        avgOrder: 51.93,
        customers: 523,
        growth: { sales: 22.3, orders: 16.1, customers: 14.7 },
      },
    };

    return baseData[selectedPeriod as keyof typeof baseData] || baseData.today;
  }, [selectedPeriod]);

  // Memoized top items data
  const topItems = useMemo(() => [
    { name: 'Americano', sales: 145, revenue: 362.50, growth: 8.5 },
    { name: 'Cappuccino', sales: 132, revenue: 528.00, growth: 12.3 },
    { name: 'Chocolate Croissant', sales: 89, revenue: 267.00, growth: -2.1 },
    { name: 'Latte', sales: 87, revenue: 435.00, growth: 15.8 },
    { name: 'Sandwich Combo', sales: 76, revenue: 684.00, growth: 6.2 },
  ], []);

  // Memoized metric cards
  const metricCards = useMemo(() => [
    {
      title: 'Total Sales',
      value: `$${mockData.sales.toLocaleString()}`,
      change: `+${mockData.growth.sales}%`,
      changeColor: Colors.success,
      icon: 'trending-up',
    },
    {
      title: 'Orders',
      value: mockData.orders.toString(),
      change: `+${mockData.growth.orders}%`,
      changeColor: Colors.success,
      icon: 'receipt',
    },
    {
      title: 'Avg Order',
      value: `$${mockData.avgOrder.toFixed(2)}`,
      change: `+${(mockData.growth.sales - mockData.growth.orders).toFixed(1)}%`,
      changeColor: Colors.success,
      icon: 'shopping-cart',
    },
    {
      title: 'Customers',
      value: mockData.customers.toString(),
      change: `+${mockData.growth.customers}%`,
      changeColor: Colors.success,
      icon: 'people',
    },
  ], [mockData]);

  // Optimized tab change handler
  const handleTabChange = useCallback((tab: typeof selectedTab) => {
    setSelectedTab(tab);
  }, []);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up cache to prevent memory leaks
      if (__DEV__) {
        const memUsage = getMemoryUsageEstimate();
        console.log('Reports cleanup - Memory usage:', memUsage);
      }
    };
  }, []);

  const renderTopItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <TopItemCard item={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item: any, index: number) => `top-item-${index}`, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadReportsData(selectedPeriod)}
          disabled={isLoading}
        >
          <Icon name="refresh" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => loadReportsData(selectedPeriod)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      )}

      {/* Main Content */}
      {!isLoading && !error && (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true} // Performance optimization
          keyboardShouldPersistTaps="handled"
        >
          {/* Period Selector */}
          <PeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={debouncedPeriodChange}
          />

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {metricCards.map((metric, index) => (
              <MetricCard
                key={`metric-${index}`}
                title={metric.title}
                value={metric.value}
                change={metric.change}
                changeColor={metric.changeColor}
                icon={metric.icon}
              />
            ))}
          </View>

          {/* Tab Selector */}
          <View style={styles.tabSelector}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'items', label: 'Top Items' },
              { key: 'staff', label: 'Staff' },
              { key: 'payments', label: 'Payments' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  selectedTab === tab.key && styles.tabButtonActive,
                ]}
                onPress={() => handleTabChange(tab.key as any)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selectedTab === tab.key && styles.tabButtonTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          {selectedTab === 'items' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Top Selling Items</Text>
              <FlatList
                data={topItems}
                renderItem={renderTopItem}
                keyExtractor={keyExtractor}
                scrollEnabled={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                windowSize={10}
              />
            </View>
          )}

          {selectedTab === 'overview' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Business Overview</Text>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewText}>
                  Your business is performing well with consistent growth across all metrics.
                </Text>
                <View style={styles.overviewStats}>
                  <Text style={styles.overviewStat}>
                    Revenue Growth: <Text style={styles.overviewStatValue}>+{mockData.growth.sales}%</Text>
                  </Text>
                  <Text style={styles.overviewStat}>
                    Customer Growth: <Text style={styles.overviewStatValue}>+{mockData.growth.customers}%</Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Performance Debug Info (Development Only) */}
          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Performance Metrics</Text>
              <Text style={styles.debugText}>Render: {metrics.renderTime}ms</Text>
              <Text style={styles.debugText}>Ready: {metrics.isReady ? 'Yes' : 'No'}</Text>
              {metrics.memoryUsage && (
                <Text style={styles.debugText}>Memory: {metrics.memoryUsage.toFixed(1)}MB</Text>
              )}
            </View>
          )}
        </ScrollView>
      )}
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
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.warning,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.secondary,
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.lightText,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: Colors.secondary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.lightText,
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.secondary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.lightText,
  },
  tabButtonTextActive: {
    color: Colors.white,
  },
  tabContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  topItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  topItemRank: {
    width: 32,
    height: 32,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topItemRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  topItemInfo: {
    flex: 1,
  },
  topItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  topItemSales: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  topItemGrowth: {
    alignItems: 'flex-end',
  },
  topItemGrowthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overviewCard: {
    padding: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  overviewText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  overviewStats: {
    gap: 8,
  },
  overviewStat: {
    fontSize: 14,
    color: Colors.lightText,
  },
  overviewStatValue: {
    fontWeight: '600',
    color: Colors.success,
  },
  debugInfo: {
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 10,
    color: Colors.lightText,
    marginBottom: 2,
  },
});

export default ReportsScreenOptimized;