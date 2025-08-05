// Temporary WebSocket types until @fynlo/shared is properly set up

export interface WebSocketMessage {
  id: string;
  type: string;
  data?: any;
  restaurant_id: string;
  timestamp: string;
}

export interface WebSocketConfig {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  pongTimeout?: number;
  authTimeout?: number;
}

export enum WebSocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',

  // Authentication events
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  AUTH_ERROR = 'auth_error',
  REAUTH = 'reauth',
  TOKEN_EXPIRED = 'token_expired',

  // Heartbeat events
  PING = 'ping',
  PONG = 'pong',

  // Business events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  INVENTORY_UPDATED = 'inventory.updated',
  MENU_UPDATED = 'menu.updated',
  SYSTEM_NOTIFICATION = 'system.notification',
}
