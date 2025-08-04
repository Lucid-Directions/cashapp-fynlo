/**
 * Service for managing split bill functionality
 * Handles bill splitting logic, calculations, and group management
 */

import { SplitBillGroup, SplitBillItem, SplitMethod, EnhancedOrderItem } from '../types/cart';
import { calculateSum, validatePrice, calculatePercentageFee } from '../utils/priceValidation';
import ErrorTrackingService from './ErrorTrackingService';
import { logger } from '../utils/logger';

export interface SplitBillCalculation {
  groups: SplitBillGroup[];
  totalAmount: number;
  remainingAmount: number;
  isFullySplit: boolean;
  errors: string[];
}

export interface GroupTotal {
  groupId: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  tip: number;
  total: number;
}

export class SplitBillService {
  private static instance: SplitBillService;

  private constructor() {}

  static getInstance(): SplitBillService {
    if (!SplitBillService.instance) {
      SplitBillService.instance = new SplitBillService();
    }
    return SplitBillService.instance;
  }

  /**
   * Create initial split bill groups
   */
  createInitialGroups(numberOfGroups: number): SplitBillGroup[] {
    return Array.from({ length: numberOfGroups }, (_, index) => ({
      id: `group-${Date.now()}-${index}`,
      name: `Person ${index + 1}`,
      color: this.getGroupColor(index),
      items: [],
      customAmount: 0,
      includeServiceCharge: true,
      includeTax: true,
      tipPercent: 0,
    }));
  }

  /**
   * Split items evenly among groups
   */
  splitEvenly(items: EnhancedOrderItem[], groups: SplitBillGroup[]): SplitBillGroup[] {
    if (groups.length === 0) return [];

    const updatedGroups = groups.map((group) => ({
      ...group,
      items: [] as SplitBillItem[],
    }));

    items.forEach((item, itemIndex) => {
      const groupIndex = itemIndex % groups.length;
      const splitItem = this.createSplitItem(item, 1, groups.length);
      updatedGroups[groupIndex].items.push(splitItem);
    });

    return updatedGroups;
  }

  /**
   * Split items equally by amount among groups
   */
  splitEqually(
    items: EnhancedOrderItem[],
    groups: SplitBillGroup[],
    totalAmount: number
  ): SplitBillGroup[] {
    if (groups.length === 0) return [];

    const amountPerGroup = totalAmount / groups.length;

    return groups.map((group) => ({
      ...group,
      customAmount: amountPerGroup,
      items: [], // Clear items for custom amount split
    }));
  }

  /**
   * Split a single item among multiple groups
   */
  splitItemAcrossGroups(
    item: EnhancedOrderItem,
    groupIds: string[],
    groups: SplitBillGroup[]
  ): SplitBillGroup[] {
    const splitQuantity = item.quantity / groupIds.length;

    return groups.map((group) => {
      if (!groupIds.includes(group.id)) {
        return group;
      }

      const splitItem = this.createSplitItem(item, splitQuantity, groupIds.length);

      // Check if item already exists in group
      const existingItemIndex = group.items.findIndex((si) => si.originalItemId === item.id);

      if (existingItemIndex >= 0) {
        // Update existing split item
        const updatedItems = [...group.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          splitQuantity: updatedItems[existingItemIndex].splitQuantity + splitQuantity,
        };
        return { ...group, items: updatedItems };
      } else {
        // Add new split item
        return {
          ...group,
          items: [...group.items, splitItem],
        };
      }
    });
  }

  /**
   * Assign an entire item to a specific group
   */
  assignItemToGroup(
    item: EnhancedOrderItem,
    groupId: string,
    groups: SplitBillGroup[]
  ): SplitBillGroup[] {
    return groups.map((group) => {
      if (group.id !== groupId) {
        // Remove item from other groups if it exists
        return {
          ...group,
          items: group.items.filter((si) => si.originalItemId !== item.id),
        };
      }

      const splitItem = this.createSplitItem(item, item.quantity, 1);

      // Replace or add the item
      const existingItemIndex = group.items.findIndex((si) => si.originalItemId === item.id);

      if (existingItemIndex >= 0) {
        const updatedItems = [...group.items];
        updatedItems[existingItemIndex] = splitItem;
        return { ...group, items: updatedItems };
      } else {
        return {
          ...group,
          items: [...group.items, splitItem],
        };
      }
    });
  }

  /**
   * Remove an item from a group
   */
  removeItemFromGroup(itemId: string, groupId: string, groups: SplitBillGroup[]): SplitBillGroup[] {
    return groups.map((group) => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        items: group.items.filter((item) => item.originalItemId !== itemId),
      };
    });
  }

  /**
   * Calculate totals for each group
   */
  calculateGroupTotals(
    groups: SplitBillGroup[],
    taxRate: number,
    serviceChargeRate: number
  ): GroupTotal[] {
    return groups.map((group) => {
      let subtotal = 0;

      // Calculate items subtotal
      if (group.items.length > 0) {
        const itemPrices = group.items.map((item) => {
          const itemTotal = item.price * item.splitQuantity;
          return validatePrice(itemTotal, {
            operation: 'split_item_total',
            screenName: 'SplitBillService',
            inputValues: {
              itemId: item.originalItemId,
              price: item.price,
              quantity: item.splitQuantity,
            },
          }).isValid
            ? itemTotal
            : 0;
        });

        const itemsTotal = calculateSum(itemPrices, {
          operation: 'group_items_subtotal',
          screenName: 'SplitBillService',
        });

        subtotal = itemsTotal.isValid ? itemsTotal.value : 0;
      }

      // Use custom amount if set
      if (group.customAmount > 0) {
        subtotal = group.customAmount;
      }

      // Calculate tax
      const tax = group.includeTax
        ? calculatePercentageFee(subtotal, taxRate, {
            operation: 'split_bill_tax',
            screenName: 'SplitBillService',
          }).value
        : 0;

      // Calculate service charge
      const serviceCharge = group.includeServiceCharge
        ? calculatePercentageFee(subtotal, serviceChargeRate, {
            operation: 'split_bill_service_charge',
            screenName: 'SplitBillService',
          }).value
        : 0;

      // Calculate tip
      const tipBase = subtotal + tax + serviceCharge;
      const tip =
        group.tipPercent > 0
          ? calculatePercentageFee(tipBase, group.tipPercent, {
              operation: 'split_bill_tip',
              screenName: 'SplitBillService',
            }).value
          : 0;

      // Calculate total
      const total = calculateSum([subtotal, tax, serviceCharge, tip], {
        operation: 'group_total',
        screenName: 'SplitBillService',
      }).value;

      return {
        groupId: group.id,
        subtotal,
        tax,
        serviceCharge,
        tip,
        total,
      };
    });
  }

  /**
   * Validate split bill configuration
   */
  validateSplitBill(
    groups: SplitBillGroup[],
    cartItems: EnhancedOrderItem[],
    cartTotal: number
  ): SplitBillCalculation {
    const errors: string[] = [];

    try {
      // Check if all items are assigned
      const assignedItemIds = new Set<string>();
      let totalSplitQuantity = 0;

      groups.forEach((group) => {
        group.items.forEach((item) => {
          assignedItemIds.add(item.originalItemId);
          totalSplitQuantity += item.splitQuantity;
        });
      });

      // Check for unassigned items
      const unassignedItems = cartItems.filter((item) => !assignedItemIds.has(item.id));

      if (unassignedItems.length > 0 && !groups.some((g) => g.customAmount > 0)) {
        errors.push(`${unassignedItems.length} items not assigned to any group`);
      }

      // Check for over-split items
      cartItems.forEach((item) => {
        const totalAssigned = groups.reduce((sum, group) => {
          const splitItem = group.items.find((si) => si.originalItemId === item.id);
          return sum + (splitItem?.splitQuantity || 0);
        }, 0);

        if (totalAssigned > item.quantity) {
          errors.push(`"${item.name}" is over-assigned (${totalAssigned} > ${item.quantity})`);
        }
      });

      // Calculate remaining amount
      const groupTotals = this.calculateGroupTotals(groups, 0, 0); // Simplified for validation
      const totalAssigned = calculateSum(
        groupTotals.map((gt) => gt.total),
        { operation: 'total_assigned', screenName: 'SplitBillService' }
      ).value;

      const remainingAmount = Math.max(0, cartTotal - totalAssigned);

      return {
        groups,
        totalAmount: cartTotal,
        remainingAmount,
        isFullySplit: remainingAmount < 0.01, // Allow for rounding errors
        errors,
      };
    } catch (error) {
      logger.error('Split bill validation error:', error);
      ErrorTrackingService.getInstance().trackError(error, {
        context: 'validateSplitBill',
        groups,
        cartItems,
      });

      return {
        groups,
        totalAmount: cartTotal,
        remainingAmount: cartTotal,
        isFullySplit: false,
        errors: ['Validation error occurred'],
      };
    }
  }

  /**
   * Create a split bill item from an order item
   */
  private createSplitItem(
    item: EnhancedOrderItem,
    splitQuantity: number,
    splitCount: number
  ): SplitBillItem {
    return {
      id: `split-${item.id}-${Date.now()}`,
      originalItemId: item.id,
      name: item.name,
      price: item.price,
      originalQuantity: item.quantity,
      splitQuantity,
      splitCount,
      modifications: item.modifications,
      modificationPrice: item.modificationPrice,
      emoji: item.emoji,
    };
  }

  /**
   * Get a color for a group based on index
   */
  private getGroupColor(index: number): string {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Sky Blue
      '#F8B4D9', // Pink
      '#82E0AA', // Green
    ];

    return colors[index % colors.length];
  }

  /**
   * Generate a payment summary for a group
   */
  generateGroupSummary(group: SplitBillGroup, total: GroupTotal): string {
    const lines: string[] = [];

    lines.push(`**${group.name}**`);

    if (group.items.length > 0) {
      lines.push('Items:');
      group.items.forEach((item) => {
        const itemTotal = item.price * item.splitQuantity;
        lines.push(`• ${item.name} (${item.splitQuantity}x) - £${itemTotal.toFixed(2)}`);
      });
    }

    if (group.customAmount > 0) {
      lines.push(`Custom amount: £${group.customAmount.toFixed(2)}`);
    }

    lines.push('');
    lines.push(`Subtotal: £${total.subtotal.toFixed(2)}`);

    if (total.tax > 0) {
      lines.push(`Tax: £${total.tax.toFixed(2)}`);
    }

    if (total.serviceCharge > 0) {
      lines.push(`Service charge: £${total.serviceCharge.toFixed(2)}`);
    }

    if (total.tip > 0) {
      lines.push(`Tip (${group.tipPercent}%): £${total.tip.toFixed(2)}`);
    }

    lines.push(`**Total: £${total.total.toFixed(2)}**`);

    return lines.join('\n');
  }

  /**
   * Export split bill data for sharing
   */
  exportSplitBill(groups: SplitBillGroup[], totals: GroupTotal[], restaurantName: string): string {
    const lines: string[] = [];

    lines.push(`Split Bill - ${restaurantName}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push('='.repeat(40));
    lines.push('');

    groups.forEach((group, index) => {
      const total = totals.find((t) => t.groupId === group.id);
      if (total) {
        lines.push(this.generateGroupSummary(group, total));
        if (index < groups.length - 1) {
          lines.push('');
          lines.push('-'.repeat(30));
          lines.push('');
        }
      }
    });

    lines.push('');
    lines.push('='.repeat(40));

    const grandTotal = calculateSum(
      totals.map((t) => t.total),
      { operation: 'export_grand_total', screenName: 'SplitBillService' }
    ).value;

    lines.push(`Grand Total: £${grandTotal.toFixed(2)}`);

    return lines.join('\n');
  }
}
