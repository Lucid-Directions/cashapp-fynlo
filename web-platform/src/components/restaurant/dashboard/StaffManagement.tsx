import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Users, 
  UserCheck, 
  UserX,
  Crown,
  Shield,
  ChefHat,
  User,
  Edit,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Clock,
  CalendarDays
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Restaurant, User } from '../../types';

// Platform-specific staff types - consider adding to shared types
interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  permissions: any;
  hourly_rate?: number;
  is_active: boolean;
  created_at: string;
  restaurant_id: string;
  updated_at: string;
}

interface StaffSchedule {
  id: string;
  staff_member_id: string;
  restaurant_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_assigned?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface StaffManagementProps {
  restaurant: Restaurant;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({ restaurant }) => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const { toast } = useToast();

  const [newStaff, setNewStaff] = useState({
    email: '',
    role: 'staff',
    hourly_rate: ''
  });

  const [newSchedule, setNewSchedule] = useState({
    staff_member_id: '',
    shift_date: '',
    start_time: '',
    end_time: '',
    role_assigned: ''
  });

  useEffect(() => {
    fetchStaffMembers();
    fetchSchedules();
  }, [restaurant.id]);

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaffMembers((data || []) as StaffMember[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load staff members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_schedules')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('shift_date', { ascending: true });

      if (error) throw error;
      setSchedules((data || []) as StaffSchedule[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load staff schedules",
        variant: "destructive",
      });
    }
  };

  const sendStaffInvitation = async () => {
    if (!newStaff.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current user for inviter name
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke('send-staff-invitation', {
        body: {
          email: newStaff.email,
          role: newStaff.role,
          restaurant_name: restaurant.name,
          inviter_name: profile?.full_name || 'Restaurant Manager',
          restaurant_id: restaurant.id
        }
      });

      if (emailError) throw emailError;

      setShowCreateStaff(false);
      setNewStaff({ email: '', role: 'staff', hourly_rate: '' });
      
      toast({
        title: "Success",
        description: `Invitation sent to ${newStaff.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send staff invitation",
        variant: "destructive",
      });
    }
  };

  const createSchedule = async () => {
    if (!newSchedule.staff_member_id || !newSchedule.shift_date || !newSchedule.start_time || !newSchedule.end_time) {
      toast({
        title: "Error",
        description: "All schedule fields are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('staff_schedules')
        .insert({
          staff_member_id: newSchedule.staff_member_id,
          restaurant_id: restaurant.id,
          shift_date: newSchedule.shift_date,
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
          role_assigned: newSchedule.role_assigned || 'staff',
          status: 'scheduled'
        });

      if (error) throw error;

      await fetchSchedules();
      setShowCreateSchedule(false);
      setNewSchedule({
        staff_member_id: '',
        shift_date: '',
        start_time: '',
        end_time: '',
        role_assigned: ''
      });
      
      toast({
        title: "Success",
        description: "Schedule created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager': return <Crown className="w-4 h-4 text-purple-500" />;
      case 'chef': return <ChefHat className="w-4 h-4 text-orange-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-red-500" />;
      default: return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-800';
      case 'chef': return 'bg-orange-100 text-orange-800';
      case 'admin': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredStaff = staffMembers.filter(staff => {
    const matchesSearch = staff.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         staff.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || staff.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const todaySchedules = schedules.filter(schedule => 
    schedule.shift_date === new Date().toISOString().split('T')[0]
  );

  const upcomingSchedules = schedules.filter(schedule => 
    new Date(schedule.shift_date) > new Date()
  ).slice(0, 5);

  if (loading) {
    return <div className="p-6">Loading staff management...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage staff members, schedules, and roles</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showCreateStaff} onOpenChange={setShowCreateStaff}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={showCreateSchedule} onOpenChange={setShowCreateSchedule}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CalendarDays className="w-4 h-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold">{staffMembers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Staff</p>
                <p className="text-2xl font-bold text-green-600">
                  {staffMembers.filter(s => s.is_active).length}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Shifts</p>
                <p className="text-2xl font-bold text-purple-600">{todaySchedules.length}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming Shifts</p>
                <p className="text-2xl font-bold">{upcomingSchedules.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Management Tabs */}
      <Tabs defaultValue="staff" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff">Staff Members</TabsTrigger>
          <TabsTrigger value="schedule">Schedule & Rotas</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search staff members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="chef">Chef</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Staff List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((staff) => (
              <Card key={staff.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {getRoleIcon(staff.role)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{staff.user_id}</h3>
                          <Badge className={getRoleBadgeColor(staff.role)}>
                            {staff.role}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    {staff.hourly_rate && (
                      <div className="text-sm text-gray-600">
                        Hourly Rate: £{staff.hourly_rate}/hr
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        Added {new Date(staff.created_at).toLocaleDateString('en-GB')}
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredStaff.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No staff members found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          {/* Schedule Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-2 text-sm">
                {/* Header */}
                <div className="font-semibold p-2">Staff</div>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="font-semibold p-2 text-center">{day}</div>
                ))}
                
                {/* Staff Schedule Rows */}
                {schedules.length === 0 ? (
                  <div className="col-span-8 text-center py-8 text-gray-500">
                    No schedules created yet
                  </div>
                ) : (
                  staffMembers.map(staff => (
                    <React.Fragment key={staff.id}>
                      <div className="p-2 font-medium">{staff.user_id}</div>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                        const daySchedule = schedules.find(s => {
                          const scheduleDate = new Date(s.shift_date);
                          const dayOfWeek = scheduleDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          return s.staff_member_id === staff.id && dayNames[dayOfWeek] === day;
                        });
                        return (
                          <div key={day} className="p-2 border rounded text-center">
                            {daySchedule ? (
                              <div className="text-xs">
                                <div>{daySchedule.start_time} - {daySchedule.end_time}</div>
                                <div className="text-gray-500">{daySchedule.role_assigned}</div>
                              </div>
                            ) : (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaySchedules.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedules.map((schedule) => {
                    const staffMember = staffMembers.find(s => s.id === schedule.staff_member_id);
                    return (
                      <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            {getRoleIcon(staffMember?.role || 'staff')}
                          </div>
                          <div>
                            <p className="font-medium">{staffMember?.user_id || 'Staff Member'}</p>
                            <p className="text-sm text-gray-600">
                              {schedule.start_time} - {schedule.end_time}
                            </p>
                          </div>
                        </div>
                        <Badge className={schedule.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {schedule.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No shifts scheduled for today</p>
              )}
            </CardContent>
          </Card>

          {/* All Schedules */}
          <Card>
            <CardHeader>
              <CardTitle>All Schedules ({schedules.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {schedules.map((schedule) => {
                  const staffMember = staffMembers.find(s => s.id === schedule.staff_member_id);
                  return (
                    <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="font-medium">
                            {new Date(schedule.shift_date).toLocaleDateString('en-GB')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {schedule.start_time} - {schedule.end_time}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{staffMember?.user_id || 'Unknown Staff'}</p>
                          <p className="text-xs text-gray-500">{schedule.role_assigned}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={schedule.status === 'scheduled' ? 'default' : 'secondary'}>
                          {schedule.status}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Staff Dialog */}
      <Dialog open={showCreateStaff} onOpenChange={setShowCreateStaff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="staff@example.com"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newStaff.role} onValueChange={(value) => setNewStaff({ ...newStaff, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="chef">Chef</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                placeholder="12.50"
                value={newStaff.hourly_rate}
                onChange={(e) => setNewStaff({ ...newStaff, hourly_rate: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateStaff(false)}>
                Cancel
              </Button>
              <Button onClick={sendStaffInvitation}>Send Invitation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateSchedule} onOpenChange={setShowCreateSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="staff_member">Staff Member</Label>
              <Select value={newSchedule.staff_member_id} onValueChange={(value) => setNewSchedule({ ...newSchedule, staff_member_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.user_id} ({staff.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="shift_date">Date</Label>
              <Input
                id="shift_date"
                type="date"
                value={newSchedule.shift_date}
                onChange={(e) => setNewSchedule({ ...newSchedule, shift_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role_assigned">Role Assignment</Label>
              <Select value={newSchedule.role_assigned} onValueChange={(value) => setNewSchedule({ ...newSchedule, role_assigned: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="chef">Chef</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateSchedule(false)}>
                Cancel
              </Button>
              <Button onClick={createSchedule}>Create Schedule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};