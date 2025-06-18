import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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

const ReportsScreen: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [selectedChart, setSelectedChart] = useState<'sales' | 'orders' | 'customers'>('sales');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'items' | 'staff' | 'payments'>('overview');

  // Comprehensive mock data
  const mockData = {
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

  const topItems = [
    { name: 'Americano', sales: 145, revenue: 362.50, growth: 8.5 },
    { name: 'Cappuccino', sales: 132, revenue: 528.00, growth: 12.3 },
    { name: 'Chocolate Croissant', sales: 89, revenue: 267.00, growth: -2.1 },
    { name: 'Latte', sales: 87, revenue: 435.00, growth: 15.8 },
    { name: 'Sandwich Combo', sales: 76, revenue: 684.00, growth: 6.2 },
  ];

  const chartData = {
    sales: [
      { period: 'Mon', amount: 1180.00 },
      { period: 'Tue', amount: 1320.50 },
      { period: 'Wed', amount: 1150.80 },
      { period: 'Thu', amount: 1470.20 },
      { period: 'Fri', amount: 1650.30 },
      { period: 'Sat', amount: 1890.15 },
      { period: 'Sun', amount: 1625.45 },
    ],
    orders: [
      { period: 'Mon', amount: 28 },
      { period: 'Tue', amount: 35 },
      { period: 'Wed', amount: 22 },
      { period: 'Thu', amount: 41 },
      { period: 'Fri', amount: 47 },
      { period: 'Sat', amount: 52 },
      { period: 'Sun', amount: 38 },
    ],
    customers: [
      { period: 'Mon', amount: 24 },
      { period: 'Tue', amount: 29 },
      { period: 'Wed', amount: 18 },
      { period: 'Thu', amount: 33 },
      { period: 'Fri', amount: 39 },
      { period: 'Sat', amount: 45 },
      { period: 'Sun', amount: 31 },
    ],
  };

  const hourlyData = [
    { hour: '9AM', sales: 85.20, orders: 3 },
    { hour: '10AM', sales: 124.50, orders: 5 },
    { hour: '11AM', sales: 201.30, orders: 8 },
    { hour: '12PM', sales: 287.40, orders: 12 },
    { hour: '1PM', sales: 325.60, orders: 14 },
    { hour: '2PM', sales: 198.70, orders: 9 },
    { hour: '3PM', sales: 156.80, orders: 6 },
    { hour: '4PM', sales: 243.90, orders: 11 },
    { hour: '5PM', sales: 298.40, orders: 13 },
    { hour: '6PM', sales: 189.60, orders: 8 },
  ];

  const employeePerformance = [
    { name: 'Sarah Johnson', sales: 2840.50, orders: 45, rating: 4.8 },
    { name: 'Mike Chen', sales: 2654.20, orders: 42, rating: 4.7 },
    { name: 'Emily Davis', sales: 2387.80, orders: 38, rating: 4.6 },
    { name: 'James Wilson', sales: 2156.90, orders: 34, rating: 4.5 },
  ];

  const paymentMethods = [
    { method: 'Card', amount: 8932.40, percentage: 72 },
    { method: 'Cash', amount: 2187.60, percentage: 18 },
    { method: 'Apple Pay', amount: 987.30, percentage: 8 },
    { method: 'Other', amount: 247.80, percentage: 2 },
  ];

  const currentData = mockData[selectedPeriod];

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    growth,
    color = Colors.secondary 
  }: { 
    title: string; 
    value: string | number; 
    icon: string; 
    growth?: number;
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color={Colors.white} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {growth !== undefined && (
          <View style={styles.growthContainer}>
            <Icon 
              name={growth >= 0 ? 'trending-up' : 'trending-down'} 
              size={16} 
              color={growth >= 0 ? Colors.success : '#E74C3C'} 
            />
            <Text style={[styles.growthText, { color: growth >= 0 ? Colors.success : '#E74C3C' }]}>
              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const PeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['today', 'week', 'month'] as const).map((period) => (
        <TouchableOpacity
          key={period}
          style={[styles.periodButton, selectedPeriod === period && styles.activePeriodButton]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[styles.periodText, selectedPeriod === period && styles.activePeriodText]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const ChartSelector = () => (
    <View style={styles.chartSelector}>
      {(['sales', 'orders', 'customers'] as const).map((chart) => (
        <TouchableOpacity
          key={chart}
          style={[styles.chartButton, selectedChart === chart && styles.activeChartButton]}
          onPress={() => setSelectedChart(chart)}
        >
          <Text style={[styles.chartButtonText, selectedChart === chart && styles.activeChartText]}>
            {chart.charAt(0).toUpperCase() + chart.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const TabSelector = () => (
    <View style={styles.tabSelector}>
      {([
        { key: 'overview', label: 'Overview', icon: 'dashboard' },
        { key: 'items', label: 'Items', icon: 'inventory' },
        { key: 'staff', label: 'Staff', icon: 'people' },
        { key: 'payments', label: 'Payments', icon: 'payment' },
      ] as const).map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabButton, selectedTab === tab.key && styles.activeTabButton]}
          onPress={() => setSelectedTab(tab.key)}
        >
          <Icon name={tab.icon} size={18} color={selectedTab === tab.key ? Colors.white : Colors.lightText} />
          <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const InteractiveChart = () => {
    const currentChartData = chartData[selectedChart];
    const maxValue = Math.max(...currentChartData.map(item => item.amount));
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>
            {selectedChart === 'sales' ? 'Sales Trend' : 
             selectedChart === 'orders' ? 'Orders Trend' : 'Customer Trend'} (Last 7 Days)
          </Text>
          <ChartSelector />
        </View>
        <View style={styles.simpleChart}>
          {currentChartData.map((item, index) => (
            <TouchableOpacity key={index} style={styles.chartBar}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    height: Math.max(20, (item.amount / maxValue) * 80),
                    backgroundColor: selectedChart === 'sales' ? Colors.success : 
                                   selectedChart === 'orders' ? Colors.secondary : Colors.warning
                  }
                ]} 
              />
              <Text style={styles.chartLabel}>{item.period}</Text>
              <Text style={styles.chartValue}>
                {selectedChart === 'sales' ? `£${(item.amount / 1000).toFixed(1)}k` :
                 selectedChart === 'orders' ? `${item.amount}` : `${item.amount}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const HourlyChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>Hourly Performance (Today)</Text>
      <View style={styles.simpleChart}>
        {hourlyData.map((item, index) => (
          <View key={index} style={styles.chartBar}>
            <View 
              style={[
                styles.bar, 
                { 
                  height: Math.max(15, (item.sales / 350) * 60),
                  backgroundColor: Colors.primary
                }
              ]} 
            />
            <Text style={styles.chartLabel}>{item.hour}</Text>
            <Text style={styles.chartValue}>£{item.sales.toFixed(0)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <PeriodSelector />

        {/* Tab Selector */}
        <TabSelector />

        {selectedTab === 'overview' && (
          <>
            {/* Summary Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {selectedPeriod === 'today' ? 'Today\'s' : selectedPeriod === 'week' ? 'This Week\'s' : 'This Month\'s'} Summary
              </Text>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Sales"
                  value={`£${currentData.sales.toFixed(2)}`}
                  icon="attach-money"
                  growth={currentData.growth.sales}
                  color={Colors.success}
                />
                <StatCard
                  title="Orders"
                  value={currentData.orders}
                  icon="receipt"
                  growth={currentData.growth.orders}
                  color={Colors.secondary}
                />
                <StatCard
                  title="Avg Order"
                  value={`£${currentData.avgOrder.toFixed(2)}`}
                  icon="trending-up"
                  color={Colors.warning}
                />
                <StatCard
                  title="Customers"
                  value={currentData.customers}
                  icon="people"
                  growth={currentData.growth.customers}
                  color={Colors.primary}
                />
              </View>
            </View>

            {/* Interactive Chart */}
            <View style={styles.section}>
              <InteractiveChart />
            </View>

            {/* Hourly Performance */}
            {selectedPeriod === 'today' && (
              <View style={styles.section}>
                <HourlyChart />
              </View>
            )}
          </>
        )}

        {selectedTab === 'items' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Selling Items</Text>
            <View style={styles.itemsList}>
              {topItems.map((item, index) => (
                <TouchableOpacity key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemStats}>{item.sales} sold • £{item.revenue.toFixed(2)}</Text>
                  </View>
                  <View style={styles.itemGrowth}>
                    <Icon 
                      name={item.growth >= 0 ? 'trending-up' : 'trending-down'} 
                      size={16} 
                      color={item.growth >= 0 ? Colors.success : '#E74C3C'} 
                    />
                    <Text style={[styles.growthText, { color: item.growth >= 0 ? Colors.success : '#E74C3C' }]}>
                      {item.growth >= 0 ? '+' : ''}{item.growth.toFixed(1)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'staff' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employee Performance</Text>
            <View style={styles.employeeList}>
              {employeePerformance.map((employee, index) => (
                <TouchableOpacity key={index} style={styles.employeeRow}>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employee.name}</Text>
                    <Text style={styles.employeeStats}>
                      £{employee.sales.toFixed(2)} • {employee.orders} orders
                    </Text>
                  </View>
                  <View style={styles.employeeRating}>
                    <Icon name="star" size={16} color={Colors.warning} />
                    <Text style={styles.ratingText}>{employee.rating}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedTab === 'payments' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.paymentList}>
              {paymentMethods.map((payment, index) => (
                <TouchableOpacity key={index} style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentMethod}>{payment.method}</Text>
                    <Text style={styles.paymentAmount}>£{payment.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentBar}>
                    <View 
                      style={[
                        styles.paymentBarFill, 
                        { width: `${payment.percentage}%` }
                      ]} 
                    />
                    <Text style={styles.paymentPercentage}>{payment.percentage}%</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Development Notice */}
        <View style={styles.notice}>
          <Icon name="info" size={20} color={Colors.secondary} />
          <Text style={styles.noticeText}>
            Interactive reports with real-time analytics. Currently showing mock data for development.
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  
  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activePeriodButton: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  activePeriodText: {
    color: Colors.white,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    width: '48%',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  growthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Chart Selector
  chartSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 2,
  },
  chartButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeChartButton: {
    backgroundColor: Colors.white,
  },
  chartButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.lightText,
  },
  activeChartText: {
    color: Colors.primary,
  },

  // Tab Selector
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'column',
  },
  activeTabButton: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.lightText,
    marginTop: 4,
  },
  activeTabText: {
    color: Colors.white,
  },

  // Chart
  chartContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  simpleChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  bar: {
    backgroundColor: Colors.secondary,
    width: '80%',
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 2,
  },
  chartValue: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
  },

  // Item Lists
  itemsList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemStats: {
    fontSize: 14,
    color: Colors.lightText,
  },
  itemGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Employee Lists
  employeeList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  employeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  employeeStats: {
    fontSize: 14,
    color: Colors.lightText,
  },
  employeeRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 4,
  },

  // Payment Methods
  paymentList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMethod: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentBar: {
    height: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 4,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },
  paymentPercentage: {
    position: 'absolute',
    right: 8,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },

  // Notice
  notice: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noticeText: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 12,
    flex: 1,
  },
});

export default ReportsScreen;