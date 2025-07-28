export interface WebSocketMessage<T = any> {
  id: string;
  type: string;
  data?: T;
  restaurant_id: string;
  timestamp: string;
  user_id?: string;
  token?: string;  // For authentication messages
}

export interface WebSocketConnectionState {
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  error?: string;
}

export type ConnectionStatus = 
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface WebSocketAuthPayload {
  token: string;
  restaurant_id?: string;
}

export interface WebSocketHeartbeat {
  timestamp: string;
  sequence: number;
}

export interface WebSocketError {
  code: string;
  message: string;
  reconnectable: boolean;
}

export interface WebSocketConfig {
  heartbeatInterval?: number;
  pongTimeout?: number;
  maxReconnectAttempts?: number;
  authTimeout?: number;
  reconnectBackoff?: number[];
  maxMessageQueueSize?: number;
}