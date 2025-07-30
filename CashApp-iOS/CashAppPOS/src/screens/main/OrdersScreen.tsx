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
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { Order } from '../../types';
import OrderService from '../../services/OrderService';
import HeaderWithBackButton from '../../components/navigation/HeaderWithBackButton';
import EmptyState from '../../components/common/EmptyState';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(__false);
  const [loading, setLoading] = useState(__true);
  const [filter, setFilter] = useState<'all' | 'preparing' | 'ready' | 'completed'>('all');
  const orderService = OrderService.getInstance();

  const statusColors = {
    draft: theme.colors.lightText,
    confirmed: theme.colors.warning,
    preparing: theme.colors.warning,
    ready: theme.colors.success,
    completed: theme.colors.lightText,
    cancelled: theme.colors.danger,
  };

  const statusIcons = {
    draft: 'edit',
    confirmed: 'check-circle-outline',
    preparing: 'access-time',
    ready: 'done',
    completed: 'check-circle',
    cancelled: 'cancel',
  };

  const filteredOrders =
    filter === 'all' ? orders : orders.filter(order => order.status === filter);

  const loadOrders = async () => {
    try {
      const __fetchedOrders = await orderService.getOrders({
        limit: 50,
        offset: 0,
      });
      setOrders(__fetchedOrders);
    } catch (__error) {
      // Keep existing orders on error
    }
  };

  const onRefresh = async () => {
    setRefreshing(__true);
    await loadOrders();
    setRefreshing(__false);
  };

  // Load orders on component mount
  useEffect(() => {
    const initializeOrders = async () => {
      setLoading(__true);
      await loadOrders();
      setLoading(__false);
    };

    initializeOrders();

    // Subscribe to real-time order updates
    const unsubscribe = orderService.subscribeToOrderEvents((__event, _data) => {
      if (event === 'order_created') {
        setOrders(prevOrders => [data, ...prevOrders]);
      } else if (event === 'order_updated') {
        setOrders(prevOrders =>
          prevOrders.map(order => (order.id === data.id ? { ...order, ...data } : _order)),
        );
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (date: _Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (date: _Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
  };

  const handleOrderPress = (order: _Order) => {
    navigation.navigate('OrderDetails', { orderId: order.id });
  };

  // eslint-disable-next-line react/no-unstable-nested-components
  const OrderCard = ({ order }: { order: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(__order)}
      activeOpacity={0.7}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{order.id}</Text>
          <Text style={styles.orderTime}>
            {formatTime(order.createdAt)} • {getTimeSince(order.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
          <Icon name={statusIcons[order.status]} size={16} color={theme.colors.white} />
          <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.customerInfo}>
          <Icon name="person" size={16} color={theme.colors.lightText} />
          <Text style={styles.customerText}>{order.customerName || 'Walk-in'}</Text>
          {order.tableNumber && (
            <>
              <Icon
                name="table-restaurant"
                size={16}
                color={theme.colors.lightText}
                style={styles.tableIcon}
              />
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
              name={
                order.paymentMethod === 'cash'
                  ? 'money'
                  : order.paymentMethod === 'card'
                  ? 'credit-card'
                  : 'phone-android'
              }
              size={16}
              color={theme.colors.lightText}
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
// eslint-disable-next-line react/no-unstable-nested-components

  const FilterButton = ({
    title,
    value,
    count,
  }: {
    title: string;
    value: typeof filter;
    count: number;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(__value)}>
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
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
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header with Back Button */}
      <HeaderWithBackButton
        title="Orders"
        backgroundColor={theme.colors.primary}
        textColor={theme.colors.white}
        rightComponent={
          <TouchableOpacity style={styles.searchButton}>
            <Icon name="search" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton title="All" value="all" count={orders.length} />
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
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.ordersList}
        // eslint-disable-next-line react/no-unstable-nested-components
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <EmptyState
            icon="📋"
            title={loading ? 'Loading orders...' : 'No orders found'}
            message={
              loading
                ? 'Please wait while we fetch your orders'
                : 'Orders will appear here when customers place them'
            }
            testID="orders-empty-state"
          />
        )}
      />
    </SafeAreaView>
  );
};

const __createStyles = (theme: _unknown) =>
  StyleSheet.create({
      shadowOpacity: 0.1,
      shadowRadius: 4
    },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }
  });

export default OrdersScreen;
