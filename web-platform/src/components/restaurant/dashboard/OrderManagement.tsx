import React, { useEffect, useState, memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemoizedFilteredData, useMemoizedStats, useMemoizedCallback } from '@/hooks/useMemoizedData';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  ChefHat,
  Eye,
  Edit,
  MoreHorizontal,
  Bell,
  TrendingUp,
  Users,
  PoundSterling,
  Calendar,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OrderStatusDialog } from './OrderStatusDialog';
import { Restaurant, Order, OrderItem } from '../../types';

interface OrderManagementProps {
  restaurant: Restaurant;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({ restaurant }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [orderStats, setOrderStats] = useState({
    todayOrders: 0,
    activeOrders: 0,
    completedToday: 0,
    todayRevenue: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
    fetchOrderStats();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          console.log('Real-time order update:', payload);
          fetchOrders();
          fetchOrderStats();
          
          // Show notification for new orders
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Order Received!",
              description: `Order #${payload.new.order_number} has been placed`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, statusFilter, activeTab]);

  const fetchOrderStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Today's orders
      const { data: todayData } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59');

      // Active orders (not completed/cancelled)
      const { data: activeData } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .not('status', 'in', '(completed,cancelled,delivered)');

      setOrderStats({
        todayOrders: todayData?.length || 0,
        activeOrders: activeData?.length || 0,
        completedToday: todayData?.filter(o => ['completed', 'delivered'].includes(o.status)).length || 0,
        todayRevenue: todayData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      });
    } catch (error) {
      console.error('Error fetching order stats:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [restaurant.id, statusFilter]);

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          restaurant_tables (table_number, section),
          order_items (
            *,
            menu_items (name, description)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      // Filter based on active tab
      if (activeTab === 'active') {
        query = query.not('status', 'in', '(completed,cancelled,delivered)');
      } else if (activeTab === 'completed') {
        query = query.in('status', ['completed', 'delivered']);
      }

      // Additional status filter
      if (statusFilter !== 'all' && statusFilter !== 'active') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        throw error;
      }

      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          ...(newStatus === 'delivered' && { completed_at: new Date().toISOString() })
        })
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      await fetchOrders();
      await fetchOrderStats();
      toast({
        title: "Success",
        description: `Order status updated to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'preparing': return <ChefHat className="w-4 h-4" />;
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending': return 'confirmed';
      case 'confirmed': return 'preparing';
      case 'preparing': return 'ready';
      case 'ready': return 'delivered';
      default: return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending': return 'Confirm';
      case 'confirmed': return 'Start Preparing';
      case 'preparing': return 'Mark Ready';
      case 'ready': return 'Mark Delivered';
      default: return null;
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  const handleOrderUpdated = () => {
    fetchOrders();
    fetchOrderStats();
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return created.toLocaleDateString();
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.restaurant_tables?.table_number.includes(searchTerm)
  );

  if (loading) {
    return <div className="p-6">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600">Manage and track all restaurant orders in real-time</p>
          </div>
          <Badge 
            variant={connectionStatus === 'connected' ? 'default' : 'destructive'} 
            className="flex items-center gap-1"
          >
            {connectionStatus === 'connected' ? (
              <><Wifi className="w-3 h-3" /> Live</>
            ) : (
              <><WifiOff className="w-3 h-3" /> Disconnected</>
            )}
          </Badge>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Orders</p>
                <p className="text-2xl font-bold">{orderStats.todayOrders}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-orange-600">{orderStats.activeOrders}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">{orderStats.completedToday}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600">£{orderStats.todayRevenue.toFixed(2)}</p>
              </div>
              <PoundSterling className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Management */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Orders ({orderStats.activeOrders})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search orders, customers, table numbers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {activeTab === 'all' && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Orders ({filteredOrders.length})</span>
                {activeTab === 'active' && orderStats.activeOrders > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {orderStats.activeOrders} active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {activeTab === 'active' ? 'No active orders' : 'No orders found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {getStatusIcon(order.status)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold">Order #{order.order_number}</h3>
                              <Badge className={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                              {order.estimated_ready_time && (
                                <Badge variant="outline" className="text-xs">
                                  Ready: {new Date(order.estimated_ready_time).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                              <span>
                                {order.restaurant_tables?.table_number 
                                  ? `Table ${order.restaurant_tables.table_number}` 
                                  : order.order_type.replace('_', ' ').toUpperCase()}
                              </span>
                              {order.customer_name && <span>• {order.customer_name}</span>}
                              <span>• {getTimeAgo(order.created_at)}</span>
                            </div>
                            
                            {/* Order Items Preview */}
                            {order.order_items && order.order_items.length > 0 && (
                              <div className="text-sm text-gray-500">
                                {order.order_items.slice(0, 2).map(item => item.menu_items.name).join(', ')}
                                {order.order_items.length > 2 && ` +${order.order_items.length - 2} more`}
                              </div>
                            )}
                            
                            {order.special_instructions && (
                              <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded mt-2">
                                <strong>Special:</strong> {order.special_instructions}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="font-semibold text-lg">£{parseFloat(order.total_amount.toString()).toFixed(2)}</p>
                            <p className="text-sm text-gray-500">
                              {order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewOrder(order)}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            
                            {getNextStatus(order.status) && (
                              <Button 
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                                className="min-w-[120px]"
                              >
                                {getNextStatusLabel(order.status)}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Detail Dialog */}
      <OrderStatusDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        order={selectedOrder}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
};