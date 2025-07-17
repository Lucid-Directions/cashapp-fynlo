import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface RouteGuardProps {
  children: React.ReactNode;
}

// Protected route that requires authentication
export const ProtectedRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// 🏪 Restaurant Manager Route - Only for restaurant managers/owners
export const RestaurantRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, fynloUserData, loading } = useAuth();

  if (loading || (user && !fynloUserData)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Platform owners should use the platform dashboard
  if (fynloUserData?.is_platform_owner) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return <>{children}</>;
};

// 👤 Platform Owner Route - Only for platform administrators
export const PlatformRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, fynloUserData, loading } = useAuth();

  if (loading || (user && !fynloUserData)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Non-platform owners should use the restaurant dashboard
  if (!fynloUserData?.is_platform_owner) {
    return <Navigate to="/restaurant/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public route that redirects authenticated users to appropriate dashboard
export const PublicRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, fynloUserData, loading } = useAuth();

  if (loading || (user && !fynloUserData)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (user) {
    // Redirect to appropriate dashboard based on user type
    if (fynloUserData?.is_platform_owner) {
      return <Navigate to="/platform/dashboard" replace />;
    } else {
      return <Navigate to="/restaurant/dashboard" replace />;
    }
  }

  return <>{children}</>;
};