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

    it('should create groups with default properties', () => {
      const groups = service.createInitialGroups(2);
      
      groups.forEach((group, index) => {
        expect(group.id).toBeTruthy();
        expect(group.name).toBe(`Person ${index + 1}`);
        expect(group.items).toEqual([]);
        expect(group.customAmount).toBe(0);
        expect(group.tipPercent).toBe(0);
        expect(group.includeServiceCharge).toBe(true);
        expect(group.includeTax).toBe(true);
      });
    });

    it('should assign unique colors to groups', () => {
      const groups = service.createInitialGroups(5);
      const colors = groups.map(g => g.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(5);
    });
  });

  describe('splitEvenly', () => {
    const createTestItems = (): EnhancedOrderItem[] => [
      {
        id: '1',
        name: 'Coffee',
        price: 4.50,
        quantity: 2,
        category: 'beverages',
        emoji: '☕',
        available: true,
        description: '',
        modifications: []
      },
      {
        id: '2',
        name: 'Sandwich',
        price: 8.00,
        quantity: 1,
        category: 'food',
        emoji: '🥪',
        available: true,
        description: '',
        modifications: []
      }
    ];

    it('should split items evenly among groups', () => {
      const items = createTestItems();
      const groups = service.createInitialGroups(2);
      
      const result = service.splitEvenly(items, groups);
      
      // First group should get coffee
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].name).toBe('Coffee');
      expect(result[0].items[0].splitQuantity).toBe(2);
      
      // Second group should get sandwich
      expect(result[1].items).toHaveLength(1);
      expect(result[1].items[0].name).toBe('Sandwich');
      expect(result[1].items[0].splitQuantity).toBe(1);
    });

    it('should handle items with multiple quantities', () => {
      const items: EnhancedOrderItem[] = [{
        id: '1',
        name: 'Pizza',
        price: 12.00,
        quantity: 4,
        category: 'food',
        emoji: '🍕',
        available: true,
        description: '',
        modifications: []
      }];
      
      const groups = service.createInitialGroups(4);
      const result = service.splitEvenly(items, groups);
      
      // Each group should get 1 pizza
      result.forEach(group => {
        expect(group.items).toHaveLength(1);
        expect(group.items[0].splitQuantity).toBe(1);
      });
    });
  });

  describe('splitEqually', () => {
    it('should split total amount equally among groups', () => {
      const items = [];
      const groups = service.createInitialGroups(3);
      const total = 90;
      
      const result = service.splitEqually(items, groups, total);
      
      // Each group should have 30
      result.forEach(group => {
        expect(group.customAmount).toBe(30);
      });
    });

    it('should handle uneven amounts', () => {
      const items = [];
      const groups = service.createInitialGroups(3);
      const total = 100;
      
      const result = service.splitEqually(items, groups, total);
      
      // First two groups get 33.34, last gets 33.32
      expect(result[0].customAmount).toBe(33.34);
      expect(result[1].customAmount).toBe(33.34);
      expect(result[2].customAmount).toBe(33.32);
    });
  });

  describe('assignItemToGroup', () => {
    it('should assign item to specified group', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        name: 'Coffee',
        price: 4.50,
        quantity: 1,
        category: 'beverages',
        emoji: '☕',
        available: true,
        description: '',
        modifications: []
      };
      
      const groups = service.createInitialGroups(2);
      const result = service.assignItemToGroup(item, groups[1].id, groups);
      
      expect(result[0].items).toHaveLength(0);
      expect(result[1].items).toHaveLength(1);
      expect(result[1].items[0].name).toBe('Coffee');
    });

    it('should remove item from other groups when reassigning', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        name: 'Coffee',
        price: 4.50,
        quantity: 1,
        category: 'beverages',
        emoji: '☕',
        available: true,
        description: '',
        modifications: []
      };
      
      let groups = service.createInitialGroups(2);
      groups = service.assignItemToGroup(item, groups[0].id, groups);
      groups = service.assignItemToGroup(item, groups[1].id, groups);
      
      expect(groups[0].items).toHaveLength(0);
      expect(groups[1].items).toHaveLength(1);
    });
  });

  describe('splitItemAcrossGroups', () => {
    it('should split item equally across selected groups', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        name: 'Pizza',
        price: 20.00,
        quantity: 4,
        category: 'food',
        emoji: '🍕',
        available: true,
        description: '',
        modifications: []
      };
      
      const groups = service.createInitialGroups(2);
      const result = service.splitItemAcrossGroups(
        item, 
        groups.map(g => g.id), 
        groups
      );
      
      // Each group should get 2 pizzas
      result.forEach(group => {
        expect(group.items).toHaveLength(1);
        expect(group.items[0].splitQuantity).toBe(2);
      });
    });

    it('should handle uneven splits', () => {
      const item: EnhancedOrderItem = {
        id: '1',
        name: 'Pizza',
        price: 20.00,
        quantity: 3,
        category: 'food',
        emoji: '🍕',
        available: true,
        description: '',
        modifications: []
      };
      
      const groups = service.createInitialGroups(2);
      const result = service.splitItemAcrossGroups(
        item, 
        groups.map(g => g.id), 
        groups
      );
      
      // One group gets 2, other gets 1
      const quantities = result.map(g => g.items[0]?.splitQuantity || 0);
      expect(quantities).toContain(2);
      expect(quantities).toContain(1);
      expect(quantities.reduce((a, b) => a + b, 0)).toBe(3);
    });
  });

  describe('calculateGroupTotals', () => {
    it('should calculate correct totals with tax and service', () => {
      const groups: SplitBillGroup[] = [{
        id: '1',
        name: 'Person 1',
        color: '#FF0000',
        items: [{
          id: 'item1',
          originalItemId: '1',
          name: 'Coffee',
          price: 10.00,
          originalQuantity: 1,
          splitQuantity: 1,
          emoji: '☕'
        }],
        customAmount: 0,
        tipPercent: 10,
        includeServiceCharge: true,
        includeTax: true
      }];
      
      const totals = service.calculateGroupTotals(groups, 10, 15);
      
      expect(totals).toHaveLength(1);
      expect(totals[0].subtotal).toBe(10.00);
      expect(totals[0].tax).toBe(1.00); // 10%
      expect(totals[0].serviceCharge).toBe(1.50); // 15%
      expect(totals[0].tip).toBe(1.00); // 10% of subtotal
      expect(totals[0].total).toBe(13.50);
    });

    it('should handle custom amounts', () => {
      const groups: SplitBillGroup[] = [{
        id: '1',
        name: 'Person 1',
        color: '#FF0000',
        items: [],
        customAmount: 25.00,
        tipPercent: 20,
        includeServiceCharge: true,
        includeTax: true
      }];
      
      const totals = service.calculateGroupTotals(groups, 10, 15);
      
      expect(totals[0].subtotal).toBe(25.00);
      expect(totals[0].tip).toBe(5.00); // 20% of 25
      expect(totals[0].total).toBe(30.00); // Custom amount + tip only
    });

    it('should exclude tax and service when disabled', () => {
      const groups: SplitBillGroup[] = [{
        id: '1',
        name: 'Person 1',
        color: '#FF0000',
        items: [{
          id: 'item1',
          originalItemId: '1',
          name: 'Coffee',
          price: 10.00,
          originalQuantity: 1,
          splitQuantity: 1,
          emoji: '☕'
        }],
        customAmount: 0,
        tipPercent: 0,
        includeServiceCharge: false,
        includeTax: false
      }];
      
      const totals = service.calculateGroupTotals(groups, 10, 15);
      
      expect(totals[0].subtotal).toBe(10.00);
      expect(totals[0].tax).toBe(0);
      expect(totals[0].serviceCharge).toBe(0);
      expect(totals[0].tip).toBe(0);
      expect(totals[0].total).toBe(10.00);
    });
  });

  describe('validateSplitBill', () => {
    const createTestGroups = (): SplitBillGroup[] => [
      {
        id: '1',
        name: 'Person 1',
        color: '#FF0000',
        items: [{
          id: 'item1',
          originalItemId: '1',
          name: 'Coffee',
          price: 10.00,
          originalQuantity: 1,
          splitQuantity: 1,
          emoji: '☕'
        }],
        customAmount: 0,
        tipPercent: 0,
        includeServiceCharge: true,
        includeTax: true
      },
      {
        id: '2',
        name: 'Person 2',
        color: '#00FF00',
        items: [{
          id: 'item2',
          originalItemId: '2',
          name: 'Sandwich',
          price: 15.00,
          originalQuantity: 1,
          splitQuantity: 1,
          emoji: '🥪'
        }],
        customAmount: 0,
        tipPercent: 0,
        includeServiceCharge: true,
        includeTax: true
      }
    ];

    const createTestItems = (): EnhancedOrderItem[] => [
      {
        id: '1',
        name: 'Coffee',
        price: 10.00,
        quantity: 1,
        category: 'beverages',
        emoji: '☕',
        available: true,
        description: '',
        modifications: []
      },
      {
        id: '2',
        name: 'Sandwich',
        price: 15.00,
        quantity: 1,
        category: 'food',
        emoji: '🥪',
        available: true,
        description: '',
        modifications: []
      }
    ];

    it('should validate fully split bill', () => {
      const groups = createTestGroups();
      const items = createTestItems();
      const total = 25.00;
      
      const result = service.validateSplitBill(groups, items, total);
      
      expect(result.isValid).toBe(true);
      expect(result.isFullySplit).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.remainingAmount).toBe(0);
    });

    it('should detect unassigned items', () => {
      const groups = createTestGroups();
      const items = [...createTestItems(), {
        id: '3',
        name: 'Dessert',
        price: 5.00,
        quantity: 1,
        category: 'food',
        emoji: '🍰',
        available: true,
        description: '',
        modifications: []
      }];
      const total = 30.00;
      
      const result = service.validateSplitBill(groups, items, total);
      
      expect(result.isValid).toBe(true);
      expect(result.isFullySplit).toBe(false);
      expect(result.unassignedItems).toHaveLength(1);
      expect(result.unassignedItems[0].name).toBe('Dessert');
    });

    it('should calculate remaining amount', () => {
      const groups: SplitBillGroup[] = [{
        id: '1',
        name: 'Person 1',
        color: '#FF0000',
        items: [],
        customAmount: 20.00,
        tipPercent: 0,
        includeServiceCharge: false,
        includeTax: false
      }];
      const items = [];
      const total = 50.00;
      
      const result = service.validateSplitBill(groups, items, total);
      
      expect(result.remainingAmount).toBe(30.00);
    });
  });

  describe('exportSplitBill', () => {
    it('should generate formatted export text', () => {
      const groups: SplitBillGroup[] = [{
        id: '1',
        name: 'John',
        color: '#FF0000',
        items: [{
          id: 'item1',
          originalItemId: '1',
          name: 'Coffee',
          price: 10.00,
          originalQuantity: 1,
          splitQuantity: 1,
          emoji: '☕'
        }],
        customAmount: 0,
        tipPercent: 10,
        includeServiceCharge: true,
        includeTax: true
      }];
      
      const totals: GroupTotal[] = [{
        groupId: '1',
        subtotal: 10.00,
        tax: 1.00,
        serviceCharge: 1.50,
        tip: 1.00,
        total: 13.50
      }];
      
      const result = service.exportSplitBill(groups, totals, 'Test Restaurant');
      
      expect(result).toContain('Test Restaurant - Split Bill Summary');
      expect(result).toContain('John');
      expect(result).toContain('Coffee');
      expect(result).toContain('£13.50');
    });
  });
});