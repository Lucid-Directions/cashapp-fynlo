/**
 * Helper utilities for product modifications
 * Provides formatting, calculations, and utility functions for modifications
 */

import type { CartItemModification, EnhancedOrderItem } from '../types/cart';

/**
 * Format modification price for display
 * Shows + for positive prices (charges), - for negative prices (discounts)
 */
export function formatModificationPrice(price: number): string {
  if (price === 0) return '';

  // Round to avoid floating point issues
  const roundedPrice = Math.round(Math.abs(price) * 100) / 100;

  if (price > 0) {
    return `+$${roundedPrice.toFixed(2)}`;
  } else {
    return `-$${roundedPrice.toFixed(2)}`;
  }
}
/**
 * Calculate total modification price for selected modifications
 */
export function calculateTotalModificationPrice(modifications: CartItemModification[]): number {
  if (!modifications || modifications.length === 0) return 0;

  return modifications.reduce((total, mod) => {
    if (!mod.selected) return total;
    const price = mod.price || 0;
    const quantity = mod.quantity || 1;
    return total + price * quantity;
  }, 0);
}

/**
 * Calculate modification total for any array with price/quantity
 */
export function calculateModificationTotal(modifications: any[]): number {
  if (!modifications || modifications.length === 0) return 0;

  return modifications.reduce((total, mod) => {
    const price = mod.price || 0;
    const quantity = mod.quantity || 1;
    return total + price * quantity;
  }, 0);
}

/**
 * Format modification summary for display
 * @param modifications - Array of modifications
 * @param maxLength - Optional max length for truncation
 */
export function formatModificationSummary(
  modifications: CartItemModification[],
  maxLength?: number
): string {
  if (!modifications || modifications.length === 0) return '';

  const selectedMods = modifications.filter((mod) => mod.selected);
  if (selectedMods.length === 0) return '';

  let summary = selectedMods
    .map((mod) => {
      // Format as "2x Extra Shot" instead of "Extra Shot (2x)"
      if (mod.quantity && mod.quantity > 1) {
        return `${mod.quantity}x ${mod.name}`;
      }
      return mod.name;
    })
    .join(', ');

  // Truncate if maxLength specified
  if (maxLength && summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + '...';
  }

  return summary;
}

/**
 * Check if item has any selected modifications or special instructions
 */
export function hasModifications(item: EnhancedOrderItem | CartItemModification[]): boolean {
  if (Array.isArray(item)) {
    return !!(item && item.some((mod) => mod.selected));
  }

  // For EnhancedOrderItem, check both modifications and special instructions
  const hasSelectedMods = !!(item.modifications && item.modifications.some((mod) => mod.selected));
  const hasInstructions = !!(
    item.specialInstructions && item.specialInstructions.trim().length > 0
  );

  return hasSelectedMods || hasInstructions;
}

/**
 * Get count of selected modifications and special instructions
 */
export function getModificationCount(item: EnhancedOrderItem | CartItemModification[]): number {
  if (Array.isArray(item)) {
    return item.filter((mod) => mod.selected).length;
  }

  // For EnhancedOrderItem, count both modifications and special instructions
  let count = 0;

  if (item.modifications) {
    count += item.modifications.filter((mod) => mod.selected).length;
  }

  if (item.specialInstructions && item.specialInstructions.trim().length > 0) {
    count += 1;
  }

  return count;
}

/**
 * Serialize modifications for storage/comparison
 */
export function serializeModifications(modifications: CartItemModification[]): string {
  if (!modifications || modifications.length === 0) return '';

  const selected = modifications
    .filter((mod) => mod.selected)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((mod) => ({
      id: mod.id,
      quantity: mod.quantity || 1,
    }));

  return JSON.stringify(selected);
}

/**
 * Deserialize modifications from string
 */
export function deserializeModifications(
  serialized: string,
  availableModifications: CartItemModification[]
): CartItemModification[] {
  if (!serialized || !availableModifications) return availableModifications || [];

  try {
    const selected = JSON.parse(serialized);

    return availableModifications.map((mod) => {
      const selectedMod = selected.find((s: any) => s.id === mod.id);
      if (selectedMod) {
        return {
          ...mod,
          selected: true,
          quantity: selectedMod.quantity || 1,
        };
      }
      return { ...mod, selected: false };
    });
  } catch {
    return availableModifications;
  }
}

/**
 * Group modifications by category
 */
export function groupModificationsByCategory(
  modifications: CartItemModification[]
): Record<string, CartItemModification[]> {
  if (!modifications) return {};

  return modifications.reduce((groups, mod) => {
    const category = mod.category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(mod);
    return groups;
  }, {} as Record<string, CartItemModification[]>);
}

/**
 * Get color for modification type based on theme
 */
export function getModificationTypeColor(type: CartItemModification['type'], theme?: any): string {
  if (theme?.colors) {
    switch (type) {
      case 'size':
        return theme.colors.info || '#2196F3';
      case 'temperature':
        return theme.colors.warning || '#FF9800';
      case 'addition':
        return theme.colors.success || '#4CAF50';
      case 'removal':
        return theme.colors.error || '#F44336';
      default:
        return theme.colors.primary || '#007AFF';
    }
  }

  // Fallback colors without theme
  switch (type) {
    case 'size':
      return '#4ECDC4';
    case 'temperature':
      return '#FF6B6B';
    case 'addition':
      return '#45B7D1';
    case 'removal':
      return '#FFA07A';
    case 'substitution':
      return '#98D8C8';
    case 'preparation':
      return '#BB8FCE';
    default:
      return '#8E8E93';
  }
}

/**
 * Check if modification combination is valid
 */
export function isModificationCombinationValid(
  modifications: CartItemModification[],
  newModId?: string
): { valid: boolean; reason?: string } {
  if (!modifications) return { valid: true };

  const selected = modifications.filter((mod) => mod.selected);

  // Count by type
  const typeCount: Record<string, number> = {};
  selected.forEach((mod) => {
    typeCount[mod.type] = (typeCount[mod.type] || 0) + 1;
  });

  // Check size selection (only one allowed)
  if (typeCount.size > 1) {
    return { valid: false, reason: 'Only one size option can be selected' };
  }

  // Check temperature selection (only one allowed)
  if (typeCount.temperature > 1) {
    return { valid: false, reason: 'Only one temperature option can be selected' };
  }

  // Check milk options (only one allowed)
  const milkOptions = selected.filter(
    (mod) =>
      mod.category === 'Milk Options' ||
      mod.name.toLowerCase().includes('milk') ||
      mod.name.toLowerCase().includes('oat') ||
      mod.name.toLowerCase().includes('whole')
  );
  if (milkOptions.length > 1) {
    return { valid: false, reason: 'Only one milk option can be selected' };
  }

  return { valid: true };
}

/**
 * Get icon for modification type
 */
export function getModificationIcon(type: CartItemModification['type']): string {
  switch (type) {
    case 'size':
      return 'format-size';
    case 'temperature':
      return 'device-thermostat';
    case 'addition':
      return 'add-circle-outline';
    case 'removal':
      return 'remove-circle-outline';
    case 'substitution':
      return 'swap-horizontal';
    case 'preparation':
      return 'chef-hat';
    default:
      return 'tune';
  }
}

/**
 * Sort modifications by type order and name
 */
export function sortModifications(modifications: CartItemModification[]): CartItemModification[] {
  if (!modifications) return [];

  const typeOrder: Record<string, number> = {
    size: 1,
    temperature: 2,
    addition: 3,
    removal: 4,
    substitution: 5,
    preparation: 6,
  };

  return [...modifications].sort((a, b) => {
    // First sort by type priority
    const aOrder = typeOrder[a.type] || 999;
    const bOrder = typeOrder[b.type] || 999;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // Then by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Check if two modification sets are equal
 */
export function areModificationsEqual(
  mods1: CartItemModification[],
  mods2: CartItemModification[]
): boolean {
  const serialize1 = serializeModifications(mods1);
  const serialize2 = serializeModifications(mods2);
  return serialize1 === serialize2;
}

/**
 * Validate modifications array
 */
export function validateModifications(modifications: any[]): boolean {
  if (!modifications) return false;

  return modifications.every((mod) => {
    return (
      mod.id && typeof mod.price === 'number' && (!mod.quantity || typeof mod.quantity === 'number')
    );
  });
}
