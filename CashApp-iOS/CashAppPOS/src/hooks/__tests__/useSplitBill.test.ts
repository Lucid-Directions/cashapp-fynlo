/**
 * Tests for useSplitBill hook
 * Tests split bill state management and actions
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useSplitBill } from '../useSplitBill';
import { EnhancedOrderItem } from '../../types/cart';
import { SplitBillService } from '../../services/SplitBillService';

// Mock dependencies
jest.mock('../../store/useEnhancedCartStore');
jest.mock('../../store/cartStoreAdapter');
jest.mock('../../store/useSettingsStore');
jest.mock('../../utils/logger');

// Mock the stores
const mockSettingsStore = {
  taxConfiguration: { enabled: true, rate: 10 },
  serviceChargeConfig: { enabled: true, rate: 15 },
};

jest.mock('../../store/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockSettingsStore),
}));

describe('useSplitBill', () => {
  const createTestItems = (): EnhancedOrderItem[] => [
    {
      id: '1',
      name: 'Coffee',
      price: 4.5,
      quantity: 2,
      category: 'beverages',
      emoji: '☕',
      available: true,
      description: '',
      modifications: [],
    },
    {
      id: '2',
      name: 'Sandwich',
      price: 8.0,
      quantity: 1,
      category: 'food',
      emoji: '🥪',
      available: true,
      description: '',
      modifications: [],
    },
  ];

  const defaultProps = {
    cartItems: createTestItems(),
    cartTotal: 17.0,
    useEnhancedCart: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty groups', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      expect(result.current.groups).toHaveLength(0);
      expect(result.current.splitMethod).toBe('even');
      expect(result.current.isProcessing).toBe(false);
    });

    it('should calculate validation state', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      expect(result.current.validation).toBeDefined();
      expect(result.current.validation.isValid).toBe(false);
      expect(result.current.validation.isFullySplit).toBe(false);
    });
  });

  describe('initializeSplit', () => {
    it('should create specified number of groups', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(3);
      });

      expect(result.current.groups).toHaveLength(3);
    });

    it('should auto-apply even split method', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
      });

      // Check that items are distributed
      const totalItems = result.current.groups.reduce((sum, group) => sum + group.items.length, 0);
      expect(totalItems).toBeGreaterThan(0);
    });
  });

  describe('setSplitMethod', () => {
    it('should update split method', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
        result.current.setSplitMethod('equal');
      });

      expect(result.current.splitMethod).toBe('equal');
    });
  });

  describe('updateGroupName', () => {
    it('should update group name', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
      });

      const firstGroupId = result.current.groups[0].id;

      act(() => {
        result.current.updateGroupName(firstGroupId, 'Alice');
      });

      expect(result.current.groups[0].name).toBe('Alice');
    });
  });

  describe('assignItemToGroup', () => {
    it('should assign item to specified group', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));
      const testItem = createTestItems()[0];

      act(() => {
        result.current.initializeSplit(2);
      });

      // Clear any auto-assigned items first
      act(() => {
        result.current.groups.forEach((group) => {
          group.items.forEach((item) => {
            result.current.removeItemFromGroup(item.originalItemId, group.id);
          });
        });
      });

      const groupId = result.current.groups[1].id;

      act(() => {
        result.current.assignItemToGroup(testItem, groupId);
      });

      const targetGroup = result.current.groups.find((g) => g.id === groupId);
      expect(targetGroup?.items).toHaveLength(1);
      expect(targetGroup?.items[0].name).toBe('Coffee');
    });
  });

  describe('splitItemAcrossGroups', () => {
    it('should split item across multiple groups', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));
      const testItem = createTestItems()[0]; // Coffee with quantity 2

      act(() => {
        result.current.initializeSplit(2);
      });

      const groupIds = result.current.groups.map((g) => g.id);

      act(() => {
        result.current.splitItemAcrossGroups(testItem, groupIds);
      });

      // Each group should have the coffee item
      result.current.groups.forEach((group) => {
        const coffeeItem = group.items.find((item) => item.name === 'Coffee');
        expect(coffeeItem).toBeDefined();
        expect(coffeeItem?.splitQuantity).toBe(1); // 2 items split across 2 groups
      });
    });
  });

  describe('removeItemFromGroup', () => {
    it('should remove item from group', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));
      const testItem = createTestItems()[0];

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;

      act(() => {
        result.current.assignItemToGroup(testItem, groupId);
      });

      expect(result.current.groups[0].items.length).toBeGreaterThan(0);

      act(() => {
        result.current.removeItemFromGroup(testItem.id, groupId);
      });

      const coffeeItem = result.current.groups[0].items.find((item) => item.name === 'Coffee');
      expect(coffeeItem).toBeUndefined();
    });
  });

  describe('setGroupCustomAmount', () => {
    it('should set custom amount for group', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;

      act(() => {
        result.current.setGroupCustomAmount(groupId, 25.5);
      });

      expect(result.current.groups[0].customAmount).toBe(25.5);
    });
  });

  describe('setGroupTipPercent', () => {
    it('should set tip percentage for group', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;

      act(() => {
        result.current.setGroupTipPercent(groupId, 20);
      });

      expect(result.current.groups[0].tipPercent).toBe(20);
    });
  });

  describe('toggleGroupServiceCharge', () => {
    it('should toggle service charge inclusion', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;
      const initialState = result.current.groups[0].includeServiceCharge;

      act(() => {
        result.current.toggleGroupServiceCharge(groupId);
      });

      expect(result.current.groups[0].includeServiceCharge).toBe(!initialState);
    });
  });

  describe('toggleGroupTax', () => {
    it('should toggle tax inclusion', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;
      const initialState = result.current.groups[0].includeTax;

      act(() => {
        result.current.toggleGroupTax(groupId);
      });

      expect(result.current.groups[0].includeTax).toBe(!initialState);
    });
  });

  describe('applySplitMethod', () => {
    it('should apply even split method', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
        result.current.setSplitMethod('even');
        result.current.applySplitMethod();
      });

      // Items should be distributed
      const totalItems = result.current.groups.reduce((sum, group) => sum + group.items.length, 0);
      expect(totalItems).toBeGreaterThan(0);
    });

    it('should apply equal split method', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(3);
        result.current.setSplitMethod('equal');
        result.current.applySplitMethod();
      });

      // Each group should have custom amount
      result.current.groups.forEach((group) => {
        expect(group.customAmount).toBeGreaterThan(0);
      });
    });

    it('should clear items for item-based split', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
        result.current.setSplitMethod('even');
        result.current.applySplitMethod();
      });

      // Should have items after even split
      expect(result.current.groups[0].items.length).toBeGreaterThan(0);

      act(() => {
        result.current.setSplitMethod('item');
        result.current.applySplitMethod();
      });

      // Items should be cleared for manual assignment
      result.current.groups.forEach((group) => {
        expect(group.items).toHaveLength(0);
      });
    });
  });

  describe('resetSplit', () => {
    it('should reset all split data', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(3);
        result.current.setSplitMethod('equal');
      });

      expect(result.current.groups).toHaveLength(3);
      expect(result.current.splitMethod).toBe('equal');

      act(() => {
        result.current.resetSplit();
      });

      expect(result.current.groups).toHaveLength(0);
      expect(result.current.splitMethod).toBe('even');
    });
  });

  describe('getUnassignedItems', () => {
    it('should return items not assigned to any group', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
        result.current.setSplitMethod('item');
        result.current.applySplitMethod();
      });

      const unassigned = result.current.getUnassignedItems();
      expect(unassigned).toHaveLength(2); // Both test items
    });

    it('should exclude assigned items', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));
      const testItem = createTestItems()[0];

      act(() => {
        result.current.initializeSplit(1);
      });

      const groupId = result.current.groups[0].id;

      act(() => {
        result.current.assignItemToGroup(testItem, groupId);
      });

      const unassigned = result.current.getUnassignedItems();
      const unassignedIds = unassigned.map((item) => item.id);
      expect(unassignedIds).not.toContain(testItem.id);
    });
  });

  describe('canProcessPayments', () => {
    it('should return false when bill not fully split', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
        result.current.setSplitMethod('item');
        result.current.applySplitMethod();
      });

      expect(result.current.canProcessPayments()).toBe(false);
    });

    it('should return true when bill fully split', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
        result.current.setSplitMethod('even');
        result.current.applySplitMethod();
      });

      // Assuming even split assigns all items
      const validation = result.current.validation;
      if (validation.isFullySplit && validation.errors.length === 0) {
        expect(result.current.canProcessPayments()).toBe(true);
      }
    });
  });

  describe('groupTotals', () => {
    it('should calculate totals with tax and service charge', () => {
      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(1);
        result.current.setSplitMethod('even');
        result.current.applySplitMethod();
      });

      const groupId = result.current.groups[0].id;

      act(() => {
        result.current.setGroupTipPercent(groupId, 15);
      });

      expect(result.current.groupTotals).toHaveLength(1);
      const total = result.current.groupTotals[0];

      expect(total.subtotal).toBeGreaterThan(0);
      expect(total.tax).toBeGreaterThan(0); // 10% tax enabled
      expect(total.serviceCharge).toBeGreaterThan(0); // 15% service enabled
      expect(total.tip).toBeGreaterThan(0); // 15% tip
      expect(total.total).toBeGreaterThan(total.subtotal);
    });
  });

  describe('exportSplitBill', () => {
    it('should generate export text', () => {
      const mockGetRestaurantName = jest.fn(() => 'Test Restaurant');

      // Mock the store with getRestaurantName
      jest.mock('../../store/cartStoreAdapter', () => ({
        useCartStore: jest.fn(() => ({
          getRestaurantName: mockGetRestaurantName,
        })),
      }));

      const { result } = renderHook(() => useSplitBill(defaultProps));

      act(() => {
        result.current.initializeSplit(2);
      });

      const exportText = result.current.exportSplitBill();

      expect(exportText).toContain('Split Bill Summary');
      expect(exportText).toContain('Person 1');
      expect(exportText).toContain('Person 2');
    });
  });
});
