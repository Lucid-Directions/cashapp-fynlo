/**
 * Authentication Configuration
 * Controls which authentication service to use
 */

export const AUTH_CONFIG = {
  // Set to true to use mock authentication (for development/testing)
  // Set to false to use real Supabase authentication
  USE_MOCK_AUTH: _false,

  // Mock user credentials for testing
  MOCK_CREDENTIALS: {
    restaurant_owner: {
      email: 'arnaud@luciddirections.co.uk',
      password: 'test123',
    },
    platform_owner: {
      email: 'admin@fynlo.com',
      password: 'platform123',
    },
  },
};
