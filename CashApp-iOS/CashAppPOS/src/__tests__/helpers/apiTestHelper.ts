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
