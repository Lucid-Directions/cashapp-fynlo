/**
 * Square Configuration
 * Configure Square SDK settings for different environments
 */

export const SQUARE_CONFIG = {
  development: {
    applicationId: 'sandbox-sq0idb-YOUR_SANDBOX_APP_ID', // Replace with your sandbox app ID
    environment: 'sandbox' as const,
    baseUrl: 'https://connect.squareupsandbox.com',
  },
  production: {
    applicationId: 'sq0idb-YOUR_PRODUCTION_APP_ID', // Replace with your production app ID
    environment: 'production' as const,
    baseUrl: 'https://connect.squareup.com',
  },
};

export const getSquareConfig = () => {
  const isDevelopment = __DEV__;
  return isDevelopment ? SQUARE_CONFIG.development : SQUARE_CONFIG.production;
};

export const SQUARE_LOCATION_ID = {
  development: 'YOUR_SANDBOX_LOCATION_ID', // Replace with your sandbox location ID
  production: 'YOUR_PRODUCTION_LOCATION_ID', // Replace with your production location ID
};

export const getSquareLocationId = () => {
  const isDevelopment = __DEV__;
  return isDevelopment ? SQUARE_LOCATION_ID.development : SQUARE_LOCATION_ID.production;
};