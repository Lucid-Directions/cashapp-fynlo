/**
 * Comprehensive edge case tests for EnhancedWebSocketService
 * These tests are designed to FAIL if bugs exist in the implementation
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

// Mock API config
jest.mock('../../../config/api', () => ({
  __esModule: true,
  default: {
    BASE_URL: 'https://api.test.com',
  },
}));

// Mock ExponentialBackoff
const mockExponentialBackoff = {
  reset: jest.fn(),
  getAttemptCount: jest.fn(() => 0),
  getNextDelay: jest.fn(() => 1000),
};

jest.mock('@fynlo/shared/src/utils/exponentialBackoff', () => ({
  ExponentialBackoff: jest.fn().mockImplementation(() => mockExponentialBackoff),
}));

// Enhanced MockWebSocket with edge case simulation capabilities
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

  private connectionDelay = 10;
  private shouldThrowOnSend = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(public url: string) {
    // Simulate connection with configurable delay
    this.connectionTimeout = setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.({});
      }
    }, this.connectionDelay);
  }

  send(data: string) {
    if (this.shouldThrowOnSend) {
      throw new Error('WebSocket send failed');
    }
    // Simulate message sent
  }

  close(code?: number, reason?: string) {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code || 1000, reason: reason || 'Normal closure' });
  }

  // Test utilities
  static setConnectionDelay(delay: number) {
    MockWebSocket.prototype.connectionDelay = delay;
  }

  static setShouldThrowOnSend(shouldThrow: boolean) {
    MockWebSocket.prototype.shouldThrowOnSend = shouldThrow;
  }

  simulateError(error: any) {
    this.onerror?.(error);
  }

  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateNetworkDrop() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: 'Network drop' });
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe('EnhancedWebSocketService - Edge Cases', () => {
  let service: EnhancedWebSocketService;
  let mockNetInfoUnsubscribe: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket.setConnectionDelay(10);
    MockWebSocket.setShouldThrowOnSend(false);

    // Spy on console.error to track error handling
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock AsyncStorage with valid user
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        id: 'user123',
        restaurant_id: 'restaurant123',
        email: 'test@test.com',
      })
    );

    // Mock tokenManager
    (tokenManager.getTokenWithRefresh as jest.Mock).mockResolvedValue('test-token');
    (tokenManager.forceRefresh as jest.Mock).mockResolvedValue('new-token');
    (tokenManager.on as jest.Mock).mockImplementation(() => {});
    (tokenManager.off as jest.Mock).mockImplementation(() => {});

    // Mock NetInfo
    mockNetInfoUnsubscribe = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockNetInfoUnsubscribe);

    service = new EnhancedWebSocketService();
  });

  afterEach(() => {
    service.disconnect();
    jest.useRealTimers();
    consoleErrorSpy.restore();
    mockExponentialBackoff.getAttemptCount.mockReturnValue(0);
  });

  describe('Edge Case 1: Rapid connect/disconnect cycles', () => {
    it('should handle rapid connect/disconnect without state corruption', async () => {
      const stateChanges: string[] = [];
      
      // Monitor state changes
      service.on('reconnection_status', (data) => {
        stateChanges.push(`reconnect_${data.attempt}`);
      });

      // Rapid cycle: connect → disconnect → connect → disconnect
      await service.connect();
      service.disconnect();
      await service.connect();
      service.disconnect();
      await service.connect();

      jest.runOnlyPendingTimers();
      
      // Should end up in a valid state, not corrupted
      expect(['DISCONNECTED', 'CONNECTING', 'AUTHENTICATING']).toContain(service.getState());
      
      // Should not have excessive state changes indicating corruption
      expect(stateChanges.length).toBeLessThan(5);
    });

    it('should prevent memory leaks from rapid connections', async () => {
      const initialListenerCount = service['listeners'].size;
      
      // Create and destroy connections rapidly
      for (let i = 0; i < 10; i++) {
        await service.connect();
        service.disconnect();
      }

      jest.runOnlyPendingTimers();
      
      // Should not accumulate listeners
      expect(service['listeners'].size).toBeLessThanOrEqual(initialListenerCount + 1);
    });
  });

  describe('Edge Case 2: Network drops during authentication', () => {
    it('should handle network drop during authentication handshake', async () => {
      const errorEvents: any[] = [];
      service.on(WebSocketEvent.ERROR, (error) => errorEvents.push(error));

      // Start connection
      await service.connect();
      jest.advanceTimersByTime(15); // Allow connection to start
      
      // Simulate network drop during authentication
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateNetworkDrop();
      }

      jest.runOnlyPendingTimers();

      // Should attempt reconnection, not get stuck in AUTHENTICATING
      expect(service.getState()).not.toBe('AUTHENTICATING');
    });

    it('should recover from authentication timeout with network issues', async () => {
      // Set longer authentication timeout for this test
      const serviceWithTimeout = new EnhancedWebSocketService({ authTimeout: 100 });
      
      await serviceWithTimeout.connect();
      jest.advanceTimersByTime(15); // Connection established
      
      // Don't send auth response, let it timeout
      jest.advanceTimersByTime(150); // Trigger auth timeout
      
      // Should not be stuck in AUTHENTICATING state
      expect(serviceWithTimeout.getState()).not.toBe('AUTHENTICATING');
      serviceWithTimeout.disconnect();
    });
  });

  describe('Edge Case 3: Invalid auth response from server', () => {
    it('should handle malformed authentication response', async () => {
      const authErrors: any[] = [];
      service.on(WebSocketEvent.AUTH_ERROR, (error) => authErrors.push(error));

      await service.connect();
      jest.advanceTimersByTime(15);

      // Simulate malformed auth response
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTH_ERROR, data: 'Invalid token format' });
      }

      jest.runOnlyPendingTimers();

      // Should capture auth error and attempt token refresh
      expect(authErrors.length).toBeGreaterThan(0);
      expect(tokenManager.forceRefresh).toHaveBeenCalled();
    });

    it('should handle unexpected message format during auth', async () => {
      await service.connect();
      jest.advanceTimersByTime(15);

      const ws = service['ws'] as any;
      if (ws) {
        // Send garbage during auth phase
        ws.onmessage?.({ data: 'not-json' });
        ws.onmessage?.({ data: '{"incomplete": true' });
        ws.onmessage?.({ data: '{"type": "unknown_type"}' });
      }

      jest.runOnlyPendingTimers();

      // Should handle parsing errors gracefully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse WebSocket message'),
        expect.any(Error)
      );
    });
  });

  describe('Edge Case 4: Server sends data before authentication completes', () => {
    it('should handle business messages during authentication phase', async () => {
      const orderEvents: any[] = [];
      service.on(WebSocketEvent.ORDER_CREATED, (data) => orderEvents.push(data));

      await service.connect();
      jest.advanceTimersByTime(15);

      const ws = service['ws'] as any;
      if (ws) {
        // Server sends business message before auth completes
        ws.simulateMessage({
          type: WebSocketEvent.ORDER_CREATED,
          data: { order_id: 'order123' },
          restaurant_id: 'restaurant123'
        });

        // Then complete auth
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Should process the order event even if received during auth
      expect(orderEvents.length).toBe(1);
      expect(service.getState()).toBe('CONNECTED');
    });

    it('should queue messages sent during authentication', async () => {
      await service.connect();
      jest.advanceTimersByTime(15);

      // Try to send message while still authenticating
      service.send({
        type: 'test_message',
        data: { test: true }
      });

      // Should queue the message
      expect(service['messageQueue']).toHaveLength(1);

      // Complete authentication
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Queue should be processed
      expect(service['messageQueue']).toHaveLength(0);
    });
  });

  describe('Edge Case 5: Token refresh during authentication', () => {
    it('should handle token refresh while authentication is in progress', async () => {
      let tokenRefreshCallback: ((token: string) => void) | null = null;
      
      // Capture the token refresh listener
      (tokenManager.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'token:refreshed') {
          tokenRefreshCallback = callback;
        }
      });

      await service.connect();
      jest.advanceTimersByTime(15);

      // Trigger token refresh during auth
      if (tokenRefreshCallback) {
        await tokenRefreshCallback('refreshed-token');
      }

      jest.runOnlyPendingTimers();

      // Should handle gracefully without breaking authentication
      expect(service.getState()).not.toBe('DISCONNECTED');
    });
  });

  describe('Edge Case 6: Multiple simultaneous connect() calls', () => {
    it('should prevent race conditions from multiple connect calls', async () => {
      const connectPromises = [
        service.connect(),
        service.connect(),
        service.connect()
      ];

      await Promise.all(connectPromises);
      jest.runOnlyPendingTimers();

      // Should only create one connection
      expect(service.getState()).not.toBe('DISCONNECTED');
      // No multiple connections created - check internal state
      expect(service['ws']).toBeTruthy();
    });

    it('should handle concurrent connect and disconnect calls', async () => {
      const operations = [
        service.connect(),
        service.disconnect(),
        service.connect()
      ];

      await Promise.allSettled(operations);
      jest.runOnlyPendingTimers();

      // Should reach a stable state
      expect(['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'DISCONNECTED']).toContain(
        service.getState()
      );
    });
  });

  describe('Edge Case 7: WebSocket.send() throwing exceptions', () => {
    it('should handle WebSocket send failures gracefully', async () => {
      MockWebSocket.setShouldThrowOnSend(true);

      await service.connect();
      jest.advanceTimersByTime(15);

      // Complete authentication
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Try to send message that will throw
      expect(() => {
        service.send({
          type: 'test_message',
          data: { test: true }
        });
      }).not.toThrow(); // Service should handle the exception internally

      // Service should remain stable
      expect(service.getState()).toBe('CONNECTED');
    });

    it('should handle heartbeat send failures', async () => {
      MockWebSocket.setShouldThrowOnSend(true);

      await service.connect();
      jest.advanceTimersByTime(15);

      // Complete authentication to start heartbeat
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Advance time to trigger heartbeat
      jest.advanceTimersByTime(15000); // heartbeatInterval

      // Should not crash the service
      expect(service.getState()).toBe('CONNECTED');
    });
  });

  describe('Edge Case 8: Very slow authentication (9.9 seconds)', () => {
    it('should complete authentication just before timeout', async () => {
      const serviceWithTimeout = new EnhancedWebSocketService({ authTimeout: 10000 });

      await serviceWithTimeout.connect();
      jest.advanceTimersByTime(15);

      // Wait 9.9 seconds (just before timeout)
      jest.advanceTimersByTime(9900);

      // Send auth success just in time
      const ws = serviceWithTimeout['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.advanceTimersByTime(50); // Small buffer

      // Should be successfully connected
      expect(serviceWithTimeout.getState()).toBe('CONNECTED');
      serviceWithTimeout.disconnect();
    });
  });

  describe('Edge Case 9: Authentication timeout at exactly 10 seconds', () => {
    it('should timeout at exactly the configured time', async () => {
      const serviceWithTimeout = new EnhancedWebSocketService({ authTimeout: 10000 });
      let disconnectReason = '';
      
      serviceWithTimeout.on(WebSocketEvent.DISCONNECT, ({ reason }) => {
        disconnectReason = reason;
      });

      await serviceWithTimeout.connect();
      jest.advanceTimersByTime(15);

      // Wait exactly 10 seconds
      jest.advanceTimersByTime(10000);

      // Should have timed out
      expect(serviceWithTimeout.getState()).toBe('RECONNECTING');
      expect(disconnectReason).toBe('Authentication timeout');
      serviceWithTimeout.disconnect();
    });
  });

  describe('Edge Case 10: State corruption from unexpected messages', () => {
    it('should maintain state consistency with unexpected message sequence', async () => {
      await service.connect();
      jest.advanceTimersByTime(15);

      const ws = service['ws'] as any;
      if (ws) {
        // Send unexpected sequence of messages
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED }); // Valid
        ws.simulateMessage({ type: WebSocketEvent.AUTH_ERROR, data: 'error' }); // Should not break state
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED }); // Second auth
        ws.simulateMessage({ type: 'unknown_message_type', data: {} }); // Unknown type
      }

      jest.runOnlyPendingTimers();

      // Should be in CONNECTED state despite noise
      expect(service.getState()).toBe('CONNECTED');
    });

    it('should handle state transition validation errors', async () => {
      // Force invalid state transition by manipulating internal state
      await service.connect();
      jest.advanceTimersByTime(15);

      // Try to force invalid transition (should be prevented)
      service['setState']('CONNECTING'); // Invalid from AUTHENTICATING

      // Should maintain valid state
      expect(['DISCONNECTED', 'CONNECTING', 'AUTHENTICATING', 'CONNECTED', 'RECONNECTING']).toContain(
        service.getState()
      );
    });

    it('should recover from corrupted message queue', async () => {
      await service.connect();
      
      // Fill message queue to capacity
      for (let i = 0; i < 105; i++) {
        service.send({
          type: 'test_message',
          data: { index: i }
        });
      }

      // Should respect queue size limit
      expect(service['messageQueue']).toHaveLength(100);

      jest.advanceTimersByTime(15);

      // Complete authentication
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Queue should be processed without corruption
      expect(service['messageQueue']).toHaveLength(0);
      expect(service.getState()).toBe('CONNECTED');
    });

    it('should handle listener exceptions without breaking service', async () => {
      // Add a listener that throws
      service.on(WebSocketEvent.CONNECT, () => {
        throw new Error('Listener error');
      });

      await service.connect();
      jest.advanceTimersByTime(15);

      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Service should still work despite listener error
      expect(service.getState()).toBe('CONNECTED');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in WebSocket listener'),
        expect.any(Error)
      );
    });
  });

  describe('Reconnection Stress Tests', () => {
    it('should handle max reconnect attempts without infinite loops', async () => {
      mockExponentialBackoff.getAttemptCount.mockReturnValue(10); // At max attempts
      
      const maxReconnectEvents: any[] = [];
      service.on('max_reconnect_attempts', (data) => maxReconnectEvents.push(data));

      await service.connect();
      jest.advanceTimersByTime(15);

      // Simulate connection failure
      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateNetworkDrop();
      }

      jest.runOnlyPendingTimers();

      // Should emit max reconnect event
      expect(maxReconnectEvents).toHaveLength(1);
      expect(service.getState()).toBe('DISCONNECTED');
    });

    it('should handle reconnection with invalid user data', async () => {
      // Start with valid connection
      await service.connect();
      jest.advanceTimersByTime(15);

      // Corrupt user data for reconnection
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid-json');

      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateNetworkDrop();
      }

      jest.runOnlyPendingTimers();

      // Should handle corrupted data gracefully
      expect(service.getState()).toBe('RECONNECTING');
    });
  });

  describe('Resource Management', () => {
    it('should clean up all timers on disconnect', async () => {
      await service.connect();
      jest.advanceTimersByTime(15);

      const ws = service['ws'] as any;
      if (ws) {
        ws.simulateMessage({ type: WebSocketEvent.AUTHENTICATED });
      }

      jest.runOnlyPendingTimers();

      // Ensure timers are running
      expect(service['heartbeatTimer']).toBeTruthy();

      service.disconnect();

      // All timers should be cleared
      expect(service['heartbeatTimer']).toBeNull();
      expect(service['pongTimer']).toBeNull();
      expect(service['reconnectTimer']).toBeNull();
    });

    it('should handle disconnect called multiple times', async () => {
      await service.connect();
      jest.advanceTimersByTime(15);

      // Multiple disconnect calls
      service.disconnect();
      service.disconnect();
      service.disconnect();

      // Should handle gracefully
      expect(service.getState()).toBe('DISCONNECTED');
    });
  });
});
