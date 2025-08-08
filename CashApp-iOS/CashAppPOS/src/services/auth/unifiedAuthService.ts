/**
 * Unified Authentication Service
 *
 * This service provides a single interface for authentication that
 * automatically switches between mock and real Supabase authentication
 * based on the AUTH_CONFIG setting.
 */

import { AUTH_CONFIG } from '../../config/auth.config';
import { logger } from '../../utils/logger';

import { mockAuthService } from './mockAuth';
import { authService as supabaseAuthService } from './supabaseAuth';

// Export the appropriate auth service based on configuration
export const authService = AUTH_CONFIG.USE_MOCK_AUTH ? mockAuthService : supabaseAuthService;

// Log auth service selection when first used (not at module level)
if (__DEV__) {
  // This will be logged when the service is first accessed
  const logAuthService = () => {
    logger.info(`🔐 Using ${AUTH_CONFIG.USE_MOCK_AUTH ? 'MOCK' : 'SUPABASE'} authentication service`);
  };
  // Defer logging until after module initialization
  setTimeout(logAuthService, 0);
}
