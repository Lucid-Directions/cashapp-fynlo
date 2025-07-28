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
    console.log('🧪 Starting DataService comprehensive tests...\n');

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
    const passed = Object.values(this.testResults).filter(Boolean).length;
    const failed = Object.values(this.testResults).filter(r => !r).length;

    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    // Print detailed results
    Object.entries(this.testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`);
    });

    return { passed, failed, results: this.testResults };
  }

  private async testFeatureFlags(): Promise<void> {
    console.log('1️⃣ Testing Feature Flags...');
    
    try {
      // Test getting default flags
      const initialFlags = this.dataService.getFeatureFlags();
      console.log('   📄 Initial flags:', initialFlags);
      
      // Test updating a flag
      await this.dataService.updateFeatureFlag('USE_REAL_API', true);
      const updatedFlags = this.dataService.getFeatureFlags();
      
      const success = updatedFlags.USE_REAL_API === true;
      this.testResults['Feature Flags Update'] = success;
      console.log(`   ${success ? '✅' : '❌'} Flag update: ${success}`);
      
      // Reset for other tests
      await this.dataService.resetToMockData();
      
    } catch (error) {
      console.log('   ❌ Feature flags test failed:', error);
      this.testResults['Feature Flags Update'] = false;
    }
  }

  private async testMockDataSystem(): Promise<void> {
    console.log('\n2️⃣ Testing Mock Data System...');
    
    try {
      // Ensure we're in mock mode
      await this.dataService.resetToMockData();
      
      // Test products
      const products = await this.dataService.getProducts();
      const productsValid = Array.isArray(products) && products.length > 0;
      this.testResults['Mock Products'] = productsValid;
      console.log(`   ${productsValid ? '✅' : '❌'} Products: ${products.length} items`);
      
      // Test categories
      const categories = await this.dataService.getCategories();
      const categoriesValid = Array.isArray(categories) && categories.length > 0;
      this.testResults['Mock Categories'] = categoriesValid;
      console.log(`   ${categoriesValid ? '✅' : '❌'} Categories: ${categories.length} items`);
      
      // Test authentication
      const authResult = await this.dataService.login('demo', 'demo');
      this.testResults['Mock Authentication'] = authResult;
      console.log(`   ${authResult ? '✅' : '❌'} Authentication: ${authResult}`);
      
      // Test floor plan
      const floorPlan = await this.dataService.getRestaurantFloorPlan();
      const floorPlanValid = floorPlan && floorPlan.tables && floorPlan.sections;
      this.testResults['Mock Floor Plan'] = floorPlanValid;
      console.log(`   ${floorPlanValid ? '✅' : '❌'} Floor Plan: ${floorPlan?.tables?.length || 0} tables`);
      
      // Test reports
      const report = await this.dataService.getDailySalesReport();
      const reportValid = report && report.summary;
      this.testResults['Mock Reports'] = reportValid;
      console.log(`   ${reportValid ? '✅' : '❌'} Reports: £${report?.summary?.total_sales || 0}`);
      
    } catch (error) {
      console.log('   ❌ Mock data test failed:', error);
      this.testResults['Mock Data System'] = false;
    }
  }

  private async testAPISwitching(): Promise<void> {
    console.log('\n3️⃣ Testing API Switching...');
    
    try {
      // Test switching to real API mode
      await this.dataService.enableRealAPI();
      const flags = this.dataService.getFeatureFlags();
      const apiEnabled = flags.USE_REAL_API === true;
      
      this.testResults['API Mode Switch'] = apiEnabled;
      console.log(`   ${apiEnabled ? '✅' : '❌'} Switch to real API: ${apiEnabled}`);
      
      // Test connection status
      const status = this.dataService.getConnectionStatus();
      const statusValid = status && typeof status.mode === 'string' && typeof status.backend === 'boolean';
      
      this.testResults['Connection Status'] = statusValid;
      console.log(`   ${statusValid ? '✅' : '❌'} Status check: Mode=${status.mode}, Backend=${status.backend}`);
      
      // Reset to mock for other tests
      await this.dataService.resetToMockData();
      
    } catch (error) {
      console.log('   ❌ API switching test failed:', error);
      this.testResults['API Mode Switch'] = false;
    }
  }

  private async testFallbackBehavior(): Promise<void> {
    console.log('\n4️⃣ Testing Fallback Behavior...');
    
    try {
      // Enable real API but expect fallback to mock (since backend likely not running)
      await this.dataService.enableRealAPI();
      
      // Try to get products - should fallback to mock data
      const products = await this.dataService.getProducts();
      const fallbackWorking = Array.isArray(products) && products.length > 0;
      
      this.testResults['Fallback to Mock'] = fallbackWorking;
      console.log(`   ${fallbackWorking ? '✅' : '❌'} Fallback working: Got ${products.length} products`);
      
      // Test that we still get beautiful data even when API fails
      const report = await this.dataService.getDailySalesReport();
      const reportFallback = report && report.summary && report.summary.total_sales > 0;
      
      this.testResults['Report Fallback'] = reportFallback;
      console.log(`   ${reportFallback ? '✅' : '❌'} Report fallback: £${report?.summary?.total_sales || 0}`);
      
      await this.dataService.resetToMockData();
      
    } catch (error) {
      console.log('   ❌ Fallback test failed:', error);
      this.testResults['Fallback to Mock'] = false;
    }
  }

  private async testAuthenticationModes(): Promise<void> {
    console.log('\n5️⃣ Testing Authentication Modes...');
    
    try {
      // Test mock authentication
      await this.dataService.updateFeatureFlag('MOCK_AUTHENTICATION', true);
      const mockAuth = await this.dataService.login('demo', 'demo');
      
      this.testResults['Mock Auth Mode'] = mockAuth;
      console.log(`   ${mockAuth ? '✅' : '❌'} Mock auth: ${mockAuth}`);
      
      // Test invalid mock credentials
      const invalidMockAuth = await this.dataService.login('invalid', 'wrong');
      const mockValidation = !invalidMockAuth; // Should be false
      
      this.testResults['Mock Auth Validation'] = mockValidation;
      console.log(`   ${mockValidation ? '✅' : '❌'} Mock validation: ${mockValidation}`);
      
    } catch (error) {
      console.log('   ❌ Authentication test failed:', error);
      this.testResults['Mock Auth Mode'] = false;
    }
  }

  private async testPaymentModes(): Promise<void> {
    console.log('\n6️⃣ Testing Payment Modes...');
    
    try {
      // Test mock payment mode (should always succeed)
      await this.dataService.updateFeatureFlag('ENABLE_PAYMENTS', false);
      const mockPayment = await this.dataService.processPayment(123, 'card', 25.99);
      
      this.testResults['Mock Payment'] = mockPayment;
      console.log(`   ${mockPayment ? '✅' : '❌'} Mock payment: ${mockPayment}`);
      
      // Test different payment methods
      const paymentMethods = ['card', 'cash', 'apple_pay'];
      let allPaymentsSucceed = true;
      
      for (const method of paymentMethods) {
        const result = await this.dataService.processPayment(123, method, 10.00);
        if (!result) allPaymentsSucceed = false;
      }
      
      this.testResults['Payment Methods'] = allPaymentsSucceed;
      console.log(`   ${allPaymentsSucceed ? '✅' : '❌'} All payment methods: ${allPaymentsSucceed}`);
      
    } catch (error) {
      console.log('   ❌ Payment test failed:', error);
      this.testResults['Mock Payment'] = false;
    }
  }

  private async testBackendDetection(): Promise<void> {
    console.log('\n7️⃣ Testing Backend Detection...');
    
    try {
      // Test connection status reporting
      const status = this.dataService.getConnectionStatus();
      const hasRequiredFields = status.mode && typeof status.backend === 'boolean' && status.flags;
      
      this.testResults['Status Reporting'] = hasRequiredFields;
      console.log(`   ${hasRequiredFields ? '✅' : '❌'} Status structure: ${hasRequiredFields}`);
      
      // Test that backend detection doesn't crash
      await this.dataService.enableRealAPI();
      
      // Wait a moment for backend check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newStatus = this.dataService.getConnectionStatus();
      const detectionWorking = newStatus.mode === 'REAL';
      
      this.testResults['Backend Detection'] = detectionWorking;
      console.log(`   ${detectionWorking ? '✅' : '❌'} Detection working: ${detectionWorking}`);
      
      await this.dataService.resetToMockData();
      
    } catch (error) {
      console.log('   ❌ Backend detection test failed:', error);
      this.testResults['Backend Detection'] = false;
    }
  }

  // Quick test method for development
  async quickTest(): Promise<boolean> {
    console.log('⚡ Running quick DataService test...');
    
    try {
      // Test basic functionality
      await this.dataService.resetToMockData();
      const products = await this.dataService.getProducts();
      const categories = await this.dataService.getCategories();
      const auth = await this.dataService.login('demo', 'demo');
      
      const success = products.length > 0 && categories.length > 0 && auth;
      
      console.log(`${success ? '✅' : '❌'} Quick test: ${success ? 'PASSED' : 'FAILED'}`);
      console.log(`   Products: ${products.length}, Categories: ${categories.length}, Auth: ${auth}`);
      
      return success;
    } catch (error) {
      console.log('❌ Quick test failed:', error);
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
if (__DEV__) {
  (global as any).testDataService = runDataServiceTests;
  (global as any).quickTestDataService = quickTestDataService;
}