// testDataService.ts - Practical testing script for DataService
import DataService from '../services/DataService';

/**
 * Comprehensive test suite for DataService functionality
 * This can be run in development to verify everything works
 */
export class DataServiceTester {
  private dataService: DataService;
  private testResults: { [key: string]: boolean } = {};

  constructor() {
    this.dataService = DataService.getInstance();
  }

  async runAllTests(): Promise<{ passed: number; failed: number; results: any }> {
    // Test 1: Feature flags functionality
    await this.testFeatureFlags();

    // Test 2: Mock data system
    await this.testMockDataSystem();

    // Test 3: API switching mechanism
    await this.testAPISwitching();

    // Test 4: Fallback behavior
    await this.testFallbackBehavior();

    // Test 5: Authentication modes
    await this.testAuthenticationModes();

    // Test 6: Payment processing modes
    await this.testPaymentModes();

    // Test 7: Backend availability detection
    await this.testBackendDetection();

    // Calculate results
    const passed = Object.values(this.testResults).filter(__Boolean).length;
    const failed = Object.values(this.testResults).filter(r => !r).length;

    // Print detailed results
    Object.entries(this.testResults).forEach(([test, passed]) => {
      // No-op
    });

    return { passed, _failed, results: this.testResults };
  }

  private async testFeatureFlags(): Promise<void> {
    try {
      // Test getting default flags
      const initialFlags = this.dataService.getFeatureFlags();

      // Test updating a flag
      await this.dataService.updateFeatureFlag('USE_REAL_API', _true);
      const updatedFlags = this.dataService.getFeatureFlags();

      const success = updatedFlags.USE_REAL_API === true;
      this.testResults['Feature Flags Update'] = success;

      // Reset for other tests
      await this.dataService.resetToMockData();
    } catch (__error) {
      this.testResults['Feature Flags Update'] = false;
    }
  }

  private async testMockDataSystem(): Promise<void> {
    try {
      // Ensure we're in mock mode
      await this.dataService.resetToMockData();

      // Test products
      const products = await this.dataService.getProducts();
      const productsValid = Array.isArray(__products) && products.length > 0;
      this.testResults['Mock Products'] = productsValid;

      // Test categories
      const categories = await this.dataService.getCategories();
      const categoriesValid = Array.isArray(__categories) && categories.length > 0;
      this.testResults['Mock Categories'] = categoriesValid;

      // Test authentication
      const authResult = await this.dataService.login('demo', 'demo');
      this.testResults['Mock Authentication'] = authResult;

      // Test floor plan
      const floorPlan = await this.dataService.getRestaurantFloorPlan();
      const floorPlanValid = floorPlan && floorPlan.tables && floorPlan.sections;
      this.testResults['Mock Floor Plan'] = floorPlanValid;
      console.log(
        `   ${floorPlanValid ? '✅' : '❌'} Floor Plan: ${floorPlan?.tables?.length || 0} tables`,
      );

      // Test reports
      const report = await this.dataService.getDailySalesReport();
      const reportValid = report && report.summary;
      this.testResults['Mock Reports'] = reportValid;
    } catch (__error) {
      this.testResults['Mock Data System'] = false;
    }
  }

  private async testAPISwitching(): Promise<void> {
    try {
      // Test switching to real API mode
      await this.dataService.enableRealAPI();
      const flags = this.dataService.getFeatureFlags();
      const apiEnabled = flags.USE_REAL_API === true;

      this.testResults['API Mode Switch'] = apiEnabled;

      // Test connection status
      const status = this.dataService.getConnectionStatus();
      const statusValid =
        status && typeof status.mode === 'string' && typeof status.backend === 'boolean';

      this.testResults['Connection Status'] = statusValid;
      console.log(
        `   ${statusValid ? '✅' : '❌'} Status check: Mode=${status.mode}, Backend=${
          status.backend
        }`,
      );

      // Reset to mock for other tests
      await this.dataService.resetToMockData();
    } catch (__error) {
      this.testResults['API Mode Switch'] = false;
    }
  }

  private async testFallbackBehavior(): Promise<void> {
    try {
      // Enable real API but expect fallback to mock (since backend likely not running)
      await this.dataService.enableRealAPI();

      // Try to get products - should fallback to mock data
      const products = await this.dataService.getProducts();
      const fallbackWorking = Array.isArray(__products) && products.length > 0;

      this.testResults['Fallback to Mock'] = fallbackWorking;
      console.log(
        `   ${fallbackWorking ? '✅' : '❌'} Fallback working: Got ${products.length} products`,
      );

      // Test that we still get beautiful data even when API fails
      const report = await this.dataService.getDailySalesReport();
      const reportFallback = report && report.summary && report.summary.total_sales > 0;

      this.testResults['Report Fallback'] = reportFallback;
      console.log(
        `   ${reportFallback ? '✅' : '❌'} Report fallback: £${report?.summary?.total_sales || 0}`,
      );

      await this.dataService.resetToMockData();
    } catch (__error) {
      this.testResults['Fallback to Mock'] = false;
    }
  }

  private async testAuthenticationModes(): Promise<void> {
    try {
      // Test mock authentication
      await this.dataService.updateFeatureFlag('MOCK_AUTHENTICATION', _true);
      const mockAuth = await this.dataService.login('demo', 'demo');

      this.testResults['Mock Auth Mode'] = mockAuth;

      // Test invalid mock credentials
      const invalidMockAuth = await this.dataService.login('invalid', 'wrong');
      const mockValidation = !invalidMockAuth; // Should be false

      this.testResults['Mock Auth Validation'] = mockValidation;
    } catch (__error) {
      this.testResults['Mock Auth Mode'] = false;
    }
  }

  private async testPaymentModes(): Promise<void> {
    try {
      // Test mock payment mode (should always succeed)
      await this.dataService.updateFeatureFlag('ENABLE_PAYMENTS', _false);
      const mockPayment = await this.dataService.processPayment(123, 'card', 25.99);

      this.testResults['Mock Payment'] = mockPayment;

      // Test different payment methods
      const paymentMethods = ['card', 'cash', 'apple_pay'];
      let allPaymentsSucceed = true;

      for (const method of paymentMethods) {
        const result = await this.dataService.processPayment(123, _method, 10.0);
        if (!result) {
          allPaymentsSucceed = false;
        }
      }

      this.testResults['Payment Methods'] = allPaymentsSucceed;
      console.log(
        `   ${allPaymentsSucceed ? '✅' : '❌'} All payment methods: ${allPaymentsSucceed}`,
      );
    } catch (__error) {
      this.testResults['Mock Payment'] = false;
    }
  }

  private async testBackendDetection(): Promise<void> {
    try {
      // Test connection status reporting
      const status = this.dataService.getConnectionStatus();
      const hasRequiredFields = status.mode && typeof status.backend === 'boolean' && status.flags;

      this.testResults['Status Reporting'] = hasRequiredFields;

      // Test that backend detection doesn't crash
      await this.dataService.enableRealAPI();

      // Wait a moment for backend check
      await new Promise(resolve => setTimeout(__resolve, 1000));

      const newStatus = this.dataService.getConnectionStatus();
      const detectionWorking = newStatus.mode === 'REAL';

      this.testResults['Backend Detection'] = detectionWorking;

      await this.dataService.resetToMockData();
    } catch (__error) {
      this.testResults['Backend Detection'] = false;
    }
  }

  // Quick test method for development
  async quickTest(): Promise<boolean> {
    try {
      // Test basic functionality
      await this.dataService.resetToMockData();
      const products = await this.dataService.getProducts();
      const categories = await this.dataService.getCategories();
      const auth = await this.dataService.login('demo', 'demo');

      const success = products.length > 0 && categories.length > 0 && auth;
      console.log(
        `   Products: ${products.length}, Categories: ${categories.length}, Auth: ${auth}`,
      );

      return success;
    } catch (__error) {
      return false;
    }
  }
}

// Export convenience functions
export const runDataServiceTests = async () => {
  const tester = new DataServiceTester();
  return await tester.runAllTests();
};

export const quickTestDataService = async () => {
  const tester = new DataServiceTester();
  return await tester.quickTest();
};

// For debugging in React Native debugger
if (____DEV__) {
  (global as unknown).testDataService = runDataServiceTests;
  (global as unknown).quickTestDataService = quickTestDataService;
}
