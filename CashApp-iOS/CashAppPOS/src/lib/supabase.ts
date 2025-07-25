/**
 * Supabase Client Configuration
 * 
 * SECURITY: All credentials MUST be provided via environment variables.
 * Never hardcode API keys or URLs in source code.
 */

import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

// Get configuration from environment variables
// Try both with and without REACT_APP_ prefix for compatibility
const SUPABASE_URL = Config.SUPABASE_URL || Config.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY || Config.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const missingVars = [];
  if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
  
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
export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Export configuration for debugging (without exposing keys)
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL ? '[CONFIGURED]' : '[NOT SET]',
  anonKey: SUPABASE_ANON_KEY ? '[CONFIGURED]' : '[NOT SET]',
};