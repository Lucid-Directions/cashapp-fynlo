import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  PoundSterling, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ChefHat,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentAnalytics } from '@/hooks/usePaymentAnalytics';
import { AdvancedAnalytics } from '../../dashboard/AdvancedAnalytics';
import { AnimatedCard, StaggeredList } from '../../ui/animations';
import { CardSkeleton, ChartSkeleton } from '../../ui/loading-skeletons';
import { Restaurant } from '../../types';

interface DashboardStats {
  todaysSales: number;
  totalOrders: number;
  activeOrders: number;
  averageOrderValue: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
}

interface RestaurantOverviewProps {
  restaurant: Restaurant;
}

export const RestaurantOverview: React.FC<RestaurantOverviewProps> = ({ restaurant }) => {
  const [stats, setStats] = useState<DashboardStats>({
    todaysSales: 0,
    totalOrders: 0,
    activeOrders: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { analytics, loading: analyticsLoading, refetch: refetchAnalytics } = usePaymentAnalytics(restaurant.id);

  useEffect(() => {
    fetchDashboardData();
  }, [restaurant.id]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch today's orders
      const { data: todaysOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', today.toISOString());

      // Fetch recent orders with table info
      const { data: recent } = await supabase
        .from('orders')
        .select(`
          *,
          restaurant_tables (table_number, section)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (todaysOrders) {
        const completedOrders = todaysOrders.filter(order => 
          order.status === 'delivered' || order.status === 'ready'
        );
        
        const todaysSales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0);
        const activeOrders = todaysOrders.filter(order => 
          !['delivered', 'cancelled'].includes(order.status)
        ).length;
        
        const pendingOrders = todaysOrders.filter(order => order.status === 'pending').length;
        const preparingOrders = todaysOrders.filter(order => order.status === 'preparing').length;
        const readyOrders = todaysOrders.filter(order => order.status === 'ready').length;

        setStats({
          todaysSales,
          totalOrders: todaysOrders.length,
          activeOrders,
          averageOrderValue: completedOrders.length > 0 ? todaysSales / completedOrders.length : 0,
          pendingOrders,
          preparingOrders,
          readyOrders,
        });
      }

      if (recent) {
        setRecentOrders(recent);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

  const getOrderIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'preparing': return <ChefHat className="w-4 h-4" />;
      case 'ready': return <CheckCircle className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Overview</h1>
        <p className="text-gray-600">Welcome to {restaurant.name} POS Dashboard</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.todaysSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {stats.totalOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Per completed order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Queue</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4 text-sm">
              <div>
                <div className="font-bold text-yellow-600">{stats.pendingOrders}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div>
                <div className="font-bold text-orange-600">{stats.preparingOrders}</div>
                <div className="text-xs text-gray-500">Preparing</div>
              </div>
              <div>
                <div className="font-bold text-green-600">{stats.readyOrders}</div>
                <div className="text-xs text-gray-500">Ready</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Payment Analytics
            </div>
            <Button onClick={() => refetchAnalytics()} disabled={analyticsLoading} size="sm" variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Loading payment analytics...</p>
            </div>
          ) : analytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">External Payments</p>
                      <p className="text-xl font-bold">£{analytics.totalRevenue.toFixed(2)}</p>
                    </div>
                    <PoundSterling className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">External Transactions</p>
                      <p className="text-xl font-bold">{analytics.totalTransactions}</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Transaction</p>
                      <p className="text-xl font-bold">£{analytics.avgTransactionValue.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Payment Provider Stats */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Payment Provider Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analytics.stripeData && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg transition-all duration-300 hover:shadow-md hover:scale-105">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">Stripe</span>
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                      <p className="text-lg font-bold text-blue-900">£{analytics.stripeData.revenue.toFixed(2)}</p>
                      <p className="text-xs text-blue-700">{analytics.stripeData.charges} charges</p>
                    </div>
                  )}
                  
                  {analytics.sumupData && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg transition-all duration-300 hover:shadow-md hover:scale-105">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-900">SumUp</span>
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <p className="text-lg font-bold text-green-900">£{analytics.sumupData.revenue.toFixed(2)}</p>
                      <p className="text-xs text-green-700">{analytics.sumupData.transactions} transactions</p>
                    </div>
                  )}
                  
                  {analytics.squareData && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg transition-all duration-300 hover:shadow-md hover:scale-105">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-900">Square</span>
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                      </div>
                      <p className="text-lg font-bold text-purple-900">£{analytics.squareData.revenue.toFixed(2)}</p>
                      <p className="text-xs text-purple-700">{analytics.squareData.payments} payments</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No payment analytics available</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No orders yet today</p>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getOrderIcon(order.status)}
                    <div>
                      <p className="font-medium">Order #{order.order_number}</p>
                      <p className="text-sm text-gray-500">
                        {order.restaurant_tables?.table_number 
                          ? `Table ${order.restaurant_tables.table_number}` 
                          : order.order_type
                        }
                        {order.customer_name && ` • ${order.customer_name}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="font-medium">£{parseFloat(order.total_amount).toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};