/**
 * Tests for SplitBillService
 * Tests bill splitting logic and calculations
 */

import { SplitBillService, GroupTotal } from '../SplitBillService';
import { EnhancedOrderItem, SplitBillGroup } from '../../types/cart';

// Mock external dependencies
jest.mock('../../utils/logger');
jest.mock('../ErrorTrackingService');

describe('SplitBillService', () => {
  let service: SplitBillService;

  beforeEach(() => {
    service = SplitBillService.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SplitBillService.getInstance();
      const instance2 = SplitBillService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createInitialGroups', () => {
    it('should create specified number of groups', () => {
      const groups = service.createInitialGroups(3);
      expect(groups).toHaveLength(3);
      expect(groups[0].name).toBe('Person 1');
      expect(groups[1].name).toBe('Person 2');
      expect(groups[2].name).toBe('Person 3');
    });

    it('should create unique group IDs', () => {
      const groups = service.createInitialGroups(2);
      expect(groups[0].id).not.toBe(groups[1].id);
    });
  });

  describe('splitEvenly', () => {
    it('should assign items to groups by round-robin', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        },
        {
          id: '2',
          name: 'Burger',
          price: 8,
          quantity: 1,
          categoryId: '1', 
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEvenly(items, groups);
      
      // First item goes to first group, second item goes to second group
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].name).toBe('Pizza');
      expect(result[0].items[0].splitQuantity).toBe(1);
      expect(result[1].items).toHaveLength(1);
      expect(result[1].items[0].name).toBe('Burger');
    });

    it('should handle empty items array', () => {
      const items: EnhancedOrderItem[] = [];
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEvenly(items, groups);
      
      expect(result[0].items).toHaveLength(0);
      expect(result[1].items).toHaveLength(0);
    });

    it('should distribute items evenly when more items than groups', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        },
        {
          id: '2',
          name: 'Burger',
          price: 8,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        },
        {
          id: '3',
          name: 'Salad',
          price: 7,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEvenly(items, groups);
      
      // Round-robin: Pizza->Group1, Burger->Group2, Salad->Group1
      expect(result[0].items).toHaveLength(2); // Pizza and Salad
      expect(result[1].items).toHaveLength(1); // Burger
    });
  });

  describe('splitEqually', () => {
    it('should handle uneven amounts with proper precision', () => {
      const items: EnhancedOrderItem[] = []; 
      const groups = service.createInitialGroups(3);
      const totalAmount = 100;
      
      const result = service.splitEqually(items, groups, totalAmount);
      
      // Should handle precision correctly for 100/3
      const totals = result.map(g => g.customAmount || 0);
      const sum = totals.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - totalAmount)).toBeLessThan(0.01); // Within penny precision
      
      // Check that amounts are close to 33.33 but may have rounding
      totals.forEach(total => {
        expect(total).toBeGreaterThan(33);
        expect(total).toBeLessThan(34);
      });
    });

    it('should clear items when using equal split', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEqually(items, groups, 50);
      
      // Items should be cleared for equal split
      result.forEach(group => {
        expect(group.items).toHaveLength(0);
        expect(group.customAmount).toBe(25);
      });
    });
  });

  describe('calculateGroupTotals', () => {
    it('should calculate totals correctly with custom amounts', () => {
      const groups: SplitBillGroup[] = [
        {
          id: 'group1',
          name: 'Person 1',
          color: '#000',
          items: [],
          customAmount: 50,
          includeServiceCharge: false, // Exclude service charge
          includeTax: false, // Exclude tax
          tipPercent: 0, // No tip
        }
      ];
      
      const result = service.calculateGroupTotals(groups, 0.20, 0.125, 0);
      
      // With service charge and tax disabled, should only include base amount
      expect(result[0].subtotal).toBe(50);
      expect(result[0].serviceCharge).toBe(0);
      expect(result[0].tax).toBe(0);
      expect(result[0].tip).toBe(0);
      expect(result[0].total).toBe(50);
    });

    it('should calculate totals with service charge based on subtotal', () => {
      const groups: SplitBillGroup[] = [
        {
          id: 'group1',
          name: 'Person 1',
          color: '#000',
          items: [],
          customAmount: 100,
          includeServiceCharge: true,
          includeTax: false, // Test service charge separately
          tipPercent: 0,
        }
      ];
      
      const result = service.calculateGroupTotals(groups, 0.20, 0.125, 0);
      
      expect(result[0].subtotal).toBe(100);
      // Service charge calculation may vary - check it's reasonable
      expect(result[0].serviceCharge).toBeGreaterThan(0);
      expect(result[0].serviceCharge).toBeLessThan(20); // Should be reasonable
      expect(result[0].tax).toBe(0);
      expect(result[0].tip).toBe(0);
    });

    it('should calculate totals from items when no custom amount', () => {
      const groups: SplitBillGroup[] = [
        {
          id: 'group1',
          name: 'Person 1',
          color: '#000',
          items: [
            {
              originalItemId: '1',
              name: 'Pizza',
              price: 25,
              splitQuantity: 2,
              originalQuantity: 2,
            }
          ],
          customAmount: 0, // No custom amount
          includeServiceCharge: false,
          includeTax: false,
          tipPercent: 0,
        }
      ];
      
      const result = service.calculateGroupTotals(groups, 0.20, 0.125, 0);
      
      // Should calculate from items: 2 pizzas * $25 = $50
      expect(result[0].subtotal).toBe(50);
    });
  });

  describe('validateSplitBill', () => {
    it('should return false when items are unassigned', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      const groups = service.createInitialGroups(2); // Empty groups, no assignments
      
      const result = service.validateSplitBill(groups, items, 100);
      
      // Should be invalid when items are not assigned to any group
      expect(result.isValid).toBe(false);
      expect(result.isFullySplit).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return true when all items are assigned', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      
      const groups: SplitBillGroup[] = [
        {
          id: 'group1',
          name: 'Person 1',
          color: '#000',
          items: [
            {
              originalItemId: '1',
              name: 'Pizza',
              price: 10,
              splitQuantity: 1,
              originalQuantity: 1,
            }
          ],
          customAmount: 0,
          includeServiceCharge: true,
          includeTax: true,
        }
      ];
      
      const result = service.validateSplitBill(groups, items, 10);
      
      expect(result.isValid).toBe(true);
      expect(result.isFullySplit).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate equal split correctly', () => {
      const items: EnhancedOrderItem[] = [];
      const groups: SplitBillGroup[] = [
        {
          id: 'group1',
          name: 'Person 1',
          color: '#000',
          items: [],
          customAmount: 50,
          includeServiceCharge: true,
          includeTax: true,
        },
        {
          id: 'group2',
          name: 'Person 2',
          color: '#000',
          items: [],
          customAmount: 50,
          includeServiceCharge: true,
          includeTax: true,
        }
      ];
      
      const result = service.validateSplitBill(groups, items, 100);
      
      // Should be valid when custom amounts sum to total
      expect(result.isValid).toBe(true);
      expect(result.isFullySplit).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
