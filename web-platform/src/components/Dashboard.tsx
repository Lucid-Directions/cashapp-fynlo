
import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { DashboardLayout } from './DashboardLayout';
import { LoadingSpinner } from './ui/loading-spinner';

// Lazy load dashboard components for better performance
const DashboardOverview = lazy(() => import('./dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const BusinessManagement = lazy(() => import('./dashboard/BusinessManagement').then(m => ({ default: m.BusinessManagement })));
const AnalyticsDashboard = lazy(() => import('./dashboard/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const PaymentSettings = lazy(() => import('./dashboard/PaymentSettings').then(m => ({ default: m.PaymentSettings })));
const SubscriptionManagement = lazy(() => import('./dashboard/SubscriptionManagement').then(m => ({ default: m.SubscriptionManagement })));
const SystemHealth = lazy(() => import('./dashboard/SystemHealth').then(m => ({ default: m.SystemHealth })));
const DashboardSettings = lazy(() => import('./dashboard/DashboardSettings').then(m => ({ default: m.DashboardSettings })));
const InventoryManagement = lazy(() => import('./dashboard/InventoryManagement').then(m => ({ default: m.InventoryManagement })));
const StaffManagement = lazy(() => import('./dashboard/StaffManagement').then(m => ({ default: m.StaffManagement })));
const CustomerDatabase = lazy(() => import('./dashboard/CustomerDatabase').then(m => ({ default: m.CustomerDatabase })));
const LocationManagement = lazy(() => import('./dashboard/LocationManagement').then(m => ({ default: m.LocationManagement })));
const ApiAccess = lazy(() => import('./dashboard/ApiAccess').then(m => ({ default: m.ApiAccess })));
const ReportsPage = lazy(() => import('./dashboard/ReportsPage').then(m => ({ default: m.ReportsPage })));
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// 🏪 RESTAURANT MANAGER DASHBOARD - For individual restaurant management
export const Dashboard = () => {
  const { loading, user, fynloUserData } = useAuth();
  const { isPlatformOwner, isAdmin } = useFeatureAccess();

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 flex items-center space-x-4">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading your restaurant dashboard...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check access permissions - Users with subscription data have access
  const hasAnyAccess = fynloUserData !== null;
  
  if (!hasAnyAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">Unable to determine your restaurant access level.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner /></div>}>
        <Routes>
          {/* Restaurant Manager Routes - Restaurant-specific data only */}
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/dashboard" element={<DashboardOverview />} />
          
          {/* Core Restaurant Management Features */}
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/payments" element={<PaymentSettings />} />
          <Route path="/settings" element={<DashboardSettings />} />
          <Route path="/reports" element={<ReportsPage />} />
          
          {/* Feature-Gated Restaurant Management Tools */}
          <Route path="/inventory" element={<InventoryManagement />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/customers" element={<CustomerDatabase />} />
          <Route path="/locations" element={<LocationManagement />} />
          <Route path="/api" element={<ApiAccess />} />

          {/* Legacy Platform Owner Routes - kept for backward compatibility */}
          {(isPlatformOwner() || isAdmin()) && (
            <>
              <Route path="/businesses" element={<BusinessManagement />} />
              <Route path="/subscriptions" element={<SubscriptionManagement />} />
              <Route path="/system" element={<SystemHealth />} />
            </>
          )}
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
};
