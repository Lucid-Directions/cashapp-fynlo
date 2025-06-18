// MockDataService.test.ts - Tests for mock data service
import AsyncStorage from '@react-native-async-storage/async-storage';
import MockDataService from '../MockDataService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('MockDataService', () => {
  let mockDataService: MockDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataService = MockDataService.getInstance();
  });

  describe('Authentication', () => {
    it('should accept valid demo accounts', async () => {
      const validAccounts = [
        { username: 'demo', password: 'demo' },
        { username: 'manager', password: 'manager' },
        { username: 'staff', password: 'staff' },
      ];

      for (const account of validAccounts) {
        const result = await mockDataService.login(account.username, account.password);
        expect(result).toBe(true);
      }
    });

    it('should reject invalid credentials', async () => {
      const result = await mockDataService.login('invalid', 'wrong');
      expect(result).toBe(false);
    });

    it('should store user data on successful login', async () => {
      await mockDataService.login('demo', 'demo');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'mock_user',
        expect.stringContaining('"name":"Demo"')
      );
    });

    it('should clear user data on logout', async () => {
      await mockDataService.logout();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('mock_user');
    });
  });

  describe('Products', () => {
    it('should return a comprehensive product list', async () => {
      const products = await mockDataService.getProducts();
      
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      
      // Check product structure
      const product = products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('description');
    });

    it('should include all expected categories', async () => {
      const products = await mockDataService.getProducts();
      const categories = [...new Set(products.map(p => p.category))];
      
      const expectedCategories = ['Starters', 'Mains', 'Pizza', 'Salads', 'Desserts', 'Drinks'];
      
      expectedCategories.forEach(category => {
        expect(categories).toContain(category);
      });
    });

    it('should filter products by category', async () => {
      const starterProducts = await mockDataService.getProductsByCategory(1); // Starters
      
      expect(Array.isArray(starterProducts)).toBe(true);
      starterProducts.forEach(product => {
        expect(product.category).toBe('Starters');
      });
    });
  });

  describe('Categories', () => {
    it('should return all categories', async () => {
      const categories = await mockDataService.getCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(6);
      
      const categoryNames = categories.map(c => c.name);
      expect(categoryNames).toContain('Starters');
      expect(categoryNames).toContain('Mains');
      expect(categoryNames).toContain('Pizza');
    });
  });

  describe('Orders', () => {
    it('should create new orders with proper structure', async () => {
      const orderData = {
        amount_total: 25.99,
        lines: [
          { product_id: 1, product_name: 'Test Item', qty: 1, price_unit: 25.99 }
        ]
      };

      const order = await mockDataService.createOrder(orderData);
      
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('order_number');
      expect(order).toHaveProperty('date_order');
      expect(order.state).toBe('draft');
      expect(order.amount_total).toBe(25.99);
    });

    it('should update existing orders', async () => {
      // Create an order first
      const orderData = { amount_total: 30.00 };
      const order = await mockDataService.createOrder(orderData);
      
      // Update it
      const updates = { state: 'paid', payment_method: 'card' };
      const updatedOrder = await mockDataService.updateOrder(order.id, updates);
      
      expect(updatedOrder.state).toBe('paid');
      expect(updatedOrder.payment_method).toBe('card');
    });

    it('should return recent orders with realistic data', async () => {
      const orders = await mockDataService.getRecentOrders(10);
      
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeLessThanOrEqual(10);
      
      if (orders.length > 0) {
        const order = orders[0];
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('order_number');
        expect(order).toHaveProperty('amount_total');
        expect(order).toHaveProperty('state');
      }
    });
  });

  describe('Restaurant Floor Plan', () => {
    it('should return complete floor plan data', async () => {
      const floorPlan = await mockDataService.getRestaurantFloorPlan();
      
      expect(floorPlan).toHaveProperty('tables');
      expect(floorPlan).toHaveProperty('sections');
      expect(Array.isArray(floorPlan.tables)).toBe(true);
      expect(Array.isArray(floorPlan.sections)).toBe(true);
    });

    it('should filter tables by section', async () => {
      const patioFloorPlan = await mockDataService.getRestaurantFloorPlan('2'); // Patio
      
      expect(patioFloorPlan.tables.length).toBeGreaterThan(0);
      patioFloorPlan.tables.forEach(table => {
        expect(table.section.id).toBe('2');
        expect(table.section.name).toBe('Patio');
      });
    });

    it('should include tables with different statuses', async () => {
      const floorPlan = await mockDataService.getRestaurantFloorPlan();
      const statuses = [...new Set(floorPlan.tables.map(t => t.status))];
      
      expect(statuses).toContain('available');
      expect(statuses).toContain('occupied');
    });
  });

  describe('Reports', () => {
    it('should generate realistic daily sales report', async () => {
      const report = await mockDataService.getDailySalesReport();
      
      expect(report).toHaveProperty('report_info');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('hourly_breakdown');
      expect(report).toHaveProperty('payment_methods');
      expect(report).toHaveProperty('top_products');
      
      // Check summary structure
      expect(report.summary).toHaveProperty('total_sales');
      expect(report.summary).toHaveProperty('total_orders');
      expect(report.summary).toHaveProperty('average_ticket');
      
      // Check hourly breakdown
      expect(Array.isArray(report.hourly_breakdown)).toBe(true);
      expect(report.hourly_breakdown.length).toBeGreaterThan(0);
    });

    it('should generate sales summary with trends', async () => {
      const summary = await mockDataService.getSalesSummary();
      
      expect(summary).toHaveProperty('period');
      expect(summary).toHaveProperty('summary');
      expect(summary).toHaveProperty('trends');
      expect(summary).toHaveProperty('by_category');
      
      // Check trends
      expect(summary.trends).toHaveProperty('sales_growth');
      expect(summary.trends).toHaveProperty('order_growth');
    });
  });

  describe('Payment Processing', () => {
    it('should always succeed in mock mode', async () => {
      const result = await mockDataService.processPayment(123, 'card', 45.99);
      expect(result).toBe(true);
    });
  });

  describe('Hardware Operations', () => {
    it('should simulate receipt printing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const order = { id: 123, order_number: 'ORD-123' };
      const result = await mockDataService.printReceipt(order);
      
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Mock: Printing receipt for order', 123);
      
      consoleSpy.mockRestore();
    });

    it('should simulate cash drawer opening', async () => {
      const result = await mockDataService.openCashDrawer();
      expect(result).toBe(true);
    });

    it('should simulate barcode scanning', async () => {
      const barcode = await mockDataService.scanBarcode();
      expect(typeof barcode).toBe('string');
      expect(barcode).toHaveLength(12); // Standard barcode length
    });
  });

  describe('Session Management', () => {
    it('should create and return current session', async () => {
      const session = await mockDataService.getCurrentSession();
      
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('totalSales');
      expect(session).toHaveProperty('ordersCount');
      expect(session.isActive).toBe(true);
    });

    it('should create new session with config', async () => {
      const session = await mockDataService.createSession(5);
      
      expect(session).toHaveProperty('configId');
      expect(session.configId).toBe(5);
      expect(session.isActive).toBe(true);
    });
  });
});