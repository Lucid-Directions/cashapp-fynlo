import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
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
  // Mock data
  const todaysStats = {
    sales: 1247.50,
    orders: 23,
    avgOrder: 54.24,
    customers: 18,
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color = Colors.secondary 
  }: { 
    title: string; 
    value: string | number; 
    icon: string; 
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color={Colors.white} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
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
        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Sales"
              value={`$${todaysStats.sales.toFixed(2)}`}
              icon="attach-money"
              color={Colors.success}
            />
            <StatCard
              title="Orders"
              value={todaysStats.orders}
              icon="receipt"
              color={Colors.secondary}
            />
            <StatCard
              title="Avg Order"
              value={`$${todaysStats.avgOrder.toFixed(2)}`}
              icon="trending-up"
              color={Colors.warning}
            />
            <StatCard
              title="Customers"
              value={todaysStats.customers}
              icon="people"
              color={Colors.primary}
            />
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.comingSoon}>
          <Icon name="analytics" size={64} color={Colors.lightText} />
          <Text style={styles.comingSoonTitle}>Advanced Reports Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            Detailed analytics, sales trends, and business insights will be available in future updates.
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
  comingSoon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default ReportsScreen;