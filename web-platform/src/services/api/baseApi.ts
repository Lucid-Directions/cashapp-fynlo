import { API_CONFIG, buildEndpoint } from '@/config/api.config';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ApiError extends Error {
  status?: number;
  code?: string;
}

class BaseApiService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}/api/${API_CONFIG.VERSION}`;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const error: ApiError = new Error(`API Error: ${response.statusText}`);
        error.status = response.status;
        
        // Handle specific error cases
        switch (response.status) {
          case 401:
            // Unauthorized - redirect to login
            toast({
              title: "Session Expired",
              description: "Please log in again to continue.",
              variant: "destructive",
            });
            // Could trigger logout here
            break;
          case 403:
            toast({
              title: "Access Denied",
              description: "You don't have permission to perform this action.",
              variant: "destructive",
            });
            break;
          case 404:
            toast({
              title: "Not Found",
              description: "The requested resource was not found.",
              variant: "destructive",
            });
            break;
          case 429:
            toast({
              title: "Rate Limited",
              description: "Too many requests. Please try again later.",
              variant: "destructive",
            });
            break;
          case 500:
            toast({
              title: "Server Error",
              description: "Something went wrong on our end. Please try again.",
              variant: "destructive",
            });
            break;
          default:
            toast({
              title: "Request Failed",
              description: "An unexpected error occurred. Please try again.",
              variant: "destructive",
            });
        }
        
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response.text() as unknown as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error
        toast({
          title: "Connection Error",
          description: "Unable to connect to the server. Please check your internet connection.",
          variant: "destructive",
        });
      }
      
      console.error('API Request failed:', {
        url,
        method: options.method || 'GET',
        error,
      });
      
      throw error;
    }
  }

  // HTTP methods
  async get<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    const url = params ? buildEndpoint(endpoint, params) : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, params?: Record<string, string | number>): Promise<T> {
    const url = params ? buildEndpoint(endpoint, params) : endpoint;
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, params?: Record<string, string | number>): Promise<T> {
    const url = params ? buildEndpoint(endpoint, params) : endpoint;
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    const url = params ? buildEndpoint(endpoint, params) : endpoint;
    return this.request<T>(url, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any, params?: Record<string, string | number>): Promise<T> {
    const url = params ? buildEndpoint(endpoint, params) : endpoint;
    return this.request<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiService = new BaseApiService();