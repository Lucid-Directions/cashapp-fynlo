import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// import { generateCustomers, CustomerData } from '../../utils/mockDataGenerator'; // Removed
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService'; // Added

import type { CustomerData } from '../../types'; // Updated import path

const CustomersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  // Styles are now static - theme values applied inline where needed
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery, selectedSegment]);

  const loadCustomers = async () => {
    // Modified
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming a getCustomers method will be added to DataService
      // For now, this will likely fail or return empty if not implemented, demonstrating error state
      const customerData = await dataService.getCustomers();

      // Parse date strings to Date objects
      const parsedCustomers = (customerData || []).map((customer) => ({
        ...customer,
        joinedDate: customer.joinedDate ? new Date(customer.joinedDate) : null,
        lastVisit: customer.lastVisit ? new Date(customer.lastVisit) : null,
      }));

      setCustomers(parsedCustomers);
    } catch (e: unknown) {
      setError(e.message || 'Failed to load customers.');
      setCustomers([]); // Clear customers on error
    } finally {
      setIsLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Apply segment filter
    if (selectedSegment !== 'all') {
      switch (selectedSegment) {
        case 'vip':
          filtered = filtered.filter((customer) => customer.totalSpent > 500);
          break;
        case 'regular':
          filtered = filtered.filter((customer) => customer.orderCount >= 10);
          break;
        case 'new':
          filtered = filtered.filter((customer) => {
            if (!customer.joinedDate) return false;
            const joinedDate =
              customer.joinedDate instanceof Date
                ? customer.joinedDate
                : new Date(customer.joinedDate);
            const daysSinceJoined = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceJoined <= 30;
          });
          break;
        case 'loyalty':
          filtered = filtered.filter((customer) => customer.loyaltyPoints > 1000);
          break;
      }
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery)
      );
    }

    setFilteredCustomers(filtered);
  };

  const getCustomerLevel = (customer: CustomerData) => {
    if (customer.totalSpent > 1000) return { level: 'VIP', color: theme.colors.warning[500] };
    if (customer.totalSpent > 500) return { level: 'Premium', color: theme.colors.secondary };
    if (customer.orderCount >= 10) return { level: 'Regular', color: theme.colors.primary };
    return { level: 'New', color: theme.colors.darkGray };
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Never';

    const days = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const renderCustomer = ({ item }: { item: CustomerData }) => {
    const customerLevel = getCustomerLevel(item);

    return (
      <TouchableOpacity
        style={[styles.customerCard, { backgroundColor: theme.colors.white }]}
        onPress={() => setSelectedCustomer(item)}
        activeOpacity={0.7}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerAvatar}>
            <Icon name="account-circle" size={50} color={theme.colors.primary} />
          </View>
          <View style={styles.customerInfo}>
            <View style={styles.customerNameRow}>
              <Text style={[styles.customerName, { color: theme.colors.text }]}>{item.name}</Text>
              <View style={[styles.levelBadge, { backgroundColor: `${customerLevel.color}20` }]}>
                <Text style={[styles.levelText, { color: customerLevel.color }]}>
                  {customerLevel.level}
                </Text>
              </View>
            </View>
            <Text style={[styles.customerEmail, { color: theme.colors.darkGray }]}>
              {item.email}
            </Text>
            <Text style={[styles.customerPhone, { color: theme.colors.darkGray }]}>
              {item.phone}
            </Text>
          </View>
          <View style={styles.customerStats}>
            <Text style={styles.statValue}>£{item.totalSpent.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        <View style={[styles.customerMetrics, { borderTopColor: theme.colors.border }]}>
          <View style={styles.metricItem}>
            <Icon name="shopping-cart" size={16} color={theme.colors.darkGray} />
            <Text style={[styles.metricText, { color: theme.colors.darkGray }]}>
              {item.orderCount} orders
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="star" size={16} color={theme.colors.warning[500]} />
            <Text style={[styles.metricText, { color: theme.colors.darkGray }]}>
              {item.loyaltyPoints} points
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="schedule" size={16} color={theme.colors.darkGray} />
            <Text style={[styles.metricText, { color: theme.colors.darkGray }]}>
              Last visit {formatDate(item.lastVisit)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const stats = {
    total: customers.length,
    vip: customers.filter((c) => c.totalSpent > 1000).length,
    new: customers.filter((c) => {
      if (!c.joinedDate) return false;
      const joinedDate = c.joinedDate instanceof Date ? c.joinedDate : new Date(c.joinedDate);
      const days = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length,
    avgSpent:
      customers.length > 0
        ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length
        : 0,
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.darkGray }]}>
          Loading Customers...
        </Text>
      </SafeAreaView>
    );
  }

  const renderEmptyListComponent = () => {
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error-outline" size={64} color={theme.colors.danger[500]} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            Error Loading Customers
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.darkGray }]}>{error}</Text>
          <TouchableOpacity
            onPress={loadCustomers}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.white }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="people" size={64} color={theme.colors.lightGray} />
        <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
          No customers found
        </Text>
        <Text style={[styles.emptyStateSubtext, { color: theme.colors.darkGray }]}>
          {searchQuery ? 'Try adjusting your search' : 'Add your first customer or pull to refresh'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.white }]}>Customers</Text>
          <Text style={styles.headerSubtitle}>{filteredCustomers.length} customers</Text>
        </View>

        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View
        style={[
          styles.statsBar,
          { backgroundColor: theme.colors.white, borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.darkGray }]}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.warning[500] }]}>{stats.vip}</Text>
          <Text style={styles.statLabel}>VIP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.success[500] }]}>{stats.new}</Text>
          <Text style={styles.statLabel}>New (30d)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
            £{stats.avgSpent.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Avg Spent</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View
        style={[
          styles.searchSection,
          { backgroundColor: theme.colors.white, borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
          <Icon name="search" size={20} color={theme.colors.darkGray} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search customers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.darkGray}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentFilters}>
          {[
            { key: 'all', label: 'All' },
            { key: 'vip', label: 'VIP' },
            { key: 'regular', label: 'Regular' },
            { key: 'new', label: 'New' },
            { key: 'loyalty', label: 'Loyalty' },
          ].map((segment) => (
            <TouchableOpacity
              key={segment.key}
              style={[
                styles.segmentFilter,
                { backgroundColor: theme.colors.background },
                selectedSegment === segment.key && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setSelectedSegment(segment.key)}
            >
              <Text
                style={[
                  styles.segmentFilterText,
                  { color: theme.colors.text },
                  selectedSegment === segment.key && { color: theme.colors.white },
                ]}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Customers List */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.customersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyListComponent}
        onRefresh={loadCustomers} // Added
        refreshing={isLoading} // Added
      />

      {/* Customer Detail Modal */}
      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.customerModal, { backgroundColor: theme.colors.white }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Customer Details
              </Text>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.customerProfile}>
                  <View style={styles.profileAvatar}>
                    <Icon name="account-circle" size={80} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.profileName, { color: theme.colors.text }]}>
                    {selectedCustomer.name}
                  </Text>
                  <View
                    style={[
                      styles.profileLevel,
                      { backgroundColor: `${getCustomerLevel(selectedCustomer).color}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileLevelText,
                        { color: getCustomerLevel(selectedCustomer).color },
                      ]}
                    >
                      {getCustomerLevel(selectedCustomer).level} Customer
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Contact Information
                  </Text>
                  <View style={styles.detailRow}>
                    <Icon name="email" size={20} color={theme.colors.darkGray} />
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      {selectedCustomer.email}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="phone" size={20} color={theme.colors.darkGray} />
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      {selectedCustomer.phone}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="calendar-today" size={20} color={theme.colors.darkGray} />
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      Customer since {selectedCustomer.joinedDate.toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Purchase History
                  </Text>
                  <View style={styles.purchaseGrid}>
                    <View
                      style={[styles.purchaseCard, { backgroundColor: theme.colors.background }]}
                    >
                      <Text style={[styles.purchaseValue, { color: theme.colors.primary }]}>
                        £{selectedCustomer.totalSpent.toFixed(2)}
                      </Text>
                      <Text style={[styles.purchaseLabel, { color: theme.colors.darkGray }]}>
                        Total Spent
                      </Text>
                    </View>
                    <View
                      style={[styles.purchaseCard, { backgroundColor: theme.colors.background }]}
                    >
                      <Text style={[styles.purchaseValue, { color: theme.colors.primary }]}>
                        {selectedCustomer.orderCount}
                      </Text>
                      <Text style={[styles.purchaseLabel, { color: theme.colors.darkGray }]}>
                        Orders
                      </Text>
                    </View>
                    <View
                      style={[styles.purchaseCard, { backgroundColor: theme.colors.background }]}
                    >
                      <Text style={[styles.purchaseValue, { color: theme.colors.primary }]}>
                        £{selectedCustomer.averageOrderValue.toFixed(2)}
                      </Text>
                      <Text style={[styles.purchaseLabel, { color: theme.colors.darkGray }]}>
                        Avg Order
                      </Text>
                    </View>
                    <View
                      style={[styles.purchaseCard, { backgroundColor: theme.colors.background }]}
                    >
                      <Text style={[styles.purchaseValue, { color: theme.colors.warning[500] }]}>
                        {selectedCustomer.loyaltyPoints}
                      </Text>
                      <Text style={[styles.purchaseLabel, { color: theme.colors.darkGray }]}>
                        Loyalty Points
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Preferred Items
                  </Text>
                  <View style={styles.preferredItems}>
                    {selectedCustomer.preferredItems?.map((item, index) => (
                      <View
                        key={index}
                        style={[
                          styles.preferredItem,
                          { backgroundColor: theme.colors.primary + '20' },
                        ]}
                      >
                        <Text style={[styles.preferredItemText, { color: theme.colors.primary }]}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {selectedCustomer.tags?.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
                    <View style={styles.customerTags}>
                      {selectedCustomer.tags?.map((tag, index) => (
                        <View
                          key={index}
                          style={[
                            styles.customerTag,
                            { backgroundColor: theme.colors.secondary + '20' },
                          ]}
                        >
                          <Text style={[styles.customerTagText, { color: theme.colors.secondary }]}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
                  >
                    <Icon name="edit" size={20} color={theme.colors.white} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.white }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.success[500] }]}
                  >
                    <Icon name="add-shopping-cart" size={20} color={theme.colors.white} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.white }]}>
                      New Order
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
  },
  backButton: {
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  searchSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  segmentFilters: {
    paddingHorizontal: 16,
  },
  segmentFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  segmentFilterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customersList: {
    padding: 16,
  },
  customerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  customerEmail: {
    fontSize: 12,
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
  customerStats: {
    alignItems: 'flex-end',
  },
  customerMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerModal: {
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  customerProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  profileLevel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profileLevelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 12,
  },
  purchaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  purchaseCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  purchaseValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  purchaseLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  preferredItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferredItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  preferredItemText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customerTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customerTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  customerTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  centered: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomersScreen;
