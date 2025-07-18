import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Edit,
  Trash2,
  Download,
  Upload,
  Filter,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Restaurant } from '../../types';

// Platform-specific inventory type - consider adding to shared types
interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  min_threshold: number;
  unit_cost: number;
  supplier_info: any;
  created_at: string;
  updated_at: string;
}

interface InventoryManagementProps {
  restaurant: Restaurant;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ restaurant }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
  const { toast } = useToast();

  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    current_stock: 0,
    min_threshold: 0,
    unit_cost: 0,
    supplier_info: { name: '', contact: '', notes: '' }
  });

  useEffect(() => {
    fetchInventoryItems();
  }, [restaurant.id]);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load inventory items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([{
          ...newItem,
          restaurant_id: restaurant.id,
          supplier_info: JSON.stringify(newItem.supplier_info)
        }])
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [...prev, data]);
      setShowAddDialog(false);
      setNewItem({
        name: '',
        sku: '',
        current_stock: 0,
        min_threshold: 0,
        unit_cost: 0,
        supplier_info: { name: '', contact: '', notes: '' }
      });

      toast({
        title: "Success",
        description: "Inventory item added successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add inventory item",
        variant: "destructive"
      });
    }
  };

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ current_stock: newStock })
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, current_stock: newStock } : item
      ));

      toast({
        title: "Success",
        description: "Stock updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update stock",
        variant: "destructive"
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Success",
        description: "Item deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive"
      });
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'low' && item.current_stock <= item.min_threshold && item.current_stock > 0) ||
                         (filterStatus === 'out' && item.current_stock === 0);
    
    return matchesSearch && matchesFilter;
  });

  const lowStockItems = items.filter(item => item.current_stock <= item.min_threshold && item.current_stock > 0);
  const outOfStockItems = items.filter(item => item.current_stock === 0);
  const totalValue = items.reduce((sum, item) => sum + (item.current_stock * item.unit_cost), 0);

  const getStockStatus = (item: InventoryItem) => {
    if (item.current_stock === 0) return { status: 'Out of Stock', color: 'destructive' as const };
    if (item.current_stock <= item.min_threshold) return { status: 'Low Stock', color: 'secondary' as const };
    return { status: 'In Stock', color: 'default' as const };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage your restaurant inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter item name"
                  />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={newItem.sku}
                    onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="Enter SKU"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stock">Current Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={newItem.current_stock}
                      onChange={(e) => setNewItem(prev => ({ ...prev, current_stock: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="threshold">Min Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={newItem.min_threshold}
                      onChange={(e) => setNewItem(prev => ({ ...prev, min_threshold: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cost">Unit Cost (£)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={newItem.unit_cost}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unit_cost: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier Name</Label>
                  <Input
                    id="supplier"
                    value={newItem.supplier_info.name}
                    onChange={(e) => setNewItem(prev => ({ 
                      ...prev, 
                      supplier_info: { ...prev.supplier_info, name: e.target.value }
                    }))}
                    placeholder="Supplier name"
                  />
                </div>
                <Button onClick={handleAddItem} className="w-full">
                  Add Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchInventoryItems}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(item);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        </div>
                        <Badge variant={stockStatus.color}>{stockStatus.status}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Stock: </span>
                          <span className="font-medium">{item.current_stock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Min: </span>
                          <span className="font-medium">{item.min_threshold}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost: </span>
                          <span className="font-medium">£{item.unit_cost}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Value: </span>
                          <span className="font-medium">£{(item.current_stock * item.unit_cost).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.current_stock}
                        onChange={(e) => handleUpdateStock(item.id, Number(e.target.value))}
                        className="w-20"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingItem(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No inventory items found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};