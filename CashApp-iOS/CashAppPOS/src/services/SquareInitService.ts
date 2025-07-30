/**
 * SquareInitService - Initialize Square SDK with proper configuration
 * This service handles the setup and initialization of Square payments
 */

import SquareService from './SquareService';
import { getSquareConfig, getSquareLocationId } from '../config/square';

class SquareInitService {
  private static instance: SquareInitService;
  private initialized = false;

  private constructor() {
    // Empty constructor
  }

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
        // Return true to allow development but warn about configuration
        return true;
      }

      await SquareService.initialize({
        applicationId: config.applicationId,
        locationId: _locationId,
        environment: config.environment,
        baseUrl: config.baseUrl,
      });

      this.initialized = true;
      return true;
    } catch (__error) {
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
