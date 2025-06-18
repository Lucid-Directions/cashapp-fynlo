import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import LazyLoadingWrapper from '../../components/performance/LazyLoadingWrapper';

const { width: screenWidth } = Dimensions.get('window');

// Fynlo POS Color Scheme
const Colors = {
  primary: '#00A651',      // Fynlo Green
  secondary: '#0066CC',    // Fynlo Blue
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

interface QuickStatCard {
  id: string;
  title: string;
  value: string;
  icon: string;
  color: string;
  change?: string;
  changePositive?: boolean;
}

interface RestaurantStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  dailyRevenue: number;
  transactionCount: number;
  lastActivity: Date;
  subscriptionTier: string;
}

const PlatformDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, platform, managedRestaurants, loadPlatformData, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('today');

  // Quick stats data
  const quickStats: QuickStatCard[] = [
    {
      id: '1',
      title: 'Total Revenue',
      value: '£125.4K',
      icon: 'attach-money',
      color: Colors.success,
      change: '+12.5%',
      changePositive: true,
    },
    {
      id: '2',
      title: 'Active Restaurants',
      value: '42',
      icon: 'store',
      color: Colors.primary,
      change: '+3',
      changePositive: true,
    },
    {
      id: '3',
      title: 'Transactions Today',
      value: '2,847',
      icon: 'receipt',
      color: Colors.secondary,
      change: '+8.2%',
      changePositive: true,
    },
    {
      id: '4',
      title: 'System Uptime',
      value: '99.9%',
      icon: 'check-circle',
      color: Colors.success,
      change: '+0.1%',
      changePositive: true,
    },
  ];

  // Mock restaurant status data
  const restaurantStatuses: RestaurantStatus[] = managedRestaurants.map((restaurant, index) => ({
    id: restaurant.id,
    name: restaurant.name,
    status: restaurant.isActive ? (index === 3 ? 'error' : 'online') : 'offline',
    dailyRevenue: Math.floor((restaurant.monthlyRevenue || 0) / 30),
    transactionCount: Math.floor(Math.random() * 150) + 50,
    lastActivity: restaurant.lastActivity || new Date(),
    subscriptionTier: restaurant.subscriptionTier || 'basic',
  }));

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPlatformData();
    setIsRefreshing(false);
  }, [loadPlatformData]);

  const handleRestaurantPress = (restaurantId: string) => {
    const restaurant = managedRestaurants.find(r => r.id === restaurantId);
    Alert.alert(
      'Restaurant Details',
      `Name: ${restaurant?.name}\nStatus: ${restaurantStatuses.find(s => s.id === restaurantId)?.status}\nRevenue: £${restaurantStatuses.find(s => s.id === restaurantId)?.dailyRevenue}/day`,
      [
        { text: 'OK' },
        { text: 'View Details', onPress: () => console.log('Navigate to restaurant details') }
      ]
    );
  };

  const handleQuickAction = (action: string) => {
    Alert.alert('Quick Action', `${action} functionality will be implemented in Phase 2`);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => signOut()
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return Colors.success;
      case 'offline': return Colors.mediumGray;
      case 'error': return Colors.danger;
      default: return Colors.mediumGray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return 'check-circle';
      case 'offline': return 'radio-button-unchecked';
      case 'error': return 'error';
      default: return 'radio-button-unchecked';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return Colors.mediumGray;
      case 'premium': return Colors.primary;
      case 'enterprise': return Colors.secondary;
      default: return Colors.mediumGray;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Platform Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome back, {user?.firstName} • {platform?.totalRestaurants} restaurants
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => handleQuickAction('Notifications')}
          >
            <Icon name="notifications" size={24} color={Colors.text} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
          >
            <Icon name="exit-to-app" size={24} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.statsGrid}>
            {quickStats.map((stat) => (
              <View key={stat.id} style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Icon name={stat.icon} size={24} color={stat.color} />
                  {stat.change && (
                    <View style={[
                      styles.changeContainer,
                      { backgroundColor: stat.changePositive ? Colors.success : Colors.danger }
                    ]}>
                      <Icon 
                        name={stat.changePositive ? 'trending-up' : 'trending-down'} 
                        size={12} 
                        color={Colors.white} 
                      />
                      <Text style={styles.changeText}>{stat.change}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Restaurant Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Restaurant Status</Text>
            <TouchableOpacity onPress={() => handleQuickAction('View All Restaurants')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {restaurantStatuses.map((restaurant) => (
            <TouchableOpacity
              key={restaurant.id}
              style={styles.restaurantCard}
              onPress={() => handleRestaurantPress(restaurant.id)}
            >
              <View style={styles.restaurantHeader}>
                <View style={styles.restaurantInfo}>
                  <View style={styles.restaurantNameRow}>
                    <Icon
                      name={getStatusIcon(restaurant.status)}
                      size={16}
                      color={getStatusColor(restaurant.status)}
                    />
                    <Text style={styles.restaurantName}>{restaurant.name}</Text>
                    <View style={[styles.tierBadge, { backgroundColor: getTierColor(restaurant.subscriptionTier) }]}>
                      <Text style={styles.tierText}>{restaurant.subscriptionTier.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.restaurantSubtitle}>
                    Last active: {restaurant.lastActivity.toLocaleTimeString()}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={Colors.mediumGray} />
              </View>
              
              <View style={styles.restaurantMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>£{restaurant.dailyRevenue.toFixed(0)}</Text>
                  <Text style={styles.metricLabel}>Daily Revenue</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{restaurant.transactionCount}</Text>
                  <Text style={styles.metricLabel}>Transactions</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: getStatusColor(restaurant.status) }]}>
                    {restaurant.status.toUpperCase()}
                  </Text>
                  <Text style={styles.metricLabel}>Status</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('Add Restaurant')}
            >
              <Icon name="add-business" size={32} color={Colors.primary} />
              <Text style={styles.actionText}>Add Restaurant</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('System Health')}
            >
              <Icon name="health-and-safety" size={32} color={Colors.secondary} />
              <Text style={styles.actionText}>System Health</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('Analytics')}
            >
              <Icon name="analytics" size={32} color={Colors.warning} />
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('Support')}
            >
              <Icon name="support" size={32} color={Colors.danger} />
              <Text style={styles.actionText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* System Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Alerts</Text>
          <View style={styles.alertCard}>
            <View style={styles.alertItem}>
              <Icon name="warning" size={16} color={Colors.warning} />
              <Text style={styles.alertText}>Payment Issue: Fynlo Fine Dining - Card Reader Down</Text>
            </View>
            <View style={styles.alertItem}>
              <Icon name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.alertText}>System Update: Completed Successfully</Text>
            </View>
            <View style={styles.alertItem}>
              <Icon name="assessment" size={16} color={Colors.secondary} />
              <Text style={styles.alertText}>Report: Weekly analytics ready for download</Text>
            </View>
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
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  notificationButton: {
    position: 'relative',
    padding: 8,
    marginRight: 12,
  },
  logoutButton: {
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (screenWidth - 60) / 2,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  changeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.lightText,
  },
  restaurantCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tierText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  restaurantSubtitle: {
    fontSize: 12,
    color: Colors.lightText,
    marginLeft: 24,
  },
  restaurantMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (screenWidth - 60) / 2,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  alertCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
});

export default memo(PlatformDashboardScreen);