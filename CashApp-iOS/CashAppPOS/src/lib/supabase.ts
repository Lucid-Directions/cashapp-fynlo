/**
 * Supabase Client Configuration
 * 
 * SECURITY: All credentials MUST be provided via environment variables.
 * Never hardcode API keys or URLs in source code.
 */

import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

// Get configuration from environment variables
const SUPABASE_URL = Config.SUPABASE_URL;
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY;

// Validate required environment variables
if (!SUPABASE_URL) {
  throw new Error(
    'Missing required environment variable: SUPABASE_URL. ' +
    'Please set this in your .env file.'
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required environment variable: SUPABASE_ANON_KEY. ' +
    'Please set this in your .env file.'
  );
}

// Create Supabase client with proper configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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