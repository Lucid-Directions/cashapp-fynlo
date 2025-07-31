/**
 * Supabase Client Configuration
 *
 * SECURITY: All credentials MUST be provided via environment variables.
 * Never hardcode API keys or URLs in source code.
 */

import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';
import 'react-native-url-polyfill/auto'; // Add URL polyfill for React Native

import { logger } from '../utils/logger';

// Get configuration from environment variables
// Try both with and without REACT_APP_ prefix for compatibility
const SUPABASE_URL =
  Config.SUPABASE_URL ||
  Config.REACT_APP_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  Config.SUPABASE_ANON_KEY ||
  Config.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const missingVars = [];
  if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');

  logger.error('Environment variables missing:', {
    SUPABASE_URL: SUPABASE_URL ? '[SET]' : '[MISSING]',
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '[SET]' : '[MISSING]',
  });

  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please ensure react-native-config is properly configured and your .env file contains these variables. ' +
      'See https://github.com/luggit/react-native-config for setup instructions.'
  );
}

// Use validated environment variables
const finalSupabaseUrl = SUPABASE_URL;
const finalSupabaseAnonKey = SUPABASE_ANON_KEY;

// Create Supabase client with proper configuration
// Wrap in try-catch to handle initialization errors
let supabase;
try {
  supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
} catch (error) {
  logger.error('Failed to initialize Supabase client:', error);
  throw error;
}

export { supabase };

// Export configuration for debugging (without exposing keys)
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL ? '[CONFIGURED]' : '[NOT SET]',
  anonKey: SUPABASE_ANON_KEY ? '[CONFIGURED]' : '[NOT SET]',
};
