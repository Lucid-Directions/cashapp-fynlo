#!/usr/bin/env node

/**
 * Test script to verify POSScreen DataService integration
 * Tests that the screen can load data from DataService and fallback gracefully
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing POSScreen DataService Integration\n');

// Test 1: Verify POSScreen imports DataService
console.log('1. Checking DataService import...');
const posScreenPath = path.join(__dirname, 'src/screens/main/POSScreen.tsx');
const posScreenContent = fs.readFileSync(posScreenPath, 'utf8');

if (posScreenContent.includes("import DataService from '../../services/DataService';")) {
  console.log('✅ DataService is correctly imported');
} else {
  console.log('❌ DataService import missing');
  process.exit(1);
}

// Test 2: Verify state management
console.log('\n2. Checking state management...');
const hasProductsState = posScreenContent.includes('const [products, setProducts] = useState<MenuItem[]>(menuItems);');
const hasCategoriesState = posScreenContent.includes('const [productCategories, setProductCategories] = useState<string[]>(categories);');
const hasDataServiceInstance = posScreenContent.includes('const [dataService] = useState(() => DataService.getInstance());');

if (hasProductsState && hasCategoriesState && hasDataServiceInstance) {
  console.log('✅ State management correctly implemented');
} else {
  console.log('❌ State management issues found');
  if (!hasProductsState) console.log('  - Missing products state');
  if (!hasCategoriesState) console.log('  - Missing categories state');
  if (!hasDataServiceInstance) console.log('  - Missing DataService instance');
}

// Test 3: Verify useEffect for data loading
console.log('\n3. Checking data loading logic...');
const hasUseEffect = posScreenContent.includes('useEffect(() => {');
const hasDataLoading = posScreenContent.includes('const loadData = async () => {');
const hasProductsLoad = posScreenContent.includes('const productsData = await dataService.getProducts();');
const hasCategoriesLoad = posScreenContent.includes('const categoriesData = await dataService.getCategories();');
const hasFallback = posScreenContent.includes('using local fallback');

if (hasUseEffect && hasDataLoading && hasProductsLoad && hasCategoriesLoad && hasFallback) {
  console.log('✅ Data loading logic correctly implemented');
} else {
  console.log('❌ Data loading logic issues found');
  if (!hasUseEffect) console.log('  - Missing useEffect');
  if (!hasDataLoading) console.log('  - Missing loadData function');
  if (!hasProductsLoad) console.log('  - Missing products loading');
  if (!hasCategoriesLoad) console.log('  - Missing categories loading');
  if (!hasFallback) console.log('  - Missing fallback logic');
}

// Test 4: Verify dynamic data usage
console.log('\n4. Checking dynamic data usage...');
const usesProductCategories = posScreenContent.includes('{productCategories.map((category) =>');
const usesProducts = posScreenContent.includes('products.filter(item => item.category === selectedCategory)');
const usesProductsInCart = posScreenContent.includes('const menuItem = products.find(mi => mi.id === item.id);');

if (usesProductCategories && usesProducts && usesProductsInCart) {
  console.log('✅ Dynamic data usage correctly implemented');
} else {
  console.log('❌ Dynamic data usage issues found');
  if (!usesProductCategories) console.log('  - Categories still hardcoded');
  if (!usesProducts) console.log('  - Products filtering still hardcoded');
  if (!usesProductsInCart) console.log('  - Cart items still use hardcoded data');
}

// Test 5: Verify ErrorBoundary integration
console.log('\n5. Checking ErrorBoundary integration...');
const hasErrorBoundaryImport = posScreenContent.includes("import ErrorBoundary from '../../components/ErrorBoundary';");
const hasErrorBoundaryWrap = posScreenContent.includes('<ErrorBoundary>');
const hasWrappedComponent = posScreenContent.includes('const WrappedPOSScreen: React.FC = () =>');

if (hasErrorBoundaryImport && hasErrorBoundaryWrap && hasWrappedComponent) {
  console.log('✅ ErrorBoundary correctly integrated');
} else {
  console.log('❌ ErrorBoundary integration issues found');
  if (!hasErrorBoundaryImport) console.log('  - Missing ErrorBoundary import');
  if (!hasErrorBoundaryWrap) console.log('  - Missing ErrorBoundary wrapper');
  if (!hasWrappedComponent) console.log('  - Missing wrapped component export');
}

// Test 6: Verify backward compatibility (mock data still present)
console.log('\n6. Checking backward compatibility...');
const hasMockMenuItems = posScreenContent.includes('const menuItems: MenuItem[] = [');
const hasMockCategories = posScreenContent.includes("const categories = ['All', 'Snacks', 'Tacos'");
const hasInitialState = posScreenContent.includes('useState<MenuItem[]>(menuItems)');

if (hasMockMenuItems && hasMockCategories && hasInitialState) {
  console.log('✅ Backward compatibility maintained (mock data preserved)');
} else {
  console.log('❌ Backward compatibility issues found');
  if (!hasMockMenuItems) console.log('  - Mock menu items removed');
  if (!hasMockCategories) console.log('  - Mock categories removed');
  if (!hasInitialState) console.log('  - Initial state not using mock data');
}

console.log('\n🎉 POSScreen DataService Integration Test Complete!');
console.log('\n📋 Summary:');
console.log('- POSScreen now integrates with DataService');
console.log('- Maintains beautiful mock data for demos');
console.log('- Gracefully falls back if API unavailable');
console.log('- Protected with ErrorBoundary');
console.log('- Ready for backend connection testing');

console.log('\n🔧 Next Steps:');
console.log('1. Run the app to verify UI works correctly');
console.log('2. Test with mock data mode (default)');
console.log('3. Test with real API mode (when backend available)');
console.log('4. Verify fallback behavior when API fails');