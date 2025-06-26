import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface RestaurantPaymentData {
  restaurantId: string;
  restaurantName: string;
  recentErrors: any[];
  recentAttempts: any[];
  stats: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    averageAmount: number;
    lastActivity: string;
  };
  status: 'healthy' | 'warning' | 'critical';
}

export interface PlatformPaymentStats {
  totalRestaurants: number;
  activeRestaurants: number;
  totalPaymentVolume: number;
  totalAttempts: number;
  overallSuccessRate: number;
  criticalErrors: number;
  restaurantsWithIssues: number;
}

export default function PaymentMonitoringScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformPaymentStats | null>(null);
  const [restaurantData, setRestaurantData] = useState<RestaurantPaymentData[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Fetch platform-wide payment monitoring data
      const response = await fetch('http://localhost:8000/api/monitoring/platform-payment-stats');
      if (response.ok) {
        const data = await response.json();
        setPlatformStats(data.platformStats);
        setRestaurantData(data.restaurants);
      } else {
        // Fallback to mock data for development
        setPlatformStats({
          totalRestaurants: 5,
          activeRestaurants: 4,
          totalPaymentVolume: 15420.50,
          totalAttempts: 234,
          overallSuccessRate: 94.2,
          criticalErrors: 2,
          restaurantsWithIssues: 1
        });

        setRestaurantData([
          {
            restaurantId: 'restaurant_1',
            restaurantName: 'La Cocina Mexicana',
            recentErrors: [
              {
                type: 'sumup_login',
                message: 'Authentication failed',
                timestamp: new Date(Date.now() - 30000).toISOString(),
                severity: 'high'
              }
            ],
            recentAttempts: [],
            stats: {
              totalAttempts: 45,
              successfulAttempts: 41,
              failedAttempts: 4,
              successRate: 91.1,
              averageAmount: 23.50,
              lastActivity: new Date(Date.now() - 30000).toISOString()
            },
            status: 'warning'
          },
          {
            restaurantId: 'restaurant_2', 
            restaurantName: 'Pizza Palace',
            recentErrors: [],
            recentAttempts: [],
            stats: {
              totalAttempts: 89,
              successfulAttempts: 87,
              failedAttempts: 2,
              successRate: 97.8,
              averageAmount: 18.75,
              lastActivity: new Date(Date.now() - 120000).toISOString()
            },
            status: 'healthy'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
      Alert.alert('Error', 'Failed to load payment monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMonitoringData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadMonitoringData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      default: return theme.colors.text;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return 'check-circle';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'help';
    }
  };

  const filteredRestaurants = restaurantData.filter(restaurant => 
    selectedFilter === 'all' || restaurant.status === selectedFilter
  );

  const renderPlatformStats = () => {
    if (!platformStats) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Platform Overview</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Icon name="restaurant" size={24} color={theme.colors.primary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {platformStats.activeRestaurants}/{platformStats.totalRestaurants}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Active Restaurants
            </Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="payments" size={24} color="#4CAF50" />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              £{platformStats.totalPaymentVolume.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Total Volume
            </Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="trending-up" size={24} color={theme.colors.primary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {platformStats.overallSuccessRate.toFixed(1)}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Success Rate
            </Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="error" size={24} color={platformStats.criticalErrors > 0 ? '#F44336' : '#4CAF50'} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {platformStats.criticalErrors}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Critical Errors
            </Text>
          </View>
        </View>

        {platformStats.restaurantsWithIssues > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
            <Icon name="warning" size={20} color="#FF9800" />
            <Text style={[styles.alertText, { color: '#E65100' }]}>
              {platformStats.restaurantsWithIssues} restaurant(s) need attention
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderFilterTabs = () => (
    <View style={[styles.filterTabs, { backgroundColor: theme.colors.card }]}>
      {[
        { key: 'all', label: 'All', count: restaurantData.length },
        { key: 'healthy', label: 'Healthy', count: restaurantData.filter(r => r.status === 'healthy').length },
        { key: 'warning', label: 'Warning', count: restaurantData.filter(r => r.status === 'warning').length },
        { key: 'critical', label: 'Critical', count: restaurantData.filter(r => r.status === 'critical').length },
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.filterTab,
            selectedFilter === tab.key && styles.filterTabActive,
            selectedFilter === tab.key && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setSelectedFilter(tab.key as any)}
        >
          <Text style={[
            styles.filterTabText,
            { color: selectedFilter === tab.key ? 'white' : theme.colors.text }
          ]}>
            {tab.label} ({tab.count})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRestaurantItem = ({ item }: { item: RestaurantPaymentData }) => (
    <TouchableOpacity
      style={[styles.restaurantCard, { backgroundColor: theme.colors.card }]}
      onPress={() => navigation.navigate('RestaurantPaymentDetails', { restaurantId: item.restaurantId })}
    >
      <View style={styles.restaurantHeader}>
        <View style={styles.restaurantInfo}>
          <Text style={[styles.restaurantName, { color: theme.colors.text }]}>
            {item.restaurantName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Icon name={getStatusIcon(item.status)} size={12} color="white" />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={[styles.lastActivity, { color: theme.colors.textSecondary }]}>
          {new Date(item.stats.lastActivity).toLocaleTimeString()}
        </Text>
      </View>

      <View style={styles.restaurantStats}>
        <View style={styles.statRow}>
          <Text style={[styles.statRowLabel, { color: theme.colors.textSecondary }]}>Success Rate:</Text>
          <Text style={[styles.statRowValue, { color: theme.colors.text }]}>
            {item.stats.successRate.toFixed(1)}% ({item.stats.successfulAttempts}/{item.stats.totalAttempts})
          </Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={[styles.statRowLabel, { color: theme.colors.textSecondary }]}>Avg Amount:</Text>
          <Text style={[styles.statRowValue, { color: theme.colors.text }]}>
            £{item.stats.averageAmount.toFixed(2)}
          </Text>
        </View>

        {item.recentErrors.length > 0 && (
          <View style={styles.errorSummary}>
            <Icon name="error" size={16} color="#F44336" />
            <Text style={[styles.errorSummaryText, { color: '#F44336' }]}>
              {item.recentErrors.length} recent error(s)
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading payment monitoring data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Payment Monitoring</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderPlatformStats()}
        {renderFilterTabs()}
        
        <FlatList
          data={filteredRestaurants}
          renderItem={renderRestaurantItem}
          keyExtractor={item => item.restaurantId}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  alertText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  restaurantCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  lastActivity: {
    fontSize: 12,
  },
  restaurantStats: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statRowLabel: {
    fontSize: 14,
  },
  statRowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorSummaryText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
});