/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

// Supabase configuration - MUST be set via environment variables
const SUPABASE_URL = Config.SUPABASE_URL;
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.'
  );
}

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Export configuration for debugging
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};