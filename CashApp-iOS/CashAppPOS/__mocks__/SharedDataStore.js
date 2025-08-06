export default {
  getInstance: jest.fn(() => ({
    serviceChargeConfig: {
      enabled: false,
      rate: 0,
      description: 'Test service charge',
    },
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
};
