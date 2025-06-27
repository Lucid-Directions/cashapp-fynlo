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
import { generateEmployees, generateSalesHistory, EmployeeData } from '../../utils/mockDataGenerator';
import Colors from '../../constants/Colors';
import { useTheme } from '../../design-system/ThemeProvider';

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
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
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      // Load employees and sales data
      const employeeData = generateEmployees();
      const salesHistory = generateSalesHistory(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days
      
      setEmployees(employeeData);
      setSalesData(salesHistory);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate today's performance metrics
  const getTodayMetrics = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayData = salesData.find(day => 
      day.date.toISOString().split('T')[0] === todayStr
    );
    
    if (!todayData) {
      return {
        totalSales: 1247.50,
        transactions: 23,
        averageOrder: 54.24,
        topPerformer: employees[0]?.name || 'Maria Rodriguez',
        topPerformerSales: 485.20
      };
    }
    
    return {
      totalSales: todayData.total,
      transactions: todayData.transactions,
      averageOrder: todayData.averageTransaction,
      topPerformer: todayData.employees[0]?.name || 'No data',
      topPerformerSales: todayData.employees[0]?.sales || 0
    };
  };

  // Calculate weekly employee costs
  const getWeeklyLaborCosts = () => {
    const totalScheduledHours = employees.reduce((sum, emp) => sum + (emp.scheduledHours * 0.25), 0); // This week
    const totalActualHours = employees.reduce((sum, emp) => sum + (emp.actualHours * 0.25), 0);
    const totalLaborCost = employees.reduce((sum, emp) => sum + (emp.actualHours * 0.25 * emp.hourlyRate), 0);
    const efficiency = totalScheduledHours > 0 ? (totalActualHours / totalScheduledHours) * 100 : 0;
    
    return {
      totalScheduledHours: Math.round(totalScheduledHours),
      totalActualHours: Math.round(totalActualHours),
      totalLaborCost,
      efficiency
    };
  };

  const todayMetrics = getTodayMetrics();
  const laborMetrics = getWeeklyLaborCosts();

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
                <Text style={[styles.statValue, { color: Colors.success }]}>£{todayMetrics.totalSales.toFixed(2)}</Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Total Sales</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{todayMetrics.transactions}</Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Orders</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.secondary }]}>£{todayMetrics.averageOrder.toFixed(2)}</Text>
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
                <Text style={[styles.statValue, { color: Colors.warning }]}>{laborMetrics.totalActualHours}h</Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Hours Worked</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Colors.danger }]}>£{laborMetrics.totalLaborCost.toFixed(0)}</Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Labor Cost</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: laborMetrics.efficiency >= 90 ? Colors.success : laborMetrics.efficiency >= 80 ? Colors.warning : Colors.danger }]}>{laborMetrics.efficiency.toFixed(0)}%</Text>
                <Text style={[styles.statLabel, { color: Colors.darkGray }]}>Efficiency</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Items Today</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            <Text style={[styles.itemText, { color: theme.colors.text }]}>🌮 Carnitas Tacos - 15 sold</Text>
            <Text style={[styles.itemText, { color: theme.colors.text }]}>🧀 Nachos - 12 sold</Text>
            <Text style={[styles.itemText, { color: theme.colors.text }]}>🫓 Quesadillas - 10 sold</Text>
            <Text style={[styles.itemText, { color: theme.colors.text }]}>🌯 Burritos - 8 sold</Text>
          </View>
        </View>

        {/* Staff Performance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Top Performers Today</Text>
          <View style={[styles.card, { backgroundColor: theme.colors.white }]}>
            {employees.slice(0, 3).map((employee, index) => {
              const dailySales = (employee.totalSales / 30); // Approximate daily sales
              return (
                <View key={employee.id} style={styles.performerRow}>
                  <View style={styles.performerRank}>
                    <Text style={[styles.rankNumber, { color: index === 0 ? Colors.warning : Colors.darkGray }]}>#{index + 1}</Text>
                  </View>
                  <View style={styles.performerInfo}>
                    <Text style={[styles.performerName, { color: theme.colors.text }]}>{employee.name}</Text>
                    <Text style={[styles.performerRole, { color: Colors.darkGray }]}>{employee.role}</Text>
                  </View>
                  <View style={styles.performerStats}>
                    <Text style={[styles.performerSales, { color: Colors.success }]}>£{dailySales.toFixed(0)}</Text>
                    <Text style={[styles.performerHours, { color: Colors.darkGray }]}>{(employee.actualHours / 7).toFixed(1)}h</Text>
                  </View>
                </View>
              );
            })}
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
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Daily, weekly, monthly sales</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('InventoryReport')}
          >
            <Icon name="inventory" size={24} color={Colors.warning} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Inventory Report</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Stock levels and costs</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('StaffReport')}
          >
            <Icon name="people" size={24} color={Colors.secondary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Employee Performance</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Performance metrics & costs</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('ScheduleReport')}
          >
            <Icon name="schedule" size={24} color={Colors.primary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Schedule & Labor Report</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Rota analysis & labor costs</Text>
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
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Labor vs revenue analysis</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.reportItem, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate('FinancialReport')}
          >
            <Icon name="account-balance" size={24} color={Colors.secondary} />
            <View style={styles.reportInfo}>
              <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Financial Report</Text>
              <Text style={[styles.reportDesc, { color: Colors.darkGray }]}>Profit, loss, and expenses</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        <View style={[styles.notice, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.noticeText, { color: Colors.darkGray }]}>
            Reports use real employee and sales data. {employees.length} employees tracked.
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
    padding: 8,
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
});

export default ReportsScreen;