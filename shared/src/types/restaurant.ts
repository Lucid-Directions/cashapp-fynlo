export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  owner_id: string;
  platform_id: string;
  settings: RestaurantSettings;
  subscription_tier: SubscriptionTier;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  logo_url?: string;
  cover_image_url?: string;
}

export type SubscriptionTier = 'alpha' | 'beta' | 'gamma';

export interface RestaurantSettings {
  currency: string;
  timezone: string;
  tax_rate: number;
  service_charge: number; // Platform-controlled
  payment_methods: PaymentMethod[];
  operating_hours: OperatingHours;
  receipt_settings: ReceiptSettings;
  table_management: TableSettings;
}

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  is_active: boolean;
  settings: Record<string, any>;
  fee_percentage: number;
}

export type PaymentMethodType = 'cash' | 'card' | 'qr' | 'apple_pay' | 'google_pay';

export interface OperatingHours {
  [day: string]: DayHours;
}

export interface DayHours {
  open: string; // "09:00"
  close: string; // "22:00"
  is_closed: boolean;
}

export interface ReceiptSettings {
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  footer_text?: string;
  paper_size: 'A4' | '80mm' | '58mm';
}

export interface TableSettings {
  enable_table_management: boolean;
  default_tables: number;
  allow_table_merge: boolean;
  require_table_assignment: boolean;
}