/**
 * Helper utilities for split bill functionality
 * Provides formatting, validation, and utility functions
 */

import { 
  SplitBillGroup, 
  SplitBillItem,
  SplitMethod,
  EnhancedOrderItem 
} from '../types/cart';
import { GroupTotal } from '../services/SplitBillService';

/**
 * Format a split bill group summary for display
 */
export function formatGroupSummary(
  group: SplitBillGroup,
  total: GroupTotal
): string {
  const parts: string[] = [];
  
  if (group.items.length > 0) {
    parts.push(`${group.items.length} items`);
  }
  
  if (group.customAmount > 0) {
    parts.push('custom amount');
  }
  
  if (total.tip > 0) {
    parts.push(`${group.tipPercent}% tip`);
  }
  
  return parts.join(', ');
}

/**
 * Calculate the split percentage for a group
 */
export function calculateGroupPercentage(
  groupTotal: number,
  billTotal: number
): number {
  if (billTotal === 0) return 0;
  return Math.round((groupTotal / billTotal) * 100);
}

/**
 * Get a descriptive name for a split method
 */
export function getSplitMethodDescription(method: SplitMethod): string {
  switch (method) {
    case 'even':
      return 'Split items evenly among all groups';
    case 'equal':
      return 'Split the total amount equally';
    case 'item':
      return 'Assign specific items to each person';
    case 'custom':
      return 'Custom split with manual adjustments';
    default:
      return 'Unknown split method';
  }
}

/**
 * Check if an item is fully assigned across groups
 */
export function isItemFullyAssigned(
  item: EnhancedOrderItem,
  groups: SplitBillGroup[]
): boolean {
  const totalAssigned = groups.reduce((sum, group) => {
    const splitItem = group.items.find(si => si.originalItemId === item.id);
    return sum + (splitItem?.splitQuantity || 0);
  }, 0);
  
  return totalAssigned >= item.quantity;
}

/**
 * Check if an item is partially assigned
 */
export function isItemPartiallyAssigned(
  item: EnhancedOrderItem,
  groups: SplitBillGroup[]
): boolean {
  const totalAssigned = groups.reduce((sum, group) => {
    const splitItem = group.items.find(si => si.originalItemId === item.id);
    return sum + (splitItem?.splitQuantity || 0);
  }, 0);
  
  return totalAssigned > 0 && totalAssigned < item.quantity;
}

/**
 * Get the groups that have a specific item
 */
export function getGroupsWithItem(
  itemId: string,
  groups: SplitBillGroup[]
): SplitBillGroup[] {
  return groups.filter(group =>
    group.items.some(item => item.originalItemId === itemId)
  );
}

/**
 * Calculate remaining quantity for an item
 */
export function getRemainingItemQuantity(
  item: EnhancedOrderItem,
  groups: SplitBillGroup[]
): number {
  const totalAssigned = groups.reduce((sum, group) => {
    const splitItem = group.items.find(si => si.originalItemId === item.id);
    return sum + (splitItem?.splitQuantity || 0);
  }, 0);
  
  return Math.max(0, item.quantity - totalAssigned);
}

/**
 * Validate if a group can pay their portion
 */
export function canGroupPay(
  group: SplitBillGroup,
  total: GroupTotal
): boolean {
  // Check if group has items or custom amount
  if (group.items.length === 0 && group.customAmount === 0) {
    return false;
  }
  
  // Check if total is positive
  return total.total > 0;
}

/**
 * Generate a share message for a group
 */
export function generateGroupShareMessage(
  group: SplitBillGroup,
  total: GroupTotal,
  restaurantName: string
): string {
  const lines: string[] = [];
  
  lines.push(`${restaurantName} - Split Bill`);
  lines.push(`Your portion (${group.name}):`);
  lines.push('');
  
  if (group.items.length > 0) {
    lines.push('Items:');
    group.items.forEach(item => {
      lines.push(`• ${item.name} (${item.splitQuantity}x)`);
    });
    lines.push('');
  }
  
  lines.push(`Subtotal: £${total.subtotal.toFixed(2)}`);
  
  if (total.tax > 0) {
    lines.push(`Tax: £${total.tax.toFixed(2)}`);
  }
  
  if (total.serviceCharge > 0) {
    lines.push(`Service: £${total.serviceCharge.toFixed(2)}`);
  }
  
  if (total.tip > 0) {
    lines.push(`Tip: £${total.tip.toFixed(2)}`);
  }
  
  lines.push(`Total: £${total.total.toFixed(2)}`);
  
  return lines.join('\n');
}

/**
 * Get suggested tip amounts for a subtotal
 */
export function getSuggestedTipAmounts(subtotal: number): Array<{
  percentage: number;
  amount: number;
}> {
  const percentages = [10, 15, 18, 20, 25];
  
  return percentages.map(percentage => ({
    percentage,
    amount: subtotal * (percentage / 100)
  }));
}

/**
 * Format split item quantity for display
 */
export function formatSplitQuantity(item: SplitBillItem): string {
  if (item.splitQuantity === item.originalQuantity) {
    return `${item.splitQuantity}x`;
  }
  
  // Check if it's a clean fraction
  const fraction = item.splitQuantity / item.originalQuantity;
  
  if (fraction === 0.5) {
    return `½ of ${item.originalQuantity}`;
  } else if (fraction === 0.33 || fraction === 1/3) {
    return `⅓ of ${item.originalQuantity}`;
  } else if (fraction === 0.25) {
    return `¼ of ${item.originalQuantity}`;
  } else if (fraction === 0.67 || fraction === 2/3) {
    return `⅔ of ${item.originalQuantity}`;
  } else if (fraction === 0.75) {
    return `¾ of ${item.originalQuantity}`;
  }
  
  // Default to decimal
  return `${item.splitQuantity} of ${item.originalQuantity}`;
}

/**
 * Validate split bill before processing
 */
export function validateSplitBill(
  groups: SplitBillGroup[],
  cartTotal: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if there are groups
  if (groups.length === 0) {
    errors.push('No split groups created');
  }
  
  // Check if all groups have valid names
  groups.forEach((group, index) => {
    if (!group.name || group.name.trim() === '') {
      errors.push(`Group ${index + 1} needs a name`);
    }
  });
  
  // Check if at least one group has items or custom amount
  const hasAnyAssignment = groups.some(
    group => group.items.length > 0 || group.customAmount > 0
  );
  
  if (!hasAnyAssignment) {
    errors.push('No items or amounts assigned to any group');
  }
  
  // Check for negative custom amounts
  groups.forEach(group => {
    if (group.customAmount < 0) {
      errors.push(`${group.name} has a negative custom amount`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get a color scheme for split bill visualization
 */
export function getSplitBillColorScheme(): string[] {
  return [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Sky Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint Green
    '#F7DC6F', // Sunflower Yellow
    '#BB8FCE', // Lavender Purple
    '#85C1E2', // Light Blue
    '#F8B4D9', // Pink
    '#82E0AA', // Light Green
  ];
}

/**
 * Calculate fair share for service charge and tax
 */
export function calculateFairShare(
  subtotal: number,
  totalSubtotal: number,
  feeAmount: number
): number {
  if (totalSubtotal === 0) return 0;
  const percentage = subtotal / totalSubtotal;
  return feeAmount * percentage;
}

/**
 * Determine if split method supports item assignment
 */
export function supportsItemAssignment(method: SplitMethod): boolean {
  return method === 'item' || method === 'custom';
}

/**
 * Determine if split method supports custom amounts
 */
export function supportsCustomAmount(method: SplitMethod): boolean {
  return method === 'equal' || method === 'custom';
}

/**
 * Generate a unique color for a new group
 */
export function generateGroupColor(existingColors: string[]): string {
  const allColors = getSplitBillColorScheme();
  
  // Find first unused color
  for (const color of allColors) {
    if (!existingColors.includes(color)) {
      return color;
    }
  }
  
  // If all colors used, return a random one
  return allColors[Math.floor(Math.random() * allColors.length)];
}