import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  PoundSterling,
  Users,
  Building2,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlatformMetrics {
  totalRestaurants: number;
  activeRestaurants: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  newSignupsThisMonth: number;
  churnedThisMonth: number;
  topPerformingRestaurant?: {
    name: string;
    revenue: number;
  };
}

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

interface RestaurantPerformance {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  lastOrderDate?: string;
}

export const PlatformAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    newSignupsThisMonth: 0,
    churnedThisMonth: 0
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [restaurantPerformance, setRestaurantPerformance] = useState<RestaurantPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { toast } = useToast();

  useEffect(() => {
    fetchPlatformMetrics();
    fetchRevenueData();
    fetchRestaurantPerformance();
  }, [selectedPeriod]);

  const fetchPlatformMetrics = async () => {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

      // Get all restaurants
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, is_active, created_at');

      // Get all orders for metrics calculation
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at, restaurant_id');

      // Get this month's signups
      const { data: thisMonthSignups } = await supabase
        .from('restaurants')
        .select('id')
        .gte('created_at', startOfMonth.toISOString());

      // Get last month's signups for churn calculation
      const { data: lastMonthSignups } = await supabase
        .from('restaurants')
        .select('id')
        .gte('created_at', lastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString());

      const totalRestaurants = restaurants?.length || 0;
      const activeRestaurants = restaurants?.filter(r => r.is_active).length || 0;
      const totalRevenue = allOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const totalOrders = allOrders?.length || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const newSignupsThisMonth = thisMonthSignups?.length || 0;

      // Calculate top performing restaurant
      const restaurantRevenues = restaurants?.map(restaurant => {
        const restaurantOrders = allOrders?.filter(order => order.restaurant_id === restaurant.id) || [];
        const revenue = restaurantOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        return { name: restaurant.name, revenue };
      }) || [];

      const topPerformingRestaurant = restaurantRevenues.reduce((top, current) => 
        current.revenue > top.revenue ? current : top, 
        { name: '', revenue: 0 }
      );

      setMetrics({
        totalRestaurants,
        activeRestaurants,
        totalRevenue,
        totalOrders,
        averageOrderValue,
        newSignupsThisMonth,
        churnedThisMonth: 0, // TODO: Calculate actual churn
        topPerformingRestaurant: topPerformingRestaurant.revenue > 0 ? topPerformingRestaurant : undefined
      });

    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load platform metrics",
        variant: "destructive",
      });
    }
  };

  const fetchRevenueData = async () => {
    try {
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Group by date
      const revenueByDate: Record<string, { revenue: number; orders: number }> = {};
      
      orders?.forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        if (!revenueByDate[date]) {
          revenueByDate[date] = { revenue: 0, orders: 0 };
        }
        revenueByDate[date].revenue += order.total_amount || 0;
        revenueByDate[date].orders += 1;
      });

      const chartData = Object.entries(revenueByDate).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders: data.orders
      }));

      setRevenueData(chartData);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    }
  };

  const fetchRestaurantPerformance = async () => {
    try {
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true);

      if (!restaurants) return;

      const performanceData = await Promise.all(
        restaurants.map(async (restaurant) => {
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount, created_at')
            .eq('restaurant_id', restaurant.id);

          const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
          const orderCount = orders?.length || 0;
          const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;
          const lastOrderDate = orders?.[0]?.created_at;

          return {
            id: restaurant.id,
            name: restaurant.name,
            revenue,
            orders: orderCount,
            averageOrderValue,
            lastOrderDate
          };
        })
      );

      // Sort by revenue descending
      performanceData.sort((a, b) => b.revenue - a.revenue);
      setRestaurantPerformance(performanceData);

    } catch (error) {
      console.error('Error fetching restaurant performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;
  const formatNumber = (num: number) => num.toLocaleString();

  if (loading) {
    return <div className="p-6">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600">Comprehensive analytics across all restaurants</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant={selectedPeriod === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('7d')}
          >
            7 Days
          </Button>
          <Button 
            variant={selectedPeriod === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('30d')}
          >
            30 Days
          </Button>
          <Button 
            variant={selectedPeriod === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('90d')}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
              <PoundSterling className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.totalOrders)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.averageOrderValue)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Restaurants</p>
                <p className="text-2xl font-bold">{metrics.activeRestaurants}</p>
                <p className="text-xs text-gray-500">of {metrics.totalRestaurants} total</p>
              </div>
              <Building2 className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="restaurants">Restaurant Performance</TabsTrigger>
          <TabsTrigger value="growth">Growth Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend ({selectedPeriod})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Revenue chart would go here</p>
                    <p className="text-sm text-gray-400">
                      {revenueData.length} data points collected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Restaurants */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Restaurants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {restaurantPerformance.slice(0, 5).map((restaurant, index) => (
                    <div key={restaurant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{restaurant.name}</h4>
                          <p className="text-sm text-gray-500">{restaurant.orders} orders</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(restaurant.revenue)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(restaurant.averageOrderValue)} avg
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Growth</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {metrics.newSignupsThisMonth} new restaurants joined this month
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <PoundSterling className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Revenue</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {metrics.topPerformingRestaurant ? 
                      `${metrics.topPerformingRestaurant.name} leads with ${formatCurrency(metrics.topPerformingRestaurant.revenue)}` :
                      'No revenue data available'
                    }
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-800">Activity</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    {((metrics.activeRestaurants / metrics.totalRestaurants) * 100).toFixed(1)}% restaurant activation rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-500">Detailed Revenue Charts</p>
                  <p className="text-sm text-gray-400">
                    Revenue trends, forecasting, and breakdown analysis
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {restaurantPerformance.map((restaurant, index) => (
                  <div key={restaurant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{restaurant.name}</h4>
                        <p className="text-sm text-gray-500">
                          {restaurant.orders} orders • Avg: {formatCurrency(restaurant.averageOrderValue)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">{formatCurrency(restaurant.revenue)}</p>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Growth Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-4">Monthly Signups</h3>
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Signup trend chart</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-4">Churn Analysis</h3>
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <PieChart className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Churn rate analysis</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};