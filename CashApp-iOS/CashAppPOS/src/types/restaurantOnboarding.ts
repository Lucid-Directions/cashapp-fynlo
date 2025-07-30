/**
 * Types for restaurant onboarding flow
 */

export interface RestaurantCreateRequest {
  name: string;
  display_name: string;
  business_type: string;
  description?: string;
  phone: string;
  email: string;
  website?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country: string;
  };
  business_hours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  owner_info: {
    name: string;
    email: string;
    phone?: string;
  };
  employees?: Array<{
    name: string;
    email: string;
    phone?: string;
    role: 'manager' | 'employee' | 'chef' | 'waiter';
    hourly_rate: number;
    start_date: string;
    access_level: 'full' | 'pos_only' | 'reports_only';
  }>;
  bank_details?: {
    sort_code: string;
    account_number: string;
    account_name: string;
    iban?: string | null;
    swift_bic?: string | null;
  };
}

export interface RestaurantCreateResponse {
  restaurant_id: string;
  restaurant_name: string;
  subscription_plan: string;
  subscription_status: string;
  enabled_features: string[];
  needs_onboarding: boolean;
  message: string;
}
