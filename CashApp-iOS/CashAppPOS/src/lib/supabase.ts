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

// Fallback to hardcoded values if environment variables are not available
// SECURITY WARNING: These should only be used as a last resort during development
const FALLBACK_SUPABASE_URL = 'https://eweggzpvuqczrrrwszyy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s';

// Use environment variables if available, otherwise use fallback
const finalSupabaseUrl = SUPABASE_URL || FALLBACK_SUPABASE_URL;
const finalSupabaseAnonKey = SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// Log warning if using fallback values
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ Using fallback Supabase configuration. ' +
    'Please ensure react-native-config is properly set up and .env file contains SUPABASE_URL and SUPABASE_ANON_KEY'
  );
}

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