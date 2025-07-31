// Debug script to identify the restaurant loading issue
console.log('=== RESTAURANT ISSUE DEBUG SCRIPT ===');

// Simulate what happens in RestaurantDataService.getPlatformRestaurants
async function debugRestaurantLoading() {
  console.log('\n🔍 Step 1: Checking API endpoint');
  const API_CONFIG = {
    BASE_URL: 'http://192.168.0.109:8000',
    FULL_API_URL: 'http://192.168.0.109:8000/api/v1',
  };

  try {
    const url = `${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/platform_owner_1`;
    console.log('🌐 API URL:', url);

    // Check if API is reachable
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });

    console.log('📡 API Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response data:', JSON.stringify(data, null, 2));

      if (data && data.restaurants && Array.isArray(data.restaurants)) {
        console.log(`✅ Found ${data.restaurants.length} restaurants in API response`);
        data.restaurants.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.name || 'Unnamed'} (ID: ${r.id})`);
        });
      } else {
        console.log('❌ API response structure is invalid:', {
          hasData: !!data,
          hasRestaurants: !!data?.restaurants,
          restaurantsType: typeof data?.restaurants,
          isArray: Array.isArray(data?.restaurants),
        });
      }
    } else {
      console.log('❌ API request failed with status:', response.status);
    }
  } catch (apiError) {
    console.log('❌ API Error:', apiError.message);
    console.log('📦 Falling back to mock data check...');

    // Check mock restaurants in AuthContext
    const MOCK_RESTAURANTS = [
      {
        id: 'restaurant1',
        name: 'Chucho',
        address: '123 Camden High Street, London, NW1 7JR',
        platformOwnerId: 'platform_owner_1',
        isActive: true,
        monthlyRevenue: 45200,
      },
    ];

    console.log('🎭 Mock restaurants available:', MOCK_RESTAURANTS.length);
    MOCK_RESTAURANTS.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} (Platform Owner: ${r.platformOwnerId})`);
    });
  }

  console.log('\n🔍 Step 2: Checking local storage fallback');
  // In a real RN environment, this would be AsyncStorage, but for debug:
  console.log('📱 Would check AsyncStorage for key: "restaurants.platform_owner_1"');

  console.log('\n🔍 Step 3: Checking authentication flow');
  console.log('🔑 Platform owner ID in authentication: "platform_owner_1"');
  console.log('🏪 Expected restaurant should be "Chucho" with ID "restaurant1"');

  console.log('\n💡 DIAGNOSIS:');
  console.log('1. Check if backend API is running on http://192.168.0.109:8000');
  console.log(
    '2. Verify the API endpoint /api/v1/platform/restaurants/platform_owner_1 returns valid data'
  );
  console.log('3. Ensure the restaurant data has the correct platformOwnerId field');
  console.log('4. Check if the RestaurantDataService is being initialized properly');

  console.log('\n🛠️  POTENTIAL FIXES:');
  console.log('1. Initialize default restaurant data in SharedDataStore');
  console.log('2. Ensure MockDataService creates platform restaurant entries');
  console.log('3. Add restaurant data during platform owner authentication');
  console.log('4. Check the database has restaurant records with correct platform_owner_id');
}

debugRestaurantLoading().catch(console.error);
