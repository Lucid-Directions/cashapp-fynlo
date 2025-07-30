/**
 * Unified Authentication Service
 *
 * This service provides a single interface for authentication that
 * automatically switches between mock and real Supabase authentication
 * based on the AUTH_CONFIG setting.
 */

import { AUTH_CONFIG } from '../../config/auth.config';
import { authService as supabaseAuthService } from './supabaseAuth';
import { mockAuthService } from './mockAuth';

// Export the appropriate auth service based on configuration
export const authService = AUTH_CONFIG.USE_MOCK_AUTH ? mockAuthService : supabaseAuthService;

console.log(`🔐 Using ${AUTH_CONFIG.USE_MOCK_AUTH ? 'MOCK' : 'SUPABASE'} authentication service`);
