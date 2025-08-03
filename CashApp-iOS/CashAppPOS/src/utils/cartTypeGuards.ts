/**
 * Type guards and validation utilities for cart types
 * Provides runtime type checking for cart data structures
 */

import { OrderItem } from '../types';
import {
  EnhancedOrderItem,
  CartItemModification,
  SplitBillGroup,
  CartTemplate,
  SplitBillConfig
} from '../types/cart';

/**
 * Type guard to check if an object is a valid OrderItem (old format)
 */
export function isOrderItem(item: any): item is OrderItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    (typeof item.id === 'number' || typeof item.id === 'string') &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number' &&
    item.price >= 0 &&
    item.quantity > 0 &&
    isFinite(item.price) &&
    isFinite(item.quantity)
  );
}

/**
 * Type guard to check if an object is a valid EnhancedOrderItem
 */
export function isEnhancedOrderItem(item: any): item is EnhancedOrderItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number' &&
    typeof item.originalPrice === 'number' &&
    typeof item.modificationPrice === 'number' &&
    typeof item.totalPrice === 'number' &&
    Array.isArray(item.modifications) &&
    typeof item.addedAt === 'string' &&
    typeof item.lastModified === 'string' &&
    item.price >= 0 &&
    item.quantity > 0 &&
    item.originalPrice >= 0 &&
    item.modificationPrice >= 0 &&
    item.totalPrice >= 0 &&
    isFinite(item.price) &&
    isFinite(item.quantity) &&
    isFinite(item.originalPrice) &&
    isFinite(item.modificationPrice) &&
    isFinite(item.totalPrice) &&
    item.modifications.every(isCartItemModification)
  );
}

/**
 * Type guard to check if an object is a valid CartItemModification
 */
export function isCartItemModification(mod: any): mod is CartItemModification {
  return (
    mod !== null &&
    typeof mod === 'object' &&
    typeof mod.id === 'string' &&
    ['size', 'temperature', 'addition', 'removal', 'custom'].includes(mod.type) &&
    typeof mod.category === 'string' &&
    typeof mod.name === 'string' &&
    typeof mod.price === 'number' &&
    typeof mod.selected === 'boolean' &&
    isFinite(mod.price) &&
    (mod.quantity === undefined || (typeof mod.quantity === 'number' && mod.quantity > 0 && isFinite(mod.quantity)))
  );
}

/**
 * Type guard to check if an object is a valid SplitBillGroup
 */
export function isSplitBillGroup(group: any): group is SplitBillGroup {
  return (
    group !== null &&
    typeof group === 'object' &&
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    typeof group.color === 'string' &&
    Array.isArray(group.itemIds) &&
    typeof group.subtotal === 'number' &&
    typeof group.serviceCharge === 'number' &&
    typeof group.serviceChargePercentage === 'number' &&
    typeof group.tax === 'number' &&
    typeof group.taxPercentage === 'number' &&
    typeof group.total === 'number' &&
    ['pending', 'processing', 'completed', 'failed', 'refunded'].includes(group.paymentStatus) &&
    typeof group.createdAt === 'string' &&
    group.itemIds.every((id: any) => typeof id === 'string') &&
    isFinite(group.subtotal) &&
    isFinite(group.serviceCharge) &&
    isFinite(group.serviceChargePercentage) &&
    isFinite(group.tax) &&
    isFinite(group.taxPercentage) &&
    isFinite(group.total) &&
    group.subtotal >= 0 &&
    group.serviceCharge >= 0 &&
    group.tax >= 0 &&
    group.total >= 0
  );
}

/**
 * Type guard to check if an object is a valid CartTemplate
 */
export function isCartTemplate(template: any): template is CartTemplate {
  return (
    template !== null &&
    typeof template === 'object' &&
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.description === 'string' &&
    Array.isArray(template.items) &&
    typeof template.createdAt === 'string' &&
    typeof template.createdBy === 'string' &&
    typeof template.useCount === 'number' &&
    typeof template.isPublic === 'boolean' &&
    Array.isArray(template.tags) &&
    template.items.every(isEnhancedOrderItem) &&
    template.tags.every((tag: any) => typeof tag === 'string') &&
    template.useCount >= 0 &&
    isFinite(template.useCount)
  );
}

/**
 * Type guard to check if an object is a valid SplitBillConfig
 */
export function isSplitBillConfig(config: any): config is SplitBillConfig {
  return (
    config !== null &&
    typeof config === 'object' &&
    typeof config.id === 'string' &&
    ['equal', 'by_items', 'custom', 'percentage'].includes(config.splitType) &&
    typeof config.numberOfSplits === 'number' &&
    Array.isArray(config.groups) &&
    Array.isArray(config.unassignedItemIds) &&
    typeof config.originalTotal === 'number' &&
    typeof config.currentTotal === 'number' &&
    typeof config.totalPaid === 'number' &&
    typeof config.remainingBalance === 'number' &&
    typeof config.allowPartialPayments === 'boolean' &&
    typeof config.requireAllGroupsPaid === 'boolean' &&
    typeof config.autoAssignServiceCharge === 'boolean' &&
    typeof config.createdAt === 'string' &&
    typeof config.createdBy === 'string' &&
    config.numberOfSplits > 0 &&
    config.groups.every(isSplitBillGroup) &&
    config.unassignedItemIds.every((id: any) => typeof id === 'string') &&
    isFinite(config.numberOfSplits) &&
    isFinite(config.originalTotal) &&
    isFinite(config.currentTotal) &&
    isFinite(config.totalPaid) &&
    isFinite(config.remainingBalance) &&
    config.originalTotal >= 0 &&
    config.currentTotal >= 0 &&
    config.totalPaid >= 0 &&
    config.remainingBalance >= 0
  );
}

/**
 * Validates cart data integrity
 * Checks for duplicate IDs, price consistency, etc.
 */
export function validateCartIntegrity(items: EnhancedOrderItem[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  
  items.forEach((item, index) => {
    // Check for duplicate IDs
    if (seenIds.has(item.id)) {
      errors.push(`Duplicate item ID found: ${item.id}`);
    }
    seenIds.add(item.id);
    
    // Validate pricing consistency
    const expectedModPrice = item.modifications
      .filter(mod => mod.selected)
      .reduce((sum, mod) => sum + (mod.price * (mod.quantity || 1)), 0);
    
    if (Math.abs(expectedModPrice - item.modificationPrice) > 0.01) {
      errors.push(`Item "${item.name}" has inconsistent modification price. Expected: ${expectedModPrice}, Actual: ${item.modificationPrice}`);
    }
    
    const expectedTotal = (item.originalPrice + item.modificationPrice) * item.quantity;
    if (Math.abs(expectedTotal - item.totalPrice) > 0.01) {
      errors.push(`Item "${item.name}" has inconsistent total price. Expected: ${expectedTotal}, Actual: ${item.totalPrice}`);
    }
    
    // Check for invalid dates
    if (isNaN(Date.parse(item.addedAt))) {
      errors.push(`Item "${item.name}" has invalid addedAt date: ${item.addedAt}`);
    }
    
    if (isNaN(Date.parse(item.lastModified))) {
      errors.push(`Item "${item.name}" has invalid lastModified date: ${item.lastModified}`);
    }
    
    // Check modification conflicts
    const sizeModifications = item.modifications.filter(mod => mod.type === 'size' && mod.selected);
    if (sizeModifications.length > 1) {
      errors.push(`Item "${item.name}" has multiple size selections`);
    }
    
    const tempModifications = item.modifications.filter(mod => mod.type === 'temperature' && mod.selected);
    if (tempModifications.length > 1) {
      errors.push(`Item "${item.name}" has multiple temperature selections`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Safely parses JSON that might contain cart data
 * Returns null if parsing fails or data is invalid
 */
export function safeParseCartData(jsonString: string): EnhancedOrderItem[] | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (!Array.isArray(parsed)) {
      return null;
    }
    
    // Check if all items are valid
    if (parsed.every(isEnhancedOrderItem)) {
      return parsed;
    }
    
    // Check if they're old format items that need migration
    if (parsed.every(isOrderItem)) {
      // Return null here - caller should handle migration
      return null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a cart needs migration from old to new format
 */
export function cartNeedsMigration(cart: any[]): boolean {
  if (!Array.isArray(cart) || cart.length === 0) {
    return false;
  }
  
  // If any item is in old format, migration is needed
  return cart.some(item => isOrderItem(item) && !isEnhancedOrderItem(item));
}