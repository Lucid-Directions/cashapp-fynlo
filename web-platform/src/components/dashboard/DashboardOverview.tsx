import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpRight, 
  TrendingUp, 
  Building2, 
  CreditCard,
  Users,
  Activity,
  PoundSterling,
  ShoppingCart,
  AlertTriangle,
  Plus
} from 'lucide-react';

export const DashboardOverview = () => {
  const { fynloUserData } = useAuth();
  const { isPlatformOwner, hasFeature, getSubscriptionPlan } = useFeatureAccess();

  const subscriptionPlan = getSubscriptionPlan();
  const showUpgrade = !isPlatformOwner() && subscriptionPlan !== 'omega';

  if (isPlatformOwner()) {
    return <PlatformOwnerOverview />;
  }

  return <CustomerPortalOverview subscriptionPlan={subscriptionPlan} showUpgrade={showUpgrade} />;
};

const PlatformOwnerOverview = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('platform-metrics');
        if (error) throw error;
        setMetrics(data);
      } catch (error) {
        console.error('Error fetching platform metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-600">Monitor your Fynlo platform performance and growth</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Businesses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : metrics?.activeBusinesses || 0}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">
                    {loading ? '...' : `${metrics?.growthMetrics?.businessGrowth > 0 ? '+' : ''}${metrics?.growthMetrics?.businessGrowth?.toFixed(1) || 0}%`}
                  </span>
                </div>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : `£${(metrics?.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
                </p>
                <div className="flex items-center mt-1">
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">
                    {loading ? '...' : `${metrics?.growthMetrics?.revenueGrowth > 0 ? '+' : ''}${metrics?.growthMetrics?.revenueGrowth?.toFixed(1) || 0}%`}
                  </span>
                </div>
              </div>
              <PoundSterling className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : (metrics?.totalTransactions || 0).toLocaleString()}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-600 ml-1">
                    {loading ? '...' : `${metrics?.growthMetrics?.transactionGrowth > 0 ? '+' : ''}${metrics?.growthMetrics?.transactionGrowth?.toFixed(1) || 0}%`}
                  </span>
                </div>
              </div>
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    loading ? 'bg-gray-400' : 
                    metrics?.systemHealth?.status === 'operational' ? 'bg-green-500' : 
                    metrics?.systemHealth?.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`text-lg font-semibold ${
                    loading ? 'text-gray-500' :
                    metrics?.systemHealth?.status === 'operational' ? 'text-green-600' :
                    metrics?.systemHealth?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {loading ? 'Loading...' : metrics?.systemHealth?.status?.charAt(0).toUpperCase() + metrics?.systemHealth?.status?.slice(1) || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {loading ? '...' : `${metrics?.systemHealth?.uptime || 99.9}% uptime`}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button className="h-20 flex flex-col items-center justify-center space-y-2">
          <Plus className="w-5 h-5" />
          <span>Add Business</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <Activity className="w-5 h-5" />
          <span>View Reports</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <CreditCard className="w-5 h-5" />
          <span>Payment Settings</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <Building2 className="w-5 h-5" />
          <span>System Status</span>
        </Button>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading activity...</div>
          ) : metrics?.recentActivity?.length ? (
            <div className="space-y-4">
              {metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {activity.status && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      activity.status === 'completed' ? 'bg-green-100 text-green-700' :
                      activity.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {activity.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Platform connected successfully.</p>
              <p className="text-sm">Activity will appear here when restaurants start processing orders.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface CustomerPortalOverviewProps {
  subscriptionPlan: 'alpha' | 'beta' | 'omega';
  showUpgrade: boolean;
}

// 🏪 RESTAURANT MANAGER DASHBOARD - Individual restaurant overview
const CustomerPortalOverview: React.FC<CustomerPortalOverviewProps> = ({ subscriptionPlan, showUpgrade }) => {
  const { user, fynloUserData } = useAuth();
  const [restaurantMetrics, setRestaurantMetrics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!fynloUserData?.restaurant_id) return;

      try {
        setLoading(true);
        
        // Fetch today's metrics
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's orders for metrics calculation
        const { data: todayOrders, error: ordersError } = await supabase
          .from('orders')
          .select('total_amount, status, created_at')
          .eq('restaurant_id', fynloUserData.restaurant_id)
          .gte('created_at', today)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Calculate metrics
        const completedOrders = todayOrders?.filter(order => order.status === 'completed') || [];
        const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
        const activeOrders = todayOrders?.filter(order => 
          ['pending', 'preparing', 'ready'].includes(order.status)
        ).length || 0;

        setRestaurantMetrics({
          todayRevenue: totalRevenue,
          todayOrders: todayOrders?.length || 0,
          completedOrders: completedOrders.length,
          activeOrders,
          averageOrderValue
        });

        // Get recent orders (last 5)
        const { data: recentOrdersData } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, status, created_at, customer_name')
          .eq('restaurant_id', fynloUserData.restaurant_id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentOrders(recentOrdersData || []);

        // Get low stock items if inventory feature is enabled
        if (fynloUserData.enabled_features?.includes('inventory_management')) {
          const { data: inventoryData } = await supabase
            .from('inventory_items')
            .select('name, current_stock, min_threshold')
            .eq('restaurant_id', fynloUserData.restaurant_id)
            .filter('current_stock', 'lt', 'min_threshold');

          setLowStockItems(inventoryData || []);
        }

      } catch (error) {
        console.error('Error fetching restaurant data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantData();
  }, [fynloUserData?.restaurant_id, fynloUserData?.enabled_features]);

  return (
    <div className="space-y-6">
      {/* Header with restaurant context */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {fynloUserData?.restaurant_name || 'Restaurant'} Dashboard
          </h1>
          <p className="text-gray-600">Here's what's happening with your restaurant today</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {subscriptionPlan.toUpperCase()} Plan
          </Badge>
          <Badge 
            variant={restaurantMetrics?.activeOrders > 0 ? "default" : "secondary"}
            className="text-sm"
          >
            {loading ? '...' : `${restaurantMetrics?.activeOrders || 0} Active Orders`}
          </Badge>
        </div>
      </div>

      {/* Real-time Restaurant Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : `£${(restaurantMetrics?.todayRevenue || 0).toFixed(2)}`}
                </p>
                <p className="text-sm text-gray-500">
                  {loading ? '...' : `${restaurantMetrics?.completedOrders || 0} completed orders`}
                </p>
              </div>
              <PoundSterling className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : restaurantMetrics?.todayOrders || 0}
                </p>
                <p className="text-sm text-gray-500">Today</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Order</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : `£${(restaurantMetrics?.averageOrderValue || 0).toFixed(2)}`}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">+12.5%</span>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : restaurantMetrics?.activeOrders || 0}
                </p>
                <p className="text-sm text-gray-500">Pending/Preparing</p>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Notifications */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">
                    Low Stock Alert
                  </h3>
                  <p className="text-orange-700">
                    {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} running low
                  </p>
                </div>
              </div>
              <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                View Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Orders
            <Button variant="outline" size="sm" onClick={() => {
              window.location.href = '/dashboard/orders';
            }}>View All</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading recent orders...</div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">#{order.order_number}</p>
                      <p className="text-sm text-gray-500">
                        {order.customer_name || 'Walk-in Customer'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">£{order.total_amount?.toFixed(2)}</p>
                    <Badge 
                      variant={order.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No orders yet today</p>
              <p className="text-sm">Orders will appear here as they come in</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button className="h-20 flex flex-col items-center justify-center space-y-2">
          <Plus className="w-5 h-5" />
          <span>New Order</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <Activity className="w-5 h-5" />
          <span>View Menu</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <CreditCard className="w-5 h-5" />
          <span>Payments</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
          <Users className="w-5 h-5" />
          <span>Staff</span>
        </Button>
      </div>

      {/* Upgrade Prompt */}
      {showUpgrade && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  Unlock More Features
                </h3>
                <p className="text-blue-700">
                  Upgrade to {subscriptionPlan === 'alpha' ? 'Beta' : 'Omega'} for advanced analytics, inventory management, and more.
                </p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};