// MockDataService.ts - Beautiful mock data for showcasing
import AsyncStorage from '@react-native-async-storage/async-storage';

export class MockDataService {
  private static instance: MockDataService;
  private mockOrders: any[] = [];
  private mockSession: any = null;

  static getInstance(): MockDataService {
    if (!MockDataService.instance) {
      MockDataService.instance = new MockDataService();
    }
    return MockDataService.instance;
  }

  // Authentication
  async login(username: string, password: string): Promise<boolean> {
    // Demo accounts that always work
    const validAccounts = [
      { username: 'demo', password: 'demo' },
      { username: 'manager', password: 'manager' },
      { username: 'staff', password: 'staff' },
    ];

    const isValid = validAccounts.some(
      acc => acc.username === username && acc.password === password
    );

    if (isValid) {
      await AsyncStorage.setItem('mock_user', JSON.stringify({
        id: Math.random() * 1000,
        name: username.charAt(0).toUpperCase() + username.slice(1),
        email: `${username}@fynlo.com`,
        role: username === 'manager' ? 'manager' : 'cashier',
      }));
    }

    return isValid;
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('mock_user');
    this.mockSession = null;
  }

  // Authentic Mexican Restaurant Menu Items
  async getProducts(): Promise<any[]> {
    return [
      // SNACKS
      { id: 1, name: 'Nachos', price: 5.00, category: 'Snacks', image: '🧀', description: 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander', available_in_pos: true, active: true },
      { id: 2, name: 'Quesadillas', price: 5.50, category: 'Snacks', image: '🫓', description: 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander', available_in_pos: true, active: true },
      { id: 3, name: 'Chorizo Quesadilla', price: 5.50, category: 'Snacks', image: '🌶️', description: 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander', available_in_pos: true, active: true },
      { id: 4, name: 'Chicken Quesadilla', price: 5.50, category: 'Snacks', image: '🐔', description: 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander', available_in_pos: true, active: true },
      { id: 5, name: 'Tostada', price: 6.50, category: 'Snacks', image: '🥙', description: 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta', available_in_pos: true, active: true },

      // TACOS
      { id: 6, name: 'Carnitas', price: 3.50, category: 'Tacos', image: '🌮', description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander', available_in_pos: true, active: true },
      { id: 7, name: 'Cochinita', price: 3.50, category: 'Tacos', image: '🌮', description: 'Marinated pulled pork served with pickle red onion', available_in_pos: true, active: true },
      { id: 8, name: 'Barbacoa de Res', price: 3.50, category: 'Tacos', image: '🌮', description: 'Juicy pulled beef topped with onion, guacamole & coriander', available_in_pos: true, active: true },
      { id: 9, name: 'Chorizo', price: 3.50, category: 'Tacos', image: '🌮', description: 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole', available_in_pos: true, active: true },
      { id: 10, name: 'Rellena', price: 3.50, category: 'Tacos', image: '🌮', description: 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion', available_in_pos: true, active: true },
      { id: 11, name: 'Chicken Fajita', price: 3.50, category: 'Tacos', image: '🌮', description: 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander', available_in_pos: true, active: true },
      { id: 12, name: 'Haggis', price: 3.50, category: 'Tacos', image: '🌮', description: 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion', available_in_pos: true, active: true },
      { id: 13, name: 'Pescado', price: 3.50, category: 'Tacos', image: '🌮', description: 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa', available_in_pos: true, active: true },
      { id: 14, name: 'Dorados', price: 3.50, category: 'Tacos', image: '🌮', description: 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta', available_in_pos: true, active: true },
      { id: 15, name: 'Dorados Papa', price: 3.50, category: 'Tacos', image: '🌮', description: 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta', available_in_pos: true, active: true },
      { id: 16, name: 'Nopal', price: 3.50, category: 'Tacos', image: '🌮', description: 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta', available_in_pos: true, active: true },
      { id: 17, name: 'Frijol', price: 3.50, category: 'Tacos', image: '🌮', description: 'Black beans with fried plantain served with tomato salsa, feta & coriander', available_in_pos: true, active: true },
      { id: 18, name: 'Verde', price: 3.50, category: 'Tacos', image: '🌮', description: 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta', available_in_pos: true, active: true },
      { id: 19, name: 'Fajita', price: 3.50, category: 'Tacos', image: '🌮', description: 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander', available_in_pos: true, active: true },

      // SPECIAL TACOS
      { id: 20, name: 'Carne Asada', price: 4.50, category: 'Special Tacos', image: '⭐', description: 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander', available_in_pos: true, active: true },
      { id: 21, name: 'Camaron', price: 4.50, category: 'Special Tacos', image: '🦐', description: 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole', available_in_pos: true, active: true },
      { id: 22, name: 'Pulpos', price: 4.50, category: 'Special Tacos', image: '🐙', description: 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander', available_in_pos: true, active: true },

      // BURRITOS
      { id: 23, name: 'Regular Burrito', price: 8.00, category: 'Burritos', image: '🌯', description: 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.', available_in_pos: true, active: true },
      { id: 24, name: 'Special Burrito', price: 10.00, category: 'Burritos', image: '🌯', description: 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.', available_in_pos: true, active: true },
      { id: 25, name: 'Add Mozzarella', price: 1.00, category: 'Burritos', image: '🧀', description: 'Add extra cheese to any burrito', available_in_pos: true, active: true },

      // SIDES & SALSAS
      { id: 26, name: 'Skinny Fries', price: 3.50, category: 'Sides', image: '🍟', description: 'Thin cut fries', available_in_pos: true, active: true },
      { id: 27, name: 'Pico de Gallo', price: 0.00, category: 'Sides', image: '🍅', description: 'Diced tomato, onion and chilli - FREE!', available_in_pos: true, active: true },
      { id: 28, name: 'Green Chili', price: 0.00, category: 'Sides', image: '🌶️', description: 'Homemade green chili salsa - HOT! - FREE!', available_in_pos: true, active: true },
      { id: 29, name: 'Pineapple Habanero', price: 0.00, category: 'Sides', image: '🍍', description: 'Pineapple sauce with habanero chili - HOT! - FREE!', available_in_pos: true, active: true },
      { id: 30, name: 'Scotch Bonnet', price: 0.00, category: 'Sides', image: '🔥', description: 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE!', available_in_pos: true, active: true },

      // DRINKS
      { id: 31, name: 'Pink Paloma', price: 3.75, category: 'Drinks', image: '🍹', description: 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine', available_in_pos: true, active: true },
      { id: 32, name: 'Coco-Nought', price: 3.75, category: 'Drinks', image: '🥥', description: 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!', available_in_pos: true, active: true },
      { id: 33, name: 'Corona', price: 3.80, category: 'Drinks', image: '🍺', description: 'Mexican beer', available_in_pos: true, active: true },
      { id: 34, name: 'Modelo', price: 4.00, category: 'Drinks', image: '🍺', description: 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml', available_in_pos: true, active: true },
      { id: 35, name: 'Pacifico', price: 4.00, category: 'Drinks', image: '🍺', description: 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml', available_in_pos: true, active: true },
      { id: 36, name: 'Dos Equis', price: 4.00, category: 'Drinks', image: '🍺', description: '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml', available_in_pos: true, active: true },
    ];
  }

  async getProductsByCategory(categoryId: number): Promise<any[]> {
    const products = await this.getProducts();
    const categoryMap: { [key: number]: string } = {
      1: 'Snacks',
      2: 'Tacos',
      3: 'Special Tacos',
      4: 'Burritos',
      5: 'Sides',
      6: 'Drinks',
    };
    
    const categoryName = categoryMap[categoryId];
    return products.filter(p => p.category === categoryName);
  }

  // Categories
  async getCategories(): Promise<any[]> {
    return [
      { id: 1, name: 'Snacks', active: true, icon: '🧀' },
      { id: 2, name: 'Tacos', active: true, icon: '🌮' },
      { id: 3, name: 'Special Tacos', active: true, icon: '⭐' },
      { id: 4, name: 'Burritos', active: true, icon: '🌯' },
      { id: 5, name: 'Sides', active: true, icon: '🍟' },
      { id: 6, name: 'Drinks', active: true, icon: '🍺' },
    ];
  }

  // Orders
  async createOrder(order: any): Promise<any> {
    const newOrder = {
      id: this.mockOrders.length + 1,
      ...order,
      date_order: new Date().toISOString(),
      state: 'draft',
      order_number: `ORD-${Date.now().toString().slice(-6)}`,
    };
    
    this.mockOrders.push(newOrder);
    
    // Update session
    if (this.mockSession) {
      this.mockSession.ordersCount++;
      this.mockSession.totalSales += order.amount_total || 0;
    }
    
    return newOrder;
  }

  async updateOrder(orderId: number, updates: any): Promise<any> {
    const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      this.mockOrders[orderIndex] = { ...this.mockOrders[orderIndex], ...updates };
      return this.mockOrders[orderIndex];
    }
    return null;
  }

  async getRecentOrders(limit: number = 20): Promise<any[]> {
    // Generate some realistic mock orders
    const now = new Date();
    const mockRecentOrders = [];
    
    for (let i = 0; i < limit; i++) {
      const orderTime = new Date(now.getTime() - i * 15 * 60 * 1000); // 15 min intervals
      mockRecentOrders.push({
        id: 1000 + i,
        order_number: `ORD-${(Date.now() - i * 1000000).toString().slice(-6)}`,
        date_order: orderTime.toISOString(),
        state: i === 0 ? 'draft' : i < 3 ? 'paid' : 'done',
        amount_total: Math.floor(Math.random() * 150) + 20,
        partner_name: `Table ${Math.floor(Math.random() * 20) + 1}`,
        items_count: Math.floor(Math.random() * 5) + 1,
        payment_method: ['card', 'cash', 'apple_pay'][Math.floor(Math.random() * 3)],
      });
    }
    
    return [...this.mockOrders, ...mockRecentOrders].slice(0, limit);
  }

  // Payment
  async processPayment(orderId: number, paymentMethod: string, amount: number): Promise<boolean> {
    console.log(`Mock payment processed: ${paymentMethod} for £${amount}`);
    await this.updateOrder(orderId, { state: 'paid', payment_method: paymentMethod });
    return true;
  }

  // Restaurant floor plan
  async getRestaurantFloorPlan(sectionId?: string | null): Promise<any> {
    const tables = [
      // Main Floor
      { id: '1', name: 'T1', display_name: 'Table 1', capacity: 4, status: 'available', section: { id: '1', name: 'Main Floor', color: '#3498db' } },
      { id: '2', name: 'T2', display_name: 'Table 2', capacity: 2, status: 'occupied', section: { id: '1', name: 'Main Floor', color: '#3498db' }, current_order: { id: '101', amount: 45.99 }, occupied_since: new Date(Date.now() - 30 * 60000).toISOString() },
      { id: '3', name: 'T3', display_name: 'Table 3', capacity: 6, status: 'reserved', section: { id: '1', name: 'Main Floor', color: '#3498db' } },
      { id: '4', name: 'T4', display_name: 'Table 4', capacity: 4, status: 'available', section: { id: '1', name: 'Main Floor', color: '#3498db' } },
      { id: '5', name: 'T5', display_name: 'Table 5', capacity: 4, status: 'occupied', section: { id: '1', name: 'Main Floor', color: '#3498db' }, current_order: { id: '102', amount: 128.50 }, occupied_since: new Date(Date.now() - 45 * 60000).toISOString() },
      
      // Patio
      { id: '6', name: 'P1', display_name: 'Patio 1', capacity: 4, status: 'available', section: { id: '2', name: 'Patio', color: '#27ae60' } },
      { id: '7', name: 'P2', display_name: 'Patio 2', capacity: 4, status: 'cleaning', section: { id: '2', name: 'Patio', color: '#27ae60' } },
      { id: '8', name: 'P3', display_name: 'Patio 3', capacity: 2, status: 'available', section: { id: '2', name: 'Patio', color: '#27ae60' } },
      
      // Bar
      { id: '9', name: 'B1', display_name: 'Bar 1', capacity: 1, status: 'occupied', section: { id: '3', name: 'Bar', color: '#e74c3c' }, current_order: { id: '103', amount: 18.95 } },
      { id: '10', name: 'B2', display_name: 'Bar 2', capacity: 1, status: 'available', section: { id: '3', name: 'Bar', color: '#e74c3c' } },
      { id: '11', name: 'B3', display_name: 'Bar 3', capacity: 1, status: 'available', section: { id: '3', name: 'Bar', color: '#e74c3c' } },
      { id: '12', name: 'B4', display_name: 'Bar 4', capacity: 1, status: 'occupied', section: { id: '3', name: 'Bar', color: '#e74c3c' }, current_order: { id: '104', amount: 32.50 } },
    ];

    const sections = [
      { id: '1', name: 'Main Floor', color: '#3498db', table_count: 5, total_capacity: 20 },
      { id: '2', name: 'Patio', color: '#27ae60', table_count: 3, total_capacity: 10 },
      { id: '3', name: 'Bar', color: '#e74c3c', table_count: 4, total_capacity: 4 },
    ];

    if (sectionId) {
      return {
        tables: tables.filter(t => t.section.id === sectionId),
        sections: sections.filter(s => s.id === sectionId),
      };
    }

    return { tables, sections };
  }

  async updateTableStatus(tableId: string, status: string, additionalData?: any): Promise<any> {
    console.log(`Mock: Table ${tableId} updated to ${status}`);
    return { success: true, tableId, status, ...additionalData };
  }

  // Reports with beautiful data
  async getDailySalesReport(date?: string): Promise<any> {
    const reportDate = date || new Date().toISOString().split('T')[0];
    
    return {
      report_info: {
        type: 'daily',
        date: reportDate,
        generated_at: new Date().toISOString(),
        restaurant: 'Fynlo Restaurant',
      },
      summary: {
        total_sales: 3847.50,
        net_sales: 3502.27,
        total_tax: 345.23,
        total_orders: 87,
        average_ticket: 44.22,
        total_items: 234,
        average_items_per_order: 2.69,
        refund_amount: 45.99,
        refund_count: 2,
        discount_amount: 189.75,
      },
      hourly_breakdown: [
        { hour: '10:00', sales: 145.50, orders: 4, items: 8 },
        { hour: '11:00', sales: 234.20, orders: 7, items: 15 },
        { hour: '12:00', sales: 687.90, orders: 18, items: 48 },
        { hour: '13:00', sales: 845.60, orders: 21, items: 61 },
        { hour: '14:00', sales: 398.30, orders: 9, items: 24 },
        { hour: '15:00', sales: 156.75, orders: 4, items: 9 },
        { hour: '16:00', sales: 189.25, orders: 5, items: 11 },
        { hour: '17:00', sales: 261.25, orders: 6, items: 15 },
        { hour: '18:00', sales: 445.75, orders: 8, items: 23 },
        { hour: '19:00', sales: 483.00, orders: 5, items: 20 },
      ],
      payment_methods: [
        { method: 'Card', amount: 2534.50, count: 58, percentage: 65.9 },
        { method: 'Cash', amount: 855.75, count: 21, percentage: 22.2 },
        { method: 'Apple Pay', amount: 457.25, count: 8, percentage: 11.9 },
      ],
      top_products: [
        { name: 'Wagyu Burger', qty: 28, amount: 810.60, category: 'Mains' },
        { name: 'Truffle Pasta', qty: 21, amount: 523.95, category: 'Mains' },
        { name: 'Caesar Salad', qty: 18, amount: 269.10, category: 'Salads' },
        { name: 'Margherita Pizza', qty: 16, amount: 303.20, category: 'Pizza' },
        { name: 'Tiramisu', qty: 24, amount: 214.80, category: 'Desserts' },
      ],
      staff_performance: [
        { name: 'Sarah Johnson', orders: 24, sales: 1045.60, avg_ticket: 43.57 },
        { name: 'Mike Chen', orders: 21, sales: 967.25, avg_ticket: 46.06 },
        { name: 'Emma Davis', orders: 19, sales: 834.90, avg_ticket: 43.94 },
        { name: 'Tom Wilson', orders: 23, sales: 999.75, avg_ticket: 43.47 },
      ],
    };
  }

  async getSalesSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    return {
      period: {
        from: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: dateTo || new Date().toISOString().split('T')[0],
      },
      summary: {
        total_sales: 98547.50,
        net_sales: 89588.64,
        total_tax: 8958.86,
        total_orders: 2341,
        average_ticket: 42.11,
        total_customers: 1876,
        repeat_customers: 423,
        repeat_rate: 22.5,
      },
      trends: {
        sales_growth: 12.3,
        order_growth: 8.7,
        avg_ticket_growth: 3.2,
      },
      by_category: [
        { category: 'Mains', sales: 45234.50, percentage: 45.9 },
        { category: 'Drinks', sales: 18965.25, percentage: 19.2 },
        { category: 'Starters', sales: 12456.75, percentage: 12.6 },
        { category: 'Pizza', sales: 11234.00, percentage: 11.4 },
        { category: 'Desserts', sales: 6789.50, percentage: 6.9 },
        { category: 'Salads', sales: 3867.50, percentage: 3.9 },
      ],
    };
  }

  // Session management
  async getCurrentSession(): Promise<any> {
    if (!this.mockSession) {
      this.mockSession = {
        id: 1,
        userId: 1,
        userName: 'Demo User',
        startTime: new Date(),
        isActive: true,
        startingCash: 200.00,
        totalSales: 0,
        ordersCount: 0,
      };
    }
    return this.mockSession;
  }

  async createSession(configId: number): Promise<any> {
    this.mockSession = {
      id: Date.now(),
      configId,
      userId: 1,
      userName: 'Demo User',
      startTime: new Date(),
      isActive: true,
      startingCash: 200.00,
      totalSales: 0,
      ordersCount: 0,
    };
    return this.mockSession;
  }

  // Hardware simulation
  async printReceipt(order: any): Promise<boolean> {
    console.log('Mock: Printing receipt for order', order.id);
    console.log('=====================================');
    console.log('         FYNLO RESTAURANT');
    console.log('=====================================');
    console.log(`Order: ${order.order_number}`);
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log('-------------------------------------');
    // ... receipt details
    console.log('=====================================');
    return true;
  }

  async openCashDrawer(): Promise<boolean> {
    console.log('Mock: Cash drawer opened');
    return true;
  }

  async scanBarcode(): Promise<string | null> {
    // Simulate barcode scanning
    const mockBarcodes = ['123456789012', '987654321098', '555555555555'];
    return mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
  }

  // Sync
  async syncOfflineData(): Promise<void> {
    console.log('Mock: Syncing offline data');
    // In real implementation, this would sync with a server
  }
}

export default MockDataService;