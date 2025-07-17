import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  RefreshCw,
  Activity,
  CheckCircle,
  Clock,
  MapPin,
  Mail,
  Phone
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  currency?: string;
  timezone?: string;
}

export const BusinessManagement = () => {
  const { isPlatformOwner } = useFeatureAccess();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  if (!isPlatformOwner()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only available to platform administrators.</p>
        </div>
      </div>
    );
  }

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data: restaurantData, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRestaurants(restaurantData || []);
      setLastUpdated(new Date());
      console.log(`Loaded ${restaurantData?.length || 0} restaurants`);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const activeRestaurants = restaurants.filter(r => r.is_active);
  const inactiveRestaurants = restaurants.filter(r => !r.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Management</h1>
          <p className="text-gray-600">Manage all businesses on the Fynlo platform</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button onClick={fetchRestaurants} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Business Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Businesses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : restaurants.length}
                </p>
                <p className="text-xs text-gray-500">All registered</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Businesses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : activeRestaurants.length}
                </p>
                <p className="text-xs text-gray-500">Currently operating</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Businesses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : inactiveRestaurants.length}
                </p>
                <p className="text-xs text-gray-500">Not operating</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Growth Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : restaurants.length > 0 ? '+12%' : '0%'}
                </p>
                <p className="text-xs text-gray-500">This month</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business List */}
      <Card>
        <CardHeader>
          <CardTitle>All Registered Businesses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading businesses...</span>
            </div>
          ) : restaurants.length > 0 ? (
            <div className="space-y-4">
              {restaurants.map((restaurant) => (
                <div key={restaurant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-blue-100">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                        <Badge variant={restaurant.is_active ? "default" : "secondary"}>
                          {restaurant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">@{restaurant.slug}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        {restaurant.email && (
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{restaurant.email}</span>
                          </div>
                        )}
                        {restaurant.phone && (
                          <div className="flex items-center space-x-1">
                            <Phone className="w-3 h-3" />
                            <span>{restaurant.phone}</span>
                          </div>
                        )}
                        {restaurant.address && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{restaurant.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Joined {new Date(restaurant.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {restaurant.currency || 'GBP'} • {restaurant.timezone || 'UTC'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 font-medium">No businesses registered yet</p>
              <p className="text-sm text-gray-500">Businesses will appear here when restaurants join the platform</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};