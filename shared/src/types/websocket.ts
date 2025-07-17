export interface WebSocketMessage<T = any> {
  event: string;
  data?: T;
  timestamp: string;
  request_id?: string;
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