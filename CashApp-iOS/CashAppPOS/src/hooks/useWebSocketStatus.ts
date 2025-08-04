/**
 * React hook for monitoring WebSocket connection status
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import { webSocketService } from '../services/websocket/EnhancedWebSocketService';
import { WebSocketEvent } from '../types/websocket';

interface WebSocketStatus {
  status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  attemptNumber: number;
  maxAttempts: number;
  nextRetryTime: number | null;
  canManualReconnect: boolean;
  lastConnectedTime: Date | null;
  lastDisconnectedTime: Date | null;
}

export const useWebSocketStatus = () => {
  const [status, setStatus] = useState<WebSocketStatus>({
    status: 'disconnected',
    attemptNumber: 0,
    maxAttempts: 10,
    nextRetryTime: null,
    canManualReconnect: false,
    lastConnectedTime: null,
    lastDisconnectedTime: null,
  });

  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current state from WebSocket service
  const updateStatus = useCallback(() => {
    const wsState = webSocketService.getState();
    
    setStatus((prev) => {
      let newStatus: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
      
      switch (wsState) {
        case 'CONNECTED':
          newStatus = 'connected';
          break;
        case 'CONNECTING':
        case 'AUTHENTICATING':
          newStatus = 'connecting';
          break;
        case 'RECONNECTING':
          newStatus = 'reconnecting';
          break;
        default:
          newStatus = 'disconnected';
      }

      return {
        ...prev,
        status: newStatus,
        lastConnectedTime: newStatus === 'connected' ? new Date() : prev.lastConnectedTime,
        lastDisconnectedTime: newStatus === 'disconnected' && prev.status \!== 'disconnected' 
          ? new Date() 
          : prev.lastDisconnectedTime,
      };
    });
  }, []);

  // Handle reconnection countdown
  const startCountdown = useCallback((delay: number) => {
    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    const endTime = Date.now() + delay;
    
    // Update immediately
    setStatus((prev) => ({
      ...prev,
      nextRetryTime: Math.ceil(delay / 1000),
    }));

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      
      if (remaining === 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setStatus((prev) => ({ ...prev, nextRetryTime: null }));
      } else {
        setStatus((prev) => ({
          ...prev,
          nextRetryTime: Math.ceil(remaining / 1000),
        }));
      }
    }, 1000);
  }, []);

  // Manual reconnect function
  const manualReconnect = useCallback(async () => {
    if (status.canManualReconnect) {
      setStatus((prev) => ({
        ...prev,
        attemptNumber: 0,
        canManualReconnect: false,
      }));
      
      // Reset the exponential backoff before reconnecting
      // Note: We might need to add a method to reset the backoff in the service
      await webSocketService.connect();
    }
  }, [status.canManualReconnect]);

  // Set up WebSocket event listeners
  useEffect(() => {
    const handleConnected = () => {
      updateStatus();
      setStatus((prev) => ({
        ...prev,
        attemptNumber: 0,
        nextRetryTime: null,
        canManualReconnect: false,
      }));
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };

    const handleDisconnected = () => {
      updateStatus();
    };

    const handleReconnectionStatus = (data: { 
      attempt: number; 
      maxAttempts: number;
      nextDelay: number;
      timestamp: number;
    }) => {
      updateStatus();
      
      setStatus((prev) => ({
        ...prev,
        attemptNumber: data.attempt,
        maxAttempts: data.maxAttempts,
      }));
      
      startCountdown(data.nextDelay);
    };

    const handleMaxReconnectAttempts = (data: { attempts: number }) => {
      setStatus((prev) => ({
        ...prev,
        status: 'disconnected',
        attemptNumber: data.attempts,
        canManualReconnect: true,
        nextRetryTime: null,
      }));
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };

    // Subscribe to events
    webSocketService.on(WebSocketEvent.CONNECT, handleConnected);
    webSocketService.on(WebSocketEvent.DISCONNECT, handleDisconnected);
    webSocketService.on('reconnection_status', handleReconnectionStatus);
    webSocketService.on('max_reconnect_attempts', handleMaxReconnectAttempts);

    // Initial status update
    updateStatus();

    // Cleanup
    return () => {
      webSocketService.off(WebSocketEvent.CONNECT, handleConnected);
      webSocketService.off(WebSocketEvent.DISCONNECT, handleDisconnected);
      webSocketService.off('reconnection_status', handleReconnectionStatus);
      webSocketService.off('max_reconnect_attempts', handleMaxReconnectAttempts);
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [updateStatus, startCountdown]);

  // Poll for status changes (backup for missing events)
  useEffect(() => {
    const interval = setInterval(() => {
      updateStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [updateStatus]);

  return {
    ...status,
    manualReconnect,
  };
};
EOF < /dev/null