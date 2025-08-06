/**
 * Test Configuration - REAL Infrastructure
 * 
 * Architecture:
 * 1. Supabase handles authentication (users sign up on website)
 * 2. DigitalOcean backend verifies Supabase tokens
 * 3. PostgreSQL database on DigitalOcean
 * 4. Valkey/Redis cache on DigitalOcean
 * 5. WebSocket server on DigitalOcean
 */

export const TEST_CONFIG = {
  // Supabase Authentication (REAL)
  SUPABASE: {
    URL: process.env.SUPABASE_URL || 'https://muukvrmagzsiqpbkmjhl.supabase.co',
    ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dWt2cm1hZ3pzaXFwYmttamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMDkwNzIsImV4cCI6MjA0NTY4NTA3Mn0.YXHqM7BV9u8K5REdpVjNKgJTvPELZ5WXCLyGx_gnxNw',
    // Use REAL existing users (already registered on fynlo.co.uk)
    TEST_USER: {
      // Restaurant Manager account
      email: process.env.TEST_USER_EMAIL || 'arnaud@luciddirections.co.uk',
      password: process.env.TEST_USER_PASSWORD || '', // Need actual password
    },
    // Alternative: Platform Owner account
    PLATFORM_OWNER: {
      email: 'admin@fynlo.com',
      password: process.env.PLATFORM_OWNER_PASSWORD || '', // Need actual password
    },
  },
  
  // DigitalOcean Backend (REAL)
  BACKEND: {
    // Production backend on DigitalOcean App Platform
    API_URL: 'https://fynlopos-9eg2c.ondigitalocean.app',
    API_VERSION: '/api/v1',
    
    // Full API URL
    get FULL_API_URL() {
      return `${this.API_URL}${this.API_VERSION}`;
    },
    
    // Backend endpoints that verify Supabase tokens
    ENDPOINTS: {
      AUTH_VERIFY: '/auth/verify',  // Verifies Supabase token with backend
      HEALTH: '/health',
      PRODUCTS: '/products/mobile',
      ORDERS: '/orders',
      PAYMENTS: '/payments',
      WEBSOCKET: '/ws',
    },
  },
  
  // WebSocket Configuration (REAL)
  WEBSOCKET: {
    // WebSocket URL on DigitalOcean
    URL: 'wss://fynlopos-9eg2c.ondigitalocean.app/ws',
    // Heartbeat interval (15 seconds as per production config)
    HEARTBEAT_INTERVAL: 15000,
    // Reconnection with exponential backoff
    RECONNECT: {
      MAX_ATTEMPTS: 10,
      BASE_DELAY: 1000,
      MAX_DELAY: 30000,
    },
  },
  
  // Test Restaurant Configuration
  TEST_RESTAURANT: {
    // This should be created in Supabase/backend first
    ID: process.env.TEST_RESTAURANT_ID || 'test-restaurant-001',
    NAME: 'Test Restaurant',
    // Platform owner can access all restaurants
    IS_PLATFORM_TEST: false,
  },
  
  // Test Timeouts
  TIMEOUT: {
    API: 10000,        // 10 seconds for API calls
    WS: 5000,          // 5 seconds for WebSocket connection
    AUTH: 15000,       // 15 seconds for auth flow (Supabase + backend)
    INTEGRATION: 30000, // 30 seconds for full integration flows
  },
  
  // Feature Flags for Tests
  FEATURES: {
    // These should all be true for production readiness
    REAL_AUTH: true,      // Use real Supabase authentication
    REAL_BACKEND: true,   // Use real DigitalOcean backend
    REAL_WEBSOCKET: true, // Test real WebSocket connections
    REAL_PAYMENTS: false, // Don't test real payments (use test mode)
  },
  
  // Environment Detection
  get IS_CI() {
    return process.env.CI === 'true';
  },
  
  get SHOULD_SKIP_INTEGRATION() {
    // Only skip if explicitly disabled or no credentials
    return (
      process.env.SKIP_INTEGRATION_TESTS === 'true' ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_ANON_KEY ||
      !process.env.TEST_USER_PASSWORD
    );
  },
};

export default TEST_CONFIG;