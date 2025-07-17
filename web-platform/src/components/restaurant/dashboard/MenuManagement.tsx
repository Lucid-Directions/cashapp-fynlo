import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  Star,
  PoundSterling,
  Grid3X3,
  List,
  Settings,
  Move
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MenuItemDialog } from './MenuItemDialog';
import { CategoryDialog } from './CategoryDialog';
import { Restaurant, Product as MenuItem, ProductCategory as MenuCategory } from '../../types';

interface MenuManagementProps {
  restaurant: Restaurant;
}

export const MenuManagement: React.FC<MenuManagementProps> = ({ restaurant }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([fetchMenuItems(), fetchCategories()]);
  }, [restaurant.id]);

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories (name)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('name');

      if (error) {
        throw error;
      }

      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order');

      if (error) {
        throw error;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const toggleItemAvailability = async (itemId: string, currentAvailability: boolean) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentAvailability })
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      await fetchMenuItems();
      toast({
        title: "Success",
        description: `Item ${!currentAvailability ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating item availability:', error);
      toast({
        title: "Error",
        description: "Failed to update item availability",
        variant: "destructive",
      });
    }
  };

  const toggleFeatured = async (itemId: string, currentFeatured: boolean) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_featured: !currentFeatured })
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      await fetchMenuItems();
      toast({
        title: "Success",
        description: `Item ${!currentFeatured ? 'featured' : 'unfeatured'}`,
      });
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast({
        title: "Error",
        description: "Failed to update featured status",
        variant: "destructive",
      });
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (item: MenuItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      await fetchMenuItems();
      toast({
        title: "Success",
        description: "Menu item deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete menu item",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleSaveItem = () => {
    fetchMenuItems();
    setEditingItem(null);
  };

  const handleSaveCategory = () => {
    fetchCategories();
    setEditingCategory(null);
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
                           item.menu_categories?.name === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="p-6">Loading menu...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-600">Manage your restaurant's menu items and categories</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={() => setItemDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{menuItems.length}</p>
              </div>
              <PoundSterling className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">
                  {menuItems.filter(item => item.is_available).length}
                </p>
              </div>
              <Eye className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Featured</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {menuItems.filter(item => item.is_featured).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-6">
          {/* Filters and View Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search menu items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Categories</option>
                    {categories.filter(c => c.is_active).map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Menu Items Display */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Card key={item.id} className={`${!item.is_available ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    {item.image_url && (
                      <div className="mb-4">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-lg">{item.name}</h3>
                          {item.is_featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        {item.menu_categories && (
                          <Badge variant="outline" className="text-xs mb-2">
                            {item.menu_categories.name}
                          </Badge>
                        )}
                        {item.description && (
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-xl font-bold text-green-600">£{item.price.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">Cost: £{item.cost.toFixed(2)}</p>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleItemAvailability(item.id, item.is_available)}
                        >
                          {item.is_available ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFeatured(item.id, item.is_featured)}
                        >
                          <Star className={`w-4 h-4 ${item.is_featured ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-wrap gap-1">
                        {item.allergens && item.allergens.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {item.allergens.length} allergen{item.allergens.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {item.tags && item.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredItems.map((item) => (
                    <div key={item.id} className={`p-4 flex items-center justify-between ${!item.is_available ? 'opacity-60' : ''}`}>
                      <div className="flex items-center space-x-4 flex-1">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.is_featured && (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            {item.menu_categories && (
                              <Badge variant="outline" className="text-xs">
                                {item.menu_categories.name}
                              </Badge>
                            )}
                            <span className="text-lg font-bold text-green-600">£{item.price.toFixed(2)}</span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600">{item.description}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleItemAvailability(item.id, item.is_available)}
                        >
                          {item.is_available ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFeatured(item.id, item.is_featured)}
                        >
                          <Star className={`w-4 h-4 ${item.is_featured ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {filteredItems.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No menu items found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          {/* Categories Management */}
          <Card>
            <CardHeader>
              <CardTitle>Menu Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Move className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">#{category.sort_order}</span>
                      </div>
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-gray-600">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {menuItems.filter(item => item.menu_categories?.name === category.name).length} items
                      </span>
                      <Button variant="outline" size="sm" onClick={() => handleEditCategory(category)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {categories.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p>No categories found. Create your first category to organize your menu.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MenuItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        restaurantId={restaurant.id}
        categories={categories.filter(c => c.is_active)}
        onSave={handleSaveItem}
      />

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        restaurantId={restaurant.id}
        onSave={handleSaveCategory}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};