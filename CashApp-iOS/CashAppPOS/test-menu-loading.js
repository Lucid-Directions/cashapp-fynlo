// Test script to verify menu loading works with fallback data
const { DataService } = require('./src/services/DataService');
const { logger } = require('./src/utils/logger');

async function testMenuLoading() {
  logger.info('Starting menu loading test...');
  
  try {
    const dataService = DataService.getInstance();
    
    // Test getMenuItems
    logger.info('Testing getMenuItems...');
    const menuItems = await dataService.getMenuItems();
    logger.info(`Got ${menuItems.length} menu items`);
    
    if (menuItems.length > 0) {
      logger.info('Sample item:', menuItems[0]);
    }
    
    // Test getMenuCategories
    logger.info('\nTesting getMenuCategories...');
    const categories = await dataService.getMenuCategories();
    logger.info(`Got ${categories.length} categories`);
    
    if (categories.length > 0) {
      logger.info('Sample category:', categories[0]);
    }
    
    logger.info('\n✅ Menu loading test completed successfully!');
    
  } catch (error) {
    logger.error('❌ Menu loading test failed:', error);
  }
}

// Run the test
testMenuLoading();