#!/bin/bash

echo "🚀 Enabling Integration Tests for Production Readiness"
echo "======================================================"
echo ""
echo "We have a REAL backend on DigitalOcean: https://fynlopos-9eg2c.ondigitalocean.app"
echo "These tests should NOT be skipped for production readiness!"
echo ""

# 1. Enable API Integration Tests
echo "1️⃣ Enabling API Integration Tests..."
sed -i '' 's/describe\.skip(/describe(/g' src/__tests__/integration/api.test.ts
sed -i '' 's/it\.skip(/it(/g' src/__tests__/integration/api.test.ts

# 2. Enable Health Check Tests
echo "2️⃣ Enabling Backend Health Tests..."
sed -i '' 's/describe\.skip(/describe(/g' src/integration/health.test.ts

# 3. Enable Onboarding Integration Tests (if API is ready)
echo "3️⃣ Enabling Onboarding Integration Tests..."
sed -i '' 's/describe\.skip(/describe(/g' src/screens/onboarding/__tests__/ComprehensiveRestaurantOnboardingScreen.integration.test.tsx

# 4. Enable Performance Tests (important for production)
echo "4️⃣ Enabling Performance Tests..."
sed -i '' 's/describe\.skip(/describe(/g' src/__tests__/performance/performance.test.ts

# 5. Update API endpoints to use production backend
echo "5️⃣ Updating test configurations to use production backend..."
cat > src/__tests__/config/test.config.ts << 'EOF'
/**
 * Test Configuration - Use REAL backend for integration tests
 */

export const TEST_CONFIG = {
  // Use REAL DigitalOcean backend for integration tests
  API_URL: 'https://fynlopos-9eg2c.ondigitalocean.app',
  API_VERSION: '/api/v1',
  
  // WebSocket URL for real-time tests
  WS_URL: 'wss://fynlopos-9eg2c.ondigitalocean.app/ws',
  
  // Test credentials (should be created in backend specifically for tests)
  TEST_USER: {
    email: 'test@fynlo.co.uk',
    password: 'TestPassword123!',
    restaurantId: 'test-restaurant-001',
  },
  
  // Timeouts for integration tests
  TIMEOUT: {
    API: 10000,      // 10 seconds for API calls
    WS: 5000,        // 5 seconds for WebSocket connection
    INTEGRATION: 30000, // 30 seconds for full integration flows
  },
  
  // Feature flags for conditional test execution
  FEATURES: {
    PAYMENTS: true,   // Test payment integrations
    WEBSOCKET: true,  // Test real-time features
    ONBOARDING: true, // Test onboarding flow
    PERFORMANCE: true, // Run performance benchmarks
  },
};

export default TEST_CONFIG;
EOF

# 6. Create a test helper for API integration
echo "6️⃣ Creating API test helper..."
cat > src/__tests__/helpers/apiTestHelper.ts << 'EOF'
/**
 * API Test Helper - Utilities for integration testing
 */

import TEST_CONFIG from '../config/test.config';

export class APITestHelper {
  private static token: string | null = null;
  
  /**
   * Check if backend is accessible
   */
  static async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${TEST_CONFIG.API_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }
  
  /**
   * Authenticate test user
   */
  static async authenticateTestUser(): Promise<string> {
    if (this.token) return this.token;
    
    try {
      const response = await fetch(`${TEST_CONFIG.API_URL}${TEST_CONFIG.API_VERSION}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_CONFIG.TEST_USER.email,
          password: TEST_CONFIG.TEST_USER.password,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }
      
      const data = await response.json();
      this.token = data.access_token;
      return this.token;
    } catch (error) {
      console.error('Test user authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * Make authenticated API request
   */
  static async makeAuthenticatedRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const token = await this.authenticateTestUser();
    
    const response = await fetch(`${TEST_CONFIG.API_URL}${TEST_CONFIG.API_VERSION}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Clean up test data
   */
  static async cleanupTestData(): Promise<void> {
    // Implement cleanup logic here
    this.token = null;
  }
}

export default APITestHelper;
EOF

# 7. Update WebSocket tests to use real server
echo "7️⃣ Configuring WebSocket tests..."
cat > src/services/websocket/__tests__/websocket.integration.test.ts << 'EOF'
/**
 * WebSocket Integration Tests - Using REAL WebSocket server
 */

import TEST_CONFIG from '../../../__tests__/config/test.config';
import WebSocketService from '../WebSocketService';

describe('WebSocket Integration - REAL Server', () => {
  let wsService: WebSocketService;
  
  beforeAll(async () => {
    // Skip if WebSocket tests are disabled
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      console.log('WebSocket tests disabled in configuration');
      return;
    }
    
    wsService = WebSocketService.getInstance();
  });
  
  afterAll(async () => {
    if (wsService) {
      await wsService.disconnect();
    }
  });
  
  it('should connect to production WebSocket server', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    const connected = await wsService.connect(TEST_CONFIG.WS_URL);
    expect(connected).toBe(true);
  }, TEST_CONFIG.TIMEOUT.WS);
  
  it('should receive heartbeat from server', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    return new Promise((resolve) => {
      wsService.on('heartbeat', () => {
        resolve(true);
      });
      
      setTimeout(() => {
        resolve(false);
      }, TEST_CONFIG.TIMEOUT.WS);
    });
  });
  
  it('should handle reconnection on disconnect', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    // Force disconnect
    await wsService.disconnect();
    
    // Should auto-reconnect
    const reconnected = await new Promise((resolve) => {
      wsService.on('reconnected', () => resolve(true));
      setTimeout(() => resolve(false), TEST_CONFIG.TIMEOUT.WS);
    });
    
    expect(reconnected).toBe(true);
  });
});
EOF

echo ""
echo "✅ Integration tests have been enabled!"
echo ""
echo "⚠️  IMPORTANT: Before running these tests:"
echo "1. Ensure the backend is running on DigitalOcean"
echo "2. Create a test user account for automated testing"
echo "3. Set up test database isolation if needed"
echo "4. Configure CI/CD to run integration tests separately"
echo ""
echo "To run integration tests:"
echo "npm run test:int"
echo ""
echo "To run ALL tests including integration:"
echo "npm test"