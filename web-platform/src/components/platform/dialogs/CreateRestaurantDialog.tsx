import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateRestaurantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestaurantCreated: () => void;
}

export const CreateRestaurantDialog: React.FC<CreateRestaurantDialogProps> = ({
  open,
  onOpenChange,
  onRestaurantCreated
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    currency: 'GBP',
    timezone: 'UTC'
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const createRestaurant = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: "Error",
        description: "Restaurant name and slug are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Create restaurant
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          currency: formData.currency,
          timezone: formData.timezone,
          owner_id: user.id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Create default restaurant settings
      await supabase
        .from('restaurant_settings')
        .insert({
          restaurant_id: data.id,
          tax_rate: 0.20,
          service_charge: 0.00,
          auto_accept_orders: false,
          opening_hours: {},
          business_days: [],
          payment_methods: []
        });

      toast({
        title: "Success",
        description: "Restaurant created successfully",
      });

      resetForm();
      onOpenChange(false);
      onRestaurantCreated();
    } catch (error: any) {
      console.error('Error creating restaurant:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create restaurant",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      address: '',
      phone: '',
      email: '',
      currency: 'GBP',
      timezone: 'UTC'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Restaurant</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Mario's Italian Restaurant"
              />
            </div>
            <div>
              <Label htmlFor="slug">URL Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({...prev, slug: e.target.value}))}
                placeholder="e.g., marios-italian"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
              placeholder="Brief description of the restaurant..."
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))}
              placeholder="Full restaurant address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))}
                placeholder="e.g., +44 20 1234 5678"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                placeholder="e.g., contact@restaurant.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({...prev, currency: e.target.value}))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({...prev, timezone: e.target.value}))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={createRestaurant} disabled={loading}>
              {loading ? 'Creating...' : 'Create Restaurant'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};