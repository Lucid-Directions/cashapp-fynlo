
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, CreditCard, TrendingUp, Calendar, Smartphone, ArrowUp } from 'lucide-react';

export const CustomerDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Restaurant Dashboard</h1>
              <p className="text-gray-600">Track your Fynlo payment system performance</p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Beta Plan - £19/month
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                  <p className="text-2xl font-bold text-slate-900">£0.00</p>
                </div>
                <div className="flex items-center text-green-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-sm">+0%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-slate-900">£0.00</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-slate-900">0</p>
                </div>
                <Smartphone className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transaction Fees</p>
                  <p className="text-2xl font-bold text-slate-900">£0.00</p>
                </div>
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Current Plan
                <Badge className="bg-blue-600">Beta</Badge>
              </CardTitle>
              <CardDescription>
                Complete business solution for growing operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Monthly Fee</span>
                <span className="font-semibold">£19.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Transaction Fee</span>
                <span className="font-semibold">1.8%</span>
              </div>
              <div className="pt-4 space-y-2">
                <Button className="w-full">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Upgrade to Omega Plan
                </Button>
                <Button variant="outline" className="w-full">
                  View Plan Details
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Smartphone className="w-5 h-5 mr-2" />
                Phone Payment Setup
              </CardTitle>
              <CardDescription>
                Get started with Fynlo's phone-based payment system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Quick Setup</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Start accepting payments on your phone in minutes - no hardware required!
                </p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Account verified
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                    Download mobile app
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                    Test first payment
                  </div>
                </div>
              </div>
              <Button className="w-full">
                <Smartphone className="w-4 h-4 mr-2" />
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Transactions
              <Button variant="outline" size="sm">View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No transactions yet</p>
              <p className="text-sm">Complete your setup to start accepting payments</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
