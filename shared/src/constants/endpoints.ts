export const API_VERSION = 'v1';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `/api/${API_VERSION}/auth/login`,
    LOGOUT: `/api/${API_VERSION}/auth/logout`,
    REFRESH: `/api/${API_VERSION}/auth/refresh`,
    ME: `/api/${API_VERSION}/auth/me`,
    REGISTER: `/api/${API_VERSION}/auth/register`,
    FORGOT_PASSWORD: `/api/${API_VERSION}/auth/forgot-password`,
    RESET_PASSWORD: `/api/${API_VERSION}/auth/reset-password`,
  },
  
  // Restaurant Operations
  RESTAURANT: {
    LIST: `/api/${API_VERSION}/restaurants`,
    DETAILS: `/api/${API_VERSION}/restaurants/:id`,
    CREATE: `/api/${API_VERSION}/restaurants`,
    UPDATE: `/api/${API_VERSION}/restaurants/:id`,
    DELETE: `/api/${API_VERSION}/restaurants/:id`,
    SETTINGS: `/api/${API_VERSION}/restaurants/:id/settings`,
    STATS: `/api/${API_VERSION}/restaurants/:id/stats`,
    USERS: `/api/${API_VERSION}/restaurants/:id/users`,
  },
  
  // Menu Management
  MENU: {
    ITEMS: `/api/${API_VERSION}/menu`,
    CATEGORIES: `/api/${API_VERSION}/menu/categories`,
    CATEGORY: `/api/${API_VERSION}/menu/categories/:id`,
    ITEM: `/api/${API_VERSION}/menu/items/:id`,
    CREATE_ITEM: `/api/${API_VERSION}/menu/items`,
    UPDATE_ITEM: `/api/${API_VERSION}/menu/items/:id`,
    DELETE_ITEM: `/api/${API_VERSION}/menu/items/:id`,
    SEARCH: `/api/${API_VERSION}/menu/search`,
    BULK_UPDATE: `/api/${API_VERSION}/menu/bulk-update`,
  },
  
  // Orders
  ORDERS: {
    LIST: `/api/${API_VERSION}/orders`,
    CREATE: `/api/${API_VERSION}/orders`,
    DETAILS: `/api/${API_VERSION}/orders/:id`,
    UPDATE: `/api/${API_VERSION}/orders/:id`,
    UPDATE_STATUS: `/api/${API_VERSION}/orders/:id/status`,
    UPDATE_ITEM_STATUS: `/api/${API_VERSION}/orders/:id/items/:itemId/status`,
    PAYMENT: `/api/${API_VERSION}/orders/:id/payment`,
    REFUND: `/api/${API_VERSION}/orders/:id/refund`,
    RECEIPT: `/api/${API_VERSION}/orders/:id/receipt`,
  },
  
  // Payments
  PAYMENTS: {
    PROCESS: `/api/${API_VERSION}/payments/process`,
    VALIDATE: `/api/${API_VERSION}/payments/validate`,
    METHODS: `/api/${API_VERSION}/payments/methods`,
    TRANSACTION: `/api/${API_VERSION}/payments/transactions/:id`,
    REFUND: `/api/${API_VERSION}/payments/refund`,
  },
  
  // Inventory
  INVENTORY: {
    LIST: `/api/${API_VERSION}/inventory`,
    ITEM: `/api/${API_VERSION}/inventory/:id`,
    UPDATE: `/api/${API_VERSION}/inventory/:id`,
    ADJUST: `/api/${API_VERSION}/inventory/:id/adjust`,
    LOW_STOCK: `/api/${API_VERSION}/inventory/low-stock`,
    HISTORY: `/api/${API_VERSION}/inventory/:id/history`,
  },
  
  // Reports & Analytics
  REPORTS: {
    SALES: `/api/${API_VERSION}/reports/sales`,
    REVENUE: `/api/${API_VERSION}/reports/revenue`,
    PRODUCTS: `/api/${API_VERSION}/reports/products`,
    STAFF: `/api/${API_VERSION}/reports/staff`,
    CUSTOMERS: `/api/${API_VERSION}/reports/customers`,
    EXPORT: `/api/${API_VERSION}/reports/export`,
  },
  
  // Platform (Owner only)
  PLATFORM: {
    OVERVIEW: `/api/${API_VERSION}/platform/overview`,
    RESTAURANTS: `/api/${API_VERSION}/platform/restaurants`,
    ANALYTICS: `/api/${API_VERSION}/platform/analytics`,
    SETTINGS: `/api/${API_VERSION}/platform/settings`,
    USERS: `/api/${API_VERSION}/platform/users`,
    SUBSCRIPTIONS: `/api/${API_VERSION}/platform/subscriptions`,
    REVENUE: `/api/${API_VERSION}/platform/revenue`,
  }
} as const;