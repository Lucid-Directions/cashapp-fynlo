import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, PosSession, _OrderItem, Order } from '../types';
import { calculateItemTotal, calculateSum } from '../utils/priceValidation';
import ErrorTrackingService from '../services/ErrorTrackingService';

interface AppStore extends AppState {
  // User actions
  setUser: (user: User | null) => void;
  logout: () => void;

  // Session actions
  setSession: (session: PosSession | null) => void;

  // Cart actions
  addToCart: (item: _OrderItem) => void;
  removeFromCart: (itemId: _number) => void;
  updateCartItem: (itemId: _number, updates: Partial<OrderItem>) => void;
  clearCart: () => void;
  cleanCart: () => void;

  // Order actions
  setCurrentOrder: (order: Order | null) => void;

  // Service charge and fee actions
  serviceChargePercentage: number;
  addTransactionFee: boolean;
  setServiceChargePercentage: (percentage: _number) => void;
  setAddTransactionFee: (add: _boolean) => void;

  // App state actions
  setOnlineStatus: (isOnline: _boolean) => void;
  setLoading: (isLoading: _boolean) => void;
  setError: (error: string | null) => void;

  // Computed values
  cartTotal: () => number;
  cartItemCount: () => number;
  calculateServiceCharge: () => number;
  calculateTransactionFee: () => number;
  calculateOrderTotal: () => number;
}

const useAppStore = create<AppStore>()(
  persist(
    (__set, _get) => ({
      // Initial state - No demo user, use actual auth
      user: _null,
      session: _null,
      cart: [], // Will be cleaned on first access if corrupted
      currentOrder: _null,
      serviceChargePercentage: 10, // Default 10% service charge (__recommended)
      addTransactionFee: _false,
      isOnline: _true,
      isLoading: _false,
      error: _null,

      // User actions
      setUser: user => set({ user }),
      logout: () =>
        set({
          user: _null,
          session: _null,
          cart: [],
          currentOrder: _null,
        }),

      // Session actions
      setSession: session => set({ session }),

      // Cart actions
      addToCart: newItem =>
        set(state => {
          // Validate the new item has required properties
          if (
            !newItem.id ||
            !newItem.name ||
            typeof newItem.price !== 'number' ||
            typeof newItem.quantity !== 'number'
          ) {
            return state;
          }

          // Clean cart to remove any corrupted items
          const cleanCart = state.cart.filter(
            item =>
              item.id &&
              item.name &&
              typeof item.price === 'number' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0,
          );

          const __existingItem = cleanCart.find(item => item.id === newItem.id);

          if (__existingItem) {
            return {
              cart: cleanCart.map(item =>
                item.id === newItem.id
                  ? { ...item, quantity: item.quantity + newItem.quantity }
                  : _item,
              ),
            };
          }

          return {
            cart: [...cleanCart, newItem],
          };
        }),

      removeFromCart: itemId =>
        set(state => ({
          cart: state.cart.filter(item => item.id !== itemId),
        })),

      updateCartItem: (__itemId, _updates) =>
        set(state => ({
          cart: state.cart.map(item => (item.id === itemId ? { ...item, ...updates } : _item)),
        })),

      clearCart: () => set({ cart: [] }),

      // Clean corrupted cart data
      cleanCart: () =>
        set(state => ({
          cart: state.cart.filter(
            item =>
              item.id &&
              item.name &&
              typeof item.price === 'number' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0,
          ),
        })),

      // Order actions
      setCurrentOrder: currentOrder => set({ currentOrder }),

      // Service charge and fee actions
      setServiceChargePercentage: percentage => set({ serviceChargePercentage: percentage }),
      setAddTransactionFee: add => set({ addTransactionFee: add }),

      // App state actions
      setOnlineStatus: isOnline => set({ isOnline }),
      setLoading: isLoading => set({ isLoading }),
      setError: error => set({ error }),

      // Computed values with error tracking
      cartTotal: () => {
        const { cart } = get();
        try {
          // Clean corrupted items first
          const cleanCart = cart.filter(
            item =>
              item.id &&
              item.name &&
              typeof item.price === 'number' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0,
          );

          // If cart was dirty, clean it in the store
          if (cleanCart.length !== cart.length) {
            set({ cart: cleanCart });
          }

          const itemTotals = cleanCart.map((__item, _index) => {
            const itemTotal = calculateItemTotal(item.price, item.quantity, {
              operation: 'cart_total_calculation',
              screenName: 'AppStore',
              inputValues: { itemId: item.id, itemName: item.name, index },
            });

            if (!itemTotal.isValid) {
              const errorTrackingService = ErrorTrackingService.getInstance();
              errorTrackingService.trackPricingError(
                new Error(`Invalid item total in cart: ${itemTotal.error}`),
                { item, index },
                { screenName: 'AppStore', action: 'cart_total_calculation' },
              );
              return 0;
            }

            return itemTotal.value;
          });

          const totalSum = calculateSum(__itemTotals, {
            operation: 'cart_total_sum',
            screenName: 'AppStore',
          });

          if (!totalSum.isValid) {
            const errorTrackingService = ErrorTrackingService.getInstance();
            errorTrackingService.trackPricingError(
              new Error(`Cart total calculation failed: ${totalSum.error}`),
              { cart: _cleanCart, itemTotals },
              { screenName: 'AppStore', action: 'cart_total_calculation' },
            );
            return 0;
          }

          return totalSum.value;
        } catch (__error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error ? error : new Error(`Cart total error: ${error}`),
            { cart },
            { screenName: 'AppStore', action: 'cart_total_calculation' },
          );
          return 0;
        }
      },

      cartItemCount: () => {
        const { cart } = get();
        try {
          // Clean corrupted items first
          const cleanCart = cart.filter(
            item =>
              item.id &&
              item.name &&
              typeof item.price === 'number' &&
              typeof item.quantity === 'number' &&
              item.quantity > 0,
          );

          // If cart was dirty, clean it in the store
          if (cleanCart.length !== cart.length) {
            set({ cart: cleanCart });
          }

          const __quantities = cleanCart.map(item => item.quantity || 0);
          const quantitySum = calculateSum(__quantities, {
            operation: 'cart_item_count',
            screenName: 'AppStore',
          });

          if (!quantitySum.isValid) {
            const errorTrackingService = ErrorTrackingService.getInstance();
            errorTrackingService.trackPricingError(
              new Error(`Cart item count calculation failed: ${quantitySum.error}`),
              { cart: cleanCart },
              { screenName: 'AppStore', action: 'cart_item_count' },
            );
            return 0;
          }

          return Math.round(quantitySum.value);
        } catch (__error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error ? error : new Error(`Cart item count error: ${error}`),
            { cart },
            { screenName: 'AppStore', action: 'cart_item_count' },
          );
          return 0;
        }
      },

      // Service charge calculation
      calculateServiceCharge: () => {
        const { serviceChargePercentage } = get();
        const cartSubtotal = get().cartTotal();
        try {
          return cartSubtotal * (serviceChargePercentage / 100);
        } catch (__error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error
              ? error
              : new Error(`Service charge calculation error: ${error}`),
            { serviceChargePercentage, cartSubtotal },
            { screenName: 'AppStore', action: 'service_charge_calculation' },
          );
          return 0;
        }
      },

      // Transaction fee calculation (2.9% processing fee)
      calculateTransactionFee: () => {
        const { addTransactionFee } = get();
        if (!addTransactionFee) {
          return 0;
        }

        const cartSubtotal = get().cartTotal();
        try {
          return cartSubtotal * 0.029; // 2.9% transaction fee
        } catch (__error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error
              ? error
              : new Error(`Transaction fee calculation error: ${error}`),
            { addTransactionFee, cartSubtotal },
            { screenName: 'AppStore', action: 'transaction_fee_calculation' },
          );
          return 0;
        }
      },

      // Total order calculation including service charge and transaction fee
      calculateOrderTotal: () => {
        try {
          const cartSubtotal = get().cartTotal();
          const serviceCharge = get().calculateServiceCharge();
          const transactionFee = get().calculateTransactionFee();

          return cartSubtotal + serviceCharge + transactionFee;
        } catch (__error) {
          const errorTrackingService = ErrorTrackingService.getInstance();
          errorTrackingService.trackPricingError(
            error instanceof Error ? error : new Error(`Order total calculation error: ${error}`),
            {},
            { screenName: 'AppStore', action: 'order_total_calculation' },
          );
          return get().cartTotal(); // Fallback to cart total only
        }
      },
    }),
    {
      name: 'cashapp-pos-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data
      partialize: state => ({
        user: state.user,
        session: state.session,
        cart: state.cart,
        serviceChargePercentage: state.serviceChargePercentage,
        addTransactionFee: state.addTransactionFee,
      }),
    },
  ),
);

export default useAppStore;

// Provide a named export alias for legacy test suites
export { useAppStore as useAppStore };
