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

const { width } = Dimensions.get('window');

// Mock ENV flag
const ENV = {
  FEATURE_REPORTS: true, // Set to true to enable, false to show ComingSoon
};

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

interface FinancialData {
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  expenses: {
    staffCosts: number;
    inventory: number;
    utilities: number;
    rent: number;
    marketing: number;
    other: number;
  };
  revenueBySource: {
    dineIn: number;
    takeaway: number;
    delivery: number;
    catering: number;
  };
  taxData: {
    vatCollected: number;
    serviceTax: number;
    totalTaxes: number;
  };
}

const FinancialReportDetailScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [reportData, setReportData] = useState<FinancialData | null>(_null);
  const [isLoading, setIsLoading] = useState<boolean>(_true);
  const [error, setError] = useState<string | null>(_null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const handleExportReport = () => {
    Alert.alert('Export Financial Report', 'Choose export format', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'PDF P&L Statement',
        onPress: () => Alert.alert('PDF Export', 'P&L PDF coming soon'),
      },
      {
        text: 'Excel Spreadsheet',
        onPress: () => Alert.alert('Excel Export', 'Excel export coming soon'),
      },
      {
        text: 'Email to Accountant',
        onPress: () => Alert.alert('Email Report', 'Email functionality coming soon'),
      },
    ]);
  };

  useEffect(() => {
    if (ENV.FEATURE_REPORTS) {
      loadReportData();
    } else {
      setIsLoading(_false); // Not loading if feature is off
    }
  }, [selectedPeriod]);

  const loadReportData = async () => {
    // Renamed and made async
    setIsLoading(_true);
    setError(_null);
    try {
      const dataService = DataService.getInstance();
      // Assuming getFinancialReportDetail returns data in FinancialData shape for the selectedPeriod
      const data = await dataService.getFinancialReportDetail(_selectedPeriod);
      setReportData(_data);
    } catch (e: unknown) {
      setError(e.message || 'Failed to load financial report.');
      setReportData(_null);
    } finally {
      setIsLoading(_false);
    }
  };

  // The complex data transformation logic previously in loadFinancialData (calculating expenses, revenue sources from salesHistory)
  // is now assumed to be handled by the backend or DataService.getFinancialReportDetail.
  // If DataService.getFinancialReportDetail were to return raw sales history, this screen
  // would need to retain that transformation logic, but it would operate on API data, not mock generated data.
  // For this refactor's scope, we assume the service provides the necessary FinancialData structure.

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getExpenseColor = (expenseType: string) => {
    const colors = {
      staffCosts: Colors.primary,
      inventory: Colors.warning,
      utilities: Colors.secondary,
      rent: Colors.danger,
      marketing: Colors.success,
      other: Colors.mediumGray,
    };
    return colors[expenseType as keyof typeof colors] || Colors.lightText;
  };

  const getRevenueSourceColor = (source: string) => {
    const colors = {
      dineIn: Colors.primary,
      takeaway: Colors.secondary,
      delivery: Colors.warning,
      catering: Colors.success,
    };
    return colors[source as keyof typeof colors] || Colors.lightText;
  };

  if (!ENV.FEATURE_REPORTS) {
    return <ComingSoon />;
  }

  if (_isLoading) {
    return <LoadingView message="Loading Financial Report..." />;
  }

  if (error || !reportData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Financial Report</Text>
          <View style={{ width: 24 }} />
          {/* Placeholder for balance */}
        </View>
        <View style={styles.centeredError}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorTextHeader}>Error Loading Report</Text>
          <Text style={styles.errorText}>
            {error || 'No data available for the selected period.'}
          </Text>
          <TouchableOpacity onPress={loadReportData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // If reportData is available, render the report:
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Report</Text>
        <TouchableOpacity style={styles.headerAction} onPress={handleExportReport}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['week', 'month', 'quarter', 'year'].map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(_period)}>
            <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Key Metrics */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.summaryValue}>{formatCurrency(reportData.grossRevenue)}</Text>
            <Text style={styles.summaryLabel}>Gross Revenue</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+15.2%</Text>
              {/* Placeholder trend */}
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatCurrency(reportData.profit)}
            </Text>
            <Text style={styles.summaryLabel}>Net Profit</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+8.5%</Text>
              {/* Placeholder trend */}
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.warning }]}>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>
              {formatPercentage(reportData.profitMargin)}
            </Text>
            <Text style={styles.summaryLabel}>Profit Margin</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.warning }]}>
              <Icon name="trending-flat" size={12} color={Colors.white} />
              <Text style={styles.trendText}>-1.2%</Text>
              {/* Placeholder trend */}
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.danger }]}>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>
              {formatCurrency(reportData.totalExpenses)}
            </Text>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.danger }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+12.1%</Text>
              {/* Placeholder trend */}
            </View>
          </View>
        </View>

        {/* Profit & Loss Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profit & Loss Statement</Text>
          <View style={styles.card}>
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Gross Revenue</Text>
              <Text style={[styles.plValue, { color: Colors.success }]}>
                {formatCurrency(reportData.grossRevenue)}
              </Text>
            </View>

            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Less: VAT ({formatPercentage(20)})</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(reportData.taxData.vatCollected)}
              </Text>
            </View>

            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Less: Service Tax ({formatPercentage(12.5)})</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(reportData.taxData.serviceTax)}
              </Text>
            </View>

            <View style={[styles.plRow, styles.plRowDivider]}>
              <Text style={[styles.plLabel, { fontWeight: 'bold' }]}>Net Revenue</Text>
              <Text style={[styles.plValue, { fontWeight: 'bold', color: Colors.primary }]}>
                {formatCurrency(reportData.netRevenue)}
              </Text>
            </View>

            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Total Expenses</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(reportData.totalExpenses)}
              </Text>
            </View>

            <View style={[styles.plRow, styles.plRowFinal]}>
              <Text style={[styles.plLabel, { fontWeight: 'bold', fontSize: 16 }]}>Net Profit</Text>
              <Text
                style={[
                  styles.plValue,
                  {
                    fontWeight: 'bold',
                    fontSize: 16,
                    color: reportData.profit >= 0 ? Colors.success : Colors.danger,
                  },
                ]}>
                {formatCurrency(reportData.profit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Expense Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Breakdown</Text>
          <View style={styles.card}>
            {Object.entries(reportData.expenses).map(([key, value]) => {
              const percentage = (value / reportData.totalExpenses) * 100;
              return (
                <View key={key} style={styles.expenseRow}>
                  <View style={styles.expenseInfo}>
                    <View
                      style={[styles.expenseColorDot, { backgroundColor: getExpenseColor(_key) }]}
                    />
                    <Text style={styles.expenseLabel}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  </View>

                  <View style={styles.expenseValues}>
                    <Text style={styles.expenseAmount}>{formatCurrency(_value)}</Text>
                    <Text style={styles.expensePercentage}>({formatPercentage(_percentage)})</Text>
                  </View>

                  <View style={styles.expenseBar}>
                    <View
                      style={[
                        styles.expenseBarFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: getExpenseColor(_key),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Revenue Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue by Source</Text>
          <View style={styles.card}>
            {Object.entries(reportData.revenueBySource).map(([key, value]) => {
              const percentage = (value / reportData.grossRevenue) * 100;
              return (
                <View key={key} style={styles.revenueRow}>
                  <View style={styles.revenueInfo}>
                    <View
                      style={[
                        styles.revenueColorDot,
                        { backgroundColor: getRevenueSourceColor(_key) },
                      ]}
                    />
                    <Text style={styles.revenueLabel}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  </View>

                  <View style={styles.revenueValues}>
                    <Text style={styles.revenueAmount}>{formatCurrency(_value)}</Text>
                    <Text style={styles.revenuePercentage}>({formatPercentage(_percentage)})</Text>
                  </View>

                  <View style={styles.revenueBar}>
                    <View
                      style={[
                        styles.revenueBarFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: getRevenueSourceColor(_key),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tax Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Summary</Text>
          <View style={styles.card}>
            <View style={styles.taxRow}>
              <Text style={styles.taxLabel}>VAT Collected (20%)</Text>
              <Text style={styles.taxValue}>{formatCurrency(reportData.taxData.vatCollected)}</Text>
            </View>

            <View style={styles.taxRow}>
              <Text style={styles.taxLabel}>Service Tax (12.5%)</Text>
              <Text style={styles.taxValue}>{formatCurrency(reportData.taxData.serviceTax)}</Text>
            </View>

            <View style={[styles.taxRow, styles.taxRowTotal]}>
              <Text style={[styles.taxLabel, { fontWeight: 'bold' }]}>Total Taxes</Text>
              <Text style={[styles.taxValue, { fontWeight: 'bold', color: Colors.primary }]}>
                {formatCurrency(reportData.taxData.totalTaxes)}
              </Text>
            </View>

            <View style={styles.taxNote}>
              <Icon name="info" size={16} color={Colors.warning} />
              <Text style={styles.taxNoteText}>Tax remittance due by the 20th of next month</Text>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 8,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 10,
    color: Colors.white,
    marginLeft: 2,
    fontWeight: '500',
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
  plRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  plRowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginTop: 8,
    paddingTop: 16,
  },
  plRowFinal: {
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    marginTop: 8,
    paddingTop: 16,
    backgroundColor: Colors.lightGray,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  plLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  plValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseRow: {
    marginBottom: 16,
  },
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  expenseLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  expenseValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  expensePercentage: {
    fontSize: 12,
    color: Colors.lightText,
  },
  expenseBar: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
  expenseBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  revenueRow: {
    marginBottom: 16,
  },
  revenueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  revenueLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  revenueValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  revenuePercentage: {
    fontSize: 12,
    color: Colors.lightText,
  },
  revenueBar: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
  revenueBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  taxRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginTop: 8,
    paddingTop: 16,
  },
  taxLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  taxValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  taxNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },
  taxNoteText: {
    fontSize: 12,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
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
  },
  errorTextHeader: {
    // Added
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.danger,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    // Added
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FinancialReportDetailScreen;
