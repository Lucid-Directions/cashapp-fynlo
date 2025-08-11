/**
 * Unified payment types for the Payment Orchestrator system
 */

export type PaymentMethodType = 
  | 'cash' 
  | 'sumup' 
  | 'apple_pay' 
  | 'qr_code' 
  | 'square'
  | 'stripe';

export interface PaymentMethod {
  id: PaymentMethodType;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  available: boolean;
  requiresAuth: boolean;
  requiresHardware: boolean;
  processingFee?: number;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentResult {
  success: boolean;
  method: PaymentMethodType;
  transactionId?: string;
  transactionCode?: string;
  amount: number;
  currency: string;
  timestamp: Date;
  error?: PaymentError;
  metadata?: Record<string, any>;
  receipt?: PaymentReceipt;
}

export interface PaymentError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

export interface PaymentReceipt {
  merchantName: string;
  merchantId: string;
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  timestamp: Date;
  items?: ReceiptItem[];
  customerEmail?: string;
  customerName?: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export type PaymentState = 
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'processing'
  | 'confirming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PaymentSession {
  id: string;
  state: PaymentState;
  method: PaymentMethodType | null;
  amount: number;
  currency: string;
  startedAt: Date;
  completedAt?: Date;
  attempts: number;
  lastError?: PaymentError;
}

export interface PaymentConfig {
  enabledMethods: PaymentMethodType[];
  defaultMethod?: PaymentMethodType;
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  requireCustomerInfo: boolean;
  enableTips: boolean;
  enableSplitPayment: boolean;
}

export interface PaymentProvider {
  id: PaymentMethodType;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  checkAvailability(): Promise<boolean>;
  cleanup(): void;
  
  // Payment processing
  processPayment(
    amount: number,
    currency: string,
    reference: string,
    customerInfo?: CustomerInfo
  ): Promise<PaymentResult>;
  
  // Optional methods
  cancelPayment?(): Promise<void>;
  refundPayment?(transactionId: string, amount?: number): Promise<boolean>;
  getTransactionStatus?(transactionId: string): Promise<PaymentState>;
}

export interface CustomerInfo {
  name?: string;
  email?: string;
  phone?: string;
  customerId?: string;
}