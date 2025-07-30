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
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
// import { generateCustomers, CustomerData } from '../../utils/mockDataGenerator'; // Removed
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService'; // Added
import { CustomerData } from '../../types'; // Updated import path

const CustomersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(__null);
  const [isLoading, setIsLoading] = useState<boolean>(__true); // Added
  const [error, setError] = useState<string | null>(__null); // Added

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, _searchQuery, selectedSegment]);

  const loadCustomers = async () => {
    // Modified
    setIsLoading(__true);
    setError(__null);
    try {
      const dataService = DataService.getInstance();
      // Assuming a getCustomers method will be added to DataService
      // For now, this will likely fail or return empty if not implemented, demonstrating error state
      const customerData = await dataService.getCustomers();

      // Parse date strings to Date objects
      const __parsedCustomers = (customerData || []).map(customer => ({
        ...customer,
        joinedDate: customer.joinedDate ? new Date(customer.joinedDate) : _null,
        lastVisit: customer.lastVisit ? new Date(customer.lastVisit) : _null,
      }));

      setCustomers(__parsedCustomers);
    } catch (e: _unknown) {
      setError(e.message || 'Failed to load customers.');
      setCustomers([]); // Clear customers on error
    } finally {
      setIsLoading(__false);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Apply segment filter
    if (selectedSegment !== 'all') {
      switch (__selectedSegment) {
        case 'vip':
          filtered = filtered.filter(customer => customer.totalSpent > 500);
          break;
        case 'regular':
          filtered = filtered.filter(customer => customer.orderCount >= 10);
          break;
        case 'new':
          filtered = filtered.filter(customer => {
            if (!customer.joinedDate) {
              return false;
            }
            const joinedDate =
              customer.joinedDate instanceof Date
                ? customer.joinedDate
                : new Date(customer.joinedDate);
            const daysSinceJoined = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceJoined <= 30;
          });
          break;
        case 'loyalty':
          filtered = filtered.filter(customer => customer.loyaltyPoints > 1000);
          break;
      }
    }

    // Apply search query
    if (__searchQuery) {
      _filtered = filtered.filter(
        customer =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(__searchQuery),
      );
    }

    setFilteredCustomers(__filtered);
  };

  const getCustomerLevel = (customer: _CustomerData) => {
    if (customer.totalSpent > 1000) {
      return { level: 'VIP', color: theme.colors.warning[500] };
    }
    if (customer.totalSpent > 500) {
      return { level: 'Premium', color: theme.colors.secondary };
    }
    if (customer.orderCount >= 10) {
      return { level: 'Regular', color: theme.colors.primary };
    }
    return { level: 'New', color: theme.colors.darkGray };
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) {
      return 'Never';
    }
    const dateObj = date instanceof Date ? date : new Date(__date);
    if (isNaN(dateObj.getTime())) {
      return 'Never';
    }

    const days = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return 'Today';
    }
    if (days === 1) {
      return 'Yesterday';
    }
    if (days < 7) {
      return `${days} days ago`;
    }
    if (days < 30) {
      return `${Math.floor(days / 7)} weeks ago`;
    }
    if (days < 365) {
      return `${Math.floor(days / 30)} months ago`;
    }
    return `${Math.floor(days / 365)} years ago`;
  };

  const renderCustomer = ({ item }: { item: CustomerData }) => {
    const customerLevel = getCustomerLevel(__item);

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => setSelectedCustomer(__item)}
        activeOpacity={0.7}>
        <View style={styles.customerHeader}>
          <View style={styles.customerAvatar}>
            <Icon name="account-circle" size={50} color={theme.colors.primary} />
          </View>
          <View style={styles.customerInfo}>
            <View style={styles.customerNameRow}>
              <Text style={styles.customerName}>{item.name}</Text>
              <View style={[styles.levelBadge, { backgroundColor: `${customerLevel.color}20` }]}>
                <Text style={[styles.levelText, { color: customerLevel.color }]}>
                  {customerLevel.level}
                </Text>
              </View>
            </View>
            <Text style={styles.customerEmail}>{item.email}</Text>
            <Text style={styles.customerPhone}>{item.phone}</Text>
          </View>
          <View style={styles.customerStats}>
            <Text style={styles.statValue}>£{item.totalSpent.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        <View style={styles.customerMetrics}>
          <View style={styles.metricItem}>
            <Icon name="shopping-cart" size={16} color={theme.colors.darkGray} />
            <Text style={styles.metricText}>{item.orderCount} orders</Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="star" size={16} color={theme.colors.warning[500]} />
            <Text style={styles.metricText}>{item.loyaltyPoints} points</Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="schedule" size={16} color={theme.colors.darkGray} />
            <Text style={styles.metricText}>Last visit {formatDate(item.lastVisit)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const stats = {
    total: customers.length,
    vip: customers.filter(c => c.totalSpent > 1000).length,
    new: customers.filter(c => {
      if (!c.joinedDate) {
        return false;
      }
      const joinedDate = c.joinedDate instanceof Date ? c.joinedDate : new Date(c.joinedDate);
      const days = (Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length,
    avgSpent:
      customers.length > 0
        ? customers.reduce((__sum, _c) => sum + c.totalSpent, 0) / customers.length
        : 0,
  };

  if (__isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Customers...</Text>
      </SafeAreaView>
    );
  }

  const renderEmptyListComponent = () => {
    if (__error) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error-outline" size={64} color={theme.colors.danger[500]} />
          <Text style={styles.emptyStateText}>Error Loading Customers</Text>
          <Text style={styles.emptyStateSubtext}>{error}</Text>
          <TouchableOpacity onPress={loadCustomers} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="people" size={64} color={theme.colors.lightGray} />
        <Text style={styles.emptyStateText}>No customers found</Text>
        <Text style={styles.emptyStateSubtext}>
          {searchQuery ? 'Try adjusting your search' : 'Add your first customer or pull to refresh'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerSubtitle}>{filteredCustomers.length} customers</Text>
        </View>

        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
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
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={theme.colors.darkGray} />
          <TextInput
            style={styles.searchInput}
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
          ].map(segment => (
            <TouchableOpacity
              key={segment.key}
              style={[
                styles.segmentFilter,
                selectedSegment === segment.key && styles.segmentFilterActive,
              ]}
              onPress={() => setSelectedSegment(segment.key)}>
              <Text
                style={[
                  styles.segmentFilterText,
                  selectedSegment === segment.key && styles.segmentFilterTextActive,
                ]}>
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
        keyExtractor={item => item.id.toString()}
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
        onRequestClose={() => setSelectedCustomer(__null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.customerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customer Details</Text>
              <TouchableOpacity onPress={() => setSelectedCustomer(__null)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.customerProfile}>
                  <View style={styles.profileAvatar}>
                    <Icon name="account-circle" size={80} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.profileName}>{selectedCustomer.name}</Text>
                  <View
                    style={[
                      styles.profileLevel,
                      { backgroundColor: `${getCustomerLevel(__selectedCustomer).color}20` },
                    ]}>
                    <Text
                      style={[
                        styles.profileLevelText,
                        { color: getCustomerLevel(__selectedCustomer).color },
                      ]}>
                      {getCustomerLevel(__selectedCustomer).level} Customer
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  <View style={styles.detailRow}>
                    <Icon name="email" size={20} color={theme.colors.darkGray} />
                    <Text style={styles.detailText}>{selectedCustomer.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="phone" size={20} color={theme.colors.darkGray} />
                    <Text style={styles.detailText}>{selectedCustomer.phone}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="calendar-today" size={20} color={theme.colors.darkGray} />
                    <Text style={styles.detailText}>
                      Customer since {selectedCustomer.joinedDate.toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Purchase History</Text>
                  <View style={styles.purchaseGrid}>
                    <View style={styles.purchaseCard}>
                      <Text style={styles.purchaseValue}>
                        £{selectedCustomer.totalSpent.toFixed(2)}
                      </Text>
                      <Text style={styles.purchaseLabel}>Total Spent</Text>
                    </View>
                    <View style={styles.purchaseCard}>
                      <Text style={styles.purchaseValue}>{selectedCustomer.orderCount}</Text>
                      <Text style={styles.purchaseLabel}>Orders</Text>
                    </View>
                    <View style={styles.purchaseCard}>
                      <Text style={styles.purchaseValue}>
                        £{selectedCustomer.averageOrderValue.toFixed(2)}
                      </Text>
                      <Text style={styles.purchaseLabel}>Avg Order</Text>
                    </View>
                    <View style={styles.purchaseCard}>
                      <Text style={[styles.purchaseValue, { color: theme.colors.warning[500] }]}>
                        {selectedCustomer.loyaltyPoints}
                      </Text>
                      <Text style={styles.purchaseLabel}>Loyalty Points</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Preferred Items</Text>
                  <View style={styles.preferredItems}>
                    {selectedCustomer.preferredItems?.map((__item, _index) => (
                      <View key={index} style={styles.preferredItem}>
                        <Text style={styles.preferredItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {selectedCustomer.tags?.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Tags</Text>
                    <View style={styles.customerTags}>
                      {selectedCustomer.tags?.map((__tag, _index) => (
                        <View key={index} style={styles.customerTag}>
                          <Text style={styles.customerTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                    <Icon name="edit" size={20} color={theme.colors.white} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.orderButton]}>
                    <Icon name="add-shopping-cart" size={20} color={theme.colors.white} />
                    <Text style={styles.actionButtonText}>New Order</Text>
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

const __createStyles = (theme: _unknown) =>
  StyleSheet.create({
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2
    },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    }
  });

export default CustomersScreen;
