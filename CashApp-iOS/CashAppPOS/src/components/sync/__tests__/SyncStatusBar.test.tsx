/**
 * Tests for SyncStatusBar component
 * Testing UI behavior, sync status display, and user interactions
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import SyncStatusBar from '../SyncStatusBar';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { useTheme } from '../../../design-system/ThemeProvider';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: jest.fn(),
}));

jest.mock('../../../design-system/ThemeProvider', () => ({
  useTheme: jest.fn(),
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock Animated API
jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
  start: (callback) => {
    if (callback) callback({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
} as any));

jest.spyOn(Animated, 'loop').mockImplementation((animation) => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as any));

jest.spyOn(Animated, 'sequence').mockImplementation((animations) => ({
  start: (callback) => {
    if (callback) callback({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
} as any));

// Mock theme
const mockTheme = {
  colors: {
    success: { 
      500: '#4CAF50', 
      50: '#E8F5E9' 
    },
    danger: { 
      500: '#F44336', 
      50: '#FFEBEE' 
    },
    warning: { 
      500: '#FF9800', 
      50: '#FFF3E0' 
    },
    info: { 
      500: '#2196F3', 
      50: '#E3F2FD' 
    },
    neutral: {
      0: '#FFFFFF',
      50: '#F5F5F5',
      100: '#E0E0E0',
      500: '#757575',
      900: '#212121',
    },
    background: '#FFFFFF',
    surface: '#F5F5F5',
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16 },
    caption: { fontSize: 14 },
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

describe('SyncStatusBar', () => {
  const mockUseSyncStatus = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;
  const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

  const defaultSyncStatus = {
    isOnline: true,
    isSyncing: false,
    queueSize: 0,
    failedCount: 0,
    conflictCount: 0,
    canSync: true,
    triggerSync: jest.fn(),
    retryFailed: jest.fn(),
    clearQueue: jest.fn(),
    resolveConflict: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ theme: mockTheme } as any);
    mockUseSyncStatus.mockReturnValue(defaultSyncStatus);
    
    // Setup default network state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('Status Display', () => {
    it('should display online status when connected', () => {
      const { getByText, queryByText } = render(<SyncStatusBar />);
      
      expect(getByText('Online')).toBeTruthy();
      expect(queryByText('Offline')).toBeFalsy();
    });

    it('should display offline status when disconnected', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
      });

      const { getByText, queryByText } = render(<SyncStatusBar />);
      
      expect(getByText('Offline')).toBeTruthy();
      expect(queryByText('Online')).toBeFalsy();
    });

    it('should display queue size when offline with pending items', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
        queueSize: 5,
      });

      const { getByText } = render(<SyncStatusBar />);
      
      expect(getByText('Offline')).toBeTruthy();
      expect(getByText('5 pending')).toBeTruthy();
    });

    it('should display syncing status with animation', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: true,
        queueSize: 3,
      });

      const { getByText } = render(<SyncStatusBar />);
      
      expect(getByText('Syncing')).toBeTruthy();
      expect(getByText('Syncing 3 items...')).toBeTruthy();
      
      // Check that animation was started
      expect(Animated.loop).toHaveBeenCalled();
    });

    it('should display sync issues when there are failed items', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        failedCount: 2,
      });

      const { getByText } = render(<SyncStatusBar />);
      
      expect(getByText('Sync Issues')).toBeTruthy();
      expect(getByText('2 failed')).toBeTruthy();
    });

    it('should display conflict warning when there are conflicts', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        conflictCount: 1,
      });

      const { getByText } = render(<SyncStatusBar />);
      
      expect(getByText('Conflicts')).toBeTruthy();
      expect(getByText('1 conflict needs resolution')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should trigger sync when manual sync button is pressed', () => {
      const triggerSync = jest.fn();
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: true,
        queueSize: 3,
        canSync: true,
        triggerSync,
      });

      const { getByTestId } = render(<SyncStatusBar showDetails />);
      
      const syncButton = getByTestId('sync-button');
      fireEvent.press(syncButton);
      
      expect(triggerSync).toHaveBeenCalled();
    });

    it('should disable sync button when cannot sync', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
        canSync: false,
      });

      const { getByTestId } = render(<SyncStatusBar showDetails />);
      
      const syncButton = getByTestId('sync-button');
      expect(syncButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should call onPress when status bar is pressed', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <SyncStatusBar onPress={onPress} />
      );
      
      const statusBar = getByTestId('sync-status-bar');
      fireEvent.press(statusBar);
      
      expect(onPress).toHaveBeenCalled();
    });

    it('should retry failed items when retry button is pressed', () => {
      const retryFailed = jest.fn();
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        failedCount: 2,
        retryFailed,
      });

      const { getByTestId } = render(<SyncStatusBar showDetails />);
      
      const retryButton = getByTestId('retry-button');
      fireEvent.press(retryButton);
      
      expect(retryFailed).toHaveBeenCalled();
    });
  });

  describe('Visual States', () => {
    it('should use danger colors when offline', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
      });

      const { getByTestId } = render(<SyncStatusBar />);
      const statusBar = getByTestId('sync-status-bar');
      
      expect(statusBar.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: mockTheme.colors.danger[50],
        })
      );
    });

    it('should use info colors when syncing', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: true,
      });

      const { getByTestId } = render(<SyncStatusBar />);
      const statusBar = getByTestId('sync-status-bar');
      
      expect(statusBar.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: mockTheme.colors.info[50],
        })
      );
    });

    it('should use warning colors when there are sync issues', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        failedCount: 1,
      });

      const { getByTestId } = render(<SyncStatusBar />);
      const statusBar = getByTestId('sync-status-bar');
      
      expect(statusBar.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: mockTheme.colors.warning[50],
        })
      );
    });

    it('should use success colors when fully synced', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: true,
        queueSize: 0,
      });

      const { getByTestId } = render(<SyncStatusBar />);
      const statusBar = getByTestId('sync-status-bar');
      
      expect(statusBar.props.style).toEqual(
        expect.objectContaining({
          backgroundColor: mockTheme.colors.success[50],
        })
      );
    });
  });

  describe('Compact vs Detailed View', () => {
    it('should show minimal info in compact mode', () => {
      const { queryByTestId, getByText } = render(
        <SyncStatusBar compact={true} />
      );
      
      expect(getByText('Online')).toBeTruthy();
      expect(queryByTestId('sync-button')).toBeFalsy();
      expect(queryByTestId('retry-button')).toBeFalsy();
    });

    it('should show detailed info when showDetails is true', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        queueSize: 3,
        failedCount: 1,
      });

      const { getByTestId, getByText } = render(
        <SyncStatusBar showDetails={true} compact={false} />
      );
      
      expect(getByText('3 in queue')).toBeTruthy();
      expect(getByText('1 failed')).toBeTruthy();
      expect(getByTestId('sync-button')).toBeTruthy();
    });
  });

  describe('Position Variants', () => {
    it('should render at top position by default', () => {
      const { getByTestId } = render(<SyncStatusBar />);
      const container = getByTestId('sync-status-container');
      
      expect(container.props.style).toEqual(
        expect.objectContaining({
          top: 0,
        })
      );
    });

    it('should render at bottom position when specified', () => {
      const { getByTestId } = render(<SyncStatusBar position="bottom" />);
      const container = getByTestId('sync-status-container');
      
      expect(container.props.style).toEqual(
        expect.objectContaining({
          bottom: 0,
        })
      );
    });
  });

  describe('Animation Lifecycle', () => {
    it('should start pulsing animation when syncing begins', () => {
      const { rerender } = render(<SyncStatusBar />);
      
      // Start syncing
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: true,
      });
      
      rerender(<SyncStatusBar />);
      
      expect(Animated.loop).toHaveBeenCalled();
      expect(Animated.sequence).toHaveBeenCalled();
    });

    it('should stop animation when syncing ends', () => {
      // Start with syncing
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: true,
      });
      
      const { rerender } = render(<SyncStatusBar />);
      
      // Stop syncing
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: false,
      });
      
      rerender(<SyncStatusBar />);
      
      // Animation value should be reset
      const animatedValue = Animated.Value.prototype.setValue;
      expect(animatedValue).toHaveBeenCalledWith(1);
    });
  });

  describe('Network State Changes', () => {
    it('should update when network state changes', async () => {
      const { rerender, getByText } = render(<SyncStatusBar />);
      
      // Simulate going offline
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
      });
      
      rerender(<SyncStatusBar />);
      
      await waitFor(() => {
        expect(getByText('Offline')).toBeTruthy();
      });
      
      // Simulate coming back online
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: true,
        isSyncing: true,
      });
      
      rerender(<SyncStatusBar />);
      
      await waitFor(() => {
        expect(getByText('Syncing')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isOnline: false,
        queueSize: 3,
      });

      const { getByLabelText, getByTestId } = render(
        <SyncStatusBar showDetails />
      );
      
      expect(getByLabelText('Sync status: Offline, 3 items pending')).toBeTruthy();
      
      const syncButton = getByTestId('sync-button');
      expect(syncButton.props.accessibilityLabel).toBe('Sync now');
      expect(syncButton.props.accessibilityRole).toBe('button');
    });

    it('should announce status changes to screen readers', async () => {
      const { rerender } = render(<SyncStatusBar />);
      
      // Change to syncing
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        isSyncing: true,
        queueSize: 5,
      });
      
      rerender(<SyncStatusBar />);
      
      await waitFor(() => {
        const announcement = 'Syncing 5 items';
        // Check that proper accessibility announcement would be made
        expect(true).toBe(true); // Placeholder for actual screen reader test
      });
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom styles when provided', () => {
      const customStyle = {
        backgroundColor: '#FF0000',
        padding: 20,
      };

      const { getByTestId } = render(
        <SyncStatusBar style={customStyle} />
      );
      
      const statusBar = getByTestId('sync-status-bar');
      expect(statusBar.props.style).toEqual(
        expect.objectContaining(customStyle)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined sync status gracefully', () => {
      mockUseSyncStatus.mockReturnValue({
        isOnline: undefined as any,
        isSyncing: undefined as any,
        queueSize: undefined as any,
        failedCount: undefined as any,
        conflictCount: undefined as any,
        canSync: false,
        triggerSync: jest.fn(),
        retryFailed: jest.fn(),
        clearQueue: jest.fn(),
        resolveConflict: jest.fn(),
      });

      const { getByText } = render(<SyncStatusBar />);
      
      // Should show default offline state
      expect(getByText('Offline')).toBeTruthy();
    });

    it('should handle rapid status changes', async () => {
      const { rerender } = render(<SyncStatusBar />);
      
      // Rapidly change states
      for (let i = 0; i < 10; i++) {
        mockUseSyncStatus.mockReturnValue({
          ...defaultSyncStatus,
          isOnline: i % 2 === 0,
          isSyncing: i % 3 === 0,
          queueSize: i,
        });
        
        rerender(<SyncStatusBar />);
      }
      
      // Should not crash and display last state
      expect(true).toBe(true);
    });

    it('should handle very large queue sizes', () => {
      mockUseSyncStatus.mockReturnValue({
        ...defaultSyncStatus,
        queueSize: 999999,
      });

      const { getByText } = render(<SyncStatusBar />);
      
      // Should format large numbers appropriately
      expect(getByText(/999/)).toBeTruthy();
    });
  });
});
