// Global types for the CashApp POS application

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  emoji?: string;
  description?: string;
  available: boolean;
  barcode?: string;
}

export interface Category {
  id: number;
  name: string;
  active: boolean;
  color?: string;
  icon?: string;
}

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  emoji?: string;
  modifications?: string[];
  notes?: string;
}

export interface Order {
  id?: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  tableNumber?: number;
  createdAt: Date;
  status: 'draft' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentMethod?: 'cash' | 'card' | 'apple_pay' | 'gift_card';
  paymentTransactionId?: string;
  paymentProvider?: string;
  serviceCharge?: number;
  transactionFee?: number;
  tipAmount?: number;
  notes?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'cashier' | 'manager' | 'admin';
  avatar?: string;
  isActive: boolean;
}

export interface PosSession {
  id: number;
  userId: number;
  userName: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  startingCash: number;
  endingCash?: number;
  totalSales: number;
  ordersCount: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'digital' | 'other';
  isActive: boolean;
  requiresAuthorization: boolean;
  icon?: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  POS: undefined;
  Orders: undefined;
  Reports: undefined;
  OrderDetails: { orderId: number };
  TableSelection: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  POS: {
    tableId?: string;
    tableName?: string;
    orderType?: 'dine_in' | 'takeout' | 'pickup' | 'delivery';
  };
  TableSelection: undefined;
  Reports: undefined;
  Employees: undefined;
  EmployeeSchedule: undefined;
  QRScanner: {
    onScanned: (data: string) => void;
    title?: string;
    subtitle?: string;
  };
  Customers: undefined;
  Inventory: undefined;
  MenuManagement: undefined;
  TableManagement: undefined;
  Dashboard: undefined;
  Settings: undefined;
  BusinessSettings: undefined;
  Hardware: undefined;
  PaymentSettings: undefined;
  AppSettings: undefined;
  Profile: undefined;
  Help: undefined;
  TableSelection: undefined;
  POS: { 
    tableId?: string; 
    tableName?: string; 
    orderType?: 'dine_in' | 'takeout' | 'pickup' | 'delivery';
  };
  OrderDetails: { orderId: number };
  ServiceChargeSelection: undefined;
  EnhancedPayment: {
    amount: number;
    orderItems: OrderItem[];
    customerName: string;
    onPaymentComplete: (result: any) => void;
  };
  QRCodePayment: {
    amount: number;
    orderItems: OrderItem[];
    customerName: string;
    onPaymentComplete: (result: any) => void;
  };
  SquareCardPayment: {
    amount: number;
    currency?: string;
    description?: string;
    onPaymentComplete: (result: any) => void;
    onPaymentCancelled: () => void;
  };
  SquareContactlessPayment: {
    amount: number;
    currency?: string;
    description?: string;
    onPaymentComplete: (result: any) => void;
    onPaymentCancelled: () => void;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Orders: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

// Store types
export interface AppState {
  user: User | null;
  session: PosSession | null;
  cart: OrderItem[];
  currentOrder: Order | null;
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UIState {
  selectedCategory: string;
  showPaymentModal: boolean;
  showOfflineIndicator: boolean;
  theme: 'light' | 'dark';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Inventory & Recipe Types (as per backend schemas)
export interface InventoryItem {
  sku: string;
  name: string;
  description?: string | null;
  qty_g: number;
  par_level_g?: number | null;
  unit?: string | null;
  cost_per_unit?: number | null;
  supplier?: string | null;
  last_updated: string; // ISO datetime string
}

export interface RecipeIngredientClient { // Renamed to avoid conflict if RecipeIngredient is used elsewhere
  ingredient_sku: string;
  qty_g: number;
  ingredient_name?: string; // For display purposes on client
  ingredient_unit?: string; // For display
}

export interface RecipeClient { // Renamed to avoid conflict
  item_id: string; // Product UUID
  item_name?: string; // Product name, joined from Product table
  ingredients: RecipeIngredientClient[];
}

export interface InventoryLedgerEntry {
  id: number;
  sku: string;
  delta_g: number;
  source: string;
  source_id?: string | null;
  ts: string; // ISO datetime string
}

// Store types for Inventory
export interface InventoryState {
  inventoryItems: { [sku: string]: InventoryItem }; // Keyed by SKU for easy lookup
  inventoryLedger: InventoryLedgerEntry[];
  isLoadingInventory: boolean;
  inventoryError: string | null;
  lowStockThreshold: number; // Percentage, e.g., 0.1 for 10%
}


// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Data types previously in mockDataGenerator.ts
export interface CustomerData {
  id: number;
  name: string;
  email: string;
  phone: string;
  joinedDate: Date;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  lastVisit: Date;
  loyaltyPoints: number;
  preferredItems: string[];
  tags: string[];
}

export interface EmployeeData {
  id: number; // Or string if UUID from backend
  name: string;
  role: 'Manager' | 'Cashier' | 'Server' | 'Cook' | string; // Allow string for future roles
  email: string;
  phone: string;
  hireDate: Date;
  hourlyRate: number;
  totalSales: number;
  averageSalesPerDay: number;
  punctualityScore: number;
  performanceScore: number;
  scheduledHours: number;
  actualHours: number;
  weeksSinceLastReview?: number; // Made optional as not all systems might have it
  photo?: string;
  // For ReportsScreenSimple, these might be part of a specific report DTO
  dailySales?: number;
  dailyHours?: number;
  // For StaffReportDetailScreen
  transactionsHandled?: number;
  efficiency?: number; // e.g., sales per hour
  customerRating?: number; // e.g., 1-5 stars
  shiftsCompleted?: number;
  performance?: 'excellent' | 'good' | 'average' | 'needs_improvement' | string;
  avatar?: string; // Typically first letter of name, or URL
}

export interface InventoryData {
  itemId: number; // Or string (SKU/UUID)
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  supplier: string;
  lastRestocked: Date;
  turnoverRate: number;
  wastage: number;
  unit?: string;
}

export interface SalesDataReportItem { // Renamed to avoid conflict if SalesData is a more generic term elsewhere
  date: Date;
  total: number; // daily total sales
  transactions: number;
  items: number;
  averageTransaction: number;
  paymentMethods: {
    card: number;
    cash: number;
    mobile: number;
    giftCard?: number; // Was used as qrCode placeholder in SalesReportDetail
    qrCode?: number;
  };
  hourlyData?: Array<{ // Made optional as not all reports might need it
    hour: number;
    sales: number;
    transactions: number;
  }>;
  topItems?: Array<{
    itemId: number | string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  employees?: Array<{
    id: number | string;
    name: string;
    sales: number;
    transactions: number;
    hours: number;
  }>;
}