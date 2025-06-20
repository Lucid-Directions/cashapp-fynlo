import { MenuItem } from '../types';

// Generate mock historical data for the past year
export interface SalesData {
  date: Date;
  total: number;
  transactions: number;
  items: number;
  averageTransaction: number;
  paymentMethods: {
    card: number;
    cash: number;
    mobile: number;
    giftCard: number;
  };
  hourlyData: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
  topItems: Array<{
    itemId: number;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  employees: Array<{
    id: number;
    name: string;
    sales: number;
    transactions: number;
    hours: number;
  }>;
}

export interface CustomerData {
  id: number;
  name: string;
  email: string;
  phone: string;
  joinedDate: Date;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  lastVisit: Date;
  loyaltyPoints: number;
  preferredItems: string[];
  tags: string[];
}

export interface EmployeeData {
  id: number;
  name: string;
  role: 'Manager' | 'Cashier' | 'Server' | 'Cook';
  email: string;
  phone: string;
  hireDate: Date;
  hourlyRate: number;
  totalSales: number;
  averageSalesPerDay: number;
  punctualityScore: number;
  performanceScore: number;
  scheduledHours: number;
  actualHours: number;
  photo?: string;
}

export interface InventoryData {
  itemId: number;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  supplier: string;
  lastRestocked: Date;
  turnoverRate: number;
  wastage: number;
}

// Generate one year of daily sales data
export const generateSalesHistory = (startDate: Date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)): SalesData[] => {
  const salesHistory: SalesData[] = [];
  const currentDate = new Date();
  
  for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 1.3 : 1.0;
    
    // Seasonal variations
    const month = d.getMonth();
    const seasonalMultiplier = month === 11 ? 1.5 : // December - Christmas
                              month === 6 || month === 7 ? 1.2 : // Summer
                              1.0;
    
    const dailyTotal = (800 + Math.random() * 1200) * baseMultiplier * seasonalMultiplier;
    const transactions = Math.floor(30 + Math.random() * 50 * baseMultiplier);
    
    // Generate hourly data
    const hourlyData = [];
    for (let hour = 10; hour <= 22; hour++) {
      const lunchRush = hour >= 12 && hour <= 14;
      const dinnerRush = hour >= 18 && hour <= 20;
      const rushMultiplier = lunchRush ? 1.5 : dinnerRush ? 1.8 : 1.0;
      
      hourlyData.push({
        hour,
        sales: Math.round((dailyTotal / 13) * rushMultiplier * (0.8 + Math.random() * 0.4)),
        transactions: Math.floor((transactions / 13) * rushMultiplier * (0.8 + Math.random() * 0.4))
      });
    }
    
    salesHistory.push({
      date: new Date(d),
      total: Math.round(dailyTotal * 100) / 100,
      transactions,
      items: Math.floor(transactions * (2.5 + Math.random())),
      averageTransaction: Math.round((dailyTotal / transactions) * 100) / 100,
      paymentMethods: {
        card: Math.round(dailyTotal * 0.65 * 100) / 100,
        cash: Math.round(dailyTotal * 0.20 * 100) / 100,
        mobile: Math.round(dailyTotal * 0.12 * 100) / 100,
        giftCard: Math.round(dailyTotal * 0.03 * 100) / 100,
      },
      hourlyData,
      topItems: generateTopItems(dailyTotal),
      employees: generateDailyEmployeeData(dailyTotal, transactions)
    });
  }
  
  return salesHistory;
};

const menuItems = [
  'Nachos', 'Quesadillas', 'Chorizo Quesadilla', 'Chicken Quesadilla', 'Tostada',
  'Carnitas', 'Cochinita', 'Barbacoa de Res', 'Chorizo', 'Rellena',
  'Chicken Fajita', 'Haggis', 'Pescado', 'Dorados', 'Dorados Papa',
  'Carne Asada', 'Camaron', 'Pulpos', 'Regular Burrito', 'Special Burrito'
];

const generateTopItems = (dailyTotal: number) => {
  const numberOfItems = 5 + Math.floor(Math.random() * 5);
  const items = [];
  let remainingTotal = dailyTotal * 0.8; // Top items make up 80% of sales
  
  for (let i = 0; i < numberOfItems; i++) {
    const itemRevenue = i === numberOfItems - 1 ? remainingTotal : remainingTotal * (0.3 + Math.random() * 0.2);
    const itemPrice = 3.50 + Math.random() * 6.50;
    
    items.push({
      itemId: i + 1,
      name: menuItems[Math.floor(Math.random() * menuItems.length)],
      quantity: Math.floor(itemRevenue / itemPrice),
      revenue: Math.round(itemRevenue * 100) / 100
    });
    
    remainingTotal -= itemRevenue;
  }
  
  return items.sort((a, b) => b.revenue - a.revenue);
};

const employeeNames = [
  'Sarah Johnson', 'Mike Chen', 'Emma Williams', 'Carlos Rodriguez',
  'Lisa Thompson', 'David Kim', 'Maria Garcia', 'James Wilson'
];

const generateDailyEmployeeData = (dailySales: number, transactions: number) => {
  const numberOfEmployees = 3 + Math.floor(Math.random() * 3);
  const employees = [];
  let remainingSales = dailySales;
  let remainingTransactions = transactions;
  
  for (let i = 0; i < numberOfEmployees; i++) {
    const employeeSales = i === numberOfEmployees - 1 ? remainingSales : remainingSales * (0.3 + Math.random() * 0.2);
    const employeeTransactions = i === numberOfEmployees - 1 ? remainingTransactions : Math.floor(remainingTransactions * (0.3 + Math.random() * 0.2));
    
    employees.push({
      id: i + 1,
      name: employeeNames[i],
      sales: Math.round(employeeSales * 100) / 100,
      transactions: employeeTransactions,
      hours: 4 + Math.floor(Math.random() * 5)
    });
    
    remainingSales -= employeeSales;
    remainingTransactions -= employeeTransactions;
  }
  
  return employees;
};

// Generate customer database
export const generateCustomers = (count: number = 500): CustomerData[] => {
  const customers: CustomerData[] = [];
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Lisa', 'Robert', 'Mary'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const tags = ['VIP', 'Regular', 'New', 'Loyalty Member', 'Birthday Club', 'Corporate', 'Student', 'Senior'];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const joinedDaysAgo = Math.floor(Math.random() * 730); // Up to 2 years
    const orderCount = Math.floor(Math.random() * 50) + 1;
    const totalSpent = orderCount * (15 + Math.random() * 35);
    
    customers.push({
      id: i + 1,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `07${Math.floor(100000000 + Math.random() * 900000000)}`,
      joinedDate: new Date(Date.now() - joinedDaysAgo * 24 * 60 * 60 * 1000),
      totalSpent: Math.round(totalSpent * 100) / 100,
      orderCount,
      averageOrderValue: Math.round((totalSpent / orderCount) * 100) / 100,
      lastVisit: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      loyaltyPoints: Math.floor(totalSpent * 10),
      preferredItems: menuItems.slice(0, 3 + Math.floor(Math.random() * 3)),
      tags: tags.filter(() => Math.random() > 0.7)
    });
  }
  
  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
};

// Generate employee database
export const generateEmployees = (): EmployeeData[] => {
  const roles: Array<'Manager' | 'Cashier' | 'Server' | 'Cook'> = ['Manager', 'Cashier', 'Server', 'Cook'];
  
  return employeeNames.map((name, index) => {
    const role = index === 0 ? 'Manager' : roles[1 + Math.floor(Math.random() * 3)];
    const hireMonthsAgo = Math.floor(Math.random() * 36); // Up to 3 years
    const performanceScore = 70 + Math.random() * 30;
    
    return {
      id: index + 1,
      name,
      role,
      email: `${name.toLowerCase().replace(' ', '.')}@fynlopos.com`,
      phone: `07${Math.floor(100000000 + Math.random() * 900000000)}`,
      hireDate: new Date(Date.now() - hireMonthsAgo * 30 * 24 * 60 * 60 * 1000),
      hourlyRate: role === 'Manager' ? 18 + Math.random() * 7 : 10.50 + Math.random() * 4,
      totalSales: Math.round((50000 + Math.random() * 150000) * 100) / 100,
      averageSalesPerDay: Math.round((200 + Math.random() * 800) * 100) / 100,
      punctualityScore: 85 + Math.random() * 15,
      performanceScore: Math.round(performanceScore * 10) / 10,
      scheduledHours: 160,
      actualHours: 155 + Math.floor(Math.random() * 10)
    };
  });
};

// Generate inventory data
export const generateInventory = (): InventoryData[] => {
  const suppliers = ['UK Foods Ltd', 'Fresh Produce Co', 'Meat Supply Co', 'Mexican Imports UK', 'Local Suppliers'];
  
  // Mexican restaurant ingredients for cooking
  const ingredients = [
    // Vegetables & Produce
    { name: 'Onions', category: 'Vegetables', unit: 'kg', cost: 2.50, min: 10, max: 50 },
    { name: 'Tomatoes', category: 'Vegetables', unit: 'kg', cost: 3.20, min: 8, max: 40 },
    { name: 'Potatoes', category: 'Vegetables', unit: 'kg', cost: 1.80, min: 15, max: 60 },
    { name: 'Bell Peppers', category: 'Vegetables', unit: 'kg', cost: 4.50, min: 5, max: 25 },
    { name: 'Jalapeños', category: 'Vegetables', unit: 'kg', cost: 6.80, min: 3, max: 15 },
    { name: 'Coriander (Fresh)', category: 'Vegetables', unit: 'bunches', cost: 1.20, min: 20, max: 80 },
    { name: 'Lime', category: 'Vegetables', unit: 'kg', cost: 3.80, min: 5, max: 20 },
    { name: 'Avocados', category: 'Vegetables', unit: 'pieces', cost: 0.80, min: 50, max: 200 },
    { name: 'Lettuce', category: 'Vegetables', unit: 'heads', cost: 1.50, min: 10, max: 40 },
    
    // Meats
    { name: 'Pork Shoulder (Carnitas)', category: 'Meat', unit: 'kg', cost: 8.50, min: 5, max: 30 },
    { name: 'Beef Chuck (Barbacoa)', category: 'Meat', unit: 'kg', cost: 12.80, min: 3, max: 20 },
    { name: 'Chicken Thighs', category: 'Meat', unit: 'kg', cost: 6.20, min: 8, max: 35 },
    { name: 'Chorizo', category: 'Meat', unit: 'kg', cost: 9.50, min: 3, max: 15 },
    { name: 'Prawns', category: 'Meat', unit: 'kg', cost: 18.50, min: 2, max: 10 },
    { name: 'Cod Fillets', category: 'Meat', unit: 'kg', cost: 14.80, min: 3, max: 12 },
    
    // Dairy & Cheese
    { name: 'Mozzarella Cheese', category: 'Dairy', unit: 'kg', cost: 7.20, min: 5, max: 25 },
    { name: 'Feta Cheese', category: 'Dairy', unit: 'kg', cost: 8.50, min: 3, max: 15 },
    { name: 'Sour Cream', category: 'Dairy', unit: 'litres', cost: 3.80, min: 5, max: 20 },
    
    // Pantry Items
    { name: 'Black Beans', category: 'Pantry', unit: 'kg', cost: 2.80, min: 10, max: 50 },
    { name: 'Corn Tortillas', category: 'Pantry', unit: 'packs', cost: 2.20, min: 20, max: 100 },
    { name: 'Flour Tortillas', category: 'Pantry', unit: 'packs', cost: 2.50, min: 15, max: 80 },
    { name: 'Rice', category: 'Pantry', unit: 'kg', cost: 1.80, min: 20, max: 100 },
    { name: 'Cooking Oil', category: 'Pantry', unit: 'litres', cost: 4.20, min: 5, max: 30 },
    { name: 'Cumin (Ground)', category: 'Spices', unit: 'kg', cost: 12.50, min: 1, max: 5 },
    { name: 'Paprika', category: 'Spices', unit: 'kg', cost: 8.80, min: 1, max: 5 },
    { name: 'Chili Powder', category: 'Spices', unit: 'kg', cost: 9.20, min: 1, max: 5 },
    
    // Beverages
    { name: 'Corona Beer', category: 'Beverages', unit: 'bottles', cost: 1.80, min: 50, max: 200 },
    { name: 'Modelo Beer', category: 'Beverages', unit: 'bottles', cost: 2.00, min: 30, max: 150 },
    { name: 'Lime Juice', category: 'Beverages', unit: 'litres', cost: 3.50, min: 5, max: 25 },
    { name: 'Pineapple Juice', category: 'Beverages', unit: 'litres', cost: 2.80, min: 5, max: 20 }
  ];
  
  return ingredients.map((item, index) => {
    const turnoverRate = 2 + Math.random() * 8; // Times per week
    const currentStock = Math.floor(item.min + Math.random() * (item.max - item.min));
    
    return {
      itemId: index + 1,
      name: item.name,
      category: item.category,
      currentStock,
      minimumStock: item.min,
      maximumStock: item.max,
      unitCost: item.cost,
      supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
      lastRestocked: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
      turnoverRate: Math.round(turnoverRate * 10) / 10,
      wastage: Math.round(Math.random() * 5 * 10) / 10,
      unit: item.unit
    };
  });
};

// Calculate business metrics
export const calculateBusinessMetrics = (salesHistory: SalesData[]) => {
  const totalRevenue = salesHistory.reduce((sum, day) => sum + day.total, 0);
  const totalTransactions = salesHistory.reduce((sum, day) => sum + day.transactions, 0);
  const avgDailySales = totalRevenue / salesHistory.length;
  const avgTransactionValue = totalRevenue / totalTransactions;
  
  // Calculate growth
  const lastMonth = salesHistory.slice(-30);
  const previousMonth = salesHistory.slice(-60, -30);
  const lastMonthRevenue = lastMonth.reduce((sum, day) => sum + day.total, 0);
  const previousMonthRevenue = previousMonth.reduce((sum, day) => sum + day.total, 0);
  const monthlyGrowth = ((lastMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
  
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalTransactions,
    avgDailySales: Math.round(avgDailySales * 100) / 100,
    avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
    monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
    lastMonthRevenue: Math.round(lastMonthRevenue * 100) / 100,
    previousMonthRevenue: Math.round(previousMonthRevenue * 100) / 100
  };
};