import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Users, 
  Bell, 
  Send,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Megaphone
} from "lucide-react";
import { toast } from "sonner";

const SupportManagement = () => {
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal',
    targetPlans: [],
    targetRestaurants: []
  });

  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);

  // Mock data - in real implementation, fetch from API
  const supportMetrics = {
    activeTickets: 12,
    averageResponseTime: '2.3 hours',
    satisfactionScore: 4.6,
    totalAnnouncements: 8
  };

  const recentTickets = [
    { id: 'T001', restaurant: 'The Local Bistro', subject: 'Payment processing issue', priority: 'high', status: 'open', created: '2 hours ago' },
    { id: 'T002', restaurant: 'Pizza Corner', subject: 'Menu sync problems', priority: 'medium', status: 'in-progress', created: '1 day ago' },
    { id: 'T003', restaurant: 'Curry House', subject: 'Staff access issue', priority: 'low', status: 'resolved', created: '2 days ago' },
    { id: 'T004', restaurant: 'Sushi Bar', subject: 'Inventory discrepancy', priority: 'medium', status: 'open', created: '3 days ago' }
  ];

  const announcements = [
    { 
      id: 'A001', 
      title: 'Platform Maintenance Scheduled', 
      content: 'We will be performing scheduled maintenance on Sunday, January 15th from 2:00 AM to 4:00 AM GMT.',
      priority: 'high',
      targetPlans: ['all'],
      created: '1 day ago',
      status: 'published'
    },
    { 
      id: 'A002', 
      title: 'New Feature: Advanced Analytics', 
      content: 'Beta and Omega plan users now have access to advanced analytics dashboard with real-time insights.',
      priority: 'normal',
      targetPlans: ['beta', 'omega'],
      created: '3 days ago',
      status: 'published'
    },
    { 
      id: 'A003', 
      title: 'Updated Terms of Service', 
      content: 'Please review our updated terms of service. The changes will take effect on February 1st, 2025.',
      priority: 'normal',
      targetPlans: ['all'],
      created: '1 week ago',
      status: 'published'
    }
  ];

  const handleCreateAnnouncement = () => {
    // In real implementation, send to API
    toast.success('Announcement created and sent to restaurants');
    setIsAnnouncementDialogOpen(false);
    setNewAnnouncement({
      title: '',
      content: '',
      priority: 'normal',
      targetPlans: [],
      targetRestaurants: []
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Management</h1>
          <p className="text-muted-foreground">Manage support tickets and platform announcements</p>
        </div>
        <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Platform Announcement</DialogTitle>
              <DialogDescription>
                Send announcements to all restaurants or specific groups
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter announcement title"
                />
              </div>
              <div>
                <Label htmlFor="announcement-content">Content</Label>
                <Textarea
                  id="announcement-content"
                  rows={4}
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter announcement content"
                />
              </div>
              <div>
                <Label htmlFor="announcement-priority">Priority</Label>
                <Select value={newAnnouncement.priority} onValueChange={(value) => setNewAnnouncement(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAnnouncementDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAnnouncement}>
                <Send className="mr-2 h-4 w-4" />
                Send Announcement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Support Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supportMetrics.activeTickets}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supportMetrics.averageResponseTime}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supportMetrics.satisfactionScore}/5</div>
            <p className="text-xs text-muted-foreground">
              Based on ticket ratings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Announcements</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supportMetrics.totalAnnouncements}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Support Tickets</CardTitle>
              <CardDescription>Latest support requests from restaurants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{ticket.id}</Badge>
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)}`} />
                        <span className="font-medium">{ticket.restaurant}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                        <span className="text-sm text-muted-foreground">{ticket.created}</span>
                      </div>
                    </div>
                    <p className="text-sm">{ticket.subject}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Announcements</CardTitle>
              <CardDescription>Recent announcements sent to restaurants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Megaphone className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{announcement.title}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={announcement.priority === 'high' ? 'destructive' : 'secondary'}>
                          {announcement.priority}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{announcement.created}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{announcement.content}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium">Target:</span>
                      {announcement.targetPlans.includes('all') ? (
                        <Badge variant="outline">All Plans</Badge>
                      ) : (
                        announcement.targetPlans.map((plan) => (
                          <Badge key={plan} variant="outline" className="capitalize">
                            {plan}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>Help articles and documentation for restaurants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Knowledge Base Management</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Knowledge base management tools will be available in a future update.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupportManagement;