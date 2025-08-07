/**
 * Test file for offline configuration
 */

import { offlineConfig, Environment, getOfflineConfig } from './offlineConfig';

// Test environment detection
const config = getOfflineConfig();
console.log('Current environment:', config.environment);
console.log('Max queue size:', config.maxQueueSize);
console.log('Encryption enabled:', config.enableEncryption);
console.log('Rate limiting enabled:', config.rateLimitEnabled);

// Test configuration for production
const prodConfig = offlineConfig.getConfiguration();
console.log('Production config:', {
  environment: prodConfig.environment,
  maxQueueSize: prodConfig.maxQueueSize,
  syncInterval: prodConfig.syncInterval,
});

export { config };
EOF < /dev/null