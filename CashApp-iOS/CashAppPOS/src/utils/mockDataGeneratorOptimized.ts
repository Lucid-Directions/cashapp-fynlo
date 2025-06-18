import { MenuItem } from '../types';
import { InteractionManager } from 'react-native';

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

// Cache for generated data to avoid regeneration
const dataCache = new Map<string, any>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Optimized cache management
class DataCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  
  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean up old cache entries
    if (this.cache.size > 50) {
      this.cleanup();
    }
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_DURATION) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.cache.delete(key));
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const cache = new DataCache();

// Optimized sales history generation with chunking and caching
export const generateSalesHistoryOptimized = async (
  startDate: Date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  days: number = 365
): Promise<SalesData[]> => {
  const cacheKey = `sales_${startDate.getTime()}_${days}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Generate data in chunks to prevent blocking
  const chunkSize = 30; // Process 30 days at a time
  const salesHistory: SalesData[] = [];
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Process data in chunks using InteractionManager
  for (let chunkStart = new Date(startDate); chunkStart < endDate; chunkStart.setDate(chunkStart.getDate() + chunkSize)) {
    const chunkEnd = new Date(Math.min(
      chunkStart.getTime() + chunkSize * 24 * 60 * 60 * 1000,
      endDate.getTime()
    ));
    
    // Process chunk asynchronously
    const chunkData = await new Promise<SalesData[]>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        const chunk = generateSalesChunk(chunkStart, chunkEnd);
        resolve(chunk);
      });
    });
    
    salesHistory.push(...chunkData);
  }

  // Cache the result
  cache.set(cacheKey, salesHistory);
  return salesHistory;
};

// Generate a chunk of sales data
const generateSalesChunk = (startDate: Date, endDate: Date): SalesData[] => {
  const chunk: SalesData[] = [];
  
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
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
    
    chunk.push({
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
      hourlyData: generateOptimizedHourlyData(dailyTotal, transactions),
      topItems: generateTopItemsOptimized(dailyTotal),
      employees: generateDailyEmployeeDataOptimized(dailyTotal, transactions)
    });
  }
  
  return chunk;
};

// Optimized hourly data generation
const generateOptimizedHourlyData = (dailyTotal: number, transactions: number) => {
  const hourlyData = [];
  const baseHourlyRevenue = dailyTotal / 13; // 13 operating hours
  const baseHourlyTransactions = transactions / 13;
  
  for (let hour = 10; hour <= 22; hour++) {
    const rushMultiplier = (hour >= 12 && hour <= 14) ? 1.5 : 
                          (hour >= 18 && hour <= 20) ? 1.8 : 1.0;
    
    hourlyData.push({
      hour,
      sales: Math.round(baseHourlyRevenue * rushMultiplier * (0.8 + Math.random() * 0.4)),
      transactions: Math.floor(baseHourlyTransactions * rushMultiplier * (0.8 + Math.random() * 0.4))
    });
  }
  
  return hourlyData;
};

const menuItems = [
  'Nachos', 'Quesadillas', 'Chorizo Quesadilla', 'Chicken Quesadilla', 'Tostada',
  'Carnitas', 'Cochinita', 'Barbacoa de Res', 'Chorizo', 'Rellena',
  'Chicken Fajita', 'Haggis', 'Pescado', 'Dorados', 'Dorados Papa',
  'Carne Asada', 'Camaron', 'Pulpos', 'Regular Burrito', 'Special Burrito'
];

// Optimized top items generation
const generateTopItemsOptimized = (dailyTotal: number) => {
  const numberOfItems = Math.min(7, 5 + Math.floor(Math.random() * 3)); // Limit items
  const items = [];
  let remainingTotal = dailyTotal * 0.8;
  
  for (let i = 0; i < numberOfItems; i++) {
    const itemRevenue = i === numberOfItems - 1 ? remainingTotal : 
                       remainingTotal * (0.2 + Math.random() * 0.15);
    const itemPrice = 3.50 + Math.random() * 6.50;
    const quantity = Math.floor(itemRevenue / itemPrice);
    
    items.push({
      itemId: i + 1,
      name: menuItems[Math.floor(Math.random() * menuItems.length)],
      quantity,
      revenue: Math.round(itemRevenue * 100) / 100
    });
    
    remainingTotal -= itemRevenue;
  }
  
  return items;
};

const employeeNames = [
  'Maria González', 'James Chen', 'Aisha Patel', 'Carlos Rodriguez',
  'Emily Johnson', 'David Kim', 'Sarah Williams', 'Michael Brown'
];

// Optimized employee data generation
const generateDailyEmployeeDataOptimized = (dailyTotal: number, transactions: number) => {
  const numberOfEmployees = Math.min(5, 3 + Math.floor(Math.random() * 3)); // Limit employees
  const employees = [];
  let remainingSales = dailyTotal;
  let remainingTransactions = transactions;
  
  for (let i = 0; i < numberOfEmployees; i++) {
    const employeeSales = i === numberOfEmployees - 1 ? remainingSales : 
                         remainingSales * (0.15 + Math.random() * 0.25);
    const employeeTransactions = i === numberOfEmployees - 1 ? remainingTransactions :
                                Math.floor(remainingTransactions * (0.15 + Math.random() * 0.25));
    
    employees.push({
      id: i + 1,
      name: employeeNames[i % employeeNames.length],
      sales: Math.round(employeeSales * 100) / 100,
      transactions: employeeTransactions,
      hours: 6 + Math.random() * 3 // 6-9 hours
    });
    
    remainingSales -= employeeSales;
    remainingTransactions -= employeeTransactions;
  }
  
  return employees;
};

// Lightweight data generation for quick access
export const generateQuickSummaryData = (days: number = 30) => {
  const cacheKey = `summary_${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  const today = new Date();
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  
  let totalRevenue = 0;
  let totalTransactions = 0;
  let totalCustomers = 0;
  
  // Quick calculation without detailed hourly data
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseMultiplier = isWeekend ? 1.3 : 1.0;
    
    const dailyRevenue = (800 + Math.random() * 1200) * baseMultiplier;
    const dailyTransactions = Math.floor(30 + Math.random() * 50 * baseMultiplier);
    const dailyCustomers = Math.floor(dailyTransactions * 0.8); // Some customers make multiple orders
    
    totalRevenue += dailyRevenue;
    totalTransactions += dailyTransactions;
    totalCustomers += dailyCustomers;
  }
  
  const summary = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalTransactions,
    totalCustomers,
    averageOrderValue: Math.round((totalRevenue / totalTransactions) * 100) / 100,
    averageDaily: Math.round((totalRevenue / days) * 100) / 100,
  };
  
  cache.set(cacheKey, summary);
  return summary;
};

// Paginated data generation for large lists
export const generatePaginatedSalesData = async (
  page: number = 1,
  pageSize: number = 30,
  startDate?: Date
): Promise<{ data: SalesData[]; hasMore: boolean; total: number }> => {
  const defaultStartDate = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const skip = (page - 1) * pageSize;
  
  // Generate only the requested page
  const pageStartDate = new Date(defaultStartDate.getTime() + skip * 24 * 60 * 60 * 1000);
  const pageEndDate = new Date(pageStartDate.getTime() + pageSize * 24 * 60 * 60 * 1000);
  
  const data = await new Promise<SalesData[]>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      const pageData = generateSalesChunk(pageStartDate, pageEndDate);
      resolve(pageData);
    });
  });
  
  return {
    data,
    hasMore: page * pageSize < 365, // Assuming max 365 days
    total: 365,
  };
};

// Clear cache function for memory management
export const clearDataCache = () => {
  cache.clear();
};

// Memory usage estimation
export const getMemoryUsageEstimate = () => {
  const entries = cache['cache'].size;
  const estimatedSize = entries * 50; // Rough estimate: 50KB per cache entry
  return {
    cacheEntries: entries,
    estimatedMemoryMB: (estimatedSize / 1024).toFixed(2),
  };
};

// Legacy compatibility - wrapper for original function with optimization
export const generateSalesHistory = (
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
): SalesData[] => {
  console.warn('generateSalesHistory: Consider using generateSalesHistoryOptimized for better performance');
  
  // Return cached quick data or generate small dataset
  const quickData = generateQuickSummaryData(30);
  
  // Convert to expected format with minimal data
  const data: SalesData[] = [];
  const endDate = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    if (date > endDate) break;
    
    const dayMultiplier = 0.9 + Math.random() * 0.2;
    data.push({
      date,
      total: quickData.averageDaily * dayMultiplier,
      transactions: Math.floor(quickData.totalTransactions / 30 * dayMultiplier),
      items: Math.floor(quickData.totalTransactions / 30 * dayMultiplier * 2.5),
      averageTransaction: quickData.averageOrderValue,
      paymentMethods: {
        card: quickData.averageDaily * dayMultiplier * 0.65,
        cash: quickData.averageDaily * dayMultiplier * 0.20,
        mobile: quickData.averageDaily * dayMultiplier * 0.12,
        giftCard: quickData.averageDaily * dayMultiplier * 0.03,
      },
      hourlyData: [],
      topItems: [],
      employees: []
    });
  }
  
  return data;
};

export default {
  generateSalesHistoryOptimized,
  generateQuickSummaryData,
  generatePaginatedSalesData,
  clearDataCache,
  getMemoryUsageEstimate,
  generateSalesHistory, // Legacy support
};