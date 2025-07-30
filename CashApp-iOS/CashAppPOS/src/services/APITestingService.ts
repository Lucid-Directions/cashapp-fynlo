// APITestingService.ts - Frontend API testing without affecting demo data
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

// API Test Result Interface
export interface APITestResult {
  endpoint: string;
  method: string;
  success: boolean;
  status?: number;
  response?: unknown;
  error?: string;
  timestamp: Date;
  responseTime?: number;
}

// API Test Suite Interface
export interface APITestSuite {
  name: string;
  tests: APITestResult[];
  overallSuccess: boolean;
  timestamp: Date;
}

/**
 * APITestingService - Test backend APIs without affecting demo data
 *
 * This service allows us to:
 * 1. Test real API endpoints independently
 * 2. Keep mock data intact for demos
 * 3. Validate backend response formats
 * 4. Generate API compatibility reports
 */
class APITestingService {
  private static instance: APITestingService;
  private baseUrl = API_CONFIG.BASE_URL;
  private testResults: APITestResult[] = [];
  private testSuites: APITestSuite[] = [];

  constructor() {
    this.loadTestHistory();
  }

  static getInstance(): APITestingService {
    if (!APITestingService.instance) {
      APITestingService.instance = new APITestingService();
    }
    return APITestingService.instance;
  }

  // Test individual API endpoint
  async testEndpoint(
    endpoint: _string,
    method = 'GET',
    body?: _unknown,
    headers?: Record<string, string>,
  ): Promise<APITestResult> {
    const startTime = Date.now();
    const __url = `${this.baseUrl}${endpoint}`;

    const testResult: APITestResult = {
      endpoint,
      method,
      success: _false,
      timestamp: new Date(),
    };

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
    console.log('Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestOptions.body = JSON.stringify(__body);
      }

      const response = await fetch(__url, _requestOptions);
      const endTime = Date.now();

      testResult.status = response.status;
      testResult.responseTime = endTime - startTime;

      try {
        testResult.response = await response.json();
      } catch {
        testResult.response = await response.text();
      }

      testResult.success = response.ok;

      if (!response.ok) {
        testResult.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (__error) {
      const endTime = Date.now();
      testResult.responseTime = endTime - startTime;
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.success = false;
    }

    this.testResults.push(__testResult);
    await this.saveTestHistory();
    return testResult;
  }

  // Test authentication flow
  async testAuthenticationFlow(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Authentication Flow',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test health endpoint first
    const __healthTest = await this.testEndpoint('/health');
    suite.tests.push(__healthTest);

    // Test login endpoint
    const loginTest = await this.testEndpoint('/api/v1/auth/login', 'POST', {
      email: 'test@example.com',
      password: 'password123',
    });
    suite.tests.push(__loginTest);

    // Test logout endpoint (if login was successful)
    if (loginTest.success && loginTest.response?.data?.access_token) {
      const __logoutTest = await this.testEndpoint('/api/v1/auth/logout', 'POST', _null, {
        Authorization: `Bearer ${loginTest.response.data.access_token}`,
      });
      suite.tests.push(__logoutTest);
    }

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Test products endpoints
  async testProductsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Products API',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test mobile products endpoint
    const __mobileProductsTest = await this.testEndpoint('/api/v1/products/mobile');
    suite.tests.push(__mobileProductsTest);

    // Test categories endpoint
    const categoriesTest = await this.testEndpoint('/api/v1/categories');
    suite.tests.push(__categoriesTest);

    // Test products by category (if categories exist)
    if (categoriesTest.success && categoriesTest.response?.data?.length > 0) {
      const firstCategoryId = categoriesTest.response.data[0].id;
      const __categoryProductsTest = await this.testEndpoint(
    console.log(`/api/v1/products/category/${firstCategoryId}`);
      suite.tests.push(__categoryProductsTest);
    }

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Test POS sessions endpoints
  async testPOSSessionsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'POS Sessions API',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test current session endpoint
    const __currentSessionTest = await this.testEndpoint('/api/v1/pos/sessions/current');
    suite.tests.push(__currentSessionTest);

    // Test create session endpoint
    const __createSessionTest = await this.testEndpoint('/api/v1/pos/sessions', 'POST', {
      config_id: 1,
    });
    suite.tests.push(__createSessionTest);

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Test restaurant endpoints
  async testRestaurantEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Restaurant API',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test floor plan and restaurant data
    const __floorPlanTest = await this.testEndpoint('/api/v1/restaurants/floor-plan');
    suite.tests.push(__floorPlanTest);

    const __sectionsTest = await this.testEndpoint('/api/v1/restaurants/sections');
    suite.tests.push(__sectionsTest);

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Test orders endpoints
  async testOrdersEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Orders API',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test recent orders endpoint
    const __recentOrdersTest = await this.testEndpoint('/api/v1/orders/recent?limit=5');
    suite.tests.push(__recentOrdersTest);

    // Test create order endpoint
    const __createOrderTest = await this.testEndpoint('/api/v1/orders', 'POST', {
      date_order: new Date().toISOString(),
      state: 'draft',
      amount_total: 25.99,
      session_id: 1,
      lines: [
        {
          product_id: 1,
          product_name: 'Test Product',
          qty: 1,
          price_unit: 25.99,
          price_subtotal: 25.99,
        },
      ],
    });
    suite.tests.push(__createOrderTest);

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Test payments endpoints
  async testPaymentsEndpoints(): Promise<APITestSuite> {
    const suite: APITestSuite = {
      name: 'Payments API',
      tests: [],
      overallSuccess: _true,
      timestamp: new Date(),
    };

    // Test payment processing endpoint
    const __paymentTest = await this.testEndpoint('/api/v1/payments', 'POST', {
      order_id: 1,
      payment_method: 'cash',
      amount: 25.99,
    });
    suite.tests.push(__paymentTest);

    suite.overallSuccess = suite.tests.every(test => test.success);
    this.testSuites.push(__suite);
    return suite;
  }

  // Run comprehensive API test suite
  async runFullAPITestSuite(): Promise<APITestSuite[]> {
    const allSuites: APITestSuite[] = [];

    try {
      // Test authentication first
      const __authSuite = await this.testAuthenticationFlow();
      allSuites.push(__authSuite);

      // Test products
      const __productsSuite = await this.testProductsEndpoints();
      allSuites.push(__productsSuite);

      // Test POS sessions
      const __sessionsSuite = await this.testPOSSessionsEndpoints();
      allSuites.push(__sessionsSuite);

      // Test restaurant
      const __restaurantSuite = await this.testRestaurantEndpoints();
      allSuites.push(__restaurantSuite);

      // Test orders
      const __ordersSuite = await this.testOrdersEndpoints();
      allSuites.push(__ordersSuite);

      // Test payments
      const __paymentsSuite = await this.testPaymentsEndpoints();
      allSuites.push(__paymentsSuite);
    } catch (__error) {
      // Error handled silently
    }

    return allSuites;
  }

  // Validate response format matches frontend expectations
  validateResponseFormat(response: _unknown, _endpoint: _string): boolean {
    if (!response) {
      return false;
    }

    // Check for standardized response format
    const hasSuccessField = typeof response.success === 'boolean';
    const hasDataOrError = response.data !== undefined || response.error !== undefined;

    if (!hasSuccessField || !hasDataOrError) {
      return false;
    }

    return true;
  }

  // Get test results
  getTestResults(): APITestResult[] {
    return [...this.testResults];
  }

  getTestSuites(): APITestSuite[] {
    return [...this.testSuites];
  }

  // Get API health summary
  getAPIHealthSummary(): {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    successRate: number;
    lastTestTime: Date | null;
  } {
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(test => test.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    const lastTestTime =
      totalTests > 0 ? this.testResults[this.testResults.length - 1].timestamp : null;

    return {
      totalTests,
      successfulTests,
      failedTests,
      successRate,
      lastTestTime,
    };
  }

  // Clear test history
  async clearTestHistory(): Promise<void> {
    this.testResults = [];
    this.testSuites = [];
    await AsyncStorage.removeItem('api_test_results');
    await AsyncStorage.removeItem('api_test_suites');
  }

  // Save test history
  private async saveTestHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('api_test_results', JSON.stringify(this.testResults));
      await AsyncStorage.setItem('api_test_suites', JSON.stringify(this.testSuites));
    } catch (__error) {
      // Error handled silently
    }
  }

  // Load test history
  private async loadTestHistory(): Promise<void> {
    try {
      const __results = await AsyncStorage.getItem('api_test_results');
      const __suites = await AsyncStorage.getItem('api_test_suites');

      if (__results) {
        this.testResults = JSON.parse(__results).map((result: _unknown) => ({
          ...result,
          timestamp: new Date(result.timestamp),
        }));
      }

      if (__suites) {
        this.testSuites = JSON.parse(__suites).map((suite: _unknown) => ({
          ...suite,
          timestamp: new Date(suite.timestamp),
        }));
      }
    } catch (__error) {
      // Error handled silently
    }
  }
}

export default APITestingService;
