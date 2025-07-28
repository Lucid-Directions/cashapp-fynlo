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
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone,
  Calendar,
  Star,
  ShoppingBag,
  Gift,
  Download,
  Upload,
  Filter,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Restaurant } from '../../types';

// Platform-specific customer type - consider adding to shared types
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyalty_points: number;
  preferences: any;
  order_history: any;
  created_at: string;
  updated_at: string;
}

interface CustomerDatabaseProps {
  restaurant: Restaurant;
}

export const CustomerDatabase: React.FC<CustomerDatabaseProps> = ({ restaurant }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'vip' | 'new' | 'inactive'>('all');
  const { toast } = useToast();

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    preferences: { dietary: [], favorite_dishes: [], allergies: [] },
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [restaurant.id]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_customers')
        .insert([{
          ...newCustomer,
          restaurant_id: restaurant.id,
          preferences: JSON.stringify(newCustomer.preferences),
          loyalty_points: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setCustomers(prev => [data, ...prev]);
      setShowAddDialog(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        preferences: { dietary: [], favorite_dishes: [], allergies: [] },
        notes: ''
      });

      toast({
        title: "Success",
        description: "Customer added successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive"
      });
    }
  };

  const handleUpdateLoyaltyPoints = async (customerId: string, points: number) => {
    try {
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ loyalty_points: points })
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(prev => prev.map(customer => 
        customer.id === customerId ? { ...customer, loyalty_points: points } : customer
      ));

      toast({
        title: "Success",
        description: "Loyalty points updated"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update loyalty points",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(prev => prev.filter(customer => customer.id !== customerId));
      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive"
      });
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm);
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'vip' && customer.loyalty_points >= 500) ||
                         (filterType === 'new' && new Date(customer.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ||
                         (filterType === 'inactive' && new Date(customer.updated_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesFilter;
  });

  const totalCustomers = customers.length;
  const vipCustomers = customers.filter(c => c.loyalty_points >= 500).length;
  const newCustomers = customers.filter(c => new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyalty_points, 0);

  const getCustomerType = (customer: Customer) => {
    if (customer.loyalty_points >= 500) return { type: 'VIP', color: 'default' as const };
    if (new Date(customer.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) return { type: 'New', color: 'secondary' as const };
    return { type: 'Regular', color: 'outline' as const };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Database</h1>
          <p className="text-muted-foreground">Manage your customer relationships and loyalty</p>
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
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Customer preferences, allergies, etc."
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddCustomer} className="w-full">
                  Add Customer
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
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{vipCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{newCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Gift className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoyaltyPoints.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            <SelectItem value="vip">VIP (500+ points)</SelectItem>
            <SelectItem value="new">New (Last 30 days)</SelectItem>
            <SelectItem value="inactive">Inactive (90+ days)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchCustomers}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => {
                const customerType = getCustomerType(customer);
                return (
                  <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <h3 className="font-medium">{customer.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          </div>
                        </div>
                        <Badge variant={customerType.color}>{customerType.type}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Loyalty Points: </span>
                          <span className="font-medium">{customer.loyalty_points}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Member Since: </span>
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(customer.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Visit: </span>
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(customer.updated_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={customer.loyalty_points}
                        onChange={(e) => handleUpdateLoyaltyPoints(customer.id, Number(e.target.value))}
                        className="w-20"
                        placeholder="Points"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <ShoppingBag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCustomer(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCustomer(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No customers found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};