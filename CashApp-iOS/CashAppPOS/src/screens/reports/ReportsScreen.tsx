import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateSalesHistory, calculateBusinessMetrics, SalesData } from '../../utils/mockDataGenerator';
import LazyLoadingWrapper from '../../components/performance/LazyLoadingWrapper';
import { ReportCardSkeleton } from '../../components/performance/SkeletonLoader';
import { usePerformanceMonitor, performanceUtils } from '../../hooks/usePerformanceMonitor';
import ErrorBoundary from '../../components/ErrorBoundary';

const { width: screenWidth } = Dimensions.get('window');

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',      // Clover Green
  secondary: '#0066CC',    // Clover Blue
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

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  value?: string;
  change?: string;
  changePositive?: boolean;
}

const ReportsScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const [salesHistory, setSalesHistory] = useState<SalesData[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor({
    componentName: 'ReportsScreen',
    enableMemoryTracking: true,
    logToConsole: __DEV__,
  });

  useEffect(() => {
    loadReportsData();
  }, [selectedPeriod]);

  const loadReportsData = () => {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (selectedPeriod) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const history = generateSalesHistory(startDate);
    const businessMetrics = calculateBusinessMetrics(history);
    
    setSalesHistory(history);
    setMetrics(businessMetrics);
  };

  const reportCategories = [
    {
      title: 'Sales Reports',
      description: 'Revenue, transactions, and sales performance',
      reports: [
        {
          id: 'sales-summary',
          title: 'Sales Summary',
          description: 'Daily, weekly, and monthly sales overview',
          icon: 'trending-up',
          color: Colors.primary,
          value: `£${metrics.totalRevenue?.toFixed(2) || '0.00'}`,
          change: `${metrics.monthlyGrowth?.toFixed(1) || '0.0'}%`,
          changePositive: (metrics.monthlyGrowth || 0) >= 0,
        },
        {
          id: 'sales-by-hour',
          title: 'Sales by Hour',
          description: 'Hourly breakdown and peak hours analysis',
          icon: 'schedule',
          color: Colors.secondary,
          value: 'Peak: 7-9 PM',
          change: '+15% vs last period',
          changePositive: true,
        },
        {
          id: 'sales-by-item',
          title: 'Top Selling Items',
          description: 'Best performing menu items and categories',
          icon: 'star',
          color: Colors.warning,
          value: 'Carnitas Tacos',
          change: '324 sold',
          changePositive: true,
        },
        {
          id: 'payment-methods',
          title: 'Payment Methods',
          description: 'Card, cash, mobile payment breakdown',
          icon: 'payment',
          color: Colors.secondary,
          value: '65% Card',
          change: '+5% vs last month',
          changePositive: true,
        },
      ],
    },
    {
      title: 'Financial Reports',
      description: 'Profit, expenses, and financial analysis',
      reports: [
        {
          id: 'profit-loss',
          title: 'Profit & Loss',
          description: 'Revenue, costs, and net profit analysis',
          icon: 'account-balance',
          color: Colors.success,
          value: `£${((metrics.totalRevenue || 0) * 0.3).toFixed(2)}`,
          change: '+8.2% profit margin',
          changePositive: true,
        },
        {
          id: 'tax-report',
          title: 'Tax Report',
          description: 'VAT collected and tax calculations',
          icon: 'receipt-long',
          color: Colors.darkGray,
          value: `£${((metrics.totalRevenue || 0) * 0.2).toFixed(2)}`,
          change: 'VAT collected',
          changePositive: true,
        },
        {
          id: 'cash-flow',
          title: 'Cash Flow',
          description: 'Daily cash in and out tracking',
          icon: 'attach-money',
          color: Colors.primary,
          value: `£${((metrics.totalRevenue || 0) * 0.2).toFixed(2)}`,
          change: 'Cash transactions',
          changePositive: true,
        },
      ],
    },
    {
      title: 'Inventory Reports',
      description: 'Stock levels, costs, and inventory analysis',
      reports: [
        {
          id: 'inventory-levels',
          title: 'Inventory Levels',
          description: 'Current stock and low inventory alerts',
          icon: 'inventory',
          color: Colors.warning,
          value: '5 Low Stock',
          change: '92% in stock',
          changePositive: true,
        },
        {
          id: 'cost-analysis',
          title: 'Cost Analysis',
          description: 'Item costs, margins, and profitability',
          icon: 'analytics',
          color: Colors.secondary,
          value: '68% Margin',
          change: '+2% vs last month',
          changePositive: true,
        },
        {
          id: 'supplier-report',
          title: 'Supplier Performance',
          description: 'Delivery times, costs, and quality',
          icon: 'local-shipping',
          color: Colors.darkGray,
          value: '4.8/5.0',
          change: 'Average rating',
          changePositive: true,
        },
      ],
    },
    {
      title: 'Employee Reports',
      description: 'Staff performance, hours, and productivity',
      reports: [
        {
          id: 'employee-sales',
          title: 'Employee Sales',
          description: 'Individual sales performance and rankings',
          icon: 'people',
          color: Colors.primary,
          value: 'Sarah Johnson',
          change: 'Top performer',
          changePositive: true,
        },
        {
          id: 'labor-costs',
          title: 'Labor Costs',
          description: 'Hourly wages, overtime, and scheduling',
          icon: 'schedule',
          color: Colors.warning,
          value: '£2,450',
          change: 'This period',
          changePositive: true,
        },
        {
          id: 'attendance',
          title: 'Attendance',
          description: 'Punctuality, absences, and time tracking',
          icon: 'access-time',
          color: Colors.secondary,
          value: '95.2%',
          change: 'Attendance rate',
          changePositive: true,
        },
      ],
    },
  ];

  const quickStats = [
    {
      label: 'Today\'s Sales',
      value: `£${(metrics.avgDailySales || 0).toFixed(2)}`,
      icon: 'today',
      color: Colors.primary,
    },
    {
      label: 'Transactions',
      value: metrics.totalTransactions?.toString() || '0',
      icon: 'receipt',
      color: Colors.secondary,
    },
    {
      label: 'Avg. Order',
      value: `£${(metrics.avgTransactionValue || 0).toFixed(2)}`,
      icon: 'shopping-cart',
      color: Colors.warning,
    },
    {
      label: 'Growth',
      value: `${(metrics.monthlyGrowth || 0).toFixed(1)}%`,
      icon: 'trending-up',
      color: (metrics.monthlyGrowth || 0) >= 0 ? Colors.success : Colors.danger,
    },
  ];

  const periods = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'year', label: 'Year' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSubtitle}>Business analytics and insights</Text>
        </View>
        
        <TouchableOpacity style={styles.exportButton}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {periods.map(period => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodButton,
                  selectedPeriod === period.key && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === period.key && styles.periodButtonTextActive
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          {quickStats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Icon name={stat.icon} size={24} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Report Categories */}
        {reportCategories.map((category, categoryIndex) => (
          <View key={category.title} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </View>
            
            <View style={styles.reportsGrid}>
              {category.reports.map((report, index) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportHeader}>
                    <View style={[styles.reportIcon, { backgroundColor: `${report.color}15` }]}>
                      <Icon name={report.icon} size={24} color={report.color} />
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle}>{report.title}</Text>
                      <Text style={styles.reportDescription}>{report.description}</Text>
                    </View>
                  </View>
                  
                  {report.value && (
                    <View style={styles.reportMetrics}>
                      <Text style={styles.reportValue}>{report.value}</Text>
                      {report.change && (
                        <View style={styles.reportChange}>
                          <Icon 
                            name={report.changePositive ? 'trending-up' : 'trending-down'} 
                            size={16} 
                            color={report.changePositive ? Colors.success : Colors.danger} 
                          />
                          <Text style={[
                            styles.reportChangeText,
                            { color: report.changePositive ? Colors.success : Colors.danger }
                          ]}>
                            {report.change}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.exportTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={[styles.exportButton, styles.pdfButton]}>
              <Icon name="picture-as-pdf" size={20} color={Colors.white} />
              <Text style={styles.exportButtonText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportButton, styles.csvButton]}>
              <Icon name="table-chart" size={20} color={Colors.white} />
              <Text style={styles.exportButtonText}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportButton, styles.emailButton]}>
              <Icon name="email" size={20} color={Colors.white} />
              <Text style={styles.exportButtonText}>Email</Text>
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
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  periodSelector: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: Colors.background,
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
  quickStats: {
    flexDirection: 'row',
    padding: 16,
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    textAlign: 'center',
    marginTop: 4,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 4,
  },
  reportsGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },
  reportCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  reportDescription: {
    fontSize: 13,
    color: Colors.darkGray,
    marginTop: 2,
  },
  reportMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  reportChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportChangeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  exportSection: {
    padding: 20,
    marginTop: 20,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pdfButton: {
    backgroundColor: Colors.danger,
  },
  csvButton: {
    backgroundColor: Colors.success,
  },
  emailButton: {
    backgroundColor: Colors.secondary,
  },
  exportButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});

const ReportsScreen: React.FC = () => {
  return (
    <ErrorBoundary>
      <ReportsScreenContent />
    </ErrorBoundary>
  );
};

export default ReportsScreen;