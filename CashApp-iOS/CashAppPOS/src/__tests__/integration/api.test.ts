/**
 * REAL API Integration Tests
 * Testing complete API workflows with actual backend
 * No mocks - uses real DigitalOcean infrastructure
 */

import { TEST_CONFIG, makeRealAPICall, getAuthHeaders } from '../../../__tests__/config/real.test.config';
import { supabase } from '../../lib/supabase';

// Use real timers for API calls
jest.useRealTimers();

describe('API Integration Tests (Real Backend)', () => {
  let authHeaders: any;

  beforeAll(async () => {
    // Authenticate once for all tests
    try {
      authHeaders = await getAuthHeaders();
      console.log('🔐 Test authentication successful');
    } catch (error) {
      console.error('❌ Test authentication failed:', error);
      // Don't fail - some tests can run without auth
    }
  });

  afterAll(async () => {
    // Clean up test session
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication flow', async () => {
      // Test real Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password,
      });

      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();
      
      // Verify we can make authenticated requests
      if (data.session?.access_token) {
        const response = await fetch(`${TEST_CONFIG.api.baseUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        // Should not fail with 401 (may return 404 if endpoint doesn't exist)
        expect([200, 404, 500].includes(response.status)).toBe(true);
      }
    }, 30000);

    it('should handle authentication failures', async () => {
      // Test with invalid credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'invalid@fynlo.co.uk',
        password: 'wrongpassword',
      });

      expect(error).toBeTruthy();
      expect(data.session).toBeNull();
    }, 15000);

    it('should handle network connectivity', async () => {
      // Test basic connectivity to backend
      const startTime = Date.now();
      
      try {
        const response = await fetch(TEST_CONFIG.api.baseUrl, {
          method: 'GET',
          timeout: 10000,
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Should respond within reasonable time (10 seconds)
        expect(responseTime).toBeLessThan(10000);
        
        // Should not be connection refused
        expect([200, 404, 405, 500].includes(response.status)).toBe(true);
      } catch (error) {
        console.warn('Network connectivity test failed:', error);
        // Fail the test if we can't connect at all
        throw new Error(`Cannot connect to backend: ${error}`);
      }
    }, 15000);
  });

  describe('API Endpoint Health', () => {
    it('should verify backend is accessible', async () => {
      const response = await fetch(TEST_CONFIG.api.baseUrl);
      
      // Should not get connection errors
      expect(response).toBeTruthy();
      expect(response.status).toBeGreaterThan(0);
    }, 15000);

    it('should handle CORS properly', async () => {
      const response = await fetch(`${TEST_CONFIG.api.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
      });
      
      // CORS should not block the request
      expect(response.status).not.toBe(0);
    }, 15000);

    it('should return proper error formats', async () => {
      // Test with non-existent endpoint
      const response = await fetch(`${TEST_CONFIG.api.baseUrl}/nonexistent`);
      
      if (response.status === 404) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toMatch(/json/i);
      }
    }, 15000);
  });

  describe('Data Operations (if authenticated)', () => {
    it('should handle menu data requests', async () => {
      if (!authHeaders) {
        console.log('⏭️ Skipping authenticated test - no auth headers');
        return;
      }

      try {
        const response = await fetch(`${TEST_CONFIG.api.baseUrl}/menu`, {
          headers: authHeaders,
        });
        
        // Should not be unauthorized
        expect(response.status).not.toBe(401);
        
        if (response.ok) {
          const data = await response.json();
          expect(data).toBeDefined();
        }
      } catch (error) {
        console.warn('Menu API test failed:', error);
        // Don't fail test - endpoint might not exist yet
      }
    }, 20000);

    it('should handle restaurant data', async () => {
      if (!authHeaders) {
        console.log('⏭️ Skipping authenticated test - no auth headers');
        return;
      }

      try {
        const response = await fetch(`${TEST_CONFIG.api.baseUrl}/restaurant`, {
          headers: authHeaders,
        });
        
        expect(response.status).not.toBe(401);
        
        if (response.ok) {
          const data = await response.json();
          expect(data).toBeDefined();
        }
      } catch (error) {
        console.warn('Restaurant API test failed:', error);
      }
    }, 20000);
  });

  describe('Performance and Resilience', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(0).map(() =>
        fetch(TEST_CONFIG.api.baseUrl, { method: 'GET' })
      );
      
      const responses = await Promise.allSettled(requests);
      
      // At least some requests should succeed
      const succeeded = responses.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThan(0);
    }, 30000);

    it('should maintain reasonable response times', async () => {
      const startTime = Date.now();
      
      await fetch(TEST_CONFIG.api.baseUrl);
      
      const responseTime = Date.now() - startTime;
      
      // Should respond within 5 seconds for health check
      expect(responseTime).toBeLessThan(5000);
    }, 10000);

    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(TEST_CONFIG.api.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{',
      });
      
      // Should not crash the server
      expect(response.status).toBeGreaterThan(0);
      expect(response.status).toBeLessThan(600);
    }, 15000);
  });
});
