import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, WebSocketEvent } from '@fynlo/shared';
import { platformWebSocket } from '../services/websocket/PlatformWebSocketService';

export interface WebSocketConnectionState {
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectCountdown: number;
  canManualReconnect: boolean;
  lastError?: string;
}

export const useWebSocketConnection = () => {
  const [state, setState] = useState<WebSocketConnectionState>({
    status: 'disconnected',
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectCountdown: 0,
    canManualReconnect: false,
  });

  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate reconnect delay based on attempts
  const getReconnectDelay = useCallback((attempts: number): number => {
    const backoffDelays = [1000, 2000, 4000, 8000, 16000, 30000];
    const index = Math.min(attempts, backoffDelays.length - 1);
    return backoffDelays[index];
  }, []);

  // Update connection state based on WebSocket status
  const updateConnectionState = useCallback((status: ConnectionStatus) => {
    setState(prev => ({
      ...prev,
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting' || status === 'authenticated',
      isReconnecting: status === 'reconnecting',
      canManualReconnect: status === 'disconnected' || status === 'error',
    }));
  }, []);

  // Handle countdown timer
  const startCountdown = useCallback((duration: number) => {
    // Clear existing countdown
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    let remaining = Math.ceil(duration / 1000);
    setState(prev => ({ ...prev, reconnectCountdown: remaining }));

    countdownInterval.current = setInterval(() => {
      remaining -= 1;
      setState(prev => ({ ...prev, reconnectCountdown: remaining }));
      
      if (remaining <= 0 && countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }, 1000);
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (state.canManualReconnect) {
      platformWebSocket.connect();
    }
  }, [state.canManualReconnect]);

  useEffect(() => {
    // Connection status listener
    const handleConnect = () => {
      updateConnectionState('connected');
      setState(prev => ({ 
        ...prev, 
        reconnectAttempts: 0,
        reconnectCountdown: 0,
        lastError: undefined 
      }));
    };

    const handleDisconnect = ({ code, reason }: { code: number; reason: string }) => {
      updateConnectionState('disconnected');
      setState(prev => ({ 
        ...prev, 
        lastError: reason || `Connection closed (code: ${code})` 
      }));
    };

    const handleReconnecting = () => {
      updateConnectionState('reconnecting');
      setState(prev => ({ 
        ...prev, 
        reconnectAttempts: prev.reconnectAttempts + 1 
      }));
      
      // Start countdown for next reconnect attempt
      const delay = getReconnectDelay(state.reconnectAttempts);
      startCountdown(delay);
    };

    const handleError = (error: any) => {
      updateConnectionState('error');
      setState(prev => ({ 
        ...prev, 
        lastError: error?.message || 'WebSocket error occurred' 
      }));
    };

    const handleAuthError = (error: any) => {
      updateConnectionState('error');
      setState(prev => ({ 
        ...prev, 
        lastError: 'Authentication failed',
        canManualReconnect: true 
      }));
    };

    const handleMaxReconnectAttempts = ({ attempts }: { attempts: number }) => {
      setState(prev => ({ 
        ...prev, 
        canManualReconnect: true,
        reconnectAttempts: attempts,
        reconnectCountdown: 0 
      }));
    };

    // Status polling to sync with WebSocket service
    const statusPollInterval = setInterval(() => {
      const currentStatus = platformWebSocket.getStatus();
      updateConnectionState(currentStatus);
    }, 500);

    // Register event listeners
    platformWebSocket.on(WebSocketEvent.CONNECT, handleConnect);
    platformWebSocket.on(WebSocketEvent.DISCONNECT, handleDisconnect);
    platformWebSocket.on('reconnecting', handleReconnecting);
    platformWebSocket.on(WebSocketEvent.ERROR, handleError);
    platformWebSocket.on(WebSocketEvent.AUTH_ERROR, handleAuthError);
    platformWebSocket.on('max_reconnect_attempts', handleMaxReconnectAttempts);

    // Initial status
    updateConnectionState(platformWebSocket.getStatus());

    // Cleanup
    return () => {
      clearInterval(statusPollInterval);
      
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      platformWebSocket.off(WebSocketEvent.CONNECT, handleConnect);
      platformWebSocket.off(WebSocketEvent.DISCONNECT, handleDisconnect);
      platformWebSocket.off('reconnecting', handleReconnecting);
      platformWebSocket.off(WebSocketEvent.ERROR, handleError);
      platformWebSocket.off(WebSocketEvent.AUTH_ERROR, handleAuthError);
      platformWebSocket.off('max_reconnect_attempts', handleMaxReconnectAttempts);
    };
  }, [state.reconnectAttempts, updateConnectionState, startCountdown, getReconnectDelay]);

  return {
    ...state,
    reconnect,
  };
};
EOF < /dev/null