/**
 * React hook for WebSocket real-time updates
 */

import { useEffect, useCallback, useState } from 'react';
import { webSocketService, WebSocketEventType } from '../services/websocket/WebSocketService';
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
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempt: 0
  });
  
  // Handle connection
  const connect = useCallback(async () => {
    if (!user?.restaurant_id) {
      console.warn('⚠️ Cannot connect WebSocket - no restaurant ID');
      return;
    }
    
    setState(prev => ({ ...prev, connecting: true, error: null }));
    
    try {
      await webSocketService.connect({
        reconnect: options.reconnect !== false,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        connecting: false,
        error: error as Error
      }));
    }
  }, [user?.restaurant_id, options.reconnect]);
  
  // Handle disconnection
  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);
  
  // Subscribe to events
  const subscribe = useCallback((eventType: WebSocketEventType, handler: (data: any) => void) => {
    webSocketService.on(eventType, handler);
    
    // Return unsubscribe function
    return () => {
      webSocketService.off(eventType, handler);
    };
  }, []);
  
  // Send message
  const send = useCallback((type: string, data: any) => {
    webSocketService.send({ type, data });
  }, []);
  
  // Set up WebSocket event listeners
  useEffect(() => {
    const handleConnected = () => {
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempt: 0
      }));
    };
    
    const handleDisconnected = () => {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false
      }));
    };
    
    const handleError = (error: Error) => {
      setState(prev => ({
        ...prev,
        error,
        connecting: false
      }));
    };
    
    const handleReconnecting = (data: { attempt: number; maxAttempts: number }) => {
      setState(prev => ({
        ...prev,
        connecting: true,
        reconnectAttempt: data.attempt
      }));
    };
    
    // Subscribe to connection events
    webSocketService.on(WebSocketEventType.CONNECTED, handleConnected);
    webSocketService.on(WebSocketEventType.DISCONNECTED, handleDisconnected);
    webSocketService.on(WebSocketEventType.ERROR, handleError);
    webSocketService.on(WebSocketEventType.RECONNECTING, handleReconnecting);
    
    // Cleanup
    return () => {
      webSocketService.off(WebSocketEventType.CONNECTED, handleConnected);
      webSocketService.off(WebSocketEventType.DISCONNECTED, handleDisconnected);
      webSocketService.off(WebSocketEventType.ERROR, handleError);
      webSocketService.off(WebSocketEventType.RECONNECTING, handleReconnecting);
    };
  }, []);
  
  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false && user?.restaurant_id && !state.connected && !state.connecting) {
      connect();
    }
    
    // Disconnect on unmount
    return () => {
      if (state.connected) {
        disconnect();
      }
    };
  }, [options.autoConnect, user?.restaurant_id]);
  
  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    send,
    isConnected: webSocketService.isConnected()
  };
};

// Export specific event hooks for common use cases

export const useOrderUpdates = (onOrderUpdate: (data: any) => void) => {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribeCreated = subscribe(WebSocketEventType.ORDER_CREATED, onOrderUpdate);
    const unsubscribeUpdated = subscribe(WebSocketEventType.ORDER_UPDATED, onOrderUpdate);
    const unsubscribeStatus = subscribe(WebSocketEventType.ORDER_STATUS_CHANGED, onOrderUpdate);
    
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatus();
    };
  }, [subscribe, onOrderUpdate]);
};

export const useInventoryUpdates = (onInventoryUpdate: (data: any) => void) => {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEventType.INVENTORY_UPDATED, onInventoryUpdate);
    return unsubscribe;
  }, [subscribe, onInventoryUpdate]);
};

export const useMenuUpdates = (onMenuUpdate: (data: any) => void) => {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEventType.MENU_UPDATED, onMenuUpdate);
    return unsubscribe;
  }, [subscribe, onMenuUpdate]);
};

export const useSystemNotifications = (onNotification: (data: any) => void) => {
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEventType.SYSTEM_NOTIFICATION, onNotification);
    return unsubscribe;
  }, [subscribe, onNotification]);
};