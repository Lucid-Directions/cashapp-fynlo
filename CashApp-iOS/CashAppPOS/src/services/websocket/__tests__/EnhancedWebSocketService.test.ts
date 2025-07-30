/**
 * Tests for EnhancedWebSocketService
 */

import { EnhancedWebSocketService } from '../EnhancedWebSocketService';
import { WebSocketEvent } from '../../../types/websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import tokenManager from '../../../utils/enhancedTokenManager';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('../../../utils/enhancedTokenManager');
jest.mock('../../../config/api', () => ({
  default: {
    BASE_URL: 'https://api.test.com',
  },
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: _unknown) => void) | null = null;
  onclose: ((event: _unknown) => void) | null = null;
  onerror: ((event: _unknown) => void) | null = null;
  onmessage: ((event: _unknown) => void) | null = null;

  constructor(public url: _string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({});
    }, 10);
  }

  send(_data: _string) {
    // Mock send
  }

  close(code?: _number, reason?: _string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

global.WebSocket = MockWebSocket;

describe('EnhancedWebSocketService', () => {
  let service: EnhancedWebSocketService;
  let __mockNetInfoUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        id: 'user123',
        restaurant_id: 'restaurant123',
        email: 'test@test.com',
      }),
    );

    // Mock tokenManager
    (tokenManager.getTokenWithRefresh as jest.Mock).mockResolvedValue('test-token');

    // Mock NetInfo
    mockNetInfoUnsubscribe = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(__mockNetInfoUnsubscribe);

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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(__null);

      await service.connect();

      expect(service.getState()).toBe('DISCONNECTED');
    });
  });

  describe('Authentication', () => {
    it('should send authentication message after connection', async () => {
      const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');

      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      const authMessage = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(authMessage.type).toBe(WebSocketEvent.AUTHENTICATE);
      expect(authMessage.data.token).toBe('test-token');
      expect(authMessage.data.user_id).toBe('user123');
      expect(authMessage.data.restaurant_id).toBe('restaurant123');
    });

    it('should handle authentication success', async () => {
      const _listener = jest.fn();
      service.on(WebSocketEvent.CONNECT, _listener);

      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Simulate auth success
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      expect(service.getState()).toBe('CONNECTED');
      expect(__listener).toHaveBeenCalled();
    });

    it('should handle authentication error and retry', async () => {
      (tokenManager.forceRefresh as jest.Mock).mockResolvedValue('new-token');

      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Simulate auth error
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTH_ERROR,
          data: { error: 'Invalid token' },
        }),
      });

      expect(tokenManager.forceRefresh).toHaveBeenCalled();
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should start heartbeat after authentication', async () => {
      const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');

      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Simulate auth success
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      // Clear previous calls
      sendSpy.mockClear();

      // Advance timer for heartbeat interval (15 seconds)
      jest.advanceTimersByTime(15000);

      const pingMessage = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(pingMessage.type).toBe(WebSocketEvent.PING);
    });

    it('should handle pong response', async () => {
      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Authenticate
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      // Send ping
      jest.advanceTimersByTime(15000);

      // Respond with pong
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.PONG,
          data: {},
        }),
      });

      // Verify missed pongs is reset
      expect((service as unknown).missedPongs).toBe(0);
    });

    it('should reconnect after missing too many pongs', async () => {
      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Authenticate
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      // Miss 3 pongs
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(15000); // Send ping
        jest.advanceTimersByTime(5000); // Wait for pong timeout
      }

      expect(service.getState()).toBe('RECONNECTING');
    });
  });

  describe('Reconnection Logic', () => {
    it('should use exponential backoff with jitter', () => {
      const calculateBackoff = (service as unknown).calculateBackoff.bind(__service);

      // Test increasing delays
      const __delay0 = calculateBackoff(0);
      const __delay1 = calculateBackoff(1);
      const __delay2 = calculateBackoff(2);

      expect(__delay0).toBeGreaterThanOrEqual(1000);
      expect(__delay0).toBeLessThanOrEqual(1300); // 1000 + 30% jitter

      expect(__delay1).toBeGreaterThanOrEqual(2000);
      expect(__delay1).toBeLessThanOrEqual(2600);

      expect(__delay2).toBeGreaterThanOrEqual(4000);
      expect(__delay2).toBeLessThanOrEqual(5200);
    });

    it('should cap backoff at maximum delay', () => {
      const calculateBackoff = (service as unknown).calculateBackoff.bind(__service);
      const maxDelay = 64000;

      const __delay10 = calculateBackoff(10);
      expect(__delay10).toBeLessThanOrEqual(maxDelay * 1.3); // max + jitter
    });

    it('should stop reconnecting after max attempts', async () => {
      const _listener = jest.fn();
      service.on('max_reconnect_attempts', _listener);

      // Set max attempts to 2 for testing
      (service as unknown).config.maxReconnectAttempts = 2;

      await service.connect();
      const ws = (service as unknown).ws;

      // Simulate disconnections
      for (let i = 0; i < 3; i++) {
        ws.close(4000, 'Test disconnect');
        jest.runAllTimers();
      }

      expect(__listener).toHaveBeenCalled();
      expect(service.getState()).toBe('DISCONNECTED');
    });
  });

  describe('Message Queue', () => {
    it('should queue messages when disconnected', () => {
      service.send({
        type: WebSocketEvent.ORDER_CREATED,
        data: { order_id: '123' },
      });

      expect((service as unknown).messageQueue.length).toBe(1);
    });

    it('should process queued messages after reconnection', async () => {
      const sendSpy = jest.spyOn(MockWebSocket.prototype, 'send');

      // Queue messages while disconnected
      service.send({
        type: WebSocketEvent.ORDER_CREATED,
        data: { order_id: '123' },
      });
      service.send({
        type: WebSocketEvent.ORDER_UPDATED,
        data: { order_id: '123' },
      });

      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Authenticate
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      // Check that queued messages were sent
      const sentMessages = sendSpy.mock.calls
        .map(call => JSON.parse(call[0]))
        .filter(
          msg =>
            msg.type === WebSocketEvent.ORDER_CREATED || msg.type === WebSocketEvent.ORDER_UPDATED,
        );

      expect(sentMessages.length).toBe(2);
    });

    it('should limit message queue size', () => {
      // Fill queue beyond limit
      for (let i = 0; i < 150; i++) {
        service.send({
          type: WebSocketEvent.DATA_UPDATED,
          data: { index: i },
        });
      }

      expect((service as unknown).messageQueue.length).toBe(100);
    });
  });

  describe('Network Monitoring', () => {
    it('should reconnect when network is restored', () => {
      const __connectSpy = jest.spyOn(__service, 'connect');

      // Simulate network state change
      const networkListener = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];

      // Network restored
      networkListener({
        isConnected: _true,
        isInternetReachable: _true,
      });

      expect(__connectSpy).toHaveBeenCalled();
    });

    it('should disconnect when network is lost', async () => {
      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Authenticate
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      // Simulate network loss
      const networkListener = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
      networkListener({
        isConnected: _false,
        isInternetReachable: _false,
      });

      expect(service.getState()).toBe('DISCONNECTED');
    });
  });

  describe('State Management', () => {
    it('should validate state transitions', () => {
      // Valid transition
      (service as unknown).setState('CONNECTING');
      expect(service.getState()).toBe('CONNECTING');

      // Invalid transition (CONNECTING cannot go directly to CONNECTED)
      const __consoleWarnSpy = jest.spyOn(__console, 'warn').mockImplementation();
      (service as unknown).setState('CONNECTED');
      expect(service.getState()).toBe('CONNECTING'); // Should not change
      expect(__consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition'),
      );
    });

    it('should handle all valid state transitions', () => {
      const validTransitions = [
        ['DISCONNECTED', 'CONNECTING'],
        ['CONNECTING', 'AUTHENTICATING'],
        ['AUTHENTICATING', 'CONNECTED'],
        ['CONNECTED', 'DISCONNECTED'],
        ['DISCONNECTED', 'RECONNECTING'],
        ['RECONNECTING', 'CONNECTING'],
      ];

      validTransitions.forEach(([from, _to]) => {
        (service as unknown).state = from;
        (service as unknown).setState(__to);
        expect(service.getState()).toBe(__to);
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on disconnect', async () => {
      await service.connect();

      const __ws = (service as unknown).ws;
      const __closeSpy = jest.spyOn(__ws, 'close');

      service.disconnect();

      expect(__closeSpy).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(__mockNetInfoUnsubscribe).toHaveBeenCalled();
      expect(service.getState()).toBe('DISCONNECTED');
      expect((service as unknown).ws).toBeNull();
    });

    it('should clear all timers on disconnect', async () => {
      await service.connect();
      await jest.runOnlyPendingTimersAsync();

      // Start heartbeat
      const ws = (service as unknown).ws;
      ws.onmessage?.({
        data: JSON.stringify({
          type: WebSocketEvent.AUTHENTICATED,
          data: {},
        }),
      });

      service.disconnect();

      expect((service as unknown).heartbeatTimer).toBeNull();
      expect((service as unknown).pongTimer).toBeNull();
      expect((service as unknown).reconnectTimer).toBeNull();
    });
  });
});
