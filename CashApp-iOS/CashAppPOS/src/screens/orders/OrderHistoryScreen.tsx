import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

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

// Order status types
type OrderStatus = 'completed' | 'cancelled' | 'refunded' | 'partially_refunded';

// Order interface
interface Order {
  id: string;
  orderNumber: number;
  date: Date;
  total: number;
  tax: number;
  tip: number;
  subtotal: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: string[];
  }>;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
  };
  paymentMethod: string;
  status: OrderStatus;
  server?: string;
  table?: string;
  notes?: string;
}

// Filter options
type FilterOption = 'all' | 'today' | 'week' | 'month' | 'completed' | 'cancelled' | 'refunded';

const OrderHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  
  // Mock order data
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'ORD001',
      orderNumber: 1234,
      date: new Date(Date.now() - 1800000), // 30 minutes ago
      total: 42.50,
      tax: 7.20,
      tip: 5.00,
      subtotal: 30.30,
      items: [
        { id: '1', name: 'Cappuccino', price: 4.50, quantity: 2, modifiers: ['Extra shot', 'Oat milk'] },
        { id: '2', name: 'Croissant', price: 3.99, quantity: 1 },
        { id: '3', name: 'Avocado Toast', price: 12.99, quantity: 1, modifiers: ['No tomatoes'] },
      ],
      customer: { name: 'John Smith', email: 'john@example.com' },
      paymentMethod: 'Card',
      status: 'completed',
      server: 'Sarah',
      table: 'T-05',
    },
    {
      id: 'ORD002', 
      orderNumber: 1235,
      date: new Date(Date.now() - 5400000), // 1.5 hours ago
      total: 28.75,
      tax: 4.88,
      tip: 0,
      subtotal: 23.87,
      items: [
        { id: '4', name: 'Green Salad', price: 14.99, quantity: 1 },
        { id: '5', name: 'Sparkling Water', price: 3.50, quantity: 2 },
        { id: '6', name: 'Chocolate Cake', price: 6.99, quantity: 1 },
      ],
      paymentMethod: 'Cash',
      status: 'completed',
      server: 'Mike',
    },
    {
      id: 'ORD003',
      orderNumber: 1236,
      date: new Date(Date.now() - 7200000), // 2 hours ago
      total: 15.25,
      tax: 2.59,
      tip: 2.50,
      subtotal: 10.16,
      items: [
        { id: '7', name: 'Latte', price: 5.25, quantity: 1 },
        { id: '8', name: 'Muffin', price: 4.99, quantity: 1 },
      ],
      paymentMethod: 'Apple Pay',
      status: 'refunded',
      server: 'Emma',
      notes: 'Customer complaint - wrong order',
    },
  ]);

  const [filteredOrders, setFilteredOrders] = useState<Order[]>(orders);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);

  // Filter and search logic
  useEffect(() => {
    let filtered = orders;

    // Apply date/status filters
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (activeFilter) {
      case 'today':
        filtered = orders.filter(order => order.date >= today);
        break;
      case 'week':
        filtered = orders.filter(order => order.date >= weekAgo);
        break;
      case 'month':
        filtered = orders.filter(order => order.date >= monthAgo);
        break;
      case 'completed':
        filtered = orders.filter(order => order.status === 'completed');
        break;
      case 'cancelled':
        filtered = orders.filter(order => order.status === 'cancelled');
        break;
      case 'refunded':
        filtered = orders.filter(order => order.status === 'refunded' || order.status === 'partially_refunded');
        break;
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.orderNumber.toString().includes(searchQuery) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, activeFilter]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'cancelled':
        return Colors.mediumGray;
      case 'refunded':
      case 'partially_refunded':
        return Colors.warning;
      default:
        return Colors.darkGray;
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'cancelled':
        return 'cancel';
      case 'refunded':
      case 'partially_refunded':
        return 'money-off';
      default:
        return 'help';
    }
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleReprint = (order: Order) => {
    setSelectedOrder(order);
    setShowReprintModal(true);
  };

  const confirmReprint = (type: 'customer' | 'kitchen' | 'both') => {
    if (!selectedOrder) return;
    
    Alert.alert(
      'Receipt Reprinted',
      `${type === 'both' ? 'Customer and kitchen receipts' : `${type} receipt`} reprinted for order #${selectedOrder.orderNumber}`,
      [{ text: 'OK', onPress: () => setShowReprintModal(false) }]
    );
  };

  const FilterButton = ({ filter, label }: { filter: FilterOption; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        activeFilter === filter && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const OrderItem = ({ order }: { order: Order }) => (
    <TouchableOpacity style={styles.orderCard} onPress={() => handleOrderPress(order)}>
      <View style={styles.orderHeader}>
        <View style={styles.orderIdSection}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Text style={styles.orderId}>{order.id}</Text>
        </View>
        <View style={styles.orderAmount}>
          <Text style={styles.orderTotal}>£{order.total.toFixed(2)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Icon name={getStatusIcon(order.status)} size={12} color={Colors.white} />
            <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <Text style={styles.orderDate}>
          {order.date.toLocaleDateString()} at {order.date.toLocaleTimeString()}
        </Text>
        <Text style={styles.orderInfo}>
          {order.paymentMethod} • {order.items.length} items
          {order.server && ` • Server: ${order.server}`}
          {order.table && ` • Table: ${order.table}`}
        </Text>
      </View>

      <View style={styles.orderItems}>
        <Text style={styles.orderItemsText} numberOfLines={2}>
          {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
        </Text>
      </View>

      {order.customer && (
        <View style={styles.customerInfo}>
          <Icon name="person" size={16} color={Colors.lightText} />
          <Text style={styles.customerName}>{order.customer.name}</Text>
          {order.customer.email && (
            <Text style={styles.customerEmail}>{order.customer.email}</Text>
          )}
        </View>
      )}

      <View style={styles.orderActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleReprint(order)}
        >
          <Icon name="print" size={16} color={Colors.secondary} />
          <Text style={styles.actionButtonText}>Reprint</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {/* Navigate to refund screen */}}
        >
          <Icon name="money-off" size={16} color={Colors.warning} />
          <Text style={styles.actionButtonText}>Refund</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const OrderDetailModal = () => (
    <Modal
      visible={showOrderModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowOrderModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity onPress={() => setShowOrderModal(false)}>
              <Icon name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.orderSummary}>
                <Text style={styles.orderNumber}>Order #{selectedOrder.orderNumber}</Text>
                <Text style={styles.orderId}>{selectedOrder.id}</Text>
                <Text style={styles.orderDate}>
                  {selectedOrder.date.toLocaleDateString()} at {selectedOrder.date.toLocaleTimeString()}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Items</Text>
                {selectedOrder.items.map(item => (
                  <View key={item.id} style={styles.detailItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <Text style={styles.itemModifiers}>
                          {item.modifiers.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.itemPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Payment Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>£{selectedOrder.subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>£{selectedOrder.tax.toFixed(2)}</Text>
                </View>
                {selectedOrder.tip > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tip</Text>
                    <Text style={styles.summaryValue}>£{selectedOrder.tip.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>£{selectedOrder.total.toFixed(2)}</Text>
                </View>
              </View>

              {selectedOrder.customer && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Customer</Text>
                  <Text style={styles.customerDetail}>{selectedOrder.customer.name}</Text>
                  {selectedOrder.customer.email && (
                    <Text style={styles.customerDetail}>{selectedOrder.customer.email}</Text>
                  )}
                  {selectedOrder.customer.phone && (
                    <Text style={styles.customerDetail}>{selectedOrder.customer.phone}</Text>
                  )}
                </View>
              )}

              {selectedOrder.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const ReprintModal = () => (
    <Modal
      visible={showReprintModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowReprintModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.reprintModalContent}>
          <Text style={styles.reprintModalTitle}>Reprint Receipt</Text>
          <Text style={styles.reprintModalSubtitle}>
            Order #{selectedOrder?.orderNumber}
          </Text>

          <View style={styles.reprintOptions}>
            <TouchableOpacity
              style={styles.reprintOption}
              onPress={() => confirmReprint('customer')}
            >
              <Icon name="receipt" size={32} color={Colors.primary} />
              <Text style={styles.reprintOptionText}>Customer Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reprintOption}
              onPress={() => confirmReprint('kitchen')}
            >
              <Icon name="restaurant" size={32} color={Colors.secondary} />
              <Text style={styles.reprintOptionText}>Kitchen Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reprintOption}
              onPress={() => confirmReprint('both')}
            >
              <Icon name="content-copy" size={32} color={Colors.warning} />
              <Text style={styles.reprintOptionText}>Both Receipts</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.reprintCancelButton}
            onPress={() => setShowReprintModal(false)}
          >
            <Text style={styles.reprintCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Icon name="search" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={Colors.mediumGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders, customers, items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="clear" size={20} color={Colors.mediumGray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        <View style={styles.filters}>
          <FilterButton filter="all" label="All" />
          <FilterButton filter="today" label="Today" />
          <FilterButton filter="week" label="This Week" />
          <FilterButton filter="month" label="This Month" />
          <FilterButton filter="completed" label="Completed" />
          <FilterButton filter="cancelled" label="Cancelled" />
          <FilterButton filter="refunded" label="Refunded" />
        </View>
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={({ item }) => <OrderItem order={item} />}
        keyExtractor={item => item.id}
        style={styles.ordersList}
        contentContainerStyle={styles.ordersListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt-long" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Orders will appear here when available'}
            </Text>
          </View>
        }
      />

      {/* Modals */}
      <OrderDetailModal />
      <ReprintModal />
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  searchButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  filtersContainer: {
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  ordersList: {
    flex: 1,
  },
  ordersListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderIdSection: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderId: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  orderDetails: {
    marginBottom: 12,
  },
  orderDate: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  orderInfo: {
    fontSize: 14,
    color: Colors.lightText,
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItemsText: {
    fontSize: 14,
    color: Colors.text,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  customerEmail: {
    fontSize: 12,
    color: Colors.lightText,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkGray,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalBody: {
    padding: 20,
  },
  orderSummary: {
    alignItems: 'center',
    marginBottom: 24,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: Colors.text,
  },
  itemModifiers: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  customerDetail: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
  },
  // Reprint modal styles
  reprintModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  reprintModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  reprintModalSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 24,
  },
  reprintOptions: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  reprintOption: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  reprintOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
  },
  reprintCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  reprintCancelText: {
    fontSize: 16,
    color: Colors.lightText,
  },
});

export default OrderHistoryScreen;