import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryState, InventoryItem, InventoryLedgerEntry, StockMovement, CostAnalysis } from '../types';
import * as InventoryApiService from '../services/InventoryApiService';
import { inventoryWebSocketService, StockUpdateEvent, StockAlertEvent, SyncStatusEvent } from '../services/InventoryWebSocketService';
import { inventoryAuditService } from '../services/InventoryAuditService';
import { inventoryOfflineSync, SyncStatus } from '../services/InventoryOfflineSync';

// Define the store interface including actions
interface InventoryStore extends InventoryState {
  // Basic Actions
  setInventoryItems: (items: InventoryItem[]) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  updateMultipleInventoryItems: (items: InventoryItem[]) => void;
  addLedgerEntry: (entry: InventoryLedgerEntry) => void;
  setLedgerEntries: (entries: InventoryLedgerEntry[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLowStockThreshold: (threshold: number) => void;

  // Enhanced Actions for Modular System
  addInventoryItem: (item: Partial<InventoryItem>) => Promise<InventoryItem>;
  deleteInventoryItem: (sku: string) => Promise<void>;
  adjustStock: (sku: string, changeQty: number, reason?: string) => Promise<void>;
  updateWastePercentage: (sku: string, wastePercent: number) => Promise<void>;
  
  // Cost Analysis
  costAnalysis: CostAnalysis | null;
  loadCostAnalysis: () => Promise<void>;
  setCostAnalysis: (analysis: CostAnalysis) => void;

  // Stock Movements
  stockMovements: StockMovement[];
  loadStockMovements: (sku?: string) => Promise<void>;
  setStockMovements: (movements: StockMovement[]) => void;

  // Search and Filtering
  searchQuery: string;
  selectedCategory: string;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;

  // Async actions (thunks)
  loadInitialInventory: () => Promise<void>;
  refreshInventory: () => Promise<void>;

  // Real-time Sync & Audit
  syncStatus: SyncStatus;
  isRealTimeEnabled: boolean;
  stockAlerts: StockAlertEvent[];
  enableRealTimeSync: (userId: string, authToken: string) => Promise<void>;
  disableRealTimeSync: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  addStockAlert: (alert: StockAlertEvent) => void;
  clearStockAlert: (sku: string) => void;
  forceSync: () => Promise<void>;

  // Selectors / Computed values
  getLowStockItems: () => InventoryItem[];
  getOutOfStockItems: () => InventoryItem[];
  getFilteredItems: () => InventoryItem[];
  getItemBySku: (sku: string) => InventoryItem | undefined;
  getCategories: () => string[];
}

const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      inventoryItems: {},
      inventoryLedger: [],
      isLoadingInventory: false,
      inventoryError: null,
      lowStockThreshold: 0.10, // Default 10%
      
      // Enhanced state
      costAnalysis: null,
      stockMovements: [],
      searchQuery: '',
      selectedCategory: 'all',

      // Real-time sync state
      syncStatus: {
        isOnline: false,
        lastSyncTime: 0,
        pendingActions: 0,
        failedActions: 0,
        conflictActions: 0,
        syncInProgress: false,
      },
      isRealTimeEnabled: false,
      stockAlerts: [],

      // --- Synchronous Actions ---
      setInventoryItems: (items) => {
        const itemsBySku: { [sku: string]: InventoryItem } = {};
        items.forEach(item => {
          itemsBySku[item.sku] = item;
        });
        set({ inventoryItems: itemsBySku, isLoadingInventory: false, inventoryError: null });
      },

      updateInventoryItem: (item) => set((state) => ({
        inventoryItems: {
          ...state.inventoryItems,
          [item.sku]: item,
        },
        isLoadingInventory: false,
      })),

      updateMultipleInventoryItems: (items) => set((state) => {
        const updatedItems = { ...state.inventoryItems };
        items.forEach(item => {
          updatedItems[item.sku] = item;
        });
        return { inventoryItems: updatedItems, isLoadingInventory: false };
      }),

      addLedgerEntry: (entry) => set((state) => ({
        // Add to start for chronological order (newest first) if desired, or sort later
        inventoryLedger: [entry, ...state.inventoryLedger],
      })),

      setLedgerEntries: (entries) => set({
        inventoryLedger: entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()), // Sort newest first
      }),

      setLoading: (isLoading) => set({ isLoadingInventory: isLoading }),
      setError: (error) => set({ inventoryError: error, isLoadingInventory: false }),
      setLowStockThreshold: (threshold) => set({ lowStockThreshold: threshold }),

      // Enhanced Actions
      setCostAnalysis: (analysis) => set({ costAnalysis: analysis }),
      setStockMovements: (movements) => set({ stockMovements: movements }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),

      // Enhanced Async Actions
      addInventoryItem: async (item) => {
        try {
          set({ isLoadingInventory: true, inventoryError: null });
          const newItem = await InventoryApiService.createInventoryItem(item);
          get().updateInventoryItem(newItem);
          return newItem;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to create inventory item";
          set({ inventoryError: errorMsg });
          throw error;
        } finally {
          set({ isLoadingInventory: false });
        }
      },

      deleteInventoryItem: async (sku) => {
        try {
          set({ isLoadingInventory: true, inventoryError: null });
          await InventoryApiService.deleteInventoryItem(sku);
          set((state) => {
            const { [sku]: deleted, ...remaining } = state.inventoryItems;
            return { inventoryItems: remaining };
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to delete inventory item";
          set({ inventoryError: errorMsg });
          throw error;
        } finally {
          set({ isLoadingInventory: false });
        }
      },

      adjustStock: async (sku, changeQty, reason = "manual_adjustment") => {
        try {
          set({ isLoadingInventory: true, inventoryError: null });
          
          const state = get();
          const item = state.inventoryItems[sku];
          if (!item) {
            throw new Error(`Item with SKU ${sku} not found`);
          }

          const previousQuantity = item.qty_g;
          const newQuantity = previousQuantity + changeQty;

          // If online, try to sync immediately
          if (state.syncStatus.isOnline) {
            try {
              const result = await InventoryApiService.adjustStock(sku, changeQty, reason);
              
              // Update locally after successful API call
              set((state) => ({
                inventoryItems: {
                  ...state.inventoryItems,
                  [sku]: { ...item, qty_g: newQuantity }
                }
              }));

              // Add movement to ledger
              if (result.movement_id) {
                get().addLedgerEntry({
                  id: parseInt(result.movement_id.replace('mov_', '')),
                  sku,
                  delta_g: changeQty,
                  source: reason,
                  source_id: result.movement_id,
                  ts: result.timestamp
                });
              }

              // Log audit event
              await inventoryAuditService.logStockMovement(
                item,
                previousQuantity,
                newQuantity,
                'ADJUSTMENT',
                { reason }
              );

              // Broadcast update via WebSocket
              if (state.isRealTimeEnabled) {
                inventoryWebSocketService.broadcastStockUpdate({
                  sku,
                  previousQuantity,
                  newQuantity,
                  changeType: 'adjustment',
                  reason,
                  userId: await get().getCurrentUserId(),
                });
              }

            } catch (apiError) {
              // API failed, queue for offline sync
              console.log('API failed, queuing for offline sync:', apiError);
              await inventoryOfflineSync.queueStockUpdate(item, previousQuantity, newQuantity, reason);
              
              // Update locally for immediate UI feedback
              set((state) => ({
                inventoryItems: {
                  ...state.inventoryItems,
                  [sku]: { ...item, qty_g: newQuantity }
                }
              }));
            }
          } else {
            // Offline - queue action and update locally
            await inventoryOfflineSync.queueStockUpdate(item, previousQuantity, newQuantity, reason);
            
            set((state) => ({
              inventoryItems: {
                ...state.inventoryItems,
                [sku]: { ...item, qty_g: newQuantity }
              }
            }));
          }

          // Check for stock alerts
          get().checkStockAlerts(sku, newQuantity);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to adjust stock";
          set({ inventoryError: errorMsg });
          throw error;
        } finally {
          set({ isLoadingInventory: false });
        }
      },

      updateWastePercentage: async (sku, wastePercent) => {
        try {
          set({ isLoadingInventory: true, inventoryError: null });
          await InventoryApiService.updateWastePercentage(sku, wastePercent);
          
          // Update locally
          set((state) => {
            const item = state.inventoryItems[sku];
            if (item) {
              return {
                inventoryItems: {
                  ...state.inventoryItems,
                  [sku]: { ...item, waste_pct: wastePercent }
                }
              };
            }
            return state;
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to update waste percentage";
          set({ inventoryError: errorMsg });
          throw error;
        } finally {
          set({ isLoadingInventory: false });
        }
      },

      loadCostAnalysis: async () => {
        try {
          const analysis = await InventoryApiService.getCostAnalysis();
          get().setCostAnalysis(analysis);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to load cost analysis";
          set({ inventoryError: errorMsg });
        }
      },

      loadStockMovements: async (sku) => {
        try {
          const movements = await InventoryApiService.fetchInventoryLedger(sku);
          get().setStockMovements(movements);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to load stock movements";
          set({ inventoryError: errorMsg });
        }
      },

      // --- Asynchronous Actions (Enhanced) ---
      loadInitialInventory: async () => {
        set({ isLoadingInventory: true, inventoryError: null });
        try {
          const items = await InventoryApiService.fetchInventoryItems();
          get().setInventoryItems(items);
          
          // Also load ledger entries
          const ledger = await InventoryApiService.fetchInventoryLedger();
          get().setLedgerEntries(ledger);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to load inventory data";
          get().setError(errorMsg);
          console.error("Error loading initial inventory:", errorMsg);
        } finally {
          set({ isLoadingInventory: false });
        }
      },

      refreshInventory: async () => {
        await get().loadInitialInventory();
      },

      // --- Enhanced Selectors / Computed Values ---
      getLowStockItems: () => {
        const { inventoryItems, lowStockThreshold } = get();
        return Object.values(inventoryItems).filter(item =>
          item.par_level_g && item.par_level_g > 0 && (item.qty_g / item.par_level_g) <= lowStockThreshold && item.qty_g > 0
        );
      },
      
      getOutOfStockItems: () => {
        const { inventoryItems } = get();
        return Object.values(inventoryItems).filter(item => item.qty_g <= 0);
      },

      getFilteredItems: () => {
        const { inventoryItems, searchQuery, selectedCategory } = get();
        let items = Object.values(inventoryItems);

        // Filter by category
        if (selectedCategory !== 'all') {
          items = items.filter(item => item.category === selectedCategory);
        }

        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          items = items.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.sku.toLowerCase().includes(query) ||
            item.supplier?.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
          );
        }

        return items;
      },

      getItemBySku: (sku) => {
        const { inventoryItems } = get();
        return inventoryItems[sku];
      },

      getCategories: () => {
        const { inventoryItems } = get();
        const categories = new Set(Object.values(inventoryItems).map(item => item.category));
        return Array.from(categories).sort();
      },

      // Real-time sync methods
      enableRealTimeSync: async (userId, authToken) => {
        try {
          // Connect to WebSocket
          await inventoryWebSocketService.connect(userId, authToken);
          
          // Set up event listeners
          inventoryWebSocketService.on('STOCK_UPDATE', (update: StockUpdateEvent) => {
            const { sku, newQuantity } = update;
            set((state) => {
              const item = state.inventoryItems[sku];
              if (item) {
                return {
                  inventoryItems: {
                    ...state.inventoryItems,
                    [sku]: { ...item, qty_g: newQuantity }
                  }
                };
              }
              return state;
            });
          });

          inventoryWebSocketService.on('STOCK_ALERT', (alert: StockAlertEvent) => {
            get().addStockAlert(alert);
          });

          inventoryWebSocketService.on('SYNC_STATUS', (status: SyncStatusEvent) => {
            set((state) => ({
              syncStatus: {
                ...state.syncStatus,
                isOnline: status.status === 'connected',
                lastSyncTime: status.lastSync,
                pendingActions: status.pendingChanges,
              }
            }));
          });

          // Set up offline sync listener
          const unsubscribe = inventoryOfflineSync.onSyncStatusChange((syncStatus) => {
            get().setSyncStatus(syncStatus);
          });

          set({ 
            isRealTimeEnabled: true,
            syncStatus: inventoryOfflineSync.getSyncStatus()
          });

          // Subscribe to all current inventory items
          const { inventoryItems } = get();
          Object.keys(inventoryItems).forEach(sku => {
            inventoryWebSocketService.subscribeToItem(sku);
          });

        } catch (error) {
          console.error('Failed to enable real-time sync:', error);
          set({ inventoryError: 'Failed to enable real-time synchronization' });
        }
      },

      disableRealTimeSync: () => {
        inventoryWebSocketService.disconnect();
        inventoryWebSocketService.removeAllListeners();
        set({ isRealTimeEnabled: false });
      },

      setSyncStatus: (status) => set({ syncStatus: status }),

      addStockAlert: (alert) => set((state) => {
        // Remove existing alert for same SKU if present
        const filteredAlerts = state.stockAlerts.filter(a => a.sku !== alert.sku);
        return { stockAlerts: [...filteredAlerts, alert] };
      }),

      clearStockAlert: (sku) => set((state) => ({
        stockAlerts: state.stockAlerts.filter(alert => alert.sku !== sku)
      })),

      forceSync: async () => {
        try {
          const result = await inventoryOfflineSync.forceSyncAll();
          console.log('Force sync completed:', result);
          
          if (result.success) {
            // Refresh inventory after successful sync
            await get().refreshInventory();
          }
        } catch (error) {
          console.error('Force sync failed:', error);
          set({ inventoryError: 'Failed to sync pending changes' });
        }
      },

      // Helper methods
      checkStockAlerts: (sku: string, newQuantity: number) => {
        const { inventoryItems } = get();
        const item = inventoryItems[sku];
        if (!item) return;

        // Check for low stock
        if (item.par_level_g && newQuantity <= item.par_level_g * 0.1) {
          const alert: StockAlertEvent = {
            sku,
            itemName: item.name,
            alertType: newQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
            currentStock: newQuantity,
            parLevel: item.par_level_g,
            priority: newQuantity <= 0 ? 'critical' : 'high',
          };
          
          get().addStockAlert(alert);

          // Broadcast alert if real-time is enabled
          if (get().isRealTimeEnabled) {
            inventoryWebSocketService.broadcastStockAlert(alert);
          }
        }
      },

      getCurrentUserId: async (): Promise<string> => {
        try {
          const userInfo = await AsyncStorage.getItem('user_info');
          return userInfo ? JSON.parse(userInfo).id : 'unknown';
        } catch {
          return 'unknown';
        }
      },

    }),
    {
      name: 'cashapp-inventory-storage', // Unique name for AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist what's necessary, or omit to persist everything
        inventoryItems: state.inventoryItems,
        lowStockThreshold: state.lowStockThreshold,
        // inventoryLedger might become very large, consider if it should be persisted
        // or always fetched. For now, not persisting ledger.
      }),
    }
  )
);

// Hook to initialize store or load data on app start if needed
export const useInitializeInventoryStore = () => {
    const loadInitialInventory = useInventoryStore((state) => state.loadInitialInventory);
    // React.useEffect(() => {
    //   loadInitialInventory();
    // }, [loadInitialInventory]);
    // Call this from your App.tsx or a similar top-level component
};

export default useInventoryStore;
