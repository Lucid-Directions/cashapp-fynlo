/**
 * Test suite for WebSocket reconnection logic in React Native
 * Tests network state awareness, connection history, and UI status updates
 */

import { ExponentialBackoff } from '@fynlo/shared/utils/exponentialBackoff';
import NetInfo from '@react-native-community/netinfo';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn()
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen(new Event('open'));
      }
    }, 100);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  send(data: string) {
    if (this.readyState \!== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }
}

global.WebSocket = MockWebSocket as any;

// WebSocket reconnection manager
class WebSocketReconnectionManager {
  private ws: WebSocket | null = null;
  private backoff: ExponentialBackoff;
  private connectionHistory: Array<{
    timestamp: Date;
    type: 'connect' | 'disconnect' | 'error';
    reason?: string;
  }> = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private networkListener: (() => void) | null = null;
  private isOnline: boolean = true;
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;

  constructor(
    private url: string,
    private options: {
      maxReconnectAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
    } = {}
  ) {
    this.backoff = new ExponentialBackoff(
      options.baseDelay || 1000,
      options.maxDelay || 30000,
      options.maxReconnectAttempts || 10,
      0.3
    );
  }

  connect() {
    this.addToHistory('connect');
    this.updateStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
      this.setupNetworkListener();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  private setupEventHandlers() {
    if (\!this.ws) return;

    this.ws.onopen = () => {
      this.backoff.reset();
      this.updateStatus('connected');
      this.addToHistory('connect', 'successful');
    };

    this.ws.onclose = (event) => {
      this.addToHistory('disconnect', `Code: ${event.code}`);
      this.updateStatus('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this.addToHistory('error', error.toString());
      this.handleConnectionError(error);
    };
  }

  private setupNetworkListener() {
    this.networkListener = NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (\!wasOnline && this.isOnline) {
        // Network came back online
        this.cancelReconnect();
        this.connect();
      } else if (wasOnline && \!this.isOnline) {
        // Network went offline
        this.updateStatus('offline');
        this.disconnect();
      }
    });
  }

  private scheduleReconnect() {
    if (\!this.isOnline) {
      this.updateStatus('offline');
      return;
    }

    if (this.backoff.hasReachedMaxAttempts()) {
      this.updateStatus('failed');
      return;
    }

    try {
      const delay = this.backoff.getNextDelay();
      this.updateStatus('reconnecting', {
        attempt: this.backoff.getAttemptCount(),
        nextRetryIn: delay,
        remainingAttempts: this.backoff.getRemainingAttempts()
      });

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } catch (error) {
      this.updateStatus('failed');
    }
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleConnectionError(error: any) {
    this.updateStatus('error', { message: error.toString() });
    this.scheduleReconnect();
  }

  private addToHistory(type: 'connect' | 'disconnect' | 'error', reason?: string) {
    this.connectionHistory.push({
      timestamp: new Date(),
      type,
      reason
    });

    // Keep only last 100 entries
    if (this.connectionHistory.length > 100) {
      this.connectionHistory.shift();
    }
  }

  private updateStatus(status: ConnectionStatus['status'], details?: any) {
    if (this.statusCallback) {
      this.statusCallback({
        status,
        details,
        timestamp: new Date()
      });
    }
  }

  disconnect() {
    this.cancelReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
  }

  onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusCallback = callback;
  }

  getConnectionHistory() {
    return [...this.connectionHistory];
  }

  resetBackoff() {
    this.backoff.reset();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'offline' | 'error' | 'failed';
  details?: any;
  timestamp: Date;
}

describe('WebSocket Reconnection Manager', () => {
  let manager: WebSocketReconnectionManager;
  let mockNetInfoState: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default network state
    mockNetInfoState = { isConnected: true };
    (NetInfo.fetch as jest.Mock).mockResolvedValue(mockNetInfoState);
    (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
      // Return unsubscribe function
      return () => {};
    });

    manager = new WebSocketReconnectionManager('ws://localhost:8000', {
      maxReconnectAttempts: 5,
      baseDelay: 1000,
      maxDelay: 10000
    });
  });

  afterEach(() => {
    manager.disconnect();
    jest.useRealTimers();
  });

  describe('Connection establishment', () => {
    it('should establish initial connection', (done) => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      manager.connect();

      // Wait for connection
      jest.advanceTimersByTime(150);

      setImmediate(() => {
        expect(statusUpdates.length).toBe(2);
        expect(statusUpdates[0].status).toBe('connecting');
        expect(statusUpdates[1].status).toBe('connected');
        expect(manager.isConnected()).toBe(true);
        done();
      });
    });

    it('should track connection history', () => {
      manager.connect();
      jest.advanceTimersByTime(150);

      const history = manager.getConnectionHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].type).toBe('connect');
      expect(history[1].type).toBe('connect');
      expect(history[1].reason).toBe('successful');
    });
  });

  describe('Reconnection with exponential backoff', () => {
    it('should attempt reconnection with increasing delays', () => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      // Override WebSocket to simulate failures
      let attemptCount = 0;
      jest.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
        attemptCount++;
        const ws = new MockWebSocket(url);
        
        // Fail first 3 attempts
        if (attemptCount <= 3) {
          setTimeout(() => {
            ws.readyState = MockWebSocket.CLOSED;
            if (ws.onclose) {
              ws.onclose(new CloseEvent('close', { code: 1006 }));
            }
          }, 50);
        }
        
        return ws as any;
      });

      manager.connect();

      // First connection attempt fails
      jest.advanceTimersByTime(100);
      
      // Check reconnection scheduled
      const reconnectingStatus = statusUpdates.find(s => s.status === 'reconnecting');
      expect(reconnectingStatus).toBeDefined();
      expect(reconnectingStatus?.details.attempt).toBe(1);
      expect(reconnectingStatus?.details.nextRetryIn).toBeGreaterThanOrEqual(700);
      expect(reconnectingStatus?.details.nextRetryIn).toBeLessThanOrEqual(1300);

      // Advance through reconnection attempts
      for (let i = 1; i <= 3; i++) {
        jest.advanceTimersByTime(Math.pow(2, i - 1) * 1000 + 500);
      }

      // Fourth attempt should succeed
      jest.advanceTimersByTime(8000 + 150);

      expect(manager.isConnected()).toBe(true);
      expect(attemptCount).toBe(4);
    });

    it('should stop reconnecting after max attempts', () => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      // Always fail
      jest.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
        const ws = new MockWebSocket(url);
        setTimeout(() => {
          ws.readyState = MockWebSocket.CLOSED;
          if (ws.onclose) {
            ws.onclose(new CloseEvent('close', { code: 1006 }));
          }
        }, 50);
        return ws as any;
      });

      manager.connect();

      // Advance through all attempts
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(30000);
      }

      const failedStatus = statusUpdates.find(s => s.status === 'failed');
      expect(failedStatus).toBeDefined();
      expect(manager.isConnected()).toBe(false);
    });
  });

  describe('Network state awareness', () => {
    it('should not reconnect when offline', () => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      // Simulate network going offline
      const networkCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
      
      manager.connect();
      jest.advanceTimersByTime(150);

      // Disconnect network
      networkCallback({ isConnected: false });

      // Force disconnection
      const ws = (manager as any).ws;
      if (ws) {
        ws.close();
      }

      jest.advanceTimersByTime(5000);

      // Should show offline status, not reconnecting
      const offlineStatus = statusUpdates.find(s => s.status === 'offline');
      expect(offlineStatus).toBeDefined();
      
      // Should not have any reconnecting status after going offline
      const reconnectingAfterOffline = statusUpdates.filter(
        (s, i) => s.status === 'reconnecting' && i > statusUpdates.indexOf(offlineStatus\!)
      );
      expect(reconnectingAfterOffline.length).toBe(0);
    });

    it('should reconnect when network comes back online', () => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      const networkCallback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];

      // Start offline
      networkCallback({ isConnected: false });
      manager.connect();

      expect(statusUpdates[statusUpdates.length - 1].status).toBe('offline');

      // Network comes back
      networkCallback({ isConnected: true });
      jest.advanceTimersByTime(150);

      expect(statusUpdates[statusUpdates.length - 1].status).toBe('connected');
      expect(manager.isConnected()).toBe(true);
    });
  });

  describe('Manual backoff reset', () => {
    it('should reset backoff counter on manual reset', () => {
      // Fail multiple times
      jest.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
        const ws = new MockWebSocket(url);
        setTimeout(() => {
          ws.readyState = MockWebSocket.CLOSED;
          if (ws.onclose) {
            ws.onclose(new CloseEvent('close'));
          }
        }, 50);
        return ws as any;
      });

      manager.connect();

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(Math.pow(2, i) * 1000 + 100);
      }

      // Reset backoff
      manager.resetBackoff();

      // Next reconnect should use base delay
      jest.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
        return new MockWebSocket(url) as any;
      });

      // Trigger another disconnect/reconnect
      const ws = (manager as any).ws;
      if (ws && ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }

      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      jest.advanceTimersByTime(50);

      const reconnectingStatus = statusUpdates.find(s => s.status === 'reconnecting');
      expect(reconnectingStatus?.details.attempt).toBe(1);
      expect(reconnectingStatus?.details.nextRetryIn).toBeGreaterThanOrEqual(700);
      expect(reconnectingStatus?.details.nextRetryIn).toBeLessThanOrEqual(1300);
    });
  });

  describe('Connection history tracking', () => {
    it('should limit history to 100 entries', () => {
      // Generate 150 connection events
      for (let i = 0; i < 150; i++) {
        (manager as any).addToHistory('connect', `Test ${i}`);
      }

      const history = manager.getConnectionHistory();
      expect(history.length).toBe(100);
      expect(history[0].reason).toBe('Test 50'); // First 50 should be removed
      expect(history[99].reason).toBe('Test 149');
    });

    it('should track different event types', () => {
      manager.connect();
      jest.advanceTimersByTime(150);

      // Simulate error
      const ws = (manager as any).ws;
      if (ws && ws.onerror) {
        ws.onerror(new Error('Test error'));
      }

      // Simulate disconnect
      if (ws && ws.onclose) {
        ws.onclose(new CloseEvent('close', { code: 1000 }));
      }

      const history = manager.getConnectionHistory();
      const eventTypes = history.map(h => h.type);
      
      expect(eventTypes).toContain('connect');
      expect(eventTypes).toContain('error');
      expect(eventTypes).toContain('disconnect');
    });
  });

  describe('UI status updates', () => {
    it('should provide detailed status for UI updates', () => {
      const statusUpdates: ConnectionStatus[] = [];
      manager.onStatusChange((status) => {
        statusUpdates.push(status);
      });

      // Fail to trigger reconnection
      jest.spyOn(global, 'WebSocket').mockImplementationOnce((url: string) => {
        const ws = new MockWebSocket(url);
        setTimeout(() => {
          if (ws.onerror) {
            ws.onerror(new Error('Connection failed'));
          }
          ws.readyState = MockWebSocket.CLOSED;
          if (ws.onclose) {
            ws.onclose(new CloseEvent('close'));
          }
        }, 50);
        return ws as any;
      });

      manager.connect();
      jest.advanceTimersByTime(100);

      // Check status updates contain required information
      expect(statusUpdates.some(s => s.status === 'connecting')).toBe(true);
      expect(statusUpdates.some(s => s.status === 'error')).toBe(true);
      expect(statusUpdates.some(s => s.status === 'reconnecting')).toBe(true);

      const reconnectingStatus = statusUpdates.find(s => s.status === 'reconnecting');
      expect(reconnectingStatus?.details).toHaveProperty('attempt');
      expect(reconnectingStatus?.details).toHaveProperty('nextRetryIn');
      expect(reconnectingStatus?.details).toHaveProperty('remainingAttempts');

      // All statuses should have timestamps
      statusUpdates.forEach(status => {
        expect(status.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});
EOF < /dev/null