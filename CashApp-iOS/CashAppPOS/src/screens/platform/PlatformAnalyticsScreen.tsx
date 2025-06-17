import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
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

  const handleAnalyticsAction = (action: string) => {
    Alert.alert('Analytics', `${action} functionality will be implemented in Phase 2`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Analytics</Text>
        <Text style={styles.headerSubtitle}>Cross-restaurant insights</Text>
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
            <Text style={styles.largeValue}>£125,400</Text>
            <Text style={styles.changeText}>+12.5% from last month</Text>
            
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>£32,800</Text>
                <Text style={styles.metricLabel}>Commission Earned</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>2.3%</Text>
                <Text style={styles.metricLabel}>Avg Commission</Text>
              </View>
            </View>
          </View>
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
            
            {[
              { name: 'Fynlo Coffee Shop', revenue: '£45,200', growth: '+15.2%' },
              { name: 'Fynlo Burger Bar', revenue: '£38,900', growth: '+8.7%' },
              { name: 'Fynlo Pizza Palace', revenue: '£32,800', growth: '+5.3%' },
            ].map((restaurant, index) => (
              <View key={index} style={styles.rankingItem}>
                <View style={styles.rankingNumber}>
                  <Text style={styles.rankingNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingName}>{restaurant.name}</Text>
                  <Text style={styles.rankingGrowth}>{restaurant.growth}</Text>
                </View>
                <Text style={styles.rankingRevenue}>{restaurant.revenue}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transaction Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Analytics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="receipt" size={24} color={Colors.secondary} />
              <Text style={styles.statValue}>28,473</Text>
              <Text style={styles.statLabel}>Total Transactions</Text>
              <Text style={styles.statChange}>+8.2%</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="trending-up" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>£44.30</Text>
              <Text style={styles.statLabel}>Avg Transaction</Text>
              <Text style={styles.statChange}>+3.1%</Text>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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