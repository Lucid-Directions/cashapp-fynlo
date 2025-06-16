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
  tableNumber?: number;
  createdAt: Date;
  status: 'draft' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentMethod?: 'cash' | 'card' | 'apple_pay' | 'gift_card';
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
  Drawer: undefined;
  TableSelection: undefined;
  POS: { 
    tableId?: string; 
    tableName?: string; 
    orderType?: 'dine_in' | 'takeout' | 'pickup' | 'delivery';
  };
  OrderDetails: { orderId: number };
};

export type MainTabParamList = {
  POS: undefined;
  Orders: undefined;
  Reports: undefined;
};

export type DrawerParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
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

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;