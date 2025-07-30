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
    url: string,
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
    const authHeaders = await this.createAuthHeaders(headers);

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
          `🌐 Network request (attempt ${attempt + 1}/${retryAttempts + 1}): ${method} ${url}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        const response = await fetch(url, {
          method,
          headers: authHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            data,
            status: response.status,
          };
        } else {
          const errorText = await response.text();
            `⚠️ Network request failed: ${response.status} ${response.statusText} - ${errorText}`,
          );
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
          };
        }
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt < retryAttempts) {
          await this.delay(retryDelay);
        }
      }
    }

    // All attempts failed
    return {
      success: false,
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
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets platform service charge configuration with robust error handling
   */
  static async getServiceChargeConfig(): Promise<NetworkResponse<any>> {
    const endpoint = `${API_CONFIG.FULL_API_URL}${API_CONFIG.PLATFORM_ENDPOINTS.SERVICE_CHARGE}`;

    return this.makeRequest(endpoint, {
      method: 'GET',
      retryAttempts: 2, // Retry twice for critical config
    });
  }

  /**
   * Simple delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
    } catch (error) {
    }

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

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // Network might be available but backend is down - still return true
      // to avoid misleading network error messages
      return true;
    }
  }
}

export default NetworkUtils;
