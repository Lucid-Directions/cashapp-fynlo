export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'https://api.fynlo.co.uk',
  VERSION: 'v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const API_ENDPOINTS = {
  // Authentication
  AUTH_VERIFY: '/auth/verify',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_ME: '/auth/me',
  
  // Restaurant Management (🏪 RESTAURANT MANAGER ONLY)
  RESTAURANT_DETAILS: '/restaurants/:id',
  RESTAURANT_UPDATE: '/restaurants/:id',
  RESTAURANT_STATS: '/restaurants/:id/stats',
  
  // Menu Management
  MENU_LIST: '/restaurants/:id/menu',
  MENU_CATEGORY_CREATE: '/restaurants/:id/menu/categories',
  MENU_CATEGORY_UPDATE: '/restaurants/:id/menu/categories/:catId',
  MENU_CATEGORY_DELETE: '/restaurants/:id/menu/categories/:catId',
  MENU_ITEM_CREATE: '/restaurants/:id/menu/items',
  MENU_ITEM_UPDATE: '/restaurants/:id/menu/items/:itemId',
  MENU_ITEM_DELETE: '/restaurants/:id/menu/items/:itemId',
  MENU_MODIFIERS: '/restaurants/:id/menu/modifiers',
  MENU_EXPORT: '/restaurants/:id/menu/export',
  MENU_IMPORT: '/restaurants/:id/menu/import',
  
  // Order Management
  ORDERS_LIST: '/restaurants/:id/orders',
  ORDER_CREATE: '/restaurants/:id/orders',
  ORDER_DETAILS: '/restaurants/:id/orders/:orderId',
  ORDER_UPDATE: '/restaurants/:id/orders/:orderId',
  ORDER_STATUS: '/restaurants/:id/orders/:orderId/status',
  ORDER_REFUND: '/restaurants/:id/orders/:orderId/refund',
  ORDERS_EXPORT: '/restaurants/:id/orders/export',
  
  // Inventory Management
  INVENTORY_LIST: '/restaurants/:id/inventory',
  INVENTORY_CREATE: '/restaurants/:id/inventory',
  INVENTORY_UPDATE: '/restaurants/:id/inventory/:itemId',
  INVENTORY_ADJUST: '/restaurants/:id/inventory/:itemId/adjust',
  INVENTORY_MOVEMENTS: '/restaurants/:id/inventory/movements',
  INVENTORY_ALERTS: '/restaurants/:id/inventory/alerts',
  
  // Staff Management
  STAFF_LIST: '/restaurants/:id/staff',
  STAFF_CREATE: '/restaurants/:id/staff',
  STAFF_UPDATE: '/restaurants/:id/staff/:staffId',
  STAFF_DELETE: '/restaurants/:id/staff/:staffId',
  STAFF_CLOCK_IN: '/restaurants/:id/staff/:staffId/clock-in',
  STAFF_CLOCK_OUT: '/restaurants/:id/staff/:staffId/clock-out',
  STAFF_SCHEDULE: '/restaurants/:id/staff/schedule',
  
  // Customer Management
  CUSTOMERS_LIST: '/restaurants/:id/customers',
  CUSTOMERS_CREATE: '/restaurants/:id/customers',
  CUSTOMERS_UPDATE: '/restaurants/:id/customers/:customerId',
  CUSTOMERS_ORDERS: '/restaurants/:id/customers/:customerId/orders',
  CUSTOMERS_IMPORT: '/restaurants/:id/customers/import',
  CUSTOMERS_EXPORT: '/restaurants/:id/customers/export',
  
  // Table Management
  TABLES_LIST: '/restaurants/:id/tables',
  TABLES_UPDATE: '/restaurants/:id/tables',
  TABLE_STATUS: '/restaurants/:id/tables/:tableId/status',
  TABLE_ASSIGN: '/restaurants/:id/tables/:tableId/assign',
  TABLES_MERGE: '/restaurants/:id/tables/merge',
  
  // Analytics & Reports
  ANALYTICS_SALES: '/restaurants/:id/analytics/sales',
  ANALYTICS_PRODUCTS: '/restaurants/:id/analytics/products',
  ANALYTICS_STAFF: '/restaurants/:id/analytics/staff',
  ANALYTICS_CUSTOMERS: '/restaurants/:id/analytics/customers',
  REPORTS_GENERATE: '/restaurants/:id/reports/generate',
  REPORTS_LIST: '/restaurants/:id/reports/list',
  
  // Settings
  SETTINGS_GET: '/restaurants/:id/settings',
  SETTINGS_BUSINESS: '/restaurants/:id/settings/business',
  SETTINGS_TAX: '/restaurants/:id/settings/tax',
  SETTINGS_RECEIPT: '/restaurants/:id/settings/receipt',
  SETTINGS_ONLINE: '/restaurants/:id/settings/online',
  SETTINGS_INTEGRATIONS: '/restaurants/:id/settings/integrations',
  
  // Platform Owner Endpoints (👤 PLATFORM OWNER ONLY)
  PLATFORM_OVERVIEW: '/platform/overview',
  PLATFORM_RESTAURANTS: '/platform/restaurants',
  PLATFORM_REVENUE: '/platform/revenue',
  PLATFORM_HEALTH: '/platform/health',
  PLATFORM_SETTINGS: '/platform/settings',
  PLATFORM_ANNOUNCEMENTS: '/platform/announcements',
  PLATFORM_SUBSCRIPTIONS: '/platform/subscriptions',
  PLATFORM_SUBSCRIPTION_UPDATE: '/platform/subscriptions/:planId',
};

// Helper function to replace URL parameters
export const buildEndpoint = (endpoint: string, params: Record<string, string | number>): string => {
  let url = endpoint;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }
  return url;
};