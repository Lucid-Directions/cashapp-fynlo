import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MenuCategory {
  id: string;
  name: string;
}

interface MenuItem {
  id?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  category_id?: string;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  allergens?: string[];
  tags?: string[];
}

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MenuItem | null;
  restaurantId: string;
  categories: MenuCategory[];
  onSave: () => void;
}

const COMMON_ALLERGENS = [
  'Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'Fish', 'Shellfish', 'Sesame'
];

export const MenuItemDialog: React.FC<MenuItemDialogProps> = ({
  open,
  onOpenChange,
  item,
  restaurantId,
  categories,
  onSave
}) => {
  const [formData, setFormData] = useState<MenuItem>({
    name: '',
    description: '',
    price: 0,
    cost: 0,
    category_id: '',
    is_available: true,
    is_featured: false,
    allergens: [],
    tags: []
  });
  const [newAllergen, setNewAllergen] = useState('');
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        cost: 0,
        category_id: '',
        is_available: true,
        is_featured: false,
        allergens: [],
        tags: []
      });
    }
    setImageFile(null);
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = formData.image_url;

      // Handle image upload if there's a new file
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `menu-items/${restaurantId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const menuItemData = {
        ...formData,
        restaurant_id: restaurantId,
        image_url: imageUrl,
        price: Number(formData.price),
        cost: Number(formData.cost || 0),
        category_id: formData.category_id || null
      };

      if (item?.id) {
        const { error } = await supabase
          .from('menu_items')
          .update(menuItemData)
          .eq('id', item.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Menu item updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert([menuItemData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Menu item added successfully",
        });
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast({
        title: "Error",
        description: "Failed to save menu item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addAllergen = (allergen: string) => {
    if (allergen && !formData.allergens?.includes(allergen)) {
      setFormData(prev => ({
        ...prev,
        allergens: [...(prev.allergens || []), allergen]
      }));
    }
    setNewAllergen('');
  };

  const removeAllergen = (allergen: string) => {
    setFormData(prev => ({
      ...prev,
      allergens: prev.allergens?.filter(a => a !== allergen) || []
    }));
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || []
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category_id || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Sale Price (£) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost Price (£)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Item Image</Label>
            <Card>
              <CardContent className="p-4">
                {formData.image_url && !imageFile && (
                  <div className="mb-4">
                    <img
                      src={formData.image_url}
                      alt="Current item"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="image-upload"
                  />
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400">
                      <Upload className="w-4 h-4" />
                      <span>Upload Image</span>
                    </div>
                  </Label>
                  {imageFile && (
                    <span className="text-sm text-green-600">
                      New image selected: {imageFile.name}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Allergens */}
          <div className="space-y-2">
            <Label>Allergens</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.allergens?.map((allergen) => (
                <Badge key={allergen} variant="secondary" className="flex items-center gap-1">
                  {allergen}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => removeAllergen(allergen)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addAllergen}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Add allergen" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_ALLERGENS.map((allergen) => (
                    <SelectItem key={allergen} value={allergen}>
                      {allergen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Custom allergen"
                value={newAllergen}
                onChange={(e) => setNewAllergen(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAllergen(newAllergen);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => addAllergen(newAllergen)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="flex items-center gap-1">
                  {tag}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(newTag);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline"
                size="sm" 
                onClick={() => addTag(newTag)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
              />
              <Label htmlFor="available">Available for ordering</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
              />
              <Label htmlFor="featured">Feature this item</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (item ? 'Update Item' : 'Add Item')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};