/**
 * Enhanced cart store with backward compatibility
 * Extends the existing useAppStore with new cart features
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

import ErrorTrackingService from '../services/ErrorTrackingService';
import type { AppState, User, PosSession, OrderItem, Order } from '../types';
import type {
  EnhancedOrderItem,
  CartTemplate,
  SplitBillConfig,
  CartHistoryEntry,
  EnhancedCartState,
  CartItemModification,
  SplitBillGroup,
} from '../types/cart';
import {
  migrateCart,
  recalculateItemPricing,
  generateUUID,
  validateUniqueIds,
} from '../utils/cartMigration';
import {
  isEnhancedOrderItem,
  cartNeedsMigration,
  validateCartIntegrity,
} from '../utils/cartTypeGuards';
import { calculateItemTotal, calculateSum } from '../utils/priceValidation';

// Extend the base AppStore interface with enhanced cart features
interface EnhancedAppStore extends Omit<AppState, 'cart'>, EnhancedCartState {
  // Keep existing user/session state
  user: User | null;
  session: PosSession | null;
  currentOrder: Order | null;
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;

  // Keep existing service charge state
  serviceChargePercentage: number;
  addTransactionFee: boolean;

  // User actions (unchanged)
  setUser: (user: User | null) => void;
  logout: () => void;
  setSession: (session: PosSession | null) => void;

  // Enhanced cart actions (replacing old ones)
  addToCart: (item: OrderItem | EnhancedOrderItem) => void;
  removeFromCart: (itemId: string | number) => void;
  updateCartItem: (itemId: string | number, updates: Partial<EnhancedOrderItem>) => void;
  clearCart: () => void;
  cleanCart: () => void;

  // New cart modification actions
  modifyCartItem: (itemId: string, modifications: CartItemModification[]) => void;
  setItemSpecialInstructions: (itemId: string, instructions: string) => void;
  duplicateCartItem: (itemId: string) => void;

  // Split bill actions
  initializeSplitBill: (splitType: SplitBillConfig['splitType'], numberOfSplits: number) => void;
  assignItemToSplitGroup: (itemId: string, groupId: string) => void;
  removeItemFromSplitGroup: (itemId: string) => void;
  updateSplitGroup: (groupId: string, updates: Partial<SplitBillGroup>) => void;
  completeSplitPayment: (groupId: string, paymentDetails: any) => void;
  cancelSplitBill: () => void;

  // Template actions
  saveCartAsTemplate: (name: string, description: string, tags?: string[]) => void;
  loadTemplate: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  updateTemplateUsage: (templateId: string) => void;

  // Bulk operations
  selectCartItem: (itemId: string) => void;
  unselectCartItem: (itemId: string) => void;
  selectAllItems: () => void;
  unselectAllItems: () => void;
  applyBulkDiscount: (percentage: number) => void;
  removeBulkItems: () => void;

  // History/Undo actions
  undoCartAction: () => void;
  redoCartAction: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Order actions (unchanged)
  setCurrentOrder: (order: Order | null) => void;

  // Service charge actions (unchanged)
  setServiceChargePercentage: (percentage: number) => void;
  setAddTransactionFee: (add: boolean) => void;

  // App state actions (unchanged)
  setOnlineStatus: (isOnline: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Enhanced computed values
  cartTotal: () => number;
  cartItemCount: () => number;
  calculateServiceCharge: () => number;
  calculateTransactionFee: () => number;
  calculateOrderTotal: () => number;
  getSelectedItems: () => EnhancedOrderItem[];
  getSplitGroupTotal: (groupId: string) => number;

  // Migration helper
  migrateCartIfNeeded: () => void;
}

// Helper to convert old OrderItem to EnhancedOrderItem
function convertToEnhancedItem(
  item: OrderItem | EnhancedOrderItem,
  userId?: string
): EnhancedOrderItem {
  if (isEnhancedOrderItem(item)) {
    return item;
  }

  const now = new Date().toISOString();
  return {
    id: item.id.toString(),
    productId: item.id.toString(),
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    emoji: item.emoji,
    modifications: [],
    originalPrice: item.price,
    modificationPrice: 0,
    totalPrice: item.price * item.quantity,
    addedAt: now,
    lastModified: now,
    addedBy: userId,
  };
}

// Helper to add to cart history
function addToHistory(
  get: () => EnhancedAppStore,
  set: (state: Partial<EnhancedAppStore>) => void,
  action: string
) {
  const state = get();
  const userId = state.user?.id || 'anonymous';
  const userName = state.user?.name || 'Anonymous';

  const historyEntry: CartHistoryEntry = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    action,
    cartBefore: [...state.cart],
    cartAfter: [...state.cart], // Will be updated after action
    itemsAdded: [],
    itemsRemoved: [],
    itemsModified: [],
    userId,
    userName,
  };

  // Limit history size
  const newHistory = [...state.cartHistory.slice(0, state.historyIndex + 1), historyEntry];
  if (newHistory.length > state.maxHistorySize) {
    newHistory.shift();
  }

  set({
    cartHistory: newHistory,
    historyIndex: newHistory.length - 1,
  });
}

const useEnhancedCartStore = create<EnhancedAppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        session: null,
        cart: [],
        currentOrder: null,
        serviceChargePercentage: 10,
        addTransactionFee: false,
        isOnline: true,
        isLoading: false,
        error: null,

        // Enhanced cart state
        templates: [],
        recentTemplates: [],
        splitBillConfig: null,
        cartHistory: [],
        historyIndex: -1,
        maxHistorySize: 20,
        selectedItemIds: [],
        isModificationModalOpen: false,
        isSplitBillModalOpen: false,
        isTemplateModalOpen: false,
        activeItemId: null,

        // User actions
        setUser: (user) => set({ user }),
        logout: () =>
          set({
            user: null,
            session: null,
            cart: [],
            currentOrder: null,
            splitBillConfig: null,
            selectedItemIds: [],
            cartHistory: [],
            historyIndex: -1,
          }),
        setSession: (session) => set({ session }),

        // Enhanced cart actions
        addToCart: (newItem) =>
          set((state) => {
            const userId = state.user?.id;
            const enhancedItem = convertToEnhancedItem(newItem, userId);

            // Validate the item
            if (
              !enhancedItem.name ||
              typeof enhancedItem.price !== 'number' ||
              typeof enhancedItem.quantity !== 'number'
            ) {
              ErrorTrackingService.getInstance().trackError(
                new Error('Invalid item being added to cart'),
                { item: newItem }
              );
              return state;
            }

            // Check for existing item
            const existingIndex = state.cart.findIndex((item) => item.id === enhancedItem.id);

            let newCart: EnhancedOrderItem[];
            if (existingIndex >= 0) {
              // Update quantity of existing item
              newCart = [...state.cart];
              newCart[existingIndex] = {
                ...newCart[existingIndex],
                quantity: newCart[existingIndex].quantity + enhancedItem.quantity,
                lastModified: new Date().toISOString(),
              };
              newCart[existingIndex] = recalculateItemPricing(newCart[existingIndex]);
            } else {
              // Add new item
              newCart = [...state.cart, enhancedItem];
            }

            // Add to history
            const historyEntry: CartHistoryEntry = {
              id: generateUUID(),
              timestamp: new Date().toISOString(),
              action:
                existingIndex >= 0
                  ? `Updated ${enhancedItem.name} quantity`
                  : `Added ${enhancedItem.name}`,
              cartBefore: [...state.cart],
              cartAfter: newCart,
              itemsAdded: existingIndex >= 0 ? [] : [enhancedItem.id],
              itemsRemoved: [],
              itemsModified: existingIndex >= 0 ? [enhancedItem.id] : [],
              userId: userId || 'anonymous',
              userName: state.user?.name || 'Anonymous',
            };

            const newHistory = [
              ...state.cartHistory.slice(0, state.historyIndex + 1),
              historyEntry,
            ];

            return {
              cart: newCart,
              cartHistory: newHistory.slice(-state.maxHistorySize),
              historyIndex: newHistory.length - 1,
            };
          }),

        removeFromCart: (itemId) =>
          set((state) => {
            const stringId = itemId.toString();
            const removedItem = state.cart.find((item) => item.id === stringId);
            if (!removedItem) return state;

            const newCart = state.cart.filter((item) => item.id !== stringId);

            // Remove from split groups if needed
            let newSplitConfig = state.splitBillConfig;
            if (newSplitConfig) {
              newSplitConfig = {
                ...newSplitConfig,
                groups: newSplitConfig.groups.map((group) => ({
                  ...group,
                  itemIds: group.itemIds.filter((id) => id !== stringId),
                })),
                unassignedItemIds: newSplitConfig.unassignedItemIds.filter((id) => id !== stringId),
              };
            }

            // Add to history
            const historyEntry: CartHistoryEntry = {
              id: generateUUID(),
              timestamp: new Date().toISOString(),
              action: `Removed ${removedItem.name}`,
              cartBefore: [...state.cart],
              cartAfter: newCart,
              itemsAdded: [],
              itemsRemoved: [stringId],
              itemsModified: [],
              userId: state.user?.id || 'anonymous',
              userName: state.user?.name || 'Anonymous',
            };

            const newHistory = [
              ...state.cartHistory.slice(0, state.historyIndex + 1),
              historyEntry,
            ];

            return {
              cart: newCart,
              splitBillConfig: newSplitConfig,
              selectedItemIds: state.selectedItemIds.filter((id) => id !== stringId),
              cartHistory: newHistory.slice(-state.maxHistorySize),
              historyIndex: newHistory.length - 1,
            };
          }),

        updateCartItem: (itemId, updates) =>
          set((state) => {
            const stringId = itemId.toString();
            const itemIndex = state.cart.findIndex((item) => item.id === stringId);
            if (itemIndex === -1) return state;

            const newCart = [...state.cart];
            newCart[itemIndex] = {
              ...newCart[itemIndex],
              ...updates,
              lastModified: new Date().toISOString(),
              modifiedBy: state.user?.id,
            };

            // Recalculate pricing if needed
            if (
              updates.quantity ||
              updates.price ||
              updates.originalPrice ||
              updates.modifications
            ) {
              newCart[itemIndex] = recalculateItemPricing(newCart[itemIndex]);
            }

            return { cart: newCart };
          }),

        clearCart: () =>
          set((state) => {
            if (state.cart.length === 0) return state;

            const historyEntry: CartHistoryEntry = {
              id: generateUUID(),
              timestamp: new Date().toISOString(),
              action: 'Cleared cart',
              cartBefore: [...state.cart],
              cartAfter: [],
              itemsAdded: [],
              itemsRemoved: state.cart.map((item) => item.id),
              itemsModified: [],
              userId: state.user?.id || 'anonymous',
              userName: state.user?.name || 'Anonymous',
            };

            const newHistory = [...state.cartHistory, historyEntry];

            return {
              cart: [],
              splitBillConfig: null,
              selectedItemIds: [],
              cartHistory: newHistory.slice(-state.maxHistorySize),
              historyIndex: newHistory.length - 1,
            };
          }),

        cleanCart: () =>
          set((state) => {
            const validCart = state.cart.filter(
              (item) =>
                isEnhancedOrderItem(item) &&
                item.quantity > 0 &&
                isFinite(item.price) &&
                isFinite(item.totalPrice)
            );

            if (validCart.length === state.cart.length) return state;

            return { cart: validCart };
          }),

        // New modification actions
        modifyCartItem: (itemId, modifications) =>
          set((state) => {
            const itemIndex = state.cart.findIndex((item) => item.id === itemId);
            if (itemIndex === -1) return state;

            const newCart = [...state.cart];
            newCart[itemIndex] = {
              ...newCart[itemIndex],
              modifications,
              lastModified: new Date().toISOString(),
              modifiedBy: state.user?.id,
            };

            // Recalculate pricing
            newCart[itemIndex] = recalculateItemPricing(newCart[itemIndex]);

            return { cart: newCart };
          }),

        setItemSpecialInstructions: (itemId, instructions) =>
          set((state) => {
            const itemIndex = state.cart.findIndex((item) => item.id === itemId);
            if (itemIndex === -1) return state;

            const newCart = [...state.cart];
            newCart[itemIndex] = {
              ...newCart[itemIndex],
              specialInstructions: instructions,
              lastModified: new Date().toISOString(),
              modifiedBy: state.user?.id,
            };

            return { cart: newCart };
          }),

        duplicateCartItem: (itemId) =>
          set((state) => {
            const itemToDuplicate = state.cart.find((item) => item.id === itemId);
            if (!itemToDuplicate) return state;

            const duplicatedItem: EnhancedOrderItem = {
              ...itemToDuplicate,
              id: generateUUID(),
              addedAt: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              addedBy: state.user?.id,
            };

            return { cart: [...state.cart, duplicatedItem] };
          }),

        // Split bill actions
        initializeSplitBill: (splitType, numberOfSplits) =>
          set((state) => {
            const groups: SplitBillGroup[] = Array.from({ length: numberOfSplits }, (_, i) => ({
              id: generateUUID(),
              name: `Split ${i + 1}`,
              color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD'][i % 5],
              emoji: ['🔴', '🟢', '🔵', '🟡', '🟣'][i % 5],
              itemIds: [],
              subtotal: 0,
              serviceCharge: 0,
              serviceChargePercentage: state.serviceChargePercentage,
              tax: 0,
              taxPercentage: 0,
              total: 0,
              paymentStatus: 'pending',
              createdAt: new Date().toISOString(),
            }));

            const config: SplitBillConfig = {
              id: generateUUID(),
              splitType,
              numberOfSplits,
              groups,
              unassignedItemIds: state.cart.map((item) => item.id),
              originalTotal: get().cartTotal(),
              currentTotal: get().cartTotal(),
              totalPaid: 0,
              remainingBalance: get().cartTotal(),
              allowPartialPayments: true,
              requireAllGroupsPaid: false,
              autoAssignServiceCharge: true,
              createdAt: new Date().toISOString(),
              createdBy: state.user?.id || 'anonymous',
            };

            return {
              splitBillConfig: config,
              isSplitBillModalOpen: true,
            };
          }),

        assignItemToSplitGroup: (itemId, groupId) =>
          set((state) => {
            if (!state.splitBillConfig) return state;

            const newConfig = { ...state.splitBillConfig };

            // Remove from unassigned or other groups
            newConfig.unassignedItemIds = newConfig.unassignedItemIds.filter((id) => id !== itemId);
            newConfig.groups = newConfig.groups.map((group) => ({
              ...group,
              itemIds:
                group.id === groupId
                  ? [...group.itemIds.filter((id) => id !== itemId), itemId]
                  : group.itemIds.filter((id) => id !== itemId),
            }));

            // Update group totals
            // This would need to recalculate based on items

            return { splitBillConfig: newConfig };
          }),

        removeItemFromSplitGroup: (itemId) =>
          set((state) => {
            if (!state.splitBillConfig) return state;

            const newConfig = { ...state.splitBillConfig };

            // Remove from all groups and add to unassigned
            newConfig.groups = newConfig.groups.map((group) => ({
              ...group,
              itemIds: group.itemIds.filter((id) => id !== itemId),
            }));

            if (!newConfig.unassignedItemIds.includes(itemId)) {
              newConfig.unassignedItemIds.push(itemId);
            }

            return { splitBillConfig: newConfig };
          }),

        updateSplitGroup: (groupId, updates) =>
          set((state) => {
            if (!state.splitBillConfig) return state;

            const newConfig = {
              ...state.splitBillConfig,
              groups: state.splitBillConfig.groups.map((group) =>
                group.id === groupId ? { ...group, ...updates } : group
              ),
            };

            return { splitBillConfig: newConfig };
          }),

        completeSplitPayment: (groupId, paymentDetails) =>
          set((state) => {
            if (!state.splitBillConfig) return state;

            const newConfig = {
              ...state.splitBillConfig,
              groups: state.splitBillConfig.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      paymentStatus: 'completed',
                      paymentDetails,
                      paidAt: new Date().toISOString(),
                      paidBy: state.user?.id,
                    }
                  : group
              ),
            };

            // Update total paid
            const totalPaid = newConfig.groups
              .filter((g) => g.paymentStatus === 'completed')
              .reduce((sum, g) => sum + g.total, 0);

            newConfig.totalPaid = totalPaid;
            newConfig.remainingBalance = newConfig.currentTotal - totalPaid;

            if (newConfig.remainingBalance <= 0) {
              newConfig.completedAt = new Date().toISOString();
            }

            return { splitBillConfig: newConfig };
          }),

        cancelSplitBill: () => set({ splitBillConfig: null, isSplitBillModalOpen: false }),

        // Template actions
        saveCartAsTemplate: (name, description, tags = []) =>
          set((state) => {
            if (state.cart.length === 0) return state;

            const template: CartTemplate = {
              id: generateUUID(),
              name,
              description,
              emoji: '📋',
              items: [...state.cart],
              createdAt: new Date().toISOString(),
              createdBy: state.user?.id || 'anonymous',
              useCount: 0,
              isPublic: false,
              tags,
            };

            return {
              templates: [...state.templates, template],
              isTemplateModalOpen: false,
            };
          }),

        loadTemplate: (templateId) =>
          set((state) => {
            const template = state.templates.find((t) => t.id === templateId);
            if (!template) return state;

            // Clone template items with new IDs and timestamps
            const now = new Date().toISOString();
            const newItems = template.items.map((item) => ({
              ...item,
              id: generateUUID(),
              addedAt: now,
              lastModified: now,
              addedBy: state.user?.id,
            }));

            // Update template usage
            const updatedTemplates = state.templates.map((t) =>
              t.id === templateId ? { ...t, useCount: t.useCount + 1, lastUsed: now } : t
            );

            // Update recent templates
            const recentTemplates = [
              templateId,
              ...state.recentTemplates.filter((id) => id !== templateId),
            ].slice(0, 5);

            return {
              cart: newItems,
              templates: updatedTemplates,
              recentTemplates,
              isTemplateModalOpen: false,
            };
          }),

        deleteTemplate: (templateId) =>
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== templateId),
            recentTemplates: state.recentTemplates.filter((id) => id !== templateId),
          })),

        updateTemplateUsage: (templateId) =>
          set((state) => {
            const now = new Date().toISOString();
            return {
              templates: state.templates.map((t) =>
                t.id === templateId ? { ...t, useCount: t.useCount + 1, lastUsed: now } : t
              ),
            };
          }),

        // Bulk operations
        selectCartItem: (itemId) =>
          set((state) => ({
            selectedItemIds: [...state.selectedItemIds, itemId],
          })),

        unselectCartItem: (itemId) =>
          set((state) => ({
            selectedItemIds: state.selectedItemIds.filter((id) => id !== itemId),
          })),

        selectAllItems: () =>
          set((state) => ({
            selectedItemIds: state.cart.map((item) => item.id),
          })),

        unselectAllItems: () => set({ selectedItemIds: [] }),

        applyBulkDiscount: (percentage) =>
          set((state) => {
            if (state.selectedItemIds.length === 0) return state;

            const discountMultiplier = 1 - percentage / 100;
            const newCart = state.cart.map((item) => {
              if (state.selectedItemIds.includes(item.id)) {
                const discountedItem = {
                  ...item,
                  originalPrice: item.originalPrice * discountMultiplier,
                  lastModified: new Date().toISOString(),
                  modifiedBy: state.user?.id,
                };
                return recalculateItemPricing(discountedItem);
              }
              return item;
            });

            return {
              cart: newCart,
              selectedItemIds: [],
            };
          }),

        removeBulkItems: () =>
          set((state) => {
            const newCart = state.cart.filter((item) => !state.selectedItemIds.includes(item.id));
            return {
              cart: newCart,
              selectedItemIds: [],
            };
          }),

        // History/Undo actions
        undoCartAction: () =>
          set((state) => {
            if (state.historyIndex <= 0) return state;

            const previousEntry = state.cartHistory[state.historyIndex - 1];
            return {
              cart: [...previousEntry.cartAfter],
              historyIndex: state.historyIndex - 1,
            };
          }),

        redoCartAction: () =>
          set((state) => {
            if (state.historyIndex >= state.cartHistory.length - 1) return state;

            const nextEntry = state.cartHistory[state.historyIndex + 1];
            return {
              cart: [...nextEntry.cartAfter],
              historyIndex: state.historyIndex + 1,
            };
          }),

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().cartHistory.length - 1,

        // Order actions
        setCurrentOrder: (currentOrder) => set({ currentOrder }),

        // Service charge actions
        setServiceChargePercentage: (percentage) => set({ serviceChargePercentage: percentage }),
        setAddTransactionFee: (add) => set({ addTransactionFee: add }),

        // App state actions
        setOnlineStatus: (isOnline) => set({ isOnline }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        // Enhanced computed values
        cartTotal: () => {
          const { cart } = get();
          try {
            const total = cart.reduce((sum, item) => {
              // Use the pre-calculated totalPrice for efficiency
              if (isFinite(item.totalPrice) && item.totalPrice >= 0) {
                return sum + item.totalPrice;
              }
              return sum;
            }, 0);

            return total;
          } catch (error) {
            ErrorTrackingService.getInstance().trackError(error, {
              context: 'cartTotal calculation',
            });
            return 0;
          }
        },

        cartItemCount: () => {
          const { cart } = get();
          return cart.reduce((count, item) => count + item.quantity, 0);
        },

        calculateServiceCharge: () => {
          const subtotal = get().cartTotal();
          const percentage = get().serviceChargePercentage;
          return (subtotal * percentage) / 100;
        },

        calculateTransactionFee: () => {
          const subtotal = get().cartTotal();
          const serviceCharge = get().calculateServiceCharge();
          const total = subtotal + serviceCharge;

          if (get().addTransactionFee) {
            // 2.9% + $0.30 for card transactions
            return total * 0.029 + 0.3;
          }
          return 0;
        },

        calculateOrderTotal: () => {
          const subtotal = get().cartTotal();
          const serviceCharge = get().calculateServiceCharge();
          const transactionFee = get().calculateTransactionFee();
          return subtotal + serviceCharge + transactionFee;
        },

        getSelectedItems: () => {
          const { cart, selectedItemIds } = get();
          return cart.filter((item) => selectedItemIds.includes(item.id));
        },

        getSplitGroupTotal: (groupId) => {
          const { cart, splitBillConfig } = get();
          if (!splitBillConfig) return 0;

          const group = splitBillConfig.groups.find((g) => g.id === groupId);
          if (!group) return 0;

          const groupItems = cart.filter((item) => group.itemIds.includes(item.id));
          const subtotal = groupItems.reduce((sum, item) => sum + item.totalPrice, 0);

          // Add service charge if auto-assigned
          if (splitBillConfig.autoAssignServiceCharge) {
            const serviceCharge = (subtotal * group.serviceChargePercentage) / 100;
            return subtotal + serviceCharge;
          }

          return subtotal;
        },

        // Migration helper
        migrateCartIfNeeded: () =>
          set((state) => {
            if (!cartNeedsMigration(state.cart)) {
              return state;
            }

            const migrationResult = migrateCart(state.cart as OrderItem[], state.user?.id);

            if (migrationResult.warnings.length > 0) {
              console.warn('Cart migration warnings:', migrationResult.warnings);
            }

            if (migrationResult.errors.length > 0) {
              console.error('Cart migration errors:', migrationResult.errors);
              ErrorTrackingService.getInstance().trackError(new Error('Cart migration failed'), {
                errors: migrationResult.errors,
                stats: migrationResult.stats,
              });
            }

            return {
              cart: migrationResult.migratedItems,
            };
          }),
      }),
      {
        name: 'enhanced-cart-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          cart: state.cart,
          serviceChargePercentage: state.serviceChargePercentage,
          addTransactionFee: state.addTransactionFee,
          templates: state.templates,
          recentTemplates: state.recentTemplates,
        }),
        onRehydrateStorage: () => (state) => {
          // Run migration after rehydration
          if (state) {
            state.migrateCartIfNeeded();
          }
        },
      }
    )
  )
);

export default useEnhancedCartStore;
