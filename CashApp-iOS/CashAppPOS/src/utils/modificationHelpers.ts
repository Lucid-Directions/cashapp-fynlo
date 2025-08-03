/**
 * Helper utilities for cart item modifications
 * Provides formatting, display, and conversion functions
 */

import { 
  CartItemModification, 
  EnhancedOrderItem 
} from '../types/cart';

/**
 * Format modification list for display in cart
 * Returns a concise summary of selected modifications
 */
export function formatModificationSummary(
  modifications: CartItemModification[],
  maxLength: number = 50
): string {
  const selected = modifications.filter(mod => mod.selected);
  if (selected.length === 0) return '';
  
  // Group by type for better organization
  const byType: Record<string, string[]> = {};
  
  selected.forEach(mod => {
    const key = mod.type === 'custom' ? mod.category : mod.type;
    if (!byType[key]) byType[key] = [];
    
    const name = mod.quantity && mod.quantity > 1 
      ? `${mod.quantity}x ${mod.name}`
      : mod.name;
    byType[key].push(name);
  });
  
  // Build summary
  const parts: string[] = [];
  
  // Order: size, temperature, additions, removals, custom
  const typeOrder = ['size', 'temperature', 'addition', 'removal', 'custom'];
  
  typeOrder.forEach(type => {
    if (byType[type]) {
      parts.push(...byType[type]);
    }
  });
  
  // Handle other types not in order
  Object.keys(byType).forEach(type => {
    if (!typeOrder.includes(type)) {
      parts.push(...byType[type]);
    }
  });
  
  const summary = parts.join(', ');
  
  // Truncate if too long
  if (summary.length > maxLength) {
    return summary.substring(0, maxLength - 3) + '...';
  }
  
  return summary;
}

/**
 * Calculate the total modification price for an item
 * Including quantity multipliers
 */
export function calculateTotalModificationPrice(
  modifications: CartItemModification[]
): number {
  return modifications
    .filter(mod => mod.selected)
    .reduce((total, mod) => {
      const quantity = mod.quantity || 1;
      return total + (mod.price * quantity);
    }, 0);
}

/**
 * Get a display-friendly price string for modifications
 */
export function formatModificationPrice(price: number): string {
  if (price === 0) return '';
  
  const sign = price > 0 ? '+' : '';
  return `${sign}$${Math.abs(price).toFixed(2)}`;
}

/**
 * Check if an item has any modifications
 */
export function hasModifications(item: EnhancedOrderItem): boolean {
  return (
    item.modifications.some(mod => mod.selected) ||
    !!item.specialInstructions
  );
}

/**
 * Get modification count for display (e.g., badge)
 */
export function getModificationCount(item: EnhancedOrderItem): number {
  const modCount = item.modifications.filter(mod => mod.selected).length;
  const hasInstructions = !!item.specialInstructions ? 1 : 0;
  return modCount + hasInstructions;
}

/**
 * Convert modifications to a shareable format
 * Useful for duplicating items or sharing between components
 */
export function serializeModifications(
  modifications: CartItemModification[]
): string {
  const selected = modifications.filter(mod => mod.selected);
  return JSON.stringify(
    selected.map(mod => ({
      id: mod.id,
      name: mod.name,
      price: mod.price,
      quantity: mod.quantity
    }))
  );
}

/**
 * Parse serialized modifications back to full format
 */
export function deserializeModifications(
  serialized: string,
  availableModifications: CartItemModification[]
): CartItemModification[] {
  try {
    const selected = JSON.parse(serialized);
    
    return availableModifications.map(mod => {
      const savedMod = selected.find((s: any) => s.id === mod.id);
      if (savedMod) {
        return {
          ...mod,
          selected: true,
          quantity: savedMod.quantity || mod.quantity
        };
      }
      return { ...mod, selected: false };
    });
  } catch {
    return availableModifications;
  }
}

/**
 * Group modifications by category for display
 */
export function groupModificationsByCategory(
  modifications: CartItemModification[]
): Record<string, CartItemModification[]> {
  return modifications.reduce((acc, mod) => {
    if (!acc[mod.category]) {
      acc[mod.category] = [];
    }
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, CartItemModification[]>);
}

/**
 * Get a color for modification display based on type
 */
export function getModificationTypeColor(
  type: CartItemModification['type'],
  theme: any
): string {
  switch (type) {
    case 'size':
      return theme.colors.info || '#2196F3';
    case 'temperature':
      return theme.colors.warning || '#FF9800';
    case 'addition':
      return theme.colors.success || '#4CAF50';
    case 'removal':
      return theme.colors.error || '#F44336';
    case 'custom':
    default:
      return theme.colors.primary || '#007AFF';
  }
}

/**
 * Validate if a modification combination is allowed
 */
export function isModificationCombinationValid(
  modifications: CartItemModification[]
): { valid: boolean; reason?: string } {
  const selected = modifications.filter(mod => mod.selected);
  
  // Check for multiple exclusive selections
  const exclusiveTypes = ['size', 'temperature'];
  const milkMods = selected.filter(mod => mod.category === 'Milk Options');
  
  for (const type of exclusiveTypes) {
    const typeCount = selected.filter(mod => mod.type === type).length;
    if (typeCount > 1) {
      return { 
        valid: false, 
        reason: `Only one ${type} option can be selected` 
      };
    }
  }
  
  if (milkMods.length > 1) {
    return { 
      valid: false, 
      reason: 'Only one milk option can be selected' 
    };
  }
  
  return { valid: true };
}

/**
 * Get icon name for modification type
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
    case 'custom':
    default:
      return 'tune';
  }
}

/**
 * Sort modifications for consistent display order
 */
export function sortModifications(
  modifications: CartItemModification[]
): CartItemModification[] {
  const typeOrder = ['size', 'temperature', 'addition', 'removal', 'custom'];
  
  return [...modifications].sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.type);
    const bIndex = typeOrder.indexOf(b.type);
    
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    
    // Within same type, sort by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Check if two modification sets are equivalent
 */
export function areModificationsEqual(
  mods1: CartItemModification[],
  mods2: CartItemModification[]
): boolean {
  if (mods1.length !== mods2.length) return false;
  
  const selected1 = mods1.filter(m => m.selected).sort((a, b) => a.id.localeCompare(b.id));
  const selected2 = mods2.filter(m => m.selected).sort((a, b) => a.id.localeCompare(b.id));
  
  if (selected1.length !== selected2.length) return false;
  
  return selected1.every((mod1, index) => {
    const mod2 = selected2[index];
    return (
      mod1.id === mod2.id &&
      mod1.quantity === mod2.quantity
    );
  });
}