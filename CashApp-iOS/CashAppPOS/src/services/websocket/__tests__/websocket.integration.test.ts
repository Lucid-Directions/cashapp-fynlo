/**
 * WebSocket Integration Tests - Using REAL WebSocket server
 */

import TEST_CONFIG from '../../../__tests__/config/test.config';
import WebSocketService from '../WebSocketService';

describe('WebSocket Integration - REAL Server', () => {
  let wsService: WebSocketService;
  
  beforeAll(async () => {
    // Skip if WebSocket tests are disabled
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      console.log('WebSocket tests disabled in configuration');
      return;
    }
    
    wsService = WebSocketService.getInstance();
  });
  
  afterAll(async () => {
    if (wsService) {
      await wsService.disconnect();
    }
  });
  
  it('should connect to production WebSocket server', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    const connected = await wsService.connect(TEST_CONFIG.WS_URL);
    expect(connected).toBe(true);
  }, TEST_CONFIG.TIMEOUT.WS);
  
  it('should receive heartbeat from server', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    return new Promise((resolve) => {
      wsService.on('heartbeat', () => {
        resolve(true);
      });
      
      setTimeout(() => {
        resolve(false);
      }, TEST_CONFIG.TIMEOUT.WS);
    });
  });
  
  it('should handle reconnection on disconnect', async () => {
    if (!TEST_CONFIG.FEATURES.WEBSOCKET) {
      return;
    }
    
    // Force disconnect
    await wsService.disconnect();
    
    // Should auto-reconnect
    const reconnected = await new Promise((resolve) => {
      wsService.on('reconnected', () => resolve(true));
      setTimeout(() => resolve(false), TEST_CONFIG.TIMEOUT.WS);
    });
    
    expect(reconnected).toBe(true);
  });
});
