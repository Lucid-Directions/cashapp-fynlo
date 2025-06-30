/**
 * API Configuration - Centralized network settings
 * 
 * Uses environment variables for API and Metro URLs.
 * Ensure you have a .env file at the root of your CashApp-iOS/CashAppPOS project
 * with at least API_BASE_URL and METRO_BASE_URL defined.
 * Example .env:
 * API_BASE_URL=http://your-backend-ip-or-domain:8000
 * METRO_BASE_URL=http://your-metro-bundler-ip:8081
 */

import Config from 'react-native-config'; // Assumes react-native-config is installed and set up

// Get the current environment
const isDevelopment = __DEV__;

// Default values if environment variables are not set (especially for development)
const DEFAULT_API_BASE_URL = isDevelopment ? 'http://localhost:8000' : 'https://api.fynlopos.com';
const DEFAULT_METRO_BASE_URL = isDevelopment ? 'http://localhost:8081' : ''; // Metro URL is dev-only

// API Configuration
export const API_CONFIG = {
  // Backend API URL (FastAPI)
  // For physical device testing, ensure API_BASE_URL in .env points to your machine's LAN IP or a reachable domain.
  BASE_URL: Config.API_BASE_URL || DEFAULT_API_BASE_URL,
  
  // Metro bundler URL (React Native dev server)
  // For physical device testing, ensure METRO_BASE_URL in .env points to your machine's LAN IP.
  METRO_URL: Config.METRO_BASE_URL || DEFAULT_METRO_BASE_URL,
  
  // API version prefix
  API_VERSION: '/api/v1',
  
  // Full API URL with version
  get FULL_API_URL() {
    return `${this.BASE_URL}${this.API_VERSION}`;
  },
  
  // Request timeout (increased to 5 seconds)
  TIMEOUT: 5000,
  
  // Health check endpoint
  HEALTH_ENDPOINT: '/health',
  
  // Platform endpoints
  PLATFORM_ENDPOINTS: {
    SERVICE_CHARGE: '/platform-settings/service-charge',
    PAYMENT_METHODS: '/platform-settings/payment-methods',
    SETTINGS: '/platform-settings',
  },
  
  // Direct database configuration has been removed for security reasons.
  // The frontend should not connect directly to the database.
};

// Health check function
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.HEALTH_ENDPOINT}`, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    const typedError = error as Error;
    console.warn('API health check failed:', typedError.message);
    return false;
  }
};

// Export for easy access
export default API_CONFIG;