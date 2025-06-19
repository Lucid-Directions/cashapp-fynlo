import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../contexts/AuthContext';

// Fynlo POS Color Scheme
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

const RestaurantsScreen: React.FC = () => {
  const { managedRestaurants, switchRestaurant } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const filteredRestaurants = managedRestaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || 
      (selectedFilter === 'active' && restaurant.isActive) ||
      (selectedFilter === 'inactive' && !restaurant.isActive);
    return matchesSearch && matchesFilter;
  });

  const handleRestaurantPress = (restaurant: any) => {
    Alert.alert(
      'Restaurant Actions',
      `What would you like to do with ${restaurant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Details', onPress: () => console.log('View details') },
        { text: 'Switch To', onPress: () => switchRestaurant(restaurant.id) },
        { text: 'Manage', onPress: () => console.log('Manage restaurant') },
      ]
    );
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return Colors.mediumGray;
      case 'premium': return Colors.primary;
      case 'enterprise': return Colors.secondary;
      default: return Colors.mediumGray;
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? Colors.success : Colors.danger;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restaurants</Text>
        <Text style={styles.headerSubtitle}>{managedRestaurants.length} locations</Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.mediumGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.filterContainer}>
          {['all', 'active', 'inactive'].map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(filter as any)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive
              ]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {filteredRestaurants.map((restaurant) => (
          <TouchableOpacity
            key={restaurant.id}
            style={styles.restaurantCard}
            onPress={() => handleRestaurantPress(restaurant)}
          >
            <View style={styles.restaurantHeader}>
              <View style={styles.restaurantInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(restaurant.isActive || false) }]}>
                    <Text style={styles.statusText}>{restaurant.isActive ? 'ONLINE' : 'OFFLINE'}</Text>
                  </View>
                </View>
                <Text style={styles.restaurantAddress}>{restaurant.address}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={Colors.mediumGray} />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>£{((restaurant.monthlyRevenue || 0) / 30).toFixed(0)}</Text>
                <Text style={styles.metricLabel}>Daily Avg</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{restaurant.commissionRate}%</Text>
                <Text style={styles.metricLabel}>Commission</Text>
              </View>
              <View style={styles.tierBadgeContainer}>
                <View style={[styles.tierBadge, { backgroundColor: getTierColor(restaurant.subscriptionTier || 'basic') }]}>
                  <Text style={styles.tierText}>{(restaurant.subscriptionTier || 'basic').toUpperCase()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton}>
                <Icon name="analytics" size={16} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Analytics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Icon name="settings" size={16} color={Colors.secondary} />
                <Text style={styles.actionButtonText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Icon name="support" size={16} color={Colors.warning} />
                <Text style={styles.actionButtonText}>Support</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add Restaurant FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Add Restaurant', 'Restaurant onboarding will be implemented in Phase 2')}
      >
        <Icon name="add" size={24} color={Colors.white} />
      </TouchableOpacity>
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
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  restaurantCard: {
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
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  restaurantAddress: {
    fontSize: 14,
    color: Colors.lightText,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  tierBadgeContainer: {
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tierText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default RestaurantsScreen;