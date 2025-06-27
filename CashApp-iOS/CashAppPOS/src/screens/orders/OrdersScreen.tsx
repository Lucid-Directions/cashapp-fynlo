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
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateSalesHistory } from '../../utils/mockDataGenerator';
import Colors from "../../constants/Colors";

interface Order {
  id: string;
  date: Date;
  customerName?: string;
  total: number;
  items: number;
  status: 'completed' | 'pending' | 'refunded' | 'cancelled';
  paymentMethod: 'card' | 'cash' | 'mobile' | 'qrCode';
  employee: string;
}

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [dateRange]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, selectedFilter]);

  const loadOrders = () => {
    // Generate mock orders from sales history
    const endDate = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const salesHistory = generateSalesHistory(startDate);
    const generatedOrders: Order[] = [];

    salesHistory.forEach(day => {
      const ordersPerDay = day.transactions;
      for (let i = 0; i < ordersPerDay; i++) {
        const orderTime = new Date(day.date);
        orderTime.setHours(10 + Math.floor(Math.random() * 12));
        orderTime.setMinutes(Math.floor(Math.random() * 60));

        const status = Math.random() > 0.95 ? 'refunded' : 
                      Math.random() > 0.98 ? 'cancelled' : 'completed';

        const paymentMethods: Array<'card' | 'cash' | 'mobile' | 'qrCode'> = ['card', 'cash', 'mobile', 'qrCode'];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

        generatedOrders.push({
          id: `ORD-${orderTime.getTime()}-${i}`,
          date: orderTime,
          customerName: Math.random() > 0.3 ? `Customer ${Math.floor(Math.random() * 1000)}` : undefined,
          total: Math.round((15 + Math.random() * 85) * 100) / 100,
          items: Math.floor(1 + Math.random() * 6),
          status,
          paymentMethod,
          employee: day.employees[Math.floor(Math.random() * day.employees.length)].name
        });
      }
    });

    setOrders(generatedOrders.sort((a, b) => b.date.getTime() - a.date.getTime()));
  };

  const filterOrders = () => {
    let filtered = orders;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(order => order.status === selectedFilter);
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.employee.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return Colors.success;
      case 'pending': return Colors.warning;
      case 'refunded': return Colors.secondary;
      case 'cancelled': return Colors.danger;
      default: return Colors.darkGray;
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card': return 'credit-card';
      case 'cash': return 'attach-money';
      case 'mobile': return 'phone-iphone';
      case 'qrCode': return 'qr-code-scanner';
      default: return 'payment';
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderCard} onPress={() => handleOrderPress(item)}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.orderBody}>
        <View style={styles.orderInfo}>
          <Icon name="person" size={16} color={Colors.darkGray} />
          <Text style={styles.orderInfoText}>
            {item.customerName || 'Walk-in Customer'}
          </Text>
        </View>
        
        <View style={styles.orderInfo}>
          <Icon name="badge" size={16} color={Colors.darkGray} />
          <Text style={styles.orderInfoText}>{item.employee}</Text>
        </View>
      </View>
      
      <View style={styles.orderFooter}>
        <View style={styles.orderStats}>
          <Icon name={getPaymentIcon(item.paymentMethod)} size={20} color={Colors.darkGray} />
          <Text style={styles.orderItems}>{item.items} items</Text>
        </View>
        <Text style={styles.orderTotal}>£{item.total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const getOrderStats = () => {
    const completed = orders.filter(o => o.status === 'completed').length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const refunded = orders.filter(o => o.status === 'refunded').length;
    const totalRevenue = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);

    return { completed, pending, refunded, totalRevenue };
  };

  const stats = getOrderStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>{filteredOrders.length} orders</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Icon name="filter-list" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>£{stats.totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.danger }]}>{stats.refunded}</Text>
          <Text style={styles.statLabel}>Refunded</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={Colors.darkGray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders, customers, or staff..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.darkGray}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={20} color={Colors.darkGray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Range Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.dateRangeContainer}
      >
        {['today', 'week', 'month', 'year'].map(range => (
          <TouchableOpacity
            key={range}
            style={[
              styles.dateRangeButton,
              dateRange === range && styles.dateRangeButtonActive
            ]}
            onPress={() => setDateRange(range)}
          >
            <Text style={[
              styles.dateRangeText,
              dateRange === range && styles.dateRangeTextActive
            ]}>
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.ordersList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Pull to refresh'}
            </Text>
          </View>
        }
      />


      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Orders</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              <Text style={styles.filterSectionTitle}>Order Status</Text>
              {['all', 'completed', 'pending', 'refunded', 'cancelled'].map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterOption,
                    selectedFilter === filter && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setSelectedFilter(filter);
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    selectedFilter === filter && styles.filterOptionTextActive
                  ]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {selectedFilter === filter && (
                    <Icon name="check" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Details Modal */}
      <Modal
        visible={showOrderDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {selectedOrder && (
            <ScrollView style={styles.orderDetailsContent}>
              <View style={styles.orderDetailsHeader}>
                <Text style={styles.orderDetailsId}>{selectedOrder.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                  <Text style={styles.statusText}>{selectedOrder.status.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <Text style={styles.detailText}>Name: {selectedOrder.customerName || 'Walk-in Customer'}</Text>
                <Text style={styles.detailText}>Date: {formatDate(selectedOrder.date)}</Text>
                <Text style={styles.detailText}>Served by: {selectedOrder.employee}</Text>
              </View>
              
              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Payment Information</Text>
                <View style={styles.paymentRow}>
                  <Icon name={getPaymentIcon(selectedOrder.paymentMethod)} size={20} color={Colors.darkGray} />
                  <Text style={styles.detailText}>{selectedOrder.paymentMethod.toUpperCase()}</Text>
                </View>
                <Text style={styles.totalText}>Total: £{selectedOrder.total.toFixed(2)}</Text>
              </View>
              
              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Order Items ({selectedOrder.items})</Text>
                <Text style={styles.detailText}>• Fish & Chips - £12.99</Text>
                <Text style={styles.detailText}>• Mushy Peas - £3.50</Text>
                <Text style={styles.detailText}>• Soft Drink - £2.50</Text>
                <View style={styles.divider} />
                <Text style={styles.detailText}>Subtotal: £{(selectedOrder.total * 0.8).toFixed(2)}</Text>
                <Text style={styles.detailText}>VAT (20%): £{(selectedOrder.total * 0.2).toFixed(2)}</Text>
                <Text style={styles.totalText}>Total: £{selectedOrder.total.toFixed(2)}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
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
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  dateRangeContainer: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  dateRangeButtonActive: {
    backgroundColor: Colors.primary,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  dateRangeTextActive: {
    color: Colors.white,
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  orderBody: {
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderInfoText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  orderStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderItems: {
    fontSize: 14,
    color: Colors.darkGray,
    marginLeft: 8,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
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
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  filterOptions: {
    paddingHorizontal: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterOptionActive: {
    backgroundColor: 'rgba(0, 166, 81, 0.05)',
  },
  filterOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  filterOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  orderDetailsContent: {
    flex: 1,
    padding: 16,
  },
  orderDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  orderDetailsId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderDetailsSection: {
    marginBottom: 24,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
});

export default OrdersScreen;