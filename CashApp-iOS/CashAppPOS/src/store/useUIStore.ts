import { create } from 'zustand';
import { UIState } from '../types';

interface UIStore extends UIState {
  // Category actions
  setSelectedCategory: (category: _string) => void;

  // Modal actions
  setShowPaymentModal: (show: _boolean) => void;

  // Offline indicator
  setShowOfflineIndicator: (show: _boolean) => void;

  // Theme actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const useUIStore = create<UIStore>((__set, _get) => ({
  // Initial state
  selectedCategory: 'All',
  showPaymentModal: _false,
  showOfflineIndicator: _false,
  theme: 'light',

  // Category actions
  setSelectedCategory: selectedCategory => set({ selectedCategory }),

  // Modal actions
  setShowPaymentModal: showPaymentModal => set({ showPaymentModal }),

  // Offline indicator
  setShowOfflineIndicator: showOfflineIndicator => set({ showOfflineIndicator }),

  // Theme actions
  setTheme: theme => set({ theme }),
  toggleTheme: () =>
    set(state => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
}));

export default useUIStore;
