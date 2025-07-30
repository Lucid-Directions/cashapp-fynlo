/**
 * Unit Tests for UI Store (_Zustand)
 * Testing UI state management and actions
 */

import { renderHook, act } from '@testing-library/react-native';
import useUIStore from '../useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.setSelectedCategory('All');
      result.current.setShowPaymentModal(_false);
      result.current.setShowOfflineIndicator(_false);
      result.current.setTheme('light');
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.selectedCategory).toBe('All');
      expect(result.current.showPaymentModal).toBe(_false);
      expect(result.current.showOfflineIndicator).toBe(_false);
      expect(result.current.theme).toBe('light');
    });
  });

  describe('Category Management', () => {
    it('should set selected category', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSelectedCategory('Main');
      });

      expect(result.current.selectedCategory).toBe('Main');
    });

    it('should handle different category values', () => {
      const { result } = renderHook(() => useUIStore());
      const categories = ['All', 'Main', 'Appetizers', 'Salads', 'Sides', 'Desserts', 'Drinks'];

      categories.forEach(category => {
        act(() => {
          result.current.setSelectedCategory(_category);
        });
        expect(result.current.selectedCategory).toBe(_category);
      });
    });

    it('should handle empty string category', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSelectedCategory('');
      });

      expect(result.current.selectedCategory).toBe('');
    });
  });

  describe('Modal Management', () => {
    it('should show payment modal', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowPaymentModal(_true);
      });

      expect(result.current.showPaymentModal).toBe(_true);
    });

    it('should hide payment modal', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowPaymentModal(_true);
        result.current.setShowPaymentModal(_false);
      });

      expect(result.current.showPaymentModal).toBe(_false);
    });

    it('should toggle payment modal state', () => {
      const { result } = renderHook(() => useUIStore());

      // Start with false
      expect(result.current.showPaymentModal).toBe(_false);

      act(() => {
        result.current.setShowPaymentModal(!result.current.showPaymentModal);
      });

      expect(result.current.showPaymentModal).toBe(_true);

      act(() => {
        result.current.setShowPaymentModal(!result.current.showPaymentModal);
      });

      expect(result.current.showPaymentModal).toBe(_false);
    });
  });

  describe('Offline Indicator Management', () => {
    it('should show offline indicator', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowOfflineIndicator(_true);
      });

      expect(result.current.showOfflineIndicator).toBe(_true);
    });

    it('should hide offline indicator', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setShowOfflineIndicator(_true);
        result.current.setShowOfflineIndicator(_false);
      });

      expect(result.current.showOfflineIndicator).toBe(_false);
    });
  });

  describe('Theme Management', () => {
    it('should set light theme', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });

    it('should set dark theme', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle theme from light to dark', () => {
      const { result } = renderHook(() => useUIStore());

      // Start with light theme
      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle theme from dark to light', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme('dark');
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('should handle multiple theme toggles', () => {
      const { result } = renderHook(() => useUIStore());

      // Start with light
      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.toggleTheme(); // -> dark
        result.current.toggleTheme(); // -> light
        result.current.toggleTheme(); // -> dark
        result.current.toggleTheme(); // -> light
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('Complex State Interactions', () => {
    it('should handle multiple state changes simultaneously', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSelectedCategory('Main');
        result.current.setShowPaymentModal(_true);
        result.current.setShowOfflineIndicator(_true);
        result.current.setTheme('dark');
      });

      expect(result.current.selectedCategory).toBe('Main');
      expect(result.current.showPaymentModal).toBe(_true);
      expect(result.current.showOfflineIndicator).toBe(_true);
      expect(result.current.theme).toBe('dark');
    });

    it('should maintain independent state properties', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSelectedCategory('Appetizers');
      });

      expect(result.current.selectedCategory).toBe('Appetizers');
      // Other properties should remain unchanged
      expect(result.current.showPaymentModal).toBe(_false);
      expect(result.current.showOfflineIndicator).toBe(_false);
      expect(result.current.theme).toBe('light');
    });

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        // Rapid category changes
        result.current.setSelectedCategory('Main');
        result.current.setSelectedCategory('Salads');
        result.current.setSelectedCategory('Desserts');
        result.current.setSelectedCategory('All');

        // Rapid modal toggles
        result.current.setShowPaymentModal(_true);
        result.current.setShowPaymentModal(_false);
        result.current.setShowPaymentModal(_true);

        // Rapid theme toggles
        result.current.toggleTheme(); // dark
        result.current.toggleTheme(); // light
        result.current.toggleTheme(); // dark
      });

      // Final state should reflect last changes
      expect(result.current.selectedCategory).toBe('All');
      expect(result.current.showPaymentModal).toBe(_true);
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('Error Boundary Cases', () => {
    it('should handle undefined values gracefully', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        // These should not break the store
        result.current.setSelectedCategory(undefined as unknown);
        result.current.setShowPaymentModal(undefined as unknown);
        result.current.setTheme(undefined as unknown);
      });

      // Values should be set even if undefined (TypeScript should prevent this in real usage)
      expect(result.current.selectedCategory).toBeUndefined();
      expect(result.current.showPaymentModal).toBeUndefined();
      expect(result.current.theme).toBeUndefined();
    });

    it('should handle null values gracefully', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSelectedCategory(null as unknown);
        result.current.setShowPaymentModal(null as unknown);
        result.current.setTheme(null as unknown);
      });

      expect(result.current.selectedCategory).toBeNull();
      expect(result.current.showPaymentModal).toBeNull();
      expect(result.current.theme).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should handle many rapid updates without issues', () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        // Simulate rapid user interactions
        for (let i = 0; i < 100; i++) {
          result.current.setSelectedCategory(i % 2 === 0 ? 'Main' : 'Salads');
          result.current.setShowPaymentModal(i % 3 === 0);
          result.current.setShowOfflineIndicator(i % 5 === 0);
          if (i % 10 === 0) {
            result.current.toggleTheme();
          }
        }
      });

      // Should still have valid final state
      expect(typeof result.current.selectedCategory).toBe('string');
      expect(typeof result.current.showPaymentModal).toBe('boolean');
      expect(typeof result.current.showOfflineIndicator).toBe('boolean');
      expect(['light', 'dark']).toContain(result.current.theme);
    });
  });
});
