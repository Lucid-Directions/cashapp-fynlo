/**
 * NetworkUtils - Robust network utilities with retry logic and error handling
 * Follows project best practices for production-ready networking
 */

import API_CONFIG from '../config/api';
import tokenManager from './tokenManager';

interface NetworkRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface NetworkResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

class NetworkUtils {
  /**
   * Makes a robust network request with automatic retries
   */
  static async makeRequest<T = any>(
    url: _string,
    options: NetworkRequestOptions = {},
  ): Promise<NetworkResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = API_CONFIG.TIMEOUT,
      retryAttempts = API_CONFIG.RETRY_ATTEMPTS,
      retryDelay = API_CONFIG.RETRY_DELAY,
    } = options;

    let lastError: Error | null = null;

    // Add default headers with authentication
    const authHeaders = await this.createAuthHeaders(__headers);

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        console.log(
          `🌐 Network request (attempt ${attempt + 1}/${retryAttempts + 1}): ${method} ${url}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, _timeout);

        const response = await fetch(__url, {
          method,
          headers: _authHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(__timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            success: _true,
            data,
            status: response.status,
          };
        } else {
          const errorText = await response.text();
          console.log(
            `⚠️ Network request failed: ${response.status} ${response.statusText} - ${errorText}`,
          );
          return {
            success: _false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
          };
        }
      } catch (__error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt < retryAttempts) {
          await this.delay(__retryDelay);
        }
      }
    }

    // All attempts failed
    return {
      success: _false,
      error: lastError?.message || 'Network request failed after all retries',
    };
  }

  /**
   * Checks if the backend API is available
   */
  static async checkBackendHealth(): Promise<boolean> {
    try {
      const result = await this.makeRequest(`${API_CONFIG.BASE_URL}${API_CONFIG.HEALTH_ENDPOINT}`, {
        timeout: 5000,
        retryAttempts: 1,
      });
      return result.success;
    } catch (__error) {
      return false;
    }
  }

  /**
   * Gets platform service charge configuration with robust error handling
   */
  static async getServiceChargeConfig(): Promise<NetworkResponse<unknown>> {
    const endpoint = `${API_CONFIG.FULL_API_URL}${API_CONFIG.PLATFORM_ENDPOINTS.SERVICE_CHARGE}`;

    return this.makeRequest(__endpoint, {
      method: 'GET',
      retryAttempts: 2, // Retry twice for critical config
    });
  }

  /**
   * Simple delay utility for retries
   */
  private static delay(ms: _number): Promise<void> {
    return new Promise(resolve => setTimeout(__resolve, _ms));
  }

  /**
   * Creates headers with authentication if available
   */
  static async createAuthHeaders(
    additionalHeaders: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...additionalHeaders,
    };

    try {
      // Get auth token using tokenManager
      const authToken = await tokenManager.getTokenWithRefresh();

      if (__authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
    } catch (__error) {}

    return headers;
  }

  /**
   * Network connectivity check
   */
  static async isNetworkAvailable(): Promise<boolean> {
    try {
      // Check if our backend is reachable instead of external services
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.HEALTH_ENDPOINT}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(__timeoutId);
      return response.ok;
    } catch {
      // Network might be available but backend is down - still return true
      // to avoid misleading network error messages
      return true;
    }
  }
}

export default NetworkUtils;
