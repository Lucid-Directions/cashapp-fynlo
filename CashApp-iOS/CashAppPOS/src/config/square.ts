/**
 * Square Configuration
 * Configure Square SDK settings for different environments
 */

export const SQUARE_CONFIG = {
  development: {
    applicationId: 'sandbox-sq0idb-fynlo-pos-dev', // Fynlo POS development app ID
    environment: 'sandbox' as const,
    baseUrl: 'https://connect.squareupsandbox.com',
  },
  production: {
    applicationId: 'sq0idb-fynlo-pos-prod', // Fynlo POS production app ID
    environment: 'production' as const,
    baseUrl: 'https://connect.squareup.com',
  },
};

export const getSquareConfig = () => {
  const isDevelopment = __DEV__;
  return isDevelopment ? SQUARE_CONFIG.development : SQUARE_CONFIG.production;
};

export const SQUARE_LOCATION_ID = {
  development: 'FYNLO_SANDBOX_LOCATION_ID', // Fynlo POS sandbox location ID
  production: 'FYNLO_PRODUCTION_LOCATION_ID', // Fynlo POS production location ID
};

export const getSquareLocationId = () => {
  const isDevelopment = __DEV__;
  return isDevelopment ? SQUARE_LOCATION_ID.development : SQUARE_LOCATION_ID.production;
};