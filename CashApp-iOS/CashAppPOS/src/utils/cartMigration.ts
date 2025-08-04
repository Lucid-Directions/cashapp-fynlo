/**
 * Cart migration utilities for converting old cart format to enhanced format
 * Handles backward compatibility and data validation
 */

import { OrderItem } from '../types';
import { EnhancedOrderItem, CartMigrationResult, CartValidationError } from '../types/cart';
import ErrorTrackingService from '../services/ErrorTrackingService';

/**
 * Migrates old OrderItem format to EnhancedOrderItem format
 * Handles ID type conversion (number to string) and adds new fields
 */
export function migrateOrderItem(oldItem: OrderItem, userId?: string): EnhancedOrderItem | null {
  try {
    const now = new Date().toISOString();

    // Convert number ID to string, handling various edge cases
    let stringId: string;
    if (typeof oldItem.id === 'number') {
      stringId = oldItem.id.toString();
    } else if (typeof oldItem.id === 'string') {
      stringId = oldItem.id;
    } else {
      // Generate new ID if invalid
      stringId = generateUUID();
    }

    // Validate required fields
    if (
      !oldItem.name ||
      typeof oldItem.price !== 'number' ||
      typeof oldItem.quantity !== 'number'
    ) {
      return null;
    }

    // Create enhanced item with default values
    const enhancedItem: EnhancedOrderItem = {
      // Core fields
      id: stringId,
      productId: stringId, // Use same ID as product ID for now
      name: oldItem.name,
      price: oldItem.price,
      quantity: Math.max(1, oldItem.quantity), // Ensure minimum quantity of 1
      emoji: oldItem.emoji,

      // New modification fields
      modifications: [],
      specialInstructions: undefined,

      // Pricing breakdown
      originalPrice: oldItem.price,
      modificationPrice: 0,
      totalPrice: oldItem.price * Math.max(1, oldItem.quantity),

      // Metadata
      addedAt: now,
      lastModified: now,
      addedBy: userId,
      modifiedBy: userId,

      // Split bill tracking
      splitGroupId: undefined,
    };

    return enhancedItem;
  } catch (error) {
    ErrorTrackingService.getInstance().trackError(error, {
      context: 'cartMigration',
      item: oldItem,
    });
    return null;
  }
}

/**
 * Migrates an entire cart from old format to new format
 * Returns detailed migration results including errors and warnings
 */
export function migrateCart(oldCart: OrderItem[], userId?: string): CartMigrationResult {
  const migratedItems: EnhancedOrderItem[] = [];
  const errors: CartValidationError[] = [];
  const warnings: string[] = [];

  let successCount = 0;
  let failedCount = 0;
  let modifiedCount = 0;

  // Process each item
  oldCart.forEach((oldItem, index) => {
    try {
      // Validate the old item
      if (!oldItem) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          itemId: `index_${index}`,
          field: 'item',
        });
        failedCount++;
        return;
      }

      // Check for invalid ID
      if (!oldItem.id && oldItem.id !== 0) {
        errors.push({
          type: 'INVALID_ID',
          itemId: `index_${index}`,
        });
        failedCount++;
        return;
      }

      // Check for invalid price
      if (typeof oldItem.price !== 'number' || oldItem.price < 0 || !isFinite(oldItem.price)) {
        errors.push({
          type: 'INVALID_PRICE',
          itemId: oldItem.id?.toString() || `index_${index}`,
          price: oldItem.price,
        });
        failedCount++;
        return;
      }

      // Check for invalid quantity
      if (
        typeof oldItem.quantity !== 'number' ||
        oldItem.quantity <= 0 ||
        !isFinite(oldItem.quantity)
      ) {
        errors.push({
          type: 'INVALID_QUANTITY',
          itemId: oldItem.id?.toString() || `index_${index}`,
          quantity: oldItem.quantity,
        });
        failedCount++;
        return;
      }

      // Attempt migration
      const enhancedItem = migrateOrderItem(oldItem, userId);

      if (enhancedItem) {
        migratedItems.push(enhancedItem);
        successCount++;

        // Track if we had to modify the item
        if (oldItem.quantity !== enhancedItem.quantity) {
          modifiedCount++;
          warnings.push(
            `Item "${oldItem.name}" quantity adjusted from ${oldItem.quantity} to ${enhancedItem.quantity}`
          );
        }

        // Warn about ID type conversion
        if (typeof oldItem.id === 'number') {
          warnings.push(
            `Item "${oldItem.name}" ID converted from number (${oldItem.id}) to string ("${enhancedItem.id}")`
          );
        }
      } else {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          itemId: oldItem.id?.toString() || `index_${index}`,
          field: 'unknown',
        });
        failedCount++;
      }
    } catch (error) {
      errors.push({
        type: 'MISSING_REQUIRED_FIELD',
        itemId: oldItem?.id?.toString() || `index_${index}`,
        field: 'migration_error',
      });
      failedCount++;

      ErrorTrackingService.getInstance().trackError(error, {
        context: 'cartMigration',
        itemIndex: index,
        item: oldItem,
      });
    }
  });

  // Add summary warning if there were failures
  if (failedCount > 0) {
    warnings.push(`${failedCount} items failed to migrate and were excluded from the cart`);
  }

  return {
    success: failedCount === 0,
    migratedItems,
    errors,
    warnings,
    stats: {
      totalItems: oldCart.length,
      successfullyMigrated: successCount,
      failed: failedCount,
      modified: modifiedCount,
    },
  };
}

/**
 * Validates that all items in a cart have unique IDs
 */
export function validateUniqueIds(items: EnhancedOrderItem[]): boolean {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
  }
  return true;
}

/**
 * Recalculates all pricing for an enhanced cart item
 * Useful after modifications are changed
 */
export function recalculateItemPricing(item: EnhancedOrderItem): EnhancedOrderItem {
  // Calculate total modification price
  const modificationPrice = item.modifications
    .filter((mod) => mod.selected)
    .reduce((sum, mod) => {
      const modQuantity = mod.quantity || 1;
      return sum + mod.price * modQuantity;
    }, 0);

  // Calculate total price
  const totalPrice = (item.originalPrice + modificationPrice) * item.quantity;

  return {
    ...item,
    modificationPrice,
    totalPrice,
    lastModified: new Date().toISOString(),
  };
}

/**
 * Safely merges old cart state with new enhanced state during migration
 * Preserves any custom fields that might exist
 */
export function mergeCartStates(
  oldCart: OrderItem[],
  enhancedCart: EnhancedOrderItem[]
): EnhancedOrderItem[] {
  // Create a map of old items by ID for quick lookup
  const oldItemMap = new Map<string, OrderItem>();
  oldCart.forEach((item) => {
    const id = item.id?.toString();
    if (id) {
      oldItemMap.set(id, item);
    }
  });

  // Merge any custom fields from old items
  return enhancedCart.map((enhancedItem) => {
    const oldItem = oldItemMap.get(enhancedItem.id);
    if (oldItem) {
      // Preserve any custom fields that might exist
      const { id, name, price, quantity, emoji, ...customFields } = oldItem as any;

      // Only add custom fields if they exist and aren't already in enhanced item
      if (Object.keys(customFields).length > 0) {
        return {
          ...enhancedItem,
          ...customFields, // Spread any custom fields
        };
      }
    }
    return enhancedItem;
  });
}

/**
 * Generates a stable UUID for cart items
 * Uses timestamp and random components
 */
export function generateUUID(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}
