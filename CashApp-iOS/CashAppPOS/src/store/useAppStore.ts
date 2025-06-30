import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, User, PosSession, OrderItem, Order } from '../types';
import { calculateItemTotal, calculateSum } from '../utils/priceValidation';
import ErrorTrackingService from '../services/ErrorTrackingService';

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
  cleanCart: () => void;
  
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
      // Initial state - DEVELOPMENT MODE: Auto-login for testing
      user: {
        id: 1,
        name: 'Demo User',
        email: 'demo@fynlo.com',
        role: 'cashier' as const,
        isActive: true,
      },
      session: {
        id: 1,
        userId: 1,
        userName: 'Demo User',
        startTime: new Date(),
        isActive: true,
        startingCash: 0,
        totalSales: 0,
        ordersCount: 0,
      },
      cart: [], // Will be cleaned on first access if corrupted
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
        // Validate the new item has required properties
        if (!newItem.id || !newItem.name || typeof newItem.price !== 'number' || typeof newItem.quantity !== 'number') {
          console.error('Invalid item being added to cart:', newItem);
          return state;
        }

        // Clean cart to remove any corrupted items
        const cleanCart = state.cart.filter(item => 
          item.id && item.name && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0
        );

        const existingItem = cleanCart.find(item => item.id === newItem.id);
        
        if (existingItem) {
          return {
            cart: cleanCart.map(item =>
              item.id === newItem.id
                ? { ...item, quantity: item.quantity + newItem.quantity }
                : item
            ),
          };
        }
        
        return {
          cart: [...cleanCart, newItem],
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

      // Clean corrupted cart data
      cleanCart: () => set((state) => ({
        cart: state.cart.filter(item => 
          item.id && item.name && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0
        )
      })),

      // Order actions
      setCurrentOrder: (currentOrder) => set({ currentOrder }),

      // App state actions
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Computed values with error tracking
      cartTotal: () => {
        const { cart } = get();
        try {
          // Clean corrupted items first
          const cleanCart = cart.filter(item => 
            item.id && item.name && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0
          );

          // If cart was dirty, clean it in the store
          if (cleanCart.length !== cart.length) {
            set({ cart: cleanCart });
          }

          const itemTotals = cleanCart.map((item, index) => {
            const itemTotal = calculateItemTotal(item.price, item.quantity, {
              operation: 'cart_total_calculation',
              screenName: 'AppStore',
              inputValues: { itemId: item.id, itemName: item.name, index }
            });
            
            if (!itemTotal.isValid) {
              const errorTrackingService = ErrorTrackingService.getInstance();
              errorTrackingService.trackPricingError(
                new Error(`Invalid item total in cart: ${itemTotal.error}`),
                { item, index },
                { screenName: 'AppStore', action: 'cart_total_calculation' }
              );
              return 0;
            }
            
            return itemTotal.value;
          });

          const totalSum = calculateSum(itemTotals, {
            operation: 'cart_total_sum',
            screenName: 'AppStore'
          });

          if (!totalSum.isValid) {
            const errorTrackingService = ErrorTrackingService.getInstance();
            errorTrackingService.trackPricingError(
              new Error(`Cart total calculation failed: ${totalSum.error}`),
              { cart: cleanCart, itemTotals },
              { screenName: 'AppStore', action: 'cart_total_calculation' }
            );
            return 0;
          }

          return totalSum.value;
        } catch (error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error ? error : new Error(`Cart total error: ${error}`),
            { cart },
            { screenName: 'AppStore', action: 'cart_total_calculation' }
          );
          return 0;
        }
      },

      cartItemCount: () => {
        const { cart } = get();
        try {
          // Clean corrupted items first
          const cleanCart = cart.filter(item => 
            item.id && item.name && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0
          );

          // If cart was dirty, clean it in the store
          if (cleanCart.length !== cart.length) {
            set({ cart: cleanCart });
          }

          const quantities = cleanCart.map(item => item.quantity || 0);
          const quantitySum = calculateSum(quantities, {
            operation: 'cart_item_count',
            screenName: 'AppStore'
          });

          if (!quantitySum.isValid) {
            const errorTrackingService = ErrorTrackingService.getInstance();
            errorTrackingService.trackPricingError(
              new Error(`Cart item count calculation failed: ${quantitySum.error}`),
              { cart: cleanCart },
              { screenName: 'AppStore', action: 'cart_item_count' }
            );
            return 0;
          }

          return Math.round(quantitySum.value);
        } catch (error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error ? error : new Error(`Cart item count error: ${error}`),
            { cart },
            { screenName: 'AppStore', action: 'cart_item_count' }
          );
          return 0;
        }
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

// Provide a named export alias for legacy test suites
export { useAppStore as useAppStore };