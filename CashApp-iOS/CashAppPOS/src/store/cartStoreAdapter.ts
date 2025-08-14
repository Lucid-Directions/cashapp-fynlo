/**
 * Adapter to provide backward compatibility between old and new cart stores
 * Allows gradual migration of components
 */

import type { OrderItem } from '../types';
import type { EnhancedOrderItem } from '../types/cart';

import useAppStore from './useAppStore';
import useEnhancedCartStore from './useEnhancedCartStore';

/**
 * Hook that returns the appropriate store based on a feature flag
 * This allows gradual rollout of enhanced cart features
 */
export function useCartStore(useEnhanced: boolean = false) {
  const oldStore = useAppStore();
  const enhancedStore = useEnhancedCartStore();

  if (!useEnhanced) {
    return oldStore;
  }

  // Return enhanced store with compatibility layer
  return {
    ...enhancedStore,

    // Provide backward-compatible methods that accept number IDs
    removeFromCart: (itemId: number | string) => {
      enhancedStore.removeFromCart(itemId);
    },

    updateCartItem: (
      itemId: number | string,
      updates: Partial<OrderItem> | Partial<EnhancedOrderItem>
    ) => {
      enhancedStore.updateCartItem(itemId, updates as Partial<EnhancedOrderItem>);
    },

    // Convert enhanced items back to old format for components that expect it
    getOldFormatCart: (): OrderItem[] => {
      return enhancedStore.cart.map((item, index) => ({
        // Use a hash of the string ID to generate a stable numeric ID
        // This avoids collisions while maintaining consistency
        id:
          typeof item.id === 'string' && isNaN(parseInt(item.id, 10))
            ? item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), index)
            : parseInt(item.id, 10) || index,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        emoji: item.emoji,
      }));
    },
  };
}

/**
 * Feature flag to control enhanced cart rollout
 * Can be controlled by environment variable or remote config
 */
export function isEnhancedCartEnabled(): boolean {
  // Enhanced cart is now enabled by default for cart persistence and modifications
  // Can be disabled via environment variable if needed
  if (typeof process !== 'undefined' && process.env?.DISABLE_ENHANCED_CART === 'true') {
    return false;
  }

  // Enable enhanced cart features for persistence
  return true;
}

/**
 * Helper to check if a cart item is enhanced or old format
 */
export function isEnhancedItem(item: any): item is EnhancedOrderItem {
  return (
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    Array.isArray(item.modifications) &&
    typeof item.originalPrice === 'number' &&
    typeof item.totalPrice === 'number'
  );
}

/**
 * Convert old cart format to enhanced format for display
 * Useful for components that want to show enhanced UI with old data
 */
export function convertToEnhancedDisplay(item: OrderItem): Partial<EnhancedOrderItem> {
  return {
    id: item.id.toString(),
    productId: item.id.toString(),
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    emoji: item.emoji,
    modifications: [],
    originalPrice: item.price,
    modificationPrice: 0,
    totalPrice: item.price * item.quantity,
  };
}

/**
 * Sync helper to keep both stores in sync during migration period
 * Can be called after critical operations
 */
export function syncCartStores() {
  const oldStore = useAppStore.getState();
  const enhancedStore = useEnhancedCartStore.getState();

  // Only sync if carts are different
  if (oldStore.cart.length !== enhancedStore.cart.length) {
    // Prefer enhanced store as source of truth
    const simplifiedCart = enhancedStore.cart.map((item, index) => ({
      // Use same hash logic as getOldFormatCart for consistency
      id:
        typeof item.id === 'string' && isNaN(parseInt(item.id, 10))
          ? item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), index)
          : parseInt(item.id, 10) || index,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      emoji: item.emoji,
    }));

    // Update old store
    useAppStore.setState({ cart: simplifiedCart });
  }
}
