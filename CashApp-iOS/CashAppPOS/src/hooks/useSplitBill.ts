/**
 * Hook for managing split bill functionality
 * Provides state management and actions for bill splitting
 */

import { useState, useCallback, useMemo } from 'react';
import { SplitBillGroup, SplitMethod, EnhancedOrderItem } from '../types/cart';
import { SplitBillService, SplitBillCalculation, GroupTotal } from '../services/SplitBillService';
import useEnhancedCartStore from '../store/useEnhancedCartStore';
import { useCartStore } from '../store/cartStoreAdapter';
import useSettingsStore from '../store/useSettingsStore';
import { logger } from '../utils/logger';

interface UseSplitBillProps {
  cartItems: EnhancedOrderItem[];
  cartTotal: number;
  useEnhancedCart?: boolean;
}

interface UseSplitBillReturn {
  // State
  groups: SplitBillGroup[];
  splitMethod: SplitMethod;
  validation: SplitBillCalculation;
  groupTotals: GroupTotal[];
  isProcessing: boolean;

  // Actions
  initializeSplit: (numberOfGroups: number) => void;
  setSplitMethod: (method: SplitMethod) => void;
  updateGroupName: (groupId: string, name: string) => void;
  updateGroupColor: (groupId: string, color: string) => void;
  assignItemToGroup: (item: EnhancedOrderItem, groupId: string) => void;
  splitItemAcrossGroups: (item: EnhancedOrderItem, groupIds: string[]) => void;
  removeItemFromGroup: (itemId: string, groupId: string) => void;
  setGroupCustomAmount: (groupId: string, amount: number) => void;
  setGroupTipPercent: (groupId: string, percent: number) => void;
  toggleGroupServiceCharge: (groupId: string) => void;
  toggleGroupTax: (groupId: string) => void;
  applySplitMethod: () => void;
  resetSplit: () => void;

  // Helpers
  getUnassignedItems: () => EnhancedOrderItem[];
  getGroupByItem: (itemId: string) => SplitBillGroup | undefined;
  canProcessPayments: () => boolean;
  exportSplitBill: () => string;
}

export function useSplitBill({
  cartItems,
  cartTotal,
  useEnhancedCart = true,
}: UseSplitBillProps): UseSplitBillReturn {
  const splitBillService = SplitBillService.getInstance();
  const store = useCartStore(useEnhancedCart) as ReturnType<typeof useEnhancedCartStore>;
  const { taxConfiguration, serviceChargeConfig } = useSettingsStore();

  // State
  const [groups, setGroups] = useState<SplitBillGroup[]>([]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('even');
  const [isProcessing, setIsProcessing] = useState(false);

  // Tax and service charge rates
  const taxRate = taxConfiguration?.enabled ? taxConfiguration.rate || 0 : 0;
  const serviceChargeRate = serviceChargeConfig?.enabled ? serviceChargeConfig.rate || 0 : 0;

  // Calculate validation and totals
  const validation = useMemo(
    () => splitBillService.validateSplitBill(groups, cartItems, cartTotal),
    [groups, cartItems, cartTotal, splitBillService]
  );

  const groupTotals = useMemo(
    () => splitBillService.calculateGroupTotals(groups, taxRate, serviceChargeRate),
    [groups, taxRate, serviceChargeRate, splitBillService]
  );

  // Actions

  const initializeSplit = useCallback(
    (numberOfGroups: number) => {
      logger.info('Initializing split bill with groups:', numberOfGroups);
      const initialGroups = splitBillService.createInitialGroups(numberOfGroups);
      setGroups(initialGroups);

      // Auto-apply split method
      if (splitMethod === 'even') {
        setGroups(splitBillService.splitEvenly(cartItems, initialGroups));
      } else if (splitMethod === 'equal') {
        setGroups(splitBillService.splitEqually(cartItems, initialGroups, cartTotal));
      }
    },
    [cartItems, cartTotal, splitMethod, splitBillService]
  );

  const updateGroupName = useCallback((groupId: string, name: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, name } : group)));
  }, []);

  const updateGroupColor = useCallback((groupId: string, color: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, color } : group)));
  }, []);

  const assignItemToGroup = useCallback(
    (item: EnhancedOrderItem, groupId: string) => {
      logger.info('Assigning item to group:', { itemId: item.id, groupId });
      setGroups((prev) => splitBillService.assignItemToGroup(item, groupId, prev));
    },
    [splitBillService]
  );

  const splitItemAcrossGroups = useCallback(
    (item: EnhancedOrderItem, groupIds: string[]) => {
      logger.info('Splitting item across groups:', { itemId: item.id, groupIds });
      setGroups((prev) => splitBillService.splitItemAcrossGroups(item, groupIds, prev));
    },
    [splitBillService]
  );

  const removeItemFromGroup = useCallback(
    (itemId: string, groupId: string) => {
      logger.info('Removing item from group:', { itemId, groupId });
      setGroups((prev) => splitBillService.removeItemFromGroup(itemId, groupId, prev));
    },
    [splitBillService]
  );

  const setGroupCustomAmount = useCallback((groupId: string, amount: number) => {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, customAmount: amount } : group))
    );
  }, []);

  const setGroupTipPercent = useCallback((groupId: string, percent: number) => {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, tipPercent: percent } : group))
    );
  }, []);

  const toggleGroupServiceCharge = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, includeServiceCharge: !group.includeServiceCharge }
          : group
      )
    );
  }, []);

  const toggleGroupTax = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, includeTax: !group.includeTax } : group
      )
    );
  }, []);

  const applySplitMethod = useCallback(() => {
    logger.info('Applying split method:', splitMethod);

    switch (splitMethod) {
      case 'even':
        setGroups((prev) => splitBillService.splitEvenly(cartItems, prev));
        break;
      case 'equal':
        setGroups((prev) => splitBillService.splitEqually(cartItems, prev, cartTotal));
        break;
      case 'custom':
        // Custom method - items are manually assigned
        break;
      case 'item':
        // Item-based - clear all assignments for manual setup
        setGroups((prev) => prev.map((group) => ({ ...group, items: [] })));
        break;
    }
  }, [splitMethod, cartItems, cartTotal, splitBillService]);

  const resetSplit = useCallback(() => {
    logger.info('Resetting split bill');
    setGroups([]);
    setSplitMethod('even');
  }, []);

  // Helpers

  const getUnassignedItems = useCallback((): EnhancedOrderItem[] => {
    const assignedIds = new Set<string>();

    groups.forEach((group) => {
      group.items.forEach((item) => {
        assignedIds.add(item.originalItemId);
      });
    });

    return cartItems.filter((item) => !assignedIds.has(item.id));
  }, [groups, cartItems]);

  const getGroupByItem = useCallback(
    (itemId: string): SplitBillGroup | undefined => {
      return groups.find((group) => group.items.some((item) => item.originalItemId === itemId));
    },
    [groups]
  );

  const canProcessPayments = useCallback((): boolean => {
    return validation.isFullySplit && validation.errors.length === 0;
  }, [validation]);

  const exportSplitBill = useCallback((): string => {
    const restaurantName = store.getRestaurantName?.() || 'Restaurant';
    return splitBillService.exportSplitBill(groups, groupTotals, restaurantName);
  }, [groups, groupTotals, store, splitBillService]);

  // Process payments for groups
  const processGroupPayments = useCallback(async () => {
    if (!canProcessPayments()) {
      logger.error('Cannot process payments - split not valid');
      return;
    }

    setIsProcessing(true);

    try {
      // Save split bill configuration to store
      if (useEnhancedCart && store.setSplitBillGroups) {
        store.setSplitBillGroups(groups);
      }

      // TODO: Integrate with payment processing
      // For now, just log the split configuration
      logger.info('Split bill ready for payment:', {
        groups: groups.length,
        totals: groupTotals,
      });
    } catch (error) {
      logger.error('Failed to process split bill payments:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [groups, groupTotals, canProcessPayments, store, useEnhancedCart]);

  return {
    // State
    groups,
    splitMethod,
    validation,
    groupTotals,
    isProcessing,

    // Actions
    initializeSplit,
    setSplitMethod,
    updateGroupName,
    updateGroupColor,
    assignItemToGroup,
    splitItemAcrossGroups,
    removeItemFromGroup,
    setGroupCustomAmount,
    setGroupTipPercent,
    toggleGroupServiceCharge,
    toggleGroupTax,
    applySplitMethod,
    resetSplit,

    // Helpers
    getUnassignedItems,
    getGroupByItem,
    canProcessPayments,
    exportSplitBill,
  };
}
