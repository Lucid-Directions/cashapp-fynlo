import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePrompt } from './UpgradePrompt';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCheck, UserX, AlertCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  hourly_rate?: number;
  created_at: string;
  restaurant_id: string;
  profiles?: {
    full_name?: string;
  };
}

interface Restaurant {
  id: string;
  name: string;
  is_active: boolean;
}

export const StaffManagement = () => {
  const { hasFeature } = useFeatureAccess();
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: '',
    role: 'staff',
    restaurant_id: '',
    hourly_rate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch restaurants
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, is_active')
        .order('name');

      if (restaurantsError) throw restaurantsError;
      setRestaurants(restaurantsData || []);

      // Fetch staff members
      const { data: staffData, error: staffError } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;
      setStaffMembers(staffData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load staff data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ is_active: !currentStatus })
        .eq('id', staffId);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Success",
        description: `Staff member ${!currentStatus ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error updating staff status:', error);
      toast({
        title: "Error",
        description: "Failed to update staff status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddStaff = async () => {
    try {
      if (!newStaff.email || !newStaff.restaurant_id) {
        toast({
          title: "Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // First, create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newStaff.email,
        password: 'TempPassword123!', // Temporary password - user will be asked to reset
        options: {
          data: {
            full_name: newStaff.email.split('@')[0], // Use email prefix as temporary name
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Then create the staff member record
      const { error: staffError } = await supabase
        .from('staff_members')
        .insert({
          user_id: authData.user.id,
          restaurant_id: newStaff.restaurant_id,
          role: newStaff.role,
          hourly_rate: newStaff.hourly_rate ? parseFloat(newStaff.hourly_rate) : null,
          is_active: true,
        });

      if (staffError) throw staffError;

      // Create user-restaurant association
      const { error: userRestaurantError } = await supabase
        .from('user_restaurants')
        .insert({
          user_id: authData.user.id,
          restaurant_id: newStaff.restaurant_id,
          role: newStaff.role,
          is_active: true,
        });

      if (userRestaurantError) throw userRestaurantError;

      toast({
        title: "Success",
        description: "Staff member added successfully! They will receive an email to set up their account.",
      });

      setAddStaffOpen(false);
      setNewStaff({
        email: '',
        role: 'staff',
        restaurant_id: '',
        hourly_rate: ''
      });
      
      await fetchData();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: "Error",
        description: "Failed to add staff member. Please try again.",
        variant: "destructive",
      });
    }
  };

  const AddStaffDialog = () => (
    <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setAddStaffOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="staff@example.com"
              value={newStaff.email}
              onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="restaurant">Restaurant *</Label>
            <Select
              value={newStaff.restaurant_id}
              onValueChange={(value) => setNewStaff({ ...newStaff, restaurant_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={newStaff.role}
              onValueChange={(value) => setNewStaff({ ...newStaff, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="chef">Chef</SelectItem>
                <SelectItem value="server">Server</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
            <Input
              id="hourly_rate"
              type="number"
              placeholder="15.00"
              value={newStaff.hourly_rate}
              onChange={(e) => setNewStaff({ ...newStaff, hourly_rate: e.target.value })}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAddStaffOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddStaff}>
            Add Staff Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!hasFeature('staff_management')) {
    return (
      <UpgradePrompt
        title="Staff Management"
        description="Manage staff accounts, permissions, and performance tracking."
        requiredPlan="beta"
        features={[
          'Staff account management',
          'Role-based permissions',
          'Performance tracking',
          'Shift scheduling',
          'Time tracking'
        ]}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const activeStaff = staffMembers.filter(staff => staff.is_active);
  const totalStaff = staffMembers.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage platform staff across all restaurants</p>
        </div>
        <AddStaffDialog />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff}</div>
            <p className="text-xs text-muted-foreground">
              Across {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaff.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently active members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Staff</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff - activeStaff.length}</div>
            <p className="text-xs text-muted-foreground">
              Deactivated members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurants.filter(r => r.is_active).length}</div>
            <p className="text-xs text-muted-foreground">
              Operational locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>
            {totalStaff > 0 
              ? `Manage all ${totalStaff} staff members across the platform`
              : "No staff members found. Add staff members to see them here."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalStaff === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No staff members</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started by adding your first staff member to the platform.
              </p>
              <div className="mt-6">
                <AddStaffDialog />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {staffMembers.map((staff) => {
                const restaurant = restaurants.find(r => r.id === staff.restaurant_id);
                return (
                  <div key={staff.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h4 className="font-medium">
                          Staff Member ({staff.user_id.slice(0, 8)}...)
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {restaurant?.name || 'Unknown Restaurant'} • {staff.role}
                        </p>
                        {staff.hourly_rate && (
                          <p className="text-sm text-muted-foreground">
                            £{staff.hourly_rate}/hour
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={staff.is_active ? "default" : "secondary"}>
                        {staff.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStaffStatus(staff.id, staff.is_active)}
                      >
                        {staff.is_active ? "Deactivate" : "Activate"}
                      </Button>
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