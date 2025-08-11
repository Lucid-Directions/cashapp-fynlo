/**
 * FallbackMenuService - Provides demo menu data when API is unavailable
 * This ensures the app remains functional for testing and demos
 */

import { MenuItem } from '../types';
import { logger } from '../utils/logger';

class FallbackMenuService {
  private static instance: FallbackMenuService;

  private constructor() {}

  static getInstance(): FallbackMenuService {
    if (!FallbackMenuService.instance) {
      FallbackMenuService.instance = new FallbackMenuService();
    }
    return FallbackMenuService.instance;
  }

  /**
   * Get demo menu items for testing when API is unavailable
   */
  getDemoMenuItems(): MenuItem[] {
    logger.info('📦 Using demo menu data (API unavailable)');
    
    return [
      // Starters
      {
        id: 'demo-1',
        name: 'Garlic Bread',
        description: 'Freshly baked bread with garlic butter',
        price: 4.99,
        category: 'Starters',
        emoji: '🥖',
        icon: 'bread-slice',
        available: true,
      },
      {
        id: 'demo-2',
        name: 'Soup of the Day',
        description: 'Ask your server for today\'s selection',
        price: 5.99,
        category: 'Starters',
        emoji: '🍲',
        icon: 'bowl-hot',
        available: true,
      },
      {
        id: 'demo-3',
        name: 'Caesar Salad',
        description: 'Crisp romaine lettuce with Caesar dressing',
        price: 7.99,
        category: 'Starters',
        emoji: '🥗',
        icon: 'salad',
        available: true,
      },

      // Mains
      {
        id: 'demo-4',
        name: 'Fish & Chips',
        description: 'Beer battered cod with chunky chips and mushy peas',
        price: 12.99,
        category: 'Mains',
        emoji: '🐟',
        icon: 'fish',
        available: true,
      },
      {
        id: 'demo-5',
        name: 'Chicken Tikka Masala',
        description: 'Tender chicken in creamy tomato sauce with rice',
        price: 13.99,
        category: 'Mains',
        emoji: '🍛',
        icon: 'bowl-rice',
        available: true,
      },
      {
        id: 'demo-6',
        name: 'Beef Burger',
        description: '8oz beef patty with lettuce, tomato, and fries',
        price: 14.99,
        category: 'Mains',
        emoji: '🍔',
        icon: 'burger',
        available: true,
      },
      {
        id: 'demo-7',
        name: 'Vegetarian Lasagne',
        description: 'Layers of pasta with roasted vegetables',
        price: 11.99,
        category: 'Mains',
        emoji: '🍝',
        icon: 'cheese',
        available: true,
      },

      // Desserts
      {
        id: 'demo-8',
        name: 'Chocolate Brownie',
        description: 'Warm brownie with vanilla ice cream',
        price: 5.99,
        category: 'Desserts',
        emoji: '🍫',
        icon: 'cookie',
        available: true,
      },
      {
        id: 'demo-9',
        name: 'Cheesecake',
        description: 'New York style with berry compote',
        price: 6.99,
        category: 'Desserts',
        emoji: '🍰',
        icon: 'cake-candles',
        available: true,
      },
      {
        id: 'demo-10',
        name: 'Ice Cream Selection',
        description: 'Choose from vanilla, chocolate, or strawberry',
        price: 4.99,
        category: 'Desserts',
        emoji: '🍦',
        icon: 'ice-cream',
        available: true,
      },

      // Drinks
      {
        id: 'demo-11',
        name: 'Coca Cola',
        description: 'Regular or Diet',
        price: 2.99,
        category: 'Drinks',
        emoji: '🥤',
        icon: 'glass',
        available: true,
      },
      {
        id: 'demo-12',
        name: 'Orange Juice',
        description: 'Freshly squeezed',
        price: 3.49,
        category: 'Drinks',
        emoji: '🍊',
        icon: 'citrus',
        available: true,
      },
      {
        id: 'demo-13',
        name: 'Latte',
        description: 'Espresso with steamed milk',
        price: 3.99,
        category: 'Drinks',
        emoji: '☕',
        icon: 'mug-hot',
        available: true,
      },
      {
        id: 'demo-14',
        name: 'Beer (Pint)',
        description: 'Selection of draft beers',
        price: 4.99,
        category: 'Drinks',
        emoji: '🍺',
        icon: 'beer-mug',
        available: true,
      },
      {
        id: 'demo-15',
        name: 'House Wine',
        description: 'Red or White (175ml)',
        price: 5.99,
        category: 'Drinks',
        emoji: '🍷',
        icon: 'wine-glass',
        available: true,
      },
    ];
  }

  /**
   * Get demo menu categories
   */
  getDemoCategories(): string[] {
    return ['All', 'Starters', 'Mains', 'Desserts', 'Drinks'];
  }

  /**
   * Check if we should use demo data based on API availability
   */
  shouldUseDemoData(apiError: any): boolean {
    // Use demo data if:
    // 1. API returned 500 error
    // 2. Network timeout
    // 3. Network unavailable
    // 4. Any other API failure
    
    if (!apiError) return false;
    
    const errorMessage = apiError.message || '';
    const statusCode = apiError.status || apiError.statusCode;
    
    // Check for specific error conditions
    if (statusCode >= 500) {
      logger.warn('🔄 API server error, falling back to demo data');
      return true;
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      logger.warn('⏱️ API timeout, falling back to demo data');
      return true;
    }
    
    if (errorMessage.includes('Network') || errorMessage.includes('network')) {
      logger.warn('📡 Network error, falling back to demo data');
      return true;
    }
    
    // Default to using demo data for any error
    logger.warn('⚠️ API error, falling back to demo data:', errorMessage);
    return true;
  }
}

export default FallbackMenuService;