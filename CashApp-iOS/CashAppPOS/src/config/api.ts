/**
 * API Configuration - Centralized network settings
 * 
 * IMPORTANT: Uses LAN IP for physical device testing
 * Physical devices cannot access Mac's localhost (127.0.0.1)
 */

// Get the current environment
const isDevelopment = __DEV__;

// Mac's LAN IP address for device testing
const MAC_LAN_IP = '192.168.0.109';

// API Configuration
export const API_CONFIG = {
  // Backend API (FastAPI on port 8000) - ALWAYS use LAN IP for device testing
  // Physical devices cannot access localhost, and api.fynlopos.com doesn't exist in DNS
  BASE_URL: `http://${MAC_LAN_IP}:8000`,
  
  // Metro bundler (React Native dev server on port 8081)
  METRO_URL: `http://${MAC_LAN_IP}:8081`,
  
  // API version prefix
  API_VERSION: '/api/v1',
  
  // Full API URL with version
  get FULL_API_URL() {
    return `${this.BASE_URL}${this.API_VERSION}`;
  },
  
  // Request timeout (2 seconds to prevent app hanging)
  TIMEOUT: 2000,
  
  // Health check endpoint
  HEALTH_ENDPOINT: '/health',
  
  // Platform endpoints
  PLATFORM_ENDPOINTS: {
    SERVICE_CHARGE: '/platform/service-charge',
    PAYMENT_METHODS: '/platform/payment-methods',
    SETTINGS: '/platform/settings',
  },
  
  // Database config for direct PostgreSQL connection (if needed)
  DATABASE: {
    host: MAC_LAN_IP, // Use LAN IP instead of localhost
    port: 5432,
    database: 'fynlo_pos',
    user: 'fynlo_user',
    password: 'fynlo_password',
  },
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
    console.warn('API health check failed:', error.message);
    return false;
  }
};

// Export for easy access
export default API_CONFIG;