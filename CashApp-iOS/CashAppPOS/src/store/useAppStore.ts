import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, User, PosSession, OrderItem, Order } from '../types';

interface AppStore extends AppState {
  // User actions
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // Session actions
  setSession: (session: PosSession | null) => void;
  
  // Cart actions
  addToCart: (item: OrderItem) => void;
  removeFromCart: (itemId: number) => void;
  updateCartItem: (itemId: number, updates: Partial<OrderItem>) => void;
  clearCart: () => void;
  
  // Order actions
  setCurrentOrder: (order: Order | null) => void;
  
  // App state actions
  setOnlineStatus: (isOnline: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed values
  cartTotal: () => number;
  cartItemCount: () => number;
}

const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      cart: [],
      currentOrder: null,
      isOnline: true,
      isLoading: false,
      error: null,

      // User actions
      setUser: (user) => set({ user }),
      logout: () => set({ 
        user: null, 
        session: null, 
        cart: [], 
        currentOrder: null 
      }),

      // Session actions
      setSession: (session) => set({ session }),

      // Cart actions
      addToCart: (newItem) => set((state) => {
        const existingItem = state.cart.find(item => item.id === newItem.id);
        
        if (existingItem) {
          return {
            cart: state.cart.map(item =>
              item.id === newItem.id
                ? { ...item, quantity: item.quantity + newItem.quantity }
                : item
            ),
          };
        }
        
        return {
          cart: [...state.cart, newItem],
        };
      }),

      removeFromCart: (itemId) => set((state) => ({
        cart: state.cart.filter(item => item.id !== itemId),
      })),

      updateCartItem: (itemId, updates) => set((state) => ({
        cart: state.cart.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
      })),

      clearCart: () => set({ cart: [] }),

      // Order actions
      setCurrentOrder: (currentOrder) => set({ currentOrder }),

      // App state actions
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Computed values
      cartTotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      cartItemCount: () => {
        const { cart } = get();
        return cart.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cashapp-pos-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        cart: state.cart,
      }),
    }
  )
);

export default useAppStore;