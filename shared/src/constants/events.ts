export enum WebSocketEvent {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  AUTH_ERROR = 'auth_error',
  
  // System
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  RECONNECT = 'reconnect',
  
  // Orders
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_ITEM_STATUS_CHANGED = 'order.item_status_changed',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_COMPLETED = 'order.completed',
  
  // Payments
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  
  // Kitchen
  KITCHEN_ORDER_RECEIVED = 'kitchen.order_received',
  KITCHEN_ITEM_STARTED = 'kitchen.item_started',
  KITCHEN_ITEM_READY = 'kitchen.item_ready',
  KITCHEN_ORDER_READY = 'kitchen.order_ready',
  
  // Inventory
  INVENTORY_LOW_STOCK = 'inventory.low_stock',
  INVENTORY_OUT_OF_STOCK = 'inventory.out_of_stock',
  INVENTORY_UPDATED = 'inventory.updated',
  
  // Staff
  STAFF_CLOCKED_IN = 'staff.clocked_in',
  STAFF_CLOCKED_OUT = 'staff.clocked_out',
  STAFF_BREAK_STARTED = 'staff.break_started',
  STAFF_BREAK_ENDED = 'staff.break_ended',
  
  // Tables
  TABLE_OCCUPIED = 'table.occupied',
  TABLE_AVAILABLE = 'table.available',
  TABLE_RESERVED = 'table.reserved',
  TABLE_CLEANED = 'table.cleaned',
  
  // Sync
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  DATA_UPDATED = 'data.updated',
}