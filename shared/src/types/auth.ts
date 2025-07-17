import { APIResponse } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurant_id?: string;
  platform_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  phone_number?: string;
}

export type UserRole = 
  | 'platform_owner' 
  | 'restaurant_owner' 
  | 'manager' 
  | 'employee';

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
  restaurant_id?: string;
}

export interface LoginResponse extends APIResponse<{
  user: User;
  tokens: AuthTokens;
  restaurant?: Restaurant;
}> {}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Restaurant is referenced here but defined in restaurant.ts
import type { Restaurant } from './restaurant';