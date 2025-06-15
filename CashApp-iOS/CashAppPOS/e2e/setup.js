/**
 * Detox E2E Test Setup
 * Global setup and utilities for end-to-end testing
 */

const detox = require('detox');
const config = require('../package.json').detox;
const adapter = require('detox/runners/jest/adapter');

jest.setTimeout(120000);
jasmine.getEnv().addReporter(adapter);

beforeAll(async () => {
  await detox.init(config, { initGlobals: false });
});

beforeEach(async () => {
  await adapter.beforeEach();
});

afterAll(async () => {
  await adapter.afterAll();
  await detox.cleanup();
});

// Global test utilities
global.waitForAppToLoad = async () => {
  await waitFor(element(by.id('app-loaded')))
    .toBeVisible()
    .withTimeout(10000);
};

global.loginAsTestUser = async () => {
  await element(by.id('username-input')).typeText('demo');
  await element(by.id('password-input')).typeText('demo123');
  await element(by.id('login-button')).tap();
  
  // Wait for main screen to load
  await waitFor(element(by.id('pos-screen')))
    .toBeVisible()
    .withTimeout(10000);
};

global.logout = async () => {
  await element(by.id('drawer-button')).tap();
  await element(by.id('settings-menu')).tap();
  await element(by.id('logout-button')).tap();
  await element(by.text('Logout')).tap();
};

global.addItemToCart = async (itemName) => {
  await element(by.text(itemName)).tap();
};

global.openPaymentModal = async () => {
  await element(by.id('checkout-button')).tap();
  await waitFor(element(by.id('payment-modal')))
    .toBeVisible()
    .withTimeout(5000);
};

global.completePayment = async () => {
  await element(by.id('confirm-payment-button')).tap();
  await waitFor(element(by.text('Order Complete')))
    .toBeVisible()
    .withTimeout(5000);
};