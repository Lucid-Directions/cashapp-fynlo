import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Clock, 
  CreditCard, 
  Percent,
  MapPin,
  Phone,
  Mail,
  Globe,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PaymentConfiguration } from '../settings/PaymentConfiguration';
import { Restaurant, RestaurantSettings as RestaurantSettingsData } from '../../types';

interface RestaurantSettingsProps {
  restaurant: Restaurant;
}

export const RestaurantSettings: React.FC<RestaurantSettingsProps> = ({ restaurant }) => {
  const [restaurantData, setRestaurantData] = useState<Restaurant>(restaurant);
  const [settings, setSettings] = useState<RestaurantSettingsData>({
    tax_rate: 0.20,
    service_charge: 0.00,
    opening_hours: {},
    business_days: [],
    auto_accept_orders: false,
    payment_methods: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 
    'friday', 'saturday', 'sunday'
  ];

  const availablePaymentMethods = [
    { id: 'cash', name: 'Cash' },
    { id: 'card', name: 'Card' },
    { id: 'apple_pay', name: 'Apple Pay' },
    { id: 'google_pay', name: 'Google Pay' },
    { id: 'sumup', name: 'SumUp' },
    { id: 'square', name: 'Square' },
    { id: 'stripe', name: 'Stripe' },
  ];

  useEffect(() => {
    fetchSettings();
  }, [restaurant.id]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          tax_rate: parseFloat(data.tax_rate.toString()) || 0.20,
          service_charge: parseFloat(data.service_charge.toString()) || 0.00,
          opening_hours: (data.opening_hours as Record<string, any>) || {},
          business_days: (data.business_days as string[]) || [],
          auto_accept_orders: data.auto_accept_orders || false,
          payment_methods: (data.payment_methods as string[]) || [],
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRestaurantInfo = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: restaurantData.name,
          description: restaurantData.description,
          address: restaurantData.address,
          phone: restaurantData.phone,
          email: restaurantData.email,
          timezone: restaurantData.timezone,
          currency: restaurantData.currency,
        })
        .eq('id', restaurant.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Restaurant information updated",
      });
    } catch (error) {
      console.error('Error saving restaurant info:', error);
      toast({
        title: "Error",
        description: "Failed to save restaurant information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .upsert({
          restaurant_id: restaurant.id,
          tax_rate: settings.tax_rate,
          service_charge: settings.service_charge,
          opening_hours: settings.opening_hours,
          business_days: settings.business_days,
          auto_accept_orders: settings.auto_accept_orders,
          payment_methods: settings.payment_methods,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentMethod = (methodId: string) => {
    setSettings(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(methodId)
        ? prev.payment_methods.filter(id => id !== methodId)
        : [...prev.payment_methods, methodId]
    }));
  };

  const toggleBusinessDay = (day: string) => {
    setSettings(prev => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter(d => d !== day)
        : [...prev.business_days, day]
    }));
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
        <p className="text-gray-600">Configure your restaurant's operational settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="payments">Payment Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Restaurant Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Restaurant Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Restaurant Name</Label>
              <Input
                id="name"
                value={restaurantData.name}
                onChange={(e) => setRestaurantData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={restaurantData.description || ''}
                onChange={(e) => setRestaurantData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your restaurant..."
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={restaurantData.address || ''}
                onChange={(e) => setRestaurantData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full restaurant address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={restaurantData.phone || ''}
                  onChange={(e) => setRestaurantData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+44 1234 567890"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={restaurantData.email || ''}
                  onChange={(e) => setRestaurantData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@restaurant.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={restaurantData.timezone}
                  onChange={(e) => setRestaurantData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="America/New_York">New York</option>
                </select>
              </div>

              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={restaurantData.currency}
                  onChange={(e) => setRestaurantData(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <Button onClick={saveRestaurantInfo} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Information
            </Button>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Percent className="w-5 h-5" />
              <span>Financial Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.tax_rate}
                onChange={(e) => setSettings(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-sm text-gray-500 mt-1">
                Current: {(settings.tax_rate * 100).toFixed(2)}%
              </p>
            </div>

            <div>
              <Label htmlFor="service_charge">Service Charge (%)</Label>
              <Input
                id="service_charge"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.service_charge}
                onChange={(e) => setSettings(prev => ({ ...prev, service_charge: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-sm text-gray-500 mt-1">
                Current: {(settings.service_charge * 100).toFixed(2)}%
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-accept Orders</Label>
                <p className="text-sm text-gray-500">Automatically confirm new orders</p>
              </div>
              <Switch
                checked={settings.auto_accept_orders}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_accept_orders: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Business Hours</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Operating Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {daysOfWeek.map(day => (
                  <Button
                    key={day}
                    variant={settings.business_days.includes(day) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleBusinessDay(day)}
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="text-sm text-gray-500">
              Selected days: {settings.business_days.length > 0 
                ? settings.business_days.join(', ') 
                : 'None selected'}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Payment Methods</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Accepted Payment Methods</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availablePaymentMethods.map(method => (
                  <Button
                    key={method.id}
                    variant={settings.payment_methods.includes(method.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePaymentMethod(method.id)}
                    className="justify-start"
                  >
                    {method.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {settings.payment_methods.map(methodId => {
                const method = availablePaymentMethods.find(m => m.id === methodId);
                return method ? (
                  <Badge key={methodId} variant="secondary">
                    {method.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Save All Settings */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving} size="lg">
            <Settings className="w-4 h-4 mr-2" />
            Save All Settings
          </Button>
        </div>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentConfiguration restaurantId={restaurant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};