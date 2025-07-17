import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Bell, 
  Maximize, 
  User,
  ArrowUpRight
} from 'lucide-react';

export const DashboardTopBar = () => {
  const { user } = useAuth();
  const { isPlatformOwner, getSubscriptionPlan } = useFeatureAccess();

  const subscriptionPlan = getSubscriptionPlan();
  const showUpgradeButton = !isPlatformOwner() && subscriptionPlan !== 'omega';

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      {/* Left side - Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search businesses, transactions..."
            className="pl-10 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-4">
        {/* Subscription upgrade prompt */}
        {showUpgradeButton && (
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            Upgrade to {subscriptionPlan === 'alpha' ? 'Beta' : 'Omega'}
          </Button>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            3
          </span>
        </Button>

        {/* Fullscreen toggle */}
        <Button variant="ghost" size="icon">
          <Maximize className="w-5 h-5" />
        </Button>

        {/* User profile */}
        <div className="flex items-center space-x-2">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {isPlatformOwner() ? 'Platform Admin' : 'Restaurant Manager'}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};