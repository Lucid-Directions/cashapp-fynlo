/**
 * Real API Test Helper - Uses Actual Infrastructure
 * 
 * Flow:
 * 1. Authenticate with Supabase (real user account)
 * 2. Get Supabase token
 * 3. Verify token with DigitalOcean backend
 * 4. Use verified token for all API calls
 */

import { createClient } from '@supabase/supabase-js';
import TEST_CONFIG from '../config/test.config';

export class RealAPITestHelper {
  private static supabaseClient = createClient(
    TEST_CONFIG.SUPABASE.URL,
    TEST_CONFIG.SUPABASE.ANON_KEY
  );
  
  private static supabaseToken: string | null = null;
  private static backendToken: string | null = null;
  
  /**
   * Check if real backend is accessible
   */
  static async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        `${TEST_CONFIG.BACKEND.API_URL}${TEST_CONFIG.BACKEND.ENDPOINTS.HEALTH}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(TEST_CONFIG.TIMEOUT.API),
        }
      );
      
      if (!response.ok) {
        console.error(`Backend health check failed: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      console.log('Backend health check:', data);
      return true;
    } catch (error) {
      console.error('Backend health check error:', error);
      return false;
    }
  }
  
  /**
   * Authenticate with Supabase (real authentication)
   */
  static async authenticateWithSupabase(): Promise<string> {
    if (this.supabaseToken) return this.supabaseToken;
    
    try {
      console.log('🔐 Authenticating with Supabase...');
      
      // Sign in with real Supabase account
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email: TEST_CONFIG.SUPABASE.TEST_USER.email,
        password: TEST_CONFIG.SUPABASE.TEST_USER.password,
      });
      
      if (error) {
        throw new Error(`Supabase auth failed: ${error.message}`);
      }
      
      if (!data.session) {
        throw new Error('No session returned from Supabase');
      }
      
      this.supabaseToken = data.session.access_token;
      console.log('✅ Supabase authentication successful');
      
      return this.supabaseToken;
    } catch (error) {
      console.error('❌ Supabase authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify Supabase token with DigitalOcean backend
   */
  static async verifyWithBackend(): Promise<any> {
    const supabaseToken = await this.authenticateWithSupabase();
    
    try {
      console.log('🔍 Verifying with DigitalOcean backend...');
      
      const response = await fetch(
        `${TEST_CONFIG.BACKEND.FULL_API_URL}${TEST_CONFIG.BACKEND.ENDPOINTS.AUTH_VERIFY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseToken}`,
          },
          signal: AbortSignal.timeout(TEST_CONFIG.TIMEOUT.AUTH),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend verification failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Backend verification successful');
      
      // Store the verified token for future requests
      this.backendToken = supabaseToken;
      
      return data;
    } catch (error) {
      console.error('❌ Backend verification failed:', error);
      throw error;
    }
  }
  
  /**
   * Make authenticated request to DigitalOcean backend
   */
  static async makeAuthenticatedRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    // Ensure we have a verified token
    if (!this.backendToken) {
      await this.verifyWithBackend();
    }
    
    try {
      const url = `${TEST_CONFIG.BACKEND.FULL_API_URL}${endpoint}`;
      console.log(`📡 ${method} ${url}`);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.backendToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TEST_CONFIG.TIMEOUT.API),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
  
  /**
   * Test WebSocket connection with authentication
   */
  static async testWebSocketConnection(): Promise<boolean> {
    // Ensure we have a verified token
    if (!this.backendToken) {
      await this.verifyWithBackend();
    }
    
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to WebSocket...');
        
        // Connect with auth token in query params (as per backend implementation)
        const wsUrl = `${TEST_CONFIG.WEBSOCKET.URL}?token=${this.backendToken}`;
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, TEST_CONFIG.TIMEOUT.WS);
        
        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          clearTimeout(timeout);
          
          // Test heartbeat
          ws.send(JSON.stringify({ type: 'ping' }));
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          
          if (data.type === 'pong' || data.type === 'heartbeat') {
            ws.close();
            resolve(true);
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          clearTimeout(timeout);
          reject(error);
        };
        
        ws.onclose = () => {
          console.log('🔌 WebSocket closed');
        };
      } catch (error) {
        console.error('WebSocket test error:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Clean up test data and sign out
   */
  static async cleanup(): Promise<void> {
    try {
      // Sign out from Supabase
      if (this.supabaseToken) {
        await this.supabaseClient.auth.signOut();
        console.log('👋 Signed out from Supabase');
      }
      
      // Clear tokens
      this.supabaseToken = null;
      this.backendToken = null;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
  
  /**
   * Run a complete integration test flow
   */
  static async runIntegrationFlow(): Promise<void> {
    console.log('🚀 Starting integration test flow...');
    
    try {
      // 1. Check backend health
      const isHealthy = await this.checkBackendHealth();
      if (!isHealthy) {
        throw new Error('Backend is not healthy');
      }
      
      // 2. Authenticate with Supabase
      await this.authenticateWithSupabase();
      
      // 3. Verify with backend
      const verifyResult = await this.verifyWithBackend();
      console.log('User info:', verifyResult.user);
      
      // 4. Test authenticated API call
      const products = await this.makeAuthenticatedRequest('/products/mobile');
      console.log(`Fetched ${products.length} products`);
      
      // 5. Test WebSocket connection
      const wsConnected = await this.testWebSocketConnection();
      console.log('WebSocket test:', wsConnected ? 'PASSED' : 'FAILED');
      
      console.log('✅ Integration test flow completed successfully!');
    } catch (error) {
      console.error('❌ Integration test flow failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

export default RealAPITestHelper;