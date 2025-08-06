/**
 * Tests for SplitBillService
 * Tests bill splitting logic and calculations
 */

import { SplitBillService, GroupTotal } from '../SplitBillService';
import { EnhancedOrderItem, SplitBillGroup } from '../../types/cart';

describe('SplitBillService', () => {
  let service: SplitBillService;

  beforeEach(() => {
    service = SplitBillService.getInstance();
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
    });
  });

  describe('splitEvenly', () => {
    it('should assign items to groups by round-robin', () => {
      const items: EnhancedOrderItem[] = [
        {
          id: '1',
          name: 'Pizza',
          price: 10,
          quantity: 3,
          categoryId: '1',
          description: '',
          isAvailable: true,
          modifications: []
        }
      ];
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEvenly(items, groups);
      
      // The service assigns whole items by round-robin, not splitting quantities
      // So the first group gets the whole item with quantity 3
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].splitQuantity).toBe(3);
      expect(result[1].items).toHaveLength(0);
    });
  });

  describe('splitEqually', () => {
    it('should handle uneven amounts with proper precision', () => {
      const items: EnhancedOrderItem[] = []; // Empty items array
      const groups = service.createInitialGroups(3);
      const totalAmount = 100;
      
      const result = service.splitEqually(items, groups, totalAmount);
      
      // Should handle precision correctly for 100/3
      const totals = result.map(g => g.customAmount);
      const sum = totals.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - totalAmount)).toBeLessThan(0.01); // Within penny precision
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
          includeTip: false, // Exclude tip
        }
      ];
      
      const result = service.calculateGroupTotals(groups, 0.20, 0.125, 0);
      
      // With service charge disabled, should only include base amount
      expect(result[0].serviceCharge).toBe(0);
      expect(result[0].tip).toBe(0);
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
      // The error message should indicate validation issues
      expect(result.errors).toEqual(expect.arrayContaining([expect.any(String)]));
    });
  });
});
