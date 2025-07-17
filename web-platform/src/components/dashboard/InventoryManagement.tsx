import React, { useState, useEffect } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package2, Plus, TrendingDown, Search, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  current_stock: number;
  min_threshold: number;
  unit_cost?: number;
  supplier_info?: any;
  restaurant_id: string;
  created_at: string;
  updated_at: string;
}

export const InventoryManagement = () => {
  const { hasFeature } = useFeatureAccess();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    fetchInventoryItems();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', (await supabase.auth.getUser()).data.user?.id);

      if (restaurants && restaurants.length > 0) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('restaurant_id', restaurants[0].id)
          .order('name');

        if (error) throw error;
        setItems(data || []);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasFeature('inventory_management')) {
    return (
      <UpgradePrompt
        title="Inventory Management"
        description="Track stock levels, set reorder points, and manage suppliers with advanced inventory tools."
        requiredPlan="beta"
        features={[
          'Real-time stock tracking',
          'Low stock alerts',
          'Supplier management',
          'Purchase orders',
          'Inventory reports',
          'Cost tracking'
        ]}
      />
    );
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = filteredItems.filter(item => item.current_stock <= item.min_threshold);
  const reorderSoonItems = filteredItems.filter(item => 
    item.current_stock > item.min_threshold && item.current_stock <= item.min_threshold * 1.5
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading inventory...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">Track and manage your restaurant inventory</p>
        </div>
        <Button onClick={() => {
          toast({
            title: "Add Item",
            description: "Add item functionality coming soon",
          });
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="font-semibold text-red-900">Low Stock</span>
                </div>
                <p className="text-2xl font-bold text-red-900">{lowStockItems.length}</p>
                <p className="text-sm text-red-700">Need immediate attention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <TrendingDown className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="font-semibold text-yellow-900">Reorder Soon</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">{reorderSoonItems.length}</p>
                <p className="text-sm text-yellow-700">Below reorder point</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <Package2 className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="font-semibold text-blue-900">Total Items</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{filteredItems.length}</p>
                <p className="text-sm text-blue-700">In inventory</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <Package2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No inventory items found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Try adjusting your search terms' : 'Add your first inventory item to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const getStatus = () => {
                  if (item.current_stock <= item.min_threshold) return 'critical';
                  if (item.current_stock <= item.min_threshold * 1.5) return 'warning';
                  return 'good';
                };
                
                const status = getStatus();
                
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        {item.sku && <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">{item.current_stock} units</p>
                        <p className="text-sm text-muted-foreground">Min: {item.min_threshold}</p>
                        {item.unit_cost && (
                          <p className="text-xs text-muted-foreground">£{item.unit_cost}</p>
                        )}
                      </div>
                      <Badge variant={
                        status === 'critical' ? 'destructive' :
                        status === 'warning' ? 'secondary' : 'default'
                      }>
                        {status === 'critical' ? 'Low Stock' :
                         status === 'warning' ? 'Reorder Soon' : 'In Stock'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};