import React, { useState, useEffect } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Crown, 
  TrendingUp, 
  Building2, 
  CreditCard,
  Users,
  DollarSign,
  Mail,
  Calendar,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export const SubscriptionManagement = () => {
  const { isPlatformOwner } = useFeatureAccess();
  const [loading, setLoading] = useState(false);

  // Test data for Chucho restaurant and subscription overview
  const [subscriptionData] = useState({
    totalSubscribers: 1,
    monthlyRevenue: 119.00, // Omega plan price
    churnRate: 0,
    conversionRate: 100,
    planBreakdown: {
      alpha: 0,
      beta: 0,
      omega: 1
    },
    customers: [
      {
        id: '459da6bc-3472-4de6-8f0c-793373f1a7b0',
        email: 'arnaud@luciddirections.co.uk',
        businessName: 'Chucho',
        plan: 'omega',
        status: 'active',
        monthlyRevenue: 5240.50,
        joinedDate: '2025-01-06',
        lastPayment: '2025-01-06',
        nextBilling: '2025-02-06',
        features: [
          'Unlimited locations',
          'Unlimited staff',
          'Advanced analytics',
          'White-label options',
          'Custom integrations',
          'Dedicated support',
          '24/7 phone support',
          'Custom training'
        ]
      }
    ]
  });

  if (!isPlatformOwner()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only available to platform administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
        <p className="text-gray-600">Monitor and manage customer subscriptions and revenue</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
                <p className="text-2xl font-bold text-gray-900">{subscriptionData.totalSubscribers}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">+100%</span>
                </div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900">£{subscriptionData.monthlyRevenue.toFixed(2)}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">+100%</span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Customer Revenue</p>
                <p className="text-2xl font-bold text-gray-900">£{subscriptionData.customers[0]?.monthlyRevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-500">from Chucho</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Churn Rate</p>
                <p className="text-2xl font-bold text-gray-900">{subscriptionData.churnRate}%</p>
                <p className="text-sm text-green-600">Excellent retention</p>
              </div>
              <Building2 className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900">Alpha</h3>
              <p className="text-2xl font-bold text-gray-600">{subscriptionData.planBreakdown.alpha}</p>
              <p className="text-sm text-gray-500">£0/month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900">Beta</h3>
              <p className="text-2xl font-bold text-blue-600">{subscriptionData.planBreakdown.beta}</p>
              <p className="text-sm text-blue-500">£49/month</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 flex items-center justify-center gap-2">
                <Crown className="w-5 h-5" />
                Omega
              </h3>
              <p className="text-2xl font-bold text-purple-600">{subscriptionData.planBreakdown.omega}</p>
              <p className="text-sm text-purple-500">£119/month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subscriptionData.customers.map((customer) => (
              <div key={customer.id} className="border rounded-lg p-6 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                      {customer.businessName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{customer.businessName}</h3>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{customer.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={customer.plan === 'omega' ? 'default' : 'secondary'}
                      className={customer.plan === 'omega' ? 'bg-purple-600' : ''}
                    >
                      {customer.plan === 'omega' && <Crown className="w-3 h-3 mr-1" />}
                      {customer.plan.toUpperCase()}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">
                      {customer.status === 'active' ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Monthly Business Revenue</p>
                    <p className="text-lg font-semibold text-green-600">
                      £{customer.monthlyRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Joined Date</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-sm font-medium">{new Date(customer.joinedDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Next Billing</p>
                    <p className="text-sm font-medium">{new Date(customer.nextBilling).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Plan Features:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {customer.features.slice(0, 8).map((feature, index) => (
                      <div key={index} className="flex items-center gap-1 text-xs text-gray-600">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Subscription Active</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage Subscription
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};