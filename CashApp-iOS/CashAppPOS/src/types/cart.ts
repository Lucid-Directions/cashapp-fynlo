/**
 * Enhanced cart types for Fynlo POS
 * Supports item modifications, split bills, and cart templates
 */

// Re-export the base OrderItem type for backward compatibility
export type { OrderItem } from '../types';

/**
 * Represents a modification to a cart item (size, temperature, additions, etc.)
 */
export interface CartItemModification {
  id: string;
  type: 'size' | 'temperature' | 'addition' | 'removal' | 'custom';
  category: string; // e.g., "Size Options", "Milk Options"
  name: string;
  price: number;
  selected: boolean;
  quantity?: number; // For additions that can have multiple (e.g., 2x extra shot)
}

/**
 * Enhanced order item with modification support
 */
export interface EnhancedOrderItem {
  // Core fields - matching shared/src/types/orders.ts structure
  id: string; // Fixed from number to string to match shared types
  productId: string;
  name: string;
  price: number; // Base price before modifications
  quantity: number;
  emoji?: string;
  
  // Category info for kitchen display
  categoryId?: string;
  categoryName?: string;
  
  // Modification fields
  modifications: CartItemModification[];
  specialInstructions?: string;
  
  // Pricing breakdown
  originalPrice: number; // Base price
  modificationPrice: number; // Sum of all modification prices
  totalPrice: number; // (originalPrice + modificationPrice) * quantity
  
  // Metadata
  addedAt: string; // ISO timestamp
  lastModified: string; // ISO timestamp
  addedBy?: string; // Staff member ID who added the item
  modifiedBy?: string; // Staff member ID who last modified
  
  // For split bill tracking
  splitGroupId?: string; // Which split group this item belongs to
}

/**
 * Cart template for saving frequently ordered combinations
 */
export interface CartTemplate {
  id: string;
  name: string;
  description: string;
  emoji?: string; // Visual identifier
  items: EnhancedOrderItem[];
  
  // Usage tracking
  createdAt: string;
  createdBy: string;
  lastUsed?: string;
  useCount: number;
  
  // Template settings
  isPublic: boolean; // Available to all staff
  tags: string[]; // e.g., ["breakfast", "lunch special"]
  estimatedPrepTime?: number; // In minutes
}

/**
 * Split bill group for dividing orders
 */
export interface SplitBillGroup {
  id: string;
  name: string; // e.g., "Table 1", "John", "Split 1"
  color: string; // Hex color for visual identification
  emoji?: string; // Alternative visual identifier
  
  // Items assigned to this group
  itemIds: string[]; // Array of EnhancedOrderItem IDs
  
  // Financial breakdown
  subtotal: number;
  serviceCharge: number;
  serviceChargePercentage: number;
  tax: number;
  taxPercentage: number;
  discount?: number;
  discountPercentage?: number;
  total: number;
  
  // Payment info
  paymentMethod?: 'cash' | 'card' | 'apple_pay' | 'tap_to_pay' | 'custom';
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentDetails?: {
    transactionId?: string;
    processedAt?: string;
    processor?: string;
    last4?: string; // Last 4 digits of card
  };
  
  // Metadata
  createdAt: string;
  paidAt?: string;
  paidBy?: string; // Staff member who processed payment
}

/**
 * Split bill configuration
 */
export interface SplitBillConfig {
  id: string;
  orderId?: string; // Link to order if already created
  
  // Split configuration
  splitType: 'equal' | 'by_items' | 'custom' | 'percentage';
  numberOfSplits: number;
  groups: SplitBillGroup[];
  
  // Unassigned items (not yet allocated to any group)
  unassignedItemIds: string[];
  
  // Overall totals
  originalTotal: number;
  currentTotal: number; // May differ if items removed
  totalPaid: number;
  remainingBalance: number;
  
  // Settings
  allowPartialPayments: boolean;
  requireAllGroupsPaid: boolean; // Before completing order
  autoAssignServiceCharge: boolean;
  
  // Metadata
  createdAt: string;
  createdBy: string;
  completedAt?: string;
}

/**
 * Bulk operation for multiple cart items
 */
export interface BulkCartOperation {
  id: string;
  type: 'discount' | 'remove' | 'duplicate' | 'move_to_group' | 'add_modifier';
  itemIds: string[];
  
  // Operation-specific data
  discountAmount?: number;
  discountPercentage?: number;
  targetGroupId?: string; // For move operations
  modificationId?: string; // For add modifier operations
  
  // Metadata
  performedAt: string;
  performedBy: string;
  
  // For undo functionality
  previousState?: any; // Snapshot of affected items before operation
  isReversible: boolean;
}

/**
 * Cart history entry for undo/redo
 */
export interface CartHistoryEntry {
  id: string;
  timestamp: string;
  action: string; // Human-readable description
  
  // State snapshots
  cartBefore: EnhancedOrderItem[];
  cartAfter: EnhancedOrderItem[];
  
  // What changed
  itemsAdded: string[];
  itemsRemoved: string[];
  itemsModified: string[];
  
  // Who made the change
  userId: string;
  userName: string;
}

/**
 * Enhanced cart state extending the base store
 */
export interface EnhancedCartState {
  // Enhanced cart items
  cart: EnhancedOrderItem[];
  
  // Templates
  templates: CartTemplate[];
  recentTemplates: string[]; // Template IDs for quick access
  
  // Split bill
  splitBillConfig: SplitBillConfig | null;
  
  // History for undo/redo
  cartHistory: CartHistoryEntry[];
  historyIndex: number; // Current position in history
  maxHistorySize: number; // Limit history entries
  
  // Selection for bulk operations
  selectedItemIds: string[];
  
  // UI state
  isModificationModalOpen: boolean;
  isSplitBillModalOpen: boolean;
  isTemplateModalOpen: boolean;
  activeItemId: string | null; // Item being modified
}

/**
 * Cart validation error types
 */
export type CartValidationError = 
  | { type: 'INVALID_ID'; itemId: string }
  | { type: 'INVALID_PRICE'; itemId: string; price: number }
  | { type: 'INVALID_QUANTITY'; itemId: string; quantity: number }
  | { type: 'MISSING_REQUIRED_FIELD'; itemId: string; field: string }
  | { type: 'MODIFICATION_CONFLICT'; itemId: string; modifications: string[] }
  | { type: 'SPLIT_BILL_MISMATCH'; message: string }
  | { type: 'TEMPLATE_INVALID'; templateId: string; reason: string };

/**
 * Migration result from old cart format to new
 */
export interface CartMigrationResult {
  success: boolean;
  migratedItems: EnhancedOrderItem[];
  errors: CartValidationError[];
  warnings: string[];
  stats: {
    totalItems: number;
    successfullyMigrated: number;
    failed: number;
    modified: number;
  };
}