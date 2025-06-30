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
      // Initial state: Conditionally set demo user/session for development
      user: __DEV__ ? {
        id: 1, // Ensure this ID type matches User['id'] if it's UUID in backend
        name: 'Demo User',
        email: 'demo@fynlo.com',
        role: 'cashier' as const,
        isActive: true,
      } : null,
      session: __DEV__ ? {
        id: 1, // Ensure this ID type matches PosSession['id']
        userId: 1, // Ensure this ID type matches User['id']
        userName: 'Demo User',
        startTime: new Date(),
        isActive: true,
        startingCash: 0,
        totalSales: 0,
        ordersCount: 0,
      } : null,
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
        // Validate the new item has required properties and positive quantity
        if (!newItem || !newItem.id || !newItem.name ||
            typeof newItem.price !== 'number' || newItem.price < 0 ||
            typeof newItem.quantity !== 'number' || newItem.quantity <= 0) {
          console.error('Invalid item being added to cart (id, name, price, or quantity error):', newItem);
          ErrorTrackingService.getInstance().captureError(new Error("Invalid item added to cart"), {
            action: 'addToCart_validation_failed',
            item: newItem,
          });
          return state; // Returns current state, effectively rejecting the item
        }

        // It's generally better to ensure data is clean before it enters the store.
        // The repetitive cleanCart in computed properties will handle any unforeseen corruption.
        const currentCart = state.cart;
        const existingItemIndex = currentCart.findIndex(item => item.id === newItem.id);
        
        if (existingItemIndex > -1) {
          const updatedCart = [...currentCart];
          const existingItem = updatedCart[existingItemIndex];
          updatedCart[existingItemIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + newItem.quantity,
            // Optionally re-validate price if it can change on re-add
            price: typeof newItem.price === 'number' && newItem.price >= 0 ? newItem.price : existingItem.price,
          };
          return { cart: updatedCart };
        }
        
        return {
          cart: [...currentCart, newItem],
        };
      }),

      removeFromCart: (itemId) => set((state) => ({
        cart: state.cart.filter(item => item.id !== itemId),
      })),

      updateCartItem: (itemId, updates) => set((state) => {
        const currentCart = state.cart;
        const itemIndex = currentCart.findIndex(item => item.id === itemId);

        if (itemIndex === -1) {
          console.warn(`Item with id ${itemId} not found in cart for update.`);
          return state;
        }

        const itemToUpdate = currentCart[itemIndex];
        let updatedItem = { ...itemToUpdate, ...updates };

        // Validate quantity if it's being updated
        if (updates.quantity !== undefined) {
          if (typeof updates.quantity !== 'number' || updates.quantity <= 0) {
            // If quantity becomes invalid, remove the item
            console.log(`Removing item ${itemId} due to invalid quantity update: ${updates.quantity}`);
            const newCart = [...currentCart];
            newCart.splice(itemIndex, 1);
            return { cart: newCart };
          }
        }

        // Validate price if it's being updated
        if (updates.price !== undefined) {
          if (typeof updates.price !== 'number' || updates.price < 0) {
            console.error(`Invalid price update for item ${itemId}:`, updates.price);
            ErrorTrackingService.getInstance().captureError(new Error("Invalid price update for cart item"), {
              action: 'updateCartItem_price_validation_failed',
              itemId: itemId,
              updates: updates,
            });
            // Reject the price update but keep other valid updates
            updatedItem.price = itemToUpdate.price;
          }
        }

        const newCart = [...currentCart];
        newCart[itemIndex] = updatedItem;
        return { cart: newCart };
      }),

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