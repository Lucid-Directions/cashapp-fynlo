/**
 * Tests for split bill helper utilities
 * Tests formatting, validation, and utility functions
 */

import {
  formatGroupSummary,
  calculateGroupPercentage,
  getSplitMethodDescription,
  isItemFullyAssigned,
  isItemPartiallyAssigned,
  getGroupsWithItem,
  getRemainingItemQuantity,
  canGroupPay,
  generateGroupShareMessage,
  getSuggestedTipAmounts,
  formatSplitQuantity,
  validateSplitBill,
  getSplitBillColorScheme,
  calculateFairShare,
  supportsItemAssignment,
  supportsCustomAmount,
  generateGroupColor,
} from '../splitBillHelpers';
import { SplitBillGroup, EnhancedOrderItem, SplitBillItem } from '../../types/cart';
import { GroupTotal } from '../../services/SplitBillService';

describe('splitBillHelpers', () => {
  const createTestGroup = (overrides?: Partial<SplitBillGroup>): SplitBillGroup => ({
    id: '1',
    name: 'Person 1',
    color: '#FF0000',
    items: [],
    customAmount: 0,
    tipPercent: 0,
    includeServiceCharge: true,
    includeTax: true,
    ...overrides,
  });

  const createTestItem = (overrides?: Partial<EnhancedOrderItem>): EnhancedOrderItem => ({
    id: '1',
    name: 'Coffee',
    price: 5.0,
    quantity: 2,
    category: 'beverages',
    emoji: '☕',
    available: true,
    description: '',
    modifications: [],
    ...overrides,
  });

  const createTestGroupTotal = (overrides?: Partial<GroupTotal>): GroupTotal => ({
    groupId: '1',
    subtotal: 10.0,
    tax: 1.0,
    serviceCharge: 1.5,
    tip: 2.0,
    total: 14.5,
    ...overrides,
  });

  describe('formatGroupSummary', () => {
    it('should format group with items', () => {
      const group = createTestGroup({
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 5,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '☕',
          },
          {
            id: '2',
            originalItemId: '2',
            name: 'Cake',
            price: 4,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '🍰',
          },
        ],
      });
      const total = createTestGroupTotal();

      const summary = formatGroupSummary(group, total);
      expect(summary).toContain('2 items');
    });

    it('should include custom amount', () => {
      const group = createTestGroup({
        customAmount: 25.0,
      });
      const total = createTestGroupTotal();

      const summary = formatGroupSummary(group, total);
      expect(summary).toContain('custom amount');
    });

    it('should include tip percentage', () => {
      const group = createTestGroup({
        tipPercent: 20,
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 5,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '☕',
          },
        ],
      });
      const total = createTestGroupTotal({ tip: 1.0 });

      const summary = formatGroupSummary(group, total);
      expect(summary).toContain('20% tip');
    });

    it('should combine multiple elements', () => {
      const group = createTestGroup({
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 5,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '☕',
          },
        ],
        customAmount: 10.0,
        tipPercent: 15,
      });
      const total = createTestGroupTotal({ tip: 1.5 });

      const summary = formatGroupSummary(group, total);
      expect(summary).toBe('1 items, custom amount, 15% tip');
    });
  });

  describe('calculateGroupPercentage', () => {
    it('should calculate percentage correctly', () => {
      const percentage = calculateGroupPercentage(25, 100);
      expect(percentage).toBe(25);
    });

    it('should round to nearest integer', () => {
      const percentage = calculateGroupPercentage(33.33, 100);
      expect(percentage).toBe(33);
    });

    it('should handle zero total', () => {
      const percentage = calculateGroupPercentage(25, 0);
      expect(percentage).toBe(0);
    });
  });

  describe('getSplitMethodDescription', () => {
    it('should return correct descriptions', () => {
      expect(getSplitMethodDescription('even')).toBe('Split items evenly among all groups');
      expect(getSplitMethodDescription('equal')).toBe('Split the total amount equally');
      expect(getSplitMethodDescription('item')).toBe('Assign specific items to each person');
      expect(getSplitMethodDescription('custom')).toBe('Custom split with manual adjustments');
    });

    it('should handle unknown method', () => {
      expect(getSplitMethodDescription('unknown' as any)).toBe('Unknown split method');
    });
  });

  describe('isItemFullyAssigned', () => {
    it('should return true when all quantity assigned', () => {
      const item = createTestItem({ quantity: 2 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 2,
              splitQuantity: 2,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(isItemFullyAssigned(item, groups)).toBe(true);
    });

    it('should return true when split across groups', () => {
      const item = createTestItem({ quantity: 3 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          id: '1',
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 3,
              splitQuantity: 2,
              emoji: '☕',
            },
          ],
        }),
        createTestGroup({
          id: '2',
          items: [
            {
              id: 'split2',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 3,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(isItemFullyAssigned(item, groups)).toBe(true);
    });

    it('should return false when partially assigned', () => {
      const item = createTestItem({ quantity: 3 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 3,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(isItemFullyAssigned(item, groups)).toBe(false);
    });
  });

  describe('isItemPartiallyAssigned', () => {
    it('should return true when partially assigned', () => {
      const item = createTestItem({ quantity: 3 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 3,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(isItemPartiallyAssigned(item, groups)).toBe(true);
    });

    it('should return false when fully assigned', () => {
      const item = createTestItem({ quantity: 2 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 2,
              splitQuantity: 2,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(isItemPartiallyAssigned(item, groups)).toBe(false);
    });

    it('should return false when not assigned', () => {
      const item = createTestItem();
      const groups: SplitBillGroup[] = [createTestGroup()];

      expect(isItemPartiallyAssigned(item, groups)).toBe(false);
    });
  });

  describe('getGroupsWithItem', () => {
    it('should return groups containing the item', () => {
      const groups: SplitBillGroup[] = [
        createTestGroup({
          id: '1',
          items: [
            {
              id: 'split1',
              originalItemId: 'item1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 1,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
        createTestGroup({
          id: '2',
          items: [],
        }),
        createTestGroup({
          id: '3',
          items: [
            {
              id: 'split2',
              originalItemId: 'item1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 1,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      const result = getGroupsWithItem('item1', groups);
      expect(result).toHaveLength(2);
      expect(result.map((g) => g.id)).toEqual(['1', '3']);
    });

    it('should return empty array when item not found', () => {
      const groups: SplitBillGroup[] = [createTestGroup()];
      const result = getGroupsWithItem('nonexistent', groups);
      expect(result).toHaveLength(0);
    });
  });

  describe('getRemainingItemQuantity', () => {
    it('should calculate remaining quantity', () => {
      const item = createTestItem({ quantity: 5 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 5,
              splitQuantity: 2,
              emoji: '☕',
            },
          ],
        }),
        createTestGroup({
          id: '2',
          items: [
            {
              id: 'split2',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 5,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(getRemainingItemQuantity(item, groups)).toBe(2);
    });

    it('should return 0 when over-assigned', () => {
      const item = createTestItem({ quantity: 2 });
      const groups: SplitBillGroup[] = [
        createTestGroup({
          items: [
            {
              id: 'split1',
              originalItemId: '1',
              name: 'Coffee',
              price: 5,
              originalQuantity: 2,
              splitQuantity: 3,
              emoji: '☕',
            },
          ],
        }),
      ];

      expect(getRemainingItemQuantity(item, groups)).toBe(0);
    });
  });

  describe('canGroupPay', () => {
    it('should return true when group has items', () => {
      const group = createTestGroup({
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 5,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '☕',
          },
        ],
      });
      const total = createTestGroupTotal({ total: 10 });

      expect(canGroupPay(group, total)).toBe(true);
    });

    it('should return true when group has custom amount', () => {
      const group = createTestGroup({ customAmount: 25 });
      const total = createTestGroupTotal({ total: 25 });

      expect(canGroupPay(group, total)).toBe(true);
    });

    it('should return false when group empty', () => {
      const group = createTestGroup();
      const total = createTestGroupTotal({ total: 0 });

      expect(canGroupPay(group, total)).toBe(false);
    });

    it('should return false when total is zero', () => {
      const group = createTestGroup({
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 0,
            originalQuantity: 1,
            splitQuantity: 1,
            emoji: '☕',
          },
        ],
      });
      const total = createTestGroupTotal({ total: 0 });

      expect(canGroupPay(group, total)).toBe(false);
    });
  });

  describe('generateGroupShareMessage', () => {
    it('should generate complete message', () => {
      const group = createTestGroup({
        tipPercent: 20,
        name: 'John',
        items: [
          {
            id: '1',
            originalItemId: '1',
            name: 'Coffee',
            price: 5,
            originalQuantity: 2,
            splitQuantity: 2,
            emoji: '☕',
          },
        ],
      });
      const total = createTestGroupTotal({
        subtotal: 10,
        tax: 1,
        serviceCharge: 1.5,
        tip: 2,
        total: 14.5,
      });

      const message = generateGroupShareMessage(group, total, 'Test Restaurant');

      expect(message).toContain('Test Restaurant - Split Bill');
      expect(message).toContain('Your portion (John)');
      expect(message).toContain('Coffee (2x)');
      expect(message).toContain('Subtotal: £10.00');
      expect(message).toContain('Tax: £1.00');
      expect(message).toContain('Service: £1.50');
      expect(message).toContain('Tip: £2.00');
      expect(message).toContain('Total: £14.50');
    });

    it('should exclude zero amounts', () => {
      const group = createTestGroup({ name: 'Alice' });
      const total = createTestGroupTotal({
        subtotal: 10,
        tax: 0,
        serviceCharge: 0,
        tip: 0,
        total: 10,
      });

      const message = generateGroupShareMessage(group, total, 'Restaurant');

      expect(message).not.toContain('Tax:');
      expect(message).not.toContain('Service:');
      expect(message).not.toContain('Tip:');
    });
  });

  describe('getSuggestedTipAmounts', () => {
    it('should return standard tip percentages', () => {
      const suggestions = getSuggestedTipAmounts(100);

      expect(suggestions).toHaveLength(5);
      expect(suggestions[0]).toEqual({ percentage: 10, amount: 10 });
      expect(suggestions[1]).toEqual({ percentage: 15, amount: 15 });
      expect(suggestions[2]).toEqual({ percentage: 18, amount: 18 });
      expect(suggestions[3]).toEqual({ percentage: 20, amount: 20 });
      expect(suggestions[4]).toEqual({ percentage: 25, amount: 25 });
    });

    it('should calculate correct amounts', () => {
      const suggestions = getSuggestedTipAmounts(50);

      expect(suggestions[0].amount).toBe(5);
      expect(suggestions[1].amount).toBe(7.5);
      expect(suggestions[2].amount).toBe(9);
      expect(suggestions[3].amount).toBe(10);
      expect(suggestions[4].amount).toBe(12.5);
    });
  });

  describe('formatSplitQuantity', () => {
    it('should format full quantity', () => {
      const item: SplitBillItem = {
        id: '1',
        originalItemId: '1',
        name: 'Coffee',
        price: 5,
        originalQuantity: 2,
        splitQuantity: 2,
        emoji: '☕',
      };

      expect(formatSplitQuantity(item)).toBe('2x');
    });

    it('should format half quantities', () => {
      const item: SplitBillItem = {
        id: '1',
        originalItemId: '1',
        name: 'Pizza',
        price: 20,
        originalQuantity: 2,
        splitQuantity: 1,
        emoji: '🍕',
      };

      expect(formatSplitQuantity(item)).toBe('½ of 2');
    });

    it('should format third quantities', () => {
      const item: SplitBillItem = {
        id: '1',
        originalItemId: '1',
        name: 'Pizza',
        price: 20,
        originalQuantity: 3,
        splitQuantity: 1,
        emoji: '🍕',
      };

      expect(formatSplitQuantity(item)).toBe('⅓ of 3');
    });

    it('should format custom fractions', () => {
      const item: SplitBillItem = {
        id: '1',
        originalItemId: '1',
        name: 'Pizza',
        price: 20,
        originalQuantity: 5,
        splitQuantity: 2,
        emoji: '🍕',
      };

      expect(formatSplitQuantity(item)).toBe('2 of 5');
    });
  });

  describe('validateSplitBill', () => {
    it('should pass validation for complete split', () => {
      const groups: SplitBillGroup[] = [
        createTestGroup({
          name: 'Alice',
          items: [
            {
              id: '1',
              originalItemId: '1',
              name: 'Coffee',
              price: 10,
              originalQuantity: 1,
              splitQuantity: 1,
              emoji: '☕',
            },
          ],
        }),
      ];

      const result = validateSplitBill(groups, 10);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with no groups', () => {
      const result = validateSplitBill([], 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No split groups created');
    });

    it('should fail with unnamed groups', () => {
      const groups: SplitBillGroup[] = [createTestGroup({ name: '' })];

      const result = validateSplitBill(groups, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Group 1 needs a name');
    });

    it('should fail with no assignments', () => {
      const groups: SplitBillGroup[] = [
        createTestGroup({ name: 'Alice' }),
        createTestGroup({ name: 'Bob' }),
      ];

      const result = validateSplitBill(groups, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No items or amounts assigned to any group');
    });

    it('should fail with negative custom amounts', () => {
      const groups: SplitBillGroup[] = [
        createTestGroup({
          name: 'Alice',
          customAmount: -10,
        }),
      ];

      const result = validateSplitBill(groups, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alice has a negative custom amount');
    });
  });

  describe('getSplitBillColorScheme', () => {
    it('should return array of colors', () => {
      const colors = getSplitBillColorScheme();

      expect(colors).toBeInstanceOf(Array);
      expect(colors.length).toBeGreaterThan(0);
      expect(colors[0]).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('calculateFairShare', () => {
    it('should calculate proportional share', () => {
      const share = calculateFairShare(25, 100, 20);
      expect(share).toBe(5); // 25% of 20
    });

    it('should handle zero total', () => {
      const share = calculateFairShare(25, 0, 20);
      expect(share).toBe(0);
    });
  });

  describe('supportsItemAssignment', () => {
    it('should return true for item and custom methods', () => {
      expect(supportsItemAssignment('item')).toBe(true);
      expect(supportsItemAssignment('custom')).toBe(true);
    });

    it('should return false for even and equal methods', () => {
      expect(supportsItemAssignment('even')).toBe(false);
      expect(supportsItemAssignment('equal')).toBe(false);
    });
  });

  describe('supportsCustomAmount', () => {
    it('should return true for equal and custom methods', () => {
      expect(supportsCustomAmount('equal')).toBe(true);
      expect(supportsCustomAmount('custom')).toBe(true);
    });

    it('should return false for even and item methods', () => {
      expect(supportsCustomAmount('even')).toBe(false);
      expect(supportsCustomAmount('item')).toBe(false);
    });
  });

  describe('generateGroupColor', () => {
    it('should return unused color', () => {
      const existingColors = ['#FF6B6B', '#4ECDC4'];
      const newColor = generateGroupColor(existingColors);

      expect(existingColors).not.toContain(newColor);
      expect(getSplitBillColorScheme()).toContain(newColor);
    });

    it('should return random color when all used', () => {
      const allColors = getSplitBillColorScheme();
      const newColor = generateGroupColor(allColors);

      expect(allColors).toContain(newColor);
    });
  });
});
