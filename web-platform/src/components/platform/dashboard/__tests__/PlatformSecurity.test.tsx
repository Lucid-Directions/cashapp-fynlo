import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { PlatformOverview } from '../PlatformOverview';
import { RestaurantManagement } from '../RestaurantManagement';
import { PlatformAnalytics } from '../PlatformAnalytics';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';

// Mock the hooks and supabase
vi.mock('@/hooks/useFeatureAccess');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('Platform Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PlatformOverview Security', () => {
    it('should block non-platform owners from accessing platform metrics', async () => {
      // Mock non-platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => false,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      // Mock supabase to track if queries are made
      const fromMock = vi.fn();
      vi.mocked(supabase.from).mockImplementation(fromMock);

      render(<PlatformOverview />, { wrapper });

      // Wait for component to attempt data fetching
      await waitFor(() => {
        // Verify that no database queries were made
        expect(fromMock).not.toHaveBeenCalled();
      });

      // Should show error or loading state, not actual data
      expect(screen.queryByText(/Total Restaurants/)).not.toBeInTheDocument();
    });

    it('should allow platform owners to access platform metrics', async () => {
      // Mock platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => true,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      // Mock successful data fetch
      const selectMock = vi.fn(() => ({
        data: [{ id: '1', is_active: true, created_at: new Date().toISOString() }],
        error: null,
      }));
      
      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      render(<PlatformOverview />, { wrapper });

      await waitFor(() => {
        // Verify that database queries were made
        expect(supabase.from).toHaveBeenCalledWith('restaurants');
        expect(supabase.from).toHaveBeenCalledWith('orders');
      });
    });
  });

  describe('RestaurantManagement Security', () => {
    it('should prevent non-platform owners from fetching all restaurants', async () => {
      // Mock non-platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => false,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      const fromMock = vi.fn();
      vi.mocked(supabase.from).mockImplementation(fromMock);

      render(<RestaurantManagement />, { wrapper });

      await waitFor(() => {
        // Should not make any database queries
        expect(fromMock).not.toHaveBeenCalled();
      });
    });

    it('should allow platform owners to fetch all restaurants', async () => {
      // Mock platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => true,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      const orderMock = vi.fn(() => ({
        data: [],
        error: null,
      }));
      
      const selectMock = vi.fn(() => ({
        order: orderMock,
      }));
      
      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      render(<RestaurantManagement />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('restaurants');
        expect(selectMock).toHaveBeenCalledWith('*');
      });
    });
  });

  describe('PlatformAnalytics Security', () => {
    it('should block unauthorized access to platform analytics', async () => {
      // Mock non-platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => false,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      const fromMock = vi.fn();
      vi.mocked(supabase.from).mockImplementation(fromMock);

      render(<PlatformAnalytics />, { wrapper });

      await waitFor(() => {
        // Should not make any database queries
        expect(fromMock).not.toHaveBeenCalled();
      });
    });

    it('should allow platform owners to view analytics across all restaurants', async () => {
      // Mock platform owner
      vi.mocked(useFeatureAccess).mockReturnValue({
        isPlatformOwner: () => true,
        hasFeature: vi.fn(),
        getRestaurantId: vi.fn(),
      });

      const selectMock = vi.fn(() => ({
        data: [],
        error: null,
      }));
      
      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn(() => ({ data: [], error: null })),
      } as any);

      render(<PlatformAnalytics />, { wrapper });

      await waitFor(() => {
        // Should query restaurants and orders
        expect(supabase.from).toHaveBeenCalledWith('restaurants');
        expect(supabase.from).toHaveBeenCalledWith('orders');
      });
    });
  });
});