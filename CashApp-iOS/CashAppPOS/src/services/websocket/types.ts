/**
 * WebSocket Types
 * Local type definitions for WebSocket functionality
 */

export interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  restaurant_id?: string;
  timestamp?: number;
  user_id?: string;
}

export interface WebSocketConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export interface WebSocketEvent {
  type: string;
  data?: any;
  timestamp?: number;
}

export enum WebSocketEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE = 'message',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  ORDER_UPDATE = 'order_update',
  TABLE_UPDATE = 'table_update',
  NOTIFICATION = 'notification',
}