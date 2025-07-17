export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH001',
  AUTH_TOKEN_EXPIRED: 'AUTH002',
  AUTH_TOKEN_INVALID: 'AUTH003',
  AUTH_UNAUTHORIZED: 'AUTH004',
  AUTH_FORBIDDEN: 'AUTH005',
  AUTH_SESSION_EXPIRED: 'AUTH006',
  
  // API errors
  API_TIMEOUT: 'API001',
  API_NETWORK_ERROR: 'API002',
  API_SERVER_ERROR: 'API003',
  API_NOT_FOUND: 'API004',
  API_BAD_REQUEST: 'API005',
  API_RATE_LIMITED: 'API006',
  
  // Business logic errors
  ORDER_NOT_FOUND: 'ORD001',
  ORDER_ALREADY_PAID: 'ORD002',
  ORDER_CANCELLED: 'ORD003',
  ORDER_INVALID_STATUS: 'ORD004',
  
  PAYMENT_FAILED: 'PAY001',
  PAYMENT_DECLINED: 'PAY002',
  PAYMENT_INSUFFICIENT_FUNDS: 'PAY003',
  PAYMENT_INVALID_METHOD: 'PAY004',
  
  INVENTORY_OUT_OF_STOCK: 'INV001',
  INVENTORY_LOW_STOCK: 'INV002',
  INVENTORY_INVALID_QUANTITY: 'INV003',
  
  // WebSocket errors
  WS_CONNECTION_FAILED: 'WS001',
  WS_AUTH_FAILED: 'WS002',
  WS_RECONNECT_FAILED: 'WS003',
  WS_TIMEOUT: 'WS004',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication
  AUTH001: 'Invalid email or password',
  AUTH002: 'Your session has expired. Please login again',
  AUTH003: 'Invalid authentication token',
  AUTH004: 'You are not authorized to perform this action',
  AUTH005: 'Access forbidden',
  AUTH006: 'Session expired',
  
  // API
  API001: 'Request timed out. Please try again',
  API002: 'Network error. Please check your connection',
  API003: 'Server error. Please try again later',
  API004: 'Resource not found',
  API005: 'Invalid request',
  API006: 'Too many requests. Please slow down',
  
  // Business logic
  ORD001: 'Order not found',
  ORD002: 'Order has already been paid',
  ORD003: 'Order has been cancelled',
  ORD004: 'Invalid order status transition',
  
  PAY001: 'Payment failed. Please try again',
  PAY002: 'Payment declined by processor',
  PAY003: 'Insufficient funds',
  PAY004: 'Invalid payment method',
  
  INV001: 'Item is out of stock',
  INV002: 'Item stock is running low',
  INV003: 'Invalid quantity',
  
  // WebSocket
  WS001: 'Failed to connect to server',
  WS002: 'WebSocket authentication failed',
  WS003: 'Failed to reconnect after multiple attempts',
  WS004: 'WebSocket connection timed out',
};