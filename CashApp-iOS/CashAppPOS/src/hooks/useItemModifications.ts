/**
 * Hook for managing item modifications in the cart
 * Provides state management and actions for modifying cart items
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  CartItemModification, 
  EnhancedOrderItem 
} from '../types/cart';
import { ModificationPricingService } from '../services/ModificationPricingService';
import useEnhancedCartStore from '../store/useEnhancedCartStore';
import { useCartStore } from '../store/cartStoreAdapter';

interface UseItemModificationsProps {
  item: EnhancedOrderItem | null;
  useEnhancedCart?: boolean;
}

interface UseItemModificationsReturn {
  // State
  modifications: CartItemModification[];
  modificationPrice: number;
  totalPrice: number;
  isValid: boolean;
  errors: string[];
  hasChanges: boolean;
  
  // Actions
  toggleModification: (modificationId: string) => void;
  updateModificationQuantity: (modificationId: string, quantity: number) => void;
  setSpecialInstructions: (instructions: string) => void;
  resetModifications: () => void;
  applyModifications: () => void;
  
  // Helpers
  getModificationSummary: () => string;
  getPriceImpactSummary: () => string;
}

export function useItemModifications({
  item,
  useEnhancedCart = true
}: UseItemModificationsProps): UseItemModificationsReturn {
  const pricingService = ModificationPricingService.getInstance();
  const store = useCartStore(useEnhancedCart);
  const enhancedStore = useEnhancedCartStore();
  
  // Initialize modifications from item or defaults
  const [modifications, setModifications] = useState<CartItemModification[]>(() => {
    if (item?.modifications && item.modifications.length > 0) {
      return [...item.modifications];
    }
    // Get default modifications based on product category
    return pricingService.getAvailableModifications(item?.categoryName);
  });
  
  const [specialInstructions, setSpecialInstructions] = useState<string>(
    item?.specialInstructions || ''
  );
  
  // Calculate current pricing
  const modificationPrice = useMemo(
    () => pricingService.calculateModificationPrice(modifications),
    [modifications, pricingService]
  );
  
  const totalPrice = useMemo(() => {
    if (!item) return 0;
    return (item.originalPrice + modificationPrice) * item.quantity;
  }, [item, modificationPrice]);
  
  // Validate modifications
  const validation = useMemo(
    () => pricingService.validateModifications(modifications),
    [modifications, pricingService]
  );
  
  // Check if modifications have changed from original
  const hasChanges = useMemo(() => {
    if (!item) return false;
    
    // Check special instructions
    if (specialInstructions !== (item.specialInstructions || '')) {
      return true;
    }
    
    // Check modifications
    if (item.modifications.length !== modifications.length) {
      return true;
    }
    
    // Compare each modification
    return !item.modifications.every(origMod => {
      const currentMod = modifications.find(m => m.id === origMod.id);
      return (
        currentMod &&
        currentMod.selected === origMod.selected &&
        currentMod.quantity === origMod.quantity
      );
    });
  }, [item, modifications, specialInstructions]);
  
  // Actions
  
  const toggleModification = useCallback((modificationId: string) => {
    setModifications(prev => {
      const newMods = [...prev];
      const modIndex = newMods.findIndex(m => m.id === modificationId);
      
      if (modIndex === -1) return prev;
      
      const mod = newMods[modIndex];
      const modType = mod.type;
      const modCategory = mod.category;
      
      // Handle exclusive selections (size, temperature, milk)
      if (modType === 'size' || modType === 'temperature' || modCategory === 'Milk Options') {
        // Deselect other options in the same category
        newMods.forEach(m => {
          if (m.id !== modificationId && 
              (m.type === modType || m.category === modCategory)) {
            m.selected = false;
          }
        });
      }
      
      // Toggle the selected modification
      newMods[modIndex] = {
        ...mod,
        selected: !mod.selected
      };
      
      return newMods;
    });
  }, []);
  
  const updateModificationQuantity = useCallback((modificationId: string, quantity: number) => {
    setModifications(prev => {
      const newMods = [...prev];
      const modIndex = newMods.findIndex(m => m.id === modificationId);
      
      if (modIndex === -1 || newMods[modIndex].quantity === undefined) {
        return prev;
      }
      
      newMods[modIndex] = {
        ...newMods[modIndex],
        quantity: Math.max(1, Math.min(quantity, 10)) // Limit between 1 and 10
      };
      
      return newMods;
    });
  }, []);
  
  const resetModifications = useCallback(() => {
    if (item?.modifications) {
      setModifications([...item.modifications]);
      setSpecialInstructions(item.specialInstructions || '');
    } else {
      const defaults = pricingService.resetToDefaults(modifications);
      setModifications(defaults);
      setSpecialInstructions('');
    }
  }, [item, modifications, pricingService]);
  
  const applyModifications = useCallback(() => {
    if (!item || !validation.isValid) return;
    
    // Only use enhanced methods if we're using the enhanced cart
    if (useEnhancedCart) {
      // Update the item in the store using enhanced methods
      enhancedStore.modifyCartItem(item.id, modifications);
      
      // Update special instructions if changed
      if (specialInstructions !== item.specialInstructions) {
        enhancedStore.setItemSpecialInstructions(item.id, specialInstructions);
      }
    } else {
      // For old store, we need to update the entire item
      // This is a limitation of the old store structure
      console.warn('Modifications not supported in old cart store');
    }
  }, [item, modifications, specialInstructions, validation.isValid, useEnhancedCart, enhancedStore]);
  
  // Helpers
  
  const getModificationSummary = useCallback(
    () => pricingService.getModificationSummary(modifications),
    [modifications, pricingService]
  );
  
  const getPriceImpactSummary = useCallback(
    () => pricingService.getPriceImpactSummary(modifications),
    [modifications, pricingService]
  );
  
  return {
    // State
    modifications,
    modificationPrice,
    totalPrice,
    isValid: validation.isValid,
    errors: validation.errors,
    hasChanges,
    
    // Actions
    toggleModification,
    updateModificationQuantity,
    setSpecialInstructions,
    resetModifications,
    applyModifications,
    
    // Helpers
    getModificationSummary,
    getPriceImpactSummary
  };
}