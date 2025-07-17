import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  Search, 
  Plus, 
  Eye,
  Settings,
  MoreHorizontal,
  MapPin,
  Calendar,
  PoundSterling,
  TrendingUp,
  Activity,
  Heart,
  Gift
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreateRestaurantDialog } from '../dialogs/CreateRestaurantDialog';
import { Restaurant } from '../../types';

interface RestaurantStats {
  totalOrders: number;
  totalRevenue: number;
  activeOrders: number;
  lastOrderAt?: string;
}

export const RestaurantManagement: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [restaurantStats, setRestaurantStats] = useState<Record<string, RestaurantStats>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRestaurants(data || []);
      
      // Fetch stats for each restaurant
      if (data) {
        fetchRestaurantStats(data.map(r => r.id));
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast({
        title: "Error",
        description: "Failed to load restaurants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantStats = async (restaurantIds: string[]) => {
    try {
      const statsPromises = restaurantIds.map(async (restaurantId) => {
        // Get order stats
        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount, status, created_at')
          .eq('restaurant_id', restaurantId);

        const totalOrders = orders?.length || 0;
        const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        const activeOrders = orders?.filter(order => !['completed', 'cancelled', 'delivered'].includes(order.status)).length || 0;
        const lastOrderAt = orders?.[0]?.created_at;

        return {
          restaurantId,
          stats: {
            totalOrders,
            totalRevenue,
            activeOrders,
            lastOrderAt
          }
        };
      });

      const results = await Promise.all(statsPromises);
      const statsMap = results.reduce((acc, { restaurantId, stats }) => {
        acc[restaurantId] = stats;
        return acc;
      }, {} as Record<string, RestaurantStats>);

      setRestaurantStats(statsMap);
    } catch (error) {
      console.error('Error fetching restaurant stats:', error);
    }
  };

  const toggleRestaurantStatus = async (restaurantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !currentStatus })
        .eq('id', restaurantId);

      if (error) throw error;

      await fetchRestaurants();
      toast({
        title: "Success",
        description: `Restaurant ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      toast({
        title: "Error",
        description: "Failed to update restaurant status",
        variant: "destructive",
      });
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         restaurant.slug.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && restaurant.is_active) ||
                         (statusFilter === 'inactive' && !restaurant.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const getTotalStats = () => {
    const stats = Object.values(restaurantStats);
    return {
      totalRevenue: stats.reduce((sum, stat) => sum + stat.totalRevenue, 0),
      totalOrders: stats.reduce((sum, stat) => sum + stat.totalOrders, 0),
      totalActiveOrders: stats.reduce((sum, stat) => sum + stat.activeOrders, 0)
    };
  };

  const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');
  const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('en-GB');

  if (loading) {
    return <div className="p-6">Loading restaurants...</div>;
  }

  const totalStats = getTotalStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Management</h1>
          <p className="text-gray-600">Manage all restaurants on the platform</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Restaurant
        </Button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Restaurants</p>
                <p className="text-2xl font-bold">{restaurants.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Restaurants</p>
                <p className="text-2xl font-bold text-green-600">
                  {restaurants.filter(r => r.is_active).length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Platform Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalStats.totalRevenue)}
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
                <p className="text-2xl font-bold">{totalStats.totalOrders}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restaurant Management */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Restaurants</TabsTrigger>
          <TabsTrigger value="active">Active ({restaurants.filter(r => r.is_active).length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({restaurants.filter(r => !r.is_active).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search restaurants, owners, or slugs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Restaurants List */}
          <Card>
            <CardHeader>
              <CardTitle>Restaurants ({filteredRestaurants.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRestaurants.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No restaurants found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRestaurants.map((restaurant) => {
                    const stats = restaurantStats[restaurant.id];
                    return (
                      <div key={restaurant.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            {restaurant.logo_url ? (
                              <img
                                src={restaurant.logo_url}
                                alt={restaurant.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                                <Badge 
                                  variant={restaurant.is_active ? 'default' : 'secondary'}
                                  className={restaurant.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                                >
                                  {restaurant.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                <span>/{restaurant.slug}</span>
                                <span>•</span>
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(restaurant.created_at)}
                                </span>
                              </div>
                              
                              {restaurant.address && (
                                <div className="flex items-center text-sm text-gray-500 mb-2">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {restaurant.address}
                                </div>
                              )}
                              
                              {/* Restaurant Stats */}
                              {stats && (
                                <div className="flex items-center space-x-4 text-sm">
                                  <span className="text-green-600 font-medium">
                                    {formatCurrency(stats.totalRevenue)} revenue
                                  </span>
                                  <span className="text-blue-600">
                                    {stats.totalOrders} orders
                                  </span>
                                  {stats.activeOrders > 0 && (
                                    <span className="text-orange-600">
                                      {stats.activeOrders} active
                                    </span>
                                  )}
                                  {stats.lastOrderAt && (
                                    <span className="text-gray-500">
                                      Last order: {formatDateTime(stats.lastOrderAt)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => toggleRestaurantStatus(restaurant.id, restaurant.is_active)}
                            >
                              {restaurant.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(`/restaurant/loyalty?restaurant_id=${restaurant.id}`, '_blank')}
                            >
                              <Heart className="w-4 h-4 mr-1" />
                              Loyalty
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(`/restaurant?restaurant_id=${restaurant.id}`, '_blank')}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Manage
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search active restaurants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active Restaurants ({restaurants.filter(r => r.is_active && (searchTerm === '' || r.name.toLowerCase().includes(searchTerm.toLowerCase()))).length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">Active restaurants view - same layout as "All" but filtered</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search inactive restaurants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Inactive Restaurants ({restaurants.filter(r => !r.is_active && (searchTerm === '' || r.name.toLowerCase().includes(searchTerm.toLowerCase()))).length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">Inactive restaurants view - same layout as "All" but filtered</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateRestaurantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onRestaurantCreated={fetchRestaurants}
      />
    </div>
  );
};