import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { Order } from '../../types';

const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

// Mock orders data
const mockOrders: Order[] = [
  {
    id: 1,
    items: [
      { id: 1, name: 'Classic Burger', price: 12.99, quantity: 2, emoji: '🍔' },
      { id: 2, name: 'French Fries', price: 4.99, quantity: 1, emoji: '🍟' },
    ],
    subtotal: 30.97,
    tax: 2.48,
    total: 33.45,
    customerName: 'John Doe',
    tableNumber: 5,
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    status: 'preparing',
    paymentMethod: 'card',
  },
  {
    id: 2,
    items: [
      { id: 3, name: 'Margherita Pizza', price: 15.99, quantity: 1, emoji: '🍕' },
      { id: 7, name: 'Coca Cola', price: 2.99, quantity: 2, emoji: '🥤' },
    ],
    subtotal: 21.97,
    tax: 1.76,
    total: 23.73,
    customerName: 'Jane Smith',
    tableNumber: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    status: 'ready',
    paymentMethod: 'cash',
  },
  {
    id: 3,
    items: [
      { id: 2, name: 'Caesar Salad', price: 9.99, quantity: 1, emoji: '🥗' },
      { id: 6, name: 'Chocolate Cake', price: 6.99, quantity: 1, emoji: '🍰' },
    ],
    subtotal: 16.98,
    tax: 1.36,
    total: 18.34,
    tableNumber: 7,
    createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    status: 'completed',
    paymentMethod: 'apple_pay',
  },
];

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'preparing' | 'ready' | 'completed'>('all');

  const statusColors = {
    draft: Colors.lightText,
    confirmed: Colors.warning,
    preparing: Colors.warning,
    ready: Colors.success,
    completed: Colors.lightText,
    cancelled: Colors.danger,
  };

  const statusIcons = {
    draft: 'edit',
    confirmed: 'check-circle-outline',
    preparing: 'access-time',
    ready: 'done',
    completed: 'check-circle',
    cancelled: 'cancel',
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetails', { orderId: order.id! });
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(order)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{order.id}</Text>
          <Text style={styles.orderTime}>
            {formatTime(order.createdAt)} • {getTimeSince(order.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
          <Icon 
            name={statusIcons[order.status]} 
            size={16} 
            color={Colors.white} 
          />
          <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.customerInfo}>
          <Icon name="person" size={16} color={Colors.lightText} />
          <Text style={styles.customerText}>
            {order.customerName || 'Walk-in'}
          </Text>
          {order.tableNumber && (
            <>
              <Icon name="table-restaurant" size={16} color={Colors.lightText} style={styles.tableIcon} />
              <Text style={styles.tableText}>Table {order.tableNumber}</Text>
            </>
          )}
        </View>

        <View style={styles.itemsPreview}>
          <Text style={styles.itemsText}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.itemsList}>
            {order.items.map(item => `${item.emoji} ${item.name}`).join(', ')}
          </Text>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.paymentMethod}>
            <Icon 
              name={order.paymentMethod === 'cash' ? 'money' : 
                    order.paymentMethod === 'card' ? 'credit-card' : 
                    'phone-android'} 
              size={16} 
              color={Colors.lightText} 
            />
            <Text style={styles.paymentText}>
              {order.paymentMethod?.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
                        <Text style={styles.totalAmount}>£{order.total.toFixed(2)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ 
    title, 
    value, 
    count 
  }: { 
    title: string; 
    value: typeof filter; 
    count: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === value && styles.filterButtonActive
      ]}
      onPress={() => setFilter(value)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === value && styles.filterButtonTextActive
      ]}>
        {title}
      </Text>
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="search" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton 
          title="All" 
          value="all" 
          count={orders.length}
        />
        <FilterButton 
          title="Preparing" 
          value="preparing" 
          count={orders.filter(o => o.status === 'preparing').length}
        />
        <FilterButton 
          title="Ready" 
          value="ready" 
          count={orders.filter(o => o.status === 'ready').length}
        />
        <FilterButton 
          title="Completed" 
          value="completed" 
          count={orders.filter(o => o.status === 'completed').length}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id!.toString()}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.ordersList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Icon name="receipt" size={64} color={Colors.lightText} />
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              Orders will appear here when customers place them
            </Text>
          </View>
        )}
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerButton: {
    padding: 8,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: Colors.lightGray,
  },
  filterButtonActive: {
    backgroundColor: Colors.secondary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  filterBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  ordersList: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderTime: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
    marginLeft: 4,
  },
  orderDetails: {
    padding: 16,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 6,
    fontWeight: '600',
  },
  tableIcon: {
    marginLeft: 12,
  },
  tableText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 6,
  },
  itemsPreview: {
    marginBottom: 12,
  },
  itemsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemsList: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentText: {
    fontSize: 12,
    color: Colors.lightText,
    marginLeft: 6,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default OrdersScreen;