/**
 * SquareInitService - Initialize Square SDK with proper configuration
 * This service handles the setup and initialization of Square payments
 */

import { logger } from '../utils/logger';
import { getSquareConfig, getSquareLocationId } from '../config/square';

import SquareService from './SquareService';

class SquareInitService {
  private static instance: SquareInitService;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): SquareInitService {
    if (!SquareInitService.instance) {
      SquareInitService.instance = new SquareInitService();
    }
    return SquareInitService.instance;
  }

  /**
   * Initialize Square SDK with proper configuration
   */
  async initializeSquare(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      const config = getSquareConfig();
      const locationId = getSquareLocationId();

      // Check if we have valid configuration
      if (config.applicationId.includes('YOUR_') || locationId.includes('YOUR_')) {
        logger.warn('Square SDK not configured with real credentials. Using demo mode.');
        // Return true to allow development but warn about configuration
        return true;
      }

      await SquareService.initialize({
        applicationId: config.applicationId,
        locationId,
        environment: config.environment,
        baseUrl: config.baseUrl,
      });

      this.initialized = true;
      logger.info('Square SDK initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Square SDK:', error);
      return false;
    }
  }

  /**
   * Check if Square is properly configured
   */
  isConfigured(): boolean {
    const config = getSquareConfig();
    const locationId = getSquareLocationId();

    return !config.applicationId.includes('YOUR_') && !locationId.includes('YOUR_');
  }

  /**
   * Get configuration status for display
   */
  getConfigurationStatus() {
    const config = getSquareConfig();
    const locationId = getSquareLocationId();

    return {
      hasApplicationId: !config.applicationId.includes('YOUR_'),
      hasLocationId: !locationId.includes('YOUR_'),
      environment: config.environment,
      isInitialized: this.initialized,
    };
  }
}

export default SquareInitService;
