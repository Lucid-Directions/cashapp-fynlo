/**
 * API Configuration - Centralized network settings
 * 
 * PRODUCTION: Uses DigitalOcean App Platform backend
 * DEVELOPMENT: Uses LAN IP for physical device testing
 */

// Get the current environment
const isDevelopment = __DEV__;

// DigitalOcean App Platform backend URL (Production) - VERIFIED WORKING
const PRODUCTION_API_URL = 'https://fynlopos-9eg2c.ondigitalocean.app';

// Mac's LAN IP address for device testing (Development only)
const MAC_LAN_IP = '192.168.0.109';

// Determine if running on simulator or device
const isSimulator = __DEV__ && (
  // iOS Simulator detection
  (global as any).navigator?.userAgent?.includes('iPhone Simulator') ||
  (global as any).navigator?.userAgent?.includes('iPad Simulator') ||
  // React Native development mode detection
  typeof __DEV__ !== 'undefined'
);

// Dynamic API URL based on environment
const getBaseURL = () => {
  // PRODUCTION: Always try DigitalOcean backend first
  // During deployment phase, app will use mock data fallbacks if backend is unavailable
  // return PRODUCTION_API_URL;
  
  // Development fallback (temporarily enabled for local testing)
  if (isSimulator) {
    return 'http://localhost:8000';
  } else {
    return `http://${MAC_LAN_IP}:8000`;
  }
};

// API Configuration
export const API_CONFIG = {
  // Backend API (FastAPI on port 8000) - Dynamic URL based on environment
  BASE_URL: getBaseURL(),
  
  // Metro bundler (React Native dev server on port 8081)
  METRO_URL: `http://${MAC_LAN_IP}:8081`,
  
  // API version prefix
  API_VERSION: '/api/v1',
  
  // Full API URL with version
  get FULL_API_URL() {
    return `${this.BASE_URL}${this.API_VERSION}`;
  },
  
  // Request timeout (10 seconds for reliable network calls)
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  
  // Health check endpoint
  HEALTH_ENDPOINT: '/health',
  
  // Platform endpoints
  PLATFORM_ENDPOINTS: {
    SERVICE_CHARGE: '/platform/public/service-charge',
    PAYMENT_METHODS: '/platform/public/payment-methods',
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