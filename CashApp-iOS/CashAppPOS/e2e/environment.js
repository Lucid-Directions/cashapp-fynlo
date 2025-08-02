/**
 * Detox E2E Test Environment
 * Custom Jest environment for Detox testing
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  DetoxCircusEnvironment,
  SpecReporter,
  WorkerAssignReporter,
} = require('detox/runners/jest-circus');

class CustomDetoxEnvironment extends DetoxCircusEnvironment {
  constructor(config, context) {
    super(config, context);

    // Register additional test reporters
    this.registerListeners({
      SpecReporter,
      WorkerAssignReporter,
    });
  }

  async setup() {
    await super.setup();

    // Set global timeout for all tests
    this.global.testTimeout = 120000;

    // Add custom global utilities
    this.global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Add screenshot utility
    this.global.takeScreenshot = async (name) => {
      try {
        await device.takeScreenshot(`${name}-${Date.now()}`);
      } catch (error) {
        console.warn('Failed to take screenshot:', error.message);
      }
    };

    // Add device utilities
    this.global.relaunchApp = async (params = {}) => {
      await device.terminateApp();
      await device.launchApp({
        newInstance: true,
        permissions: { camera: 'YES', photos: 'YES' },
        ...params,
      });
    };
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomDetoxEnvironment;
