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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateSalesHistory } from '../../utils/mockDataGenerator';

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
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedView, setSelectedView] = useState('overview');

  useEffect(() => {
    loadFinancialData();
  }, [selectedPeriod]);

  const loadFinancialData = () => {
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

    const salesHistory = generateSalesHistory(startDate);
    const grossRevenue = salesHistory.reduce((sum, day) => sum + day.sales, 0);
    
    // Calculate expenses (realistic percentages for restaurant business)
    const staffCosts = grossRevenue * 0.35; // 35% of revenue
    const inventory = grossRevenue * 0.28; // 28% of revenue (food costs)
    const rent = grossRevenue * 0.08; // 8% of revenue
    const utilities = grossRevenue * 0.05; // 5% of revenue
    const marketing = grossRevenue * 0.03; // 3% of revenue
    const other = grossRevenue * 0.04; // 4% of revenue

    const totalExpenses = staffCosts + inventory + rent + utilities + marketing + other;
    
    // Calculate taxes
    const vatCollected = grossRevenue * 0.20; // 20% VAT
    const serviceTax = grossRevenue * 0.125; // 12.5% service charge
    const totalTaxes = vatCollected + serviceTax;
    
    const netRevenue = grossRevenue - totalTaxes;
    const profit = netRevenue - totalExpenses;
    const profitMargin = (profit / grossRevenue) * 100;

    // Revenue breakdown
    const dineIn = grossRevenue * 0.45;
    const takeaway = grossRevenue * 0.30;
    const delivery = grossRevenue * 0.20;
    const catering = grossRevenue * 0.05;

    const data: FinancialData = {
      grossRevenue,
      netRevenue,
      totalExpenses,
      profit,
      profitMargin,
      expenses: {
        staffCosts,
        inventory,
        utilities,
        rent,
        marketing,
        other,
      },
      revenueBySource: {
        dineIn,
        takeaway,
        delivery,
        catering,
      },
      taxData: {
        vatCollected,
        serviceTax,
        totalTaxes,
      },
    };

    setFinancialData(data);
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  if (!financialData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading financial data...</Text>
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
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Report</Text>
        <TouchableOpacity style={styles.headerAction}>
          <Icon name="download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['week', 'month', 'quarter', 'year'].map(period => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodText,
              selectedPeriod === period && styles.periodTextActive
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Key Metrics */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.summaryValue}>{formatCurrency(financialData.grossRevenue)}</Text>
            <Text style={styles.summaryLabel}>Gross Revenue</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+15.2%</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatCurrency(financialData.profit)}
            </Text>
            <Text style={styles.summaryLabel}>Net Profit</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+8.5%</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.warning }]}>
            <Text style={[styles.summaryValue, { color: Colors.warning }]}>
              {formatPercentage(financialData.profitMargin)}
            </Text>
            <Text style={styles.summaryLabel}>Profit Margin</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.warning }]}>
              <Icon name="trending-flat" size={12} color={Colors.white} />
              <Text style={styles.trendText}>-1.2%</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: Colors.danger }]}>
            <Text style={[styles.summaryValue, { color: Colors.danger }]}>
              {formatCurrency(financialData.totalExpenses)}
            </Text>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.danger }]}>
              <Icon name="trending-up" size={12} color={Colors.white} />
              <Text style={styles.trendText}>+12.1%</Text>
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
                {formatCurrency(financialData.grossRevenue)}
              </Text>
            </View>
            
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Less: VAT ({formatPercentage(20)})</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(financialData.taxData.vatCollected)}
              </Text>
            </View>
            
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Less: Service Tax ({formatPercentage(12.5)})</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(financialData.taxData.serviceTax)}
              </Text>
            </View>
            
            <View style={[styles.plRow, styles.plRowDivider]}>
              <Text style={[styles.plLabel, { fontWeight: 'bold' }]}>Net Revenue</Text>
              <Text style={[styles.plValue, { fontWeight: 'bold', color: Colors.primary }]}>
                {formatCurrency(financialData.netRevenue)}
              </Text>
            </View>
            
            <View style={styles.plRow}>
              <Text style={styles.plLabel}>Total Expenses</Text>
              <Text style={[styles.plValue, { color: Colors.danger }]}>
                -{formatCurrency(financialData.totalExpenses)}
              </Text>
            </View>
            
            <View style={[styles.plRow, styles.plRowFinal]}>
              <Text style={[styles.plLabel, { fontWeight: 'bold', fontSize: 16 }]}>Net Profit</Text>
              <Text style={[
                styles.plValue, 
                { 
                  fontWeight: 'bold', 
                  fontSize: 16,
                  color: financialData.profit >= 0 ? Colors.success : Colors.danger 
                }
              ]}>
                {formatCurrency(financialData.profit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Expense Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Breakdown</Text>
          <View style={styles.card}>
            {Object.entries(financialData.expenses).map(([key, value]) => {
              const percentage = (value / financialData.totalExpenses) * 100;
              return (
                <View key={key} style={styles.expenseRow}>
                  <View style={styles.expenseInfo}>
                    <View 
                      style={[
                        styles.expenseColorDot, 
                        { backgroundColor: getExpenseColor(key) }
                      ]} 
                    />
                    <Text style={styles.expenseLabel}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  </View>
                  
                  <View style={styles.expenseValues}>
                    <Text style={styles.expenseAmount}>{formatCurrency(value)}</Text>
                    <Text style={styles.expensePercentage}>({formatPercentage(percentage)})</Text>
                  </View>
                  
                  <View style={styles.expenseBar}>
                    <View 
                      style={[
                        styles.expenseBarFill,
                        { 
                          width: `${percentage}%`,
                          backgroundColor: getExpenseColor(key)
                        }
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
            {Object.entries(financialData.revenueBySource).map(([key, value]) => {
              const percentage = (value / financialData.grossRevenue) * 100;
              return (
                <View key={key} style={styles.revenueRow}>
                  <View style={styles.revenueInfo}>
                    <View 
                      style={[
                        styles.revenueColorDot, 
                        { backgroundColor: getRevenueSourceColor(key) }
                      ]} 
                    />
                    <Text style={styles.revenueLabel}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                  </View>
                  
                  <View style={styles.revenueValues}>
                    <Text style={styles.revenueAmount}>{formatCurrency(value)}</Text>
                    <Text style={styles.revenuePercentage}>({formatPercentage(percentage)})</Text>
                  </View>
                  
                  <View style={styles.revenueBar}>
                    <View 
                      style={[
                        styles.revenueBarFill,
                        { 
                          width: `${percentage}%`,
                          backgroundColor: getRevenueSourceColor(key)
                        }
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
              <Text style={styles.taxValue}>{formatCurrency(financialData.taxData.vatCollected)}</Text>
            </View>
            
            <View style={styles.taxRow}>
              <Text style={styles.taxLabel}>Service Tax (12.5%)</Text>
              <Text style={styles.taxValue}>{formatCurrency(financialData.taxData.serviceTax)}</Text>
            </View>
            
            <View style={[styles.taxRow, styles.taxRowTotal]}>
              <Text style={[styles.taxLabel, { fontWeight: 'bold' }]}>Total Taxes</Text>
              <Text style={[styles.taxValue, { fontWeight: 'bold', color: Colors.primary }]}>
                {formatCurrency(financialData.taxData.totalTaxes)}
              </Text>
            </View>
            
            <View style={styles.taxNote}>
              <Icon name="info" size={16} color={Colors.warning} />
              <Text style={styles.taxNoteText}>
                Tax remittance due by the 20th of next month
              </Text>
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
});

export default FinancialReportDetailScreen;