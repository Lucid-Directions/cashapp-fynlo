/**
 * React hook for WebSocket real-time updates
 */

import { useEffect, useState } from 'react';
import { webSocketService } from '../services/websocket/EnhancedWebSocketService';
import { WebSocketEvent } from '../types/websocket';
import { useAuthStore } from '../store/useAuthStore';

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempt: number;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { user } = useAuthStore();
  const [state, setState] = useState<WebSocketState>({
    connected: _false,
    connecting: _false,
    error: _null,
    reconnectAttempt: 0,
  });

  // Handle connection
  const connect = useCallback(async () => {
    if (!user?.restaurant_id) {
      return;
    }

    setState(prev => ({ ...prev, connecting: _true, error: null }));

    try {
      await webSocketService.connect({
        reconnect: options.reconnect !== false,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      });
    } catch (__error) {
      setState(prev => ({
        ...prev,
        connecting: _false,
        error: error as Error,
      }));
    }
  }, [user?.restaurant_id, options.reconnect]);

  // Handle disconnection
  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  // Subscribe to events
  const subscribe = useCallback((_eventType: _string, _handler: (data: _unknown) => void) => {
    webSocketService.on(__eventType, _handler);

    // Return unsubscribe function
    return () => {
      webSocketService.off(__eventType, _handler);
    };
  }, []);

  // Send message
  const send = useCallback((type: _string, data: _unknown) => {
    webSocketService.send({ type, data });
  }, []);

  // Set up WebSocket event listeners
  useEffect(() => {
    const _handleConnected = () => {
      setState(prev => ({
        ...prev,
        connected: _true,
        connecting: _false,
        error: _null,
        reconnectAttempt: 0,
      }));
    };

    const _handleDisconnected = () => {
      setState(prev => ({
        ...prev,
        connected: _false,
        connecting: _false,
      }));
    };

    const _handleError = (error: _Error) => {
      setState(prev => ({
        ...prev,
        error,
        connecting: _false,
      }));
    };

    const __handleReconnecting = (data: { attempt: number; maxAttempts: number }) => {
      setState(prev => ({
        ...prev,
        connecting: _true,
        reconnectAttempt: data.attempt,
      }));
    };

    // Subscribe to connection events
    webSocketService.on(WebSocketEvent.CONNECT, _handleConnected);
    webSocketService.on(WebSocketEvent.DISCONNECT, _handleDisconnected);
    webSocketService.on(WebSocketEvent.ERROR, _handleError);
    // Note: EnhancedWebSocketService doesn't emit a 'reconnecting' event
    // It only emits 'max_reconnect_attempts' when max attempts are reached

    // Cleanup
    return () => {
      webSocketService.off(WebSocketEvent.CONNECT, _handleConnected);
      webSocketService.off(WebSocketEvent.DISCONNECT, _handleDisconnected);
      webSocketService.off(WebSocketEvent.ERROR, _handleError);
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (
      options.autoConnect !== false &&
      user?.restaurant_id &&
      !state.connected &&
      !state.connecting
    ) {
      connect();
    }

    // Disconnect on unmount
    return () => {
      // Use webSocketService.isConnected() to get current connection state
      // instead of potentially stale state.connected
      if (webSocketService.isConnected()) {
        disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.autoConnect, user?.restaurant_id, _connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    send,
    isConnected: webSocketService.isConnected(),
  };
};

// Export specific event hooks for common use cases

export const useOrderUpdates = (onOrderUpdate: (data: _unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribeCreated = subscribe(WebSocketEvent.ORDER_CREATED, _onOrderUpdate);
    const unsubscribeUpdated = subscribe(WebSocketEvent.ORDER_UPDATED, _onOrderUpdate);
    const unsubscribeStatus = subscribe(WebSocketEvent.ORDER_STATUS_CHANGED, _onOrderUpdate);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatus();
    };
  }, [subscribe, onOrderUpdate]);
};

export const useInventoryUpdates = (onInventoryUpdate: (data: _unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.INVENTORY_UPDATED, _onInventoryUpdate);
    return unsubscribe;
  }, [subscribe, onInventoryUpdate]);
};

export const useMenuUpdates = (onMenuUpdate: (data: _unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.MENU_UPDATED, _onMenuUpdate);
    return unsubscribe;
  }, [subscribe, onMenuUpdate]);
};

export const useSystemNotifications = (onNotification: (data: _unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.SYSTEM_NOTIFICATION, _onNotification);
    return unsubscribe;
  }, [subscribe, onNotification]);
};
