/**
 * Tests for EnhancedWebSocketService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { WebSocketEvent } from '../../../types/websocket';
import tokenManager from '../../../utils/tokenManager';
import { EnhancedWebSocketService } from '../EnhancedWebSocketService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('../../../utils/tokenManager');

// Mock API config properly
jest.mock('../../../config/api', () => ({
  __esModule: true,
  default: {
    BASE_URL: 'https://api.test.com',
  },
}));

// Mock ExponentialBackoff
jest.mock('@fynlo/shared/src/utils/exponentialBackoff', () => ({
  ExponentialBackoff: jest.fn().mockImplementation(() => ({
    reset: jest.fn(),
    getAttemptCount: jest.fn(() => 0),
    getNextDelay: jest.fn(() => 1000),
  })),
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({});
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe('EnhancedWebSocketService', () => {
  let service: EnhancedWebSocketService;
  let mockNetInfoUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        id: 'user123',
        restaurant_id: 'restaurant123',
        email: 'test@test.com',
      })
    );

    // Mock tokenManager
    (tokenManager.getTokenWithRefresh as jest.Mock).mockResolvedValue('test-token');

    // Mock NetInfo
    mockNetInfoUnsubscribe = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockNetInfoUnsubscribe);

    service = new EnhancedWebSocketService();
  });

  afterEach(() => {
    service.disconnect();
    jest.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket with correct URL', async () => {
      await service.connect();

      // Allow async operations to complete
      await jest.runOnlyPendingTimersAsync();

      expect(service.getState()).toBe('AUTHENTICATING');
    });

    it('should not create duplicate connections', async () => {
      await service.connect();
      await service.connect(); // Second call should be ignored

      expect(service.getState()).not.toBe('DISCONNECTED');
    });

    it('should handle missing user info gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      await service.connect();

      expect(service.getState()).toBe('RECONNECTING');
    });
  });
});
