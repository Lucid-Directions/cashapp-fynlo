import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Building2, 
  BarChart3, 
  CreditCard, 
  Package, 
  Activity, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  Package2,
  Database,
  Map,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const DashboardSidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isPlatformOwner, hasFeature, getSubscriptionPlan } = useFeatureAccess();

  const handleSignOut = async () => {
    await signOut();
  };

  // Platform owner navigation items
  const platformOwnerItems = [
    { icon: Home, label: 'Overview', href: '/dashboard', exact: true },
    { icon: Building2, label: 'Businesses', href: '/dashboard/businesses' },
    { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
    { icon: CreditCard, label: 'Payment Settings', href: '/dashboard/payments' },
    { icon: Package, label: 'Subscriptions', href: '/dashboard/subscriptions' },
    { icon: Activity, label: 'System Health', href: '/dashboard/system' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  ];

  // Customer portal navigation items (subscription-based)
  const customerItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard', exact: true, show: true },
    { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics', show: hasFeature('advanced_analytics') },
    { icon: Package2, label: 'Inventory', href: '/dashboard/inventory', show: hasFeature('inventory_management') },
    { icon: Users, label: 'Staff', href: '/dashboard/staff', show: hasFeature('staff_management') },
    { icon: Database, label: 'Customers', href: '/dashboard/customers', show: hasFeature('customer_database') },
    { icon: Map, label: 'Locations', href: '/dashboard/locations', show: hasFeature('multi_location') },
    { icon: Code, label: 'API Access', href: '/dashboard/api', show: hasFeature('api_access') },
    { icon: BarChart3, label: 'Reports', href: '/dashboard/reports', show: true },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings', show: true },
  ].filter(item => item.show);

  const navigationItems = isPlatformOwner() ? platformOwnerItems : customerItems;

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const subscriptionPlan = getSubscriptionPlan();
  const planColors = {
    alpha: 'bg-bronze-100 text-bronze-800',
    beta: 'bg-gray-100 text-gray-800', 
    omega: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <div className={cn(
      "bg-gray-900 text-gray-300 h-screen flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isPlatformOwner() ? 'Fynlo Admin' : 'Fynlo Portal'}
              </h2>
              {!isPlatformOwner() && (
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full mt-1 inline-block",
                  planColors[subscriptionPlan]
                )}>
                  {subscriptionPlan.toUpperCase()} Plan
                </span>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-gray-300 hover:text-white hover:bg-gray-800"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-lg transition-colors duration-200",
                active 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-300 hover:bg-gray-800 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("w-5 h-5", !collapsed && "mr-3")} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm text-gray-400 truncate">{user?.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full text-gray-300 hover:bg-red-600 hover:text-white",
            collapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("w-4 h-4", !collapsed && "mr-2")} />
          {!collapsed && "Sign Out"}
        </Button>
      </div>
    </div>
  );
};