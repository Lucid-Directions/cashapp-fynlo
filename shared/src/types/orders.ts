import { ProductVariant } from './products';

export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  customer_id?: string;
  staff_id: string;
  table_number?: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  items: OrderItem[];
  
  // Financial
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  discount_amount: number;
  tip_amount: number;
  total_amount: number;
  
  // Payment details
  payment_method?: string;
  payment_details?: PaymentDetails;
  
  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export type OrderStatus = 
  | 'draft'
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded'
  | 'partial';

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  modifiers: OrderItemModifier[];
  variant?: ProductVariant;
  special_instructions?: string;
  status: OrderItemStatus;
}

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentDetails {
  transaction_id?: string;
  processor?: string;
  method_details?: Record<string, any>;
  processed_at?: string;
}

export interface OrderSummary {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  item_count: number;
  created_at: string;
  table_number?: string;
}