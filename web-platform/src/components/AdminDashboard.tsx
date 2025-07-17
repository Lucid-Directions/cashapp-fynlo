
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Settings, BarChart3, CreditCard, FileText, Shield, Edit, Eye, Globe, Palette } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UserButton } from './UserButton';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-slate-900">Fynlo Admin</h1>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">Administrator</Badge>
          </div>
          <UserButton />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="website" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Website Editor
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Customers</p>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-slate-900">£0</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Plans</p>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                    </div>
                    <CreditCard className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Support Tickets</p>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                    </div>
                    <Shield className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest platform activity and customer actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  No recent activity to display
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="website" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Edit className="w-5 h-5 mr-2" />
                    Website Content Management
                  </CardTitle>
                  <CardDescription>
                    Edit and customize your website content in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full justify-start">
                    <Globe className="w-4 h-4 mr-2" />
                    Edit Homepage Content
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Manage Pricing Plans
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Palette className="w-4 h-4 mr-2" />
                    Customize Theme
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Customer Experience Preview
                  </CardTitle>
                  <CardDescription>
                    Preview how customers see your platform
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="w-full justify-start">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Customer Dashboard
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Preview Payment Flow
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    Test Customer Journey
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Website Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Website Performance</CardTitle>
                <CardDescription>Monitor your website's performance and user engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-gray-600">Daily Visitors</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-600">Sign-ups Today</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">0%</div>
                    <div className="text-sm text-gray-600">Conversion Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Customer Management
                </CardTitle>
                <CardDescription>
                  Manage customer accounts and subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                  <p>Customer accounts will appear here once users start signing up</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Platform Settings
                  </CardTitle>
                  <CardDescription>
                    Configure platform settings and security
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <Shield className="w-4 h-4 mr-2" />
                    Security Settings
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Payment Configuration
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Terms & Policies
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your admin account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-sm text-gray-900">{user?.email}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Role</label>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Administrator</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Account Created</label>
                    <p className="text-sm text-gray-900">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
