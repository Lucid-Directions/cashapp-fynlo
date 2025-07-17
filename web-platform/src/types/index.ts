/**
 * Centralized type imports from @fynlo/shared
 * This file re-exports all shared types for use in the platform dashboard
 */

// Re-export all types from shared package
export * from '@fynlo/shared';

// Re-export Supabase types
export type { Database, Json } from '../integrations/supabase/types';

// Platform-specific types that extend shared types
export interface PlatformDashboardState {
  selectedRestaurantId?: string;
  viewMode: 'platform' | 'restaurant';
  sidebarCollapsed: boolean;
}

// Platform-specific user extensions
export interface PlatformUser {
  id: string;
  email: string;
  role: 'platform_owner' | 'platform_admin';
  permissions: string[];
  created_at: string;
  updated_at: string;
}