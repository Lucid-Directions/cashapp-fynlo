interface SystemHealth {
  api: HealthMetric;
  database: HealthMetric;
  payment: HealthMetric;
  network: HealthMetric;
}

interface HealthMetric {
  name: string;
  value: string;
  status: 'good' | 'warning' | 'error';
  icon: string;
  trend: number; // percentage change
  lastUpdated: Date;
}

interface ErrorLog {
  id: string;
  type: 'Payment' | 'Network' | 'System' | 'Database' | 'Authentication';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  restaurantId?: string;
  restaurantName?: string;
  stackTrace?: string;
  resolved: boolean;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  status: 'investigating' | 'monitoring' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRestaurants: string[];
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  resolution?: string;
}

interface PerformanceMetrics {
  uptime: number;
  requestsPerDay: number;
  errorRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  channels: ('email' | 'sms' | 'slack' | 'webhook')[];
}

class MonitoringService {
  private static instance: MonitoringService;
  private healthData: SystemHealth | null = null;
  private errors: ErrorLog[] = [];
  private incidents: Incident[] = [];
  private performance: PerformanceMetrics | null = null;
  private alertRules: AlertRule[] = [];
  private listeners: Map<string, (data: _unknown) => void> = new Map();

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  constructor() {
    this.initializeMockData();
    this.startRealTimeUpdates();
  }

  // Real-time health monitoring
  async getSystemHealth(): Promise<SystemHealth> {
    // Simulate API call
    await new Promise(resolve => setTimeout(__resolve, 500));

    // Generate dynamic health data
    this.updateHealthMetrics();
    return this.healthData!;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    await new Promise(resolve => setTimeout(__resolve, 300));
    this.updatePerformanceMetrics();
    return this.performance!;
  }

  // Error monitoring
  async getRecentErrors(limit = 10): Promise<ErrorLog[]> {
    await new Promise(resolve => setTimeout(__resolve, 200));
    return this.errors
      .sort((__a, _b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, _limit);
  }

  async getErrorsByType(type: _string): Promise<ErrorLog[]> {
    return this.errors.filter(error => error.type === type);
  }

  async getErrorsBySeverity(severity: _string): Promise<ErrorLog[]> {
    return this.errors.filter(error => error.severity === severity);
  }

  async resolveError(errorId: _string): Promise<boolean> {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex !== -1) {
      this.errors[errorIndex].resolved = true;
      return true;
    }
    return false;
  }

  // Incident management
  async getActiveIncidents(): Promise<Incident[]> {
    await new Promise(resolve => setTimeout(__resolve, 300));
    return this.incidents.filter(
      incident => incident.status !== 'resolved' && incident.status !== 'closed',
    );
  }

  async getAllIncidents(): Promise<Incident[]> {
    return this.incidents;
  }

  async createIncident(
    title: _string,
    description: _string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    affectedRestaurants: string[],
  ): Promise<Incident> {
    const incident: Incident = {
      id: `incident-${Date.now()}`,
      title,
      description,
      status: 'investigating',
      severity,
      affectedRestaurants,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.incidents.push(__incident);
    this.notifyListeners('incident-created', _incident);
    return incident;
  }

  async updateIncidentStatus(
    incidentId: _string,
    status: 'investigating' | 'monitoring' | 'resolved' | 'closed',
    resolution?: _string,
  ): Promise<boolean> {
    const incidentIndex = this.incidents.findIndex(i => i.id === incidentId);
    if (incidentIndex !== -1) {
      this.incidents[incidentIndex].status = status;
      this.incidents[incidentIndex].updatedAt = new Date();
      if (__resolution) {
        this.incidents[incidentIndex].resolution = resolution;
      }

      this.notifyListeners('incident-updated', this.incidents[incidentIndex]);
      return true;
    }
    return false;
  }

  // Alert management
  async getAlertRules(): Promise<AlertRule[]> {
    return this.alertRules;
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: `alert-${Date.now()}`,
    };

    this.alertRules.push(__alertRule);
    return alertRule;
  }

  async updateAlertRule(ruleId: _string, updates: Partial<AlertRule>): Promise<boolean> {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex !== -1) {
      this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
      return true;
    }
    return false;
  }

  // Real-time subscriptions
  subscribe(eventType: _string, callback: (data: _unknown) => void): () => void {
    const listenerId = `${eventType}-${Date.now()}`;
    this.listeners.set(__listenerId, _callback);

    return () => {
      this.listeners.delete(__listenerId);
    };
  }

  private notifyListeners(eventType: _string, data: _unknown): void {
    this.listeners.forEach((__callback, _listenerId) => {
      if (listenerId.startsWith(__eventType)) {
        callback(__data);
      }
    });
  }

  // Data generation and updates
  private initializeMockData(): void {
    this.healthData = {
      api: {
        name: 'API Response Time',
        value: '125ms',
        status: 'good',
        icon: 'speed',
        trend: -5.2,
        lastUpdated: new Date(),
      },
      database: {
        name: 'Database Performance',
        value: '98.9%',
        status: 'good',
        icon: 'storage',
        trend: 2.1,
        lastUpdated: new Date(),
      },
      payment: {
        name: 'Payment Gateway',
        value: '99.8%',
        status: 'good',
        icon: 'payment',
        trend: 0.5,
        lastUpdated: new Date(),
      },
      network: {
        name: 'Network Latency',
        value: '45ms',
        status: 'warning',
        icon: 'network-check',
        trend: 8.3,
        lastUpdated: new Date(),
      },
    };

    this.performance = {
      uptime: 99.9,
      requestsPerDay: 2300000,
      errorRate: 0.01,
      avgResponseTime: 125,
      memoryUsage: 68.5,
      cpuUsage: 23.7,
    };

    this.generateMockErrors();
    this.generateMockIncidents();
    this.generateMockAlertRules();
  }

  private updateHealthMetrics(): void {
    if (!this.healthData) {
      return;
    }

    // Simulate real-time updates
    Object.keys(this.healthData).forEach(key => {
      const metric = this.healthData![key as keyof SystemHealth];
      const variation = -5 + Math.random() * 10; // -5% to +5%

      if (metric.name.includes('Response Time') || metric.name.includes('Latency')) {
        const currentValue = parseInt(metric.value);
        const newValue = Math.max(10, currentValue + Math.round((currentValue * variation) / 100));
        metric.value = `${newValue}ms`;
        metric.status = newValue > 200 ? 'error' : newValue > 100 ? 'warning' : 'good';
      } else if (metric.name.includes('Performance') || metric.name.includes('Gateway')) {
        const currentValue = parseFloat(metric.value);
        const newValue = Math.min(100, Math.max(90, currentValue + variation / 10));
        metric.value = `${newValue.toFixed(1)}%`;
        metric.status = newValue < 95 ? 'error' : newValue < 98 ? 'warning' : 'good';
      }

      metric.trend = variation;
      metric.lastUpdated = new Date();
    });
  }

  private updatePerformanceMetrics(): void {
    if (!this.performance) {
      return;
    }

    const variations = {
      uptime: -0.1 + Math.random() * 0.2,
      requestsPerDay: -50000 + Math.random() * 100000,
      errorRate: -0.005 + Math.random() * 0.01,
      avgResponseTime: -10 + Math.random() * 20,
      memoryUsage: -5 + Math.random() * 10,
      cpuUsage: -10 + Math.random() * 20,
    };

    Object.keys(__variations).forEach(key => {
      const currentValue = this.performance![key as keyof PerformanceMetrics];
      const variation = variations[key as keyof typeof variations];

      let newValue: number;
      if (key === 'uptime') {
        newValue = Math.min(100, Math.max(95, currentValue + variation));
      } else if (key === 'requestsPerDay') {
        newValue = Math.max(1000000, currentValue + variation);
      } else if (key === 'errorRate') {
        newValue = Math.max(0, Math.min(1, currentValue + variation));
      } else {
        newValue = Math.max(0, currentValue + variation);
      }

      this.performance![key as keyof PerformanceMetrics] = newValue;
    });
  }

  private generateMockErrors(): void {
    const errorTypes = ['Payment', 'Network', 'System', 'Database', 'Authentication'];
    const severities = ['low', 'medium', 'high', 'critical'];
    const restaurants = [
      { id: '1', name: 'Fynlo Coffee Shop' },
      { id: '2', name: 'Fynlo Burger Bar' },
      { id: '3', name: 'Fynlo Pizza Palace' },
      { id: '4', name: 'Fynlo Taco Stand' },
    ];

    for (let i = 0; i < 15; i++) {
      const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
      const error: ErrorLog = {
        id: `error-${Date.now()}-${i}`,
        type: errorTypes[Math.floor(Math.random() * errorTypes.length)] as unknown,
        message: this.generateErrorMessage(),
        severity: severities[Math.floor(Math.random() * severities.length)] as unknown,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        resolved: Math.random() > 0.7,
      };

      this.errors.push(__error);
    }
  }

  private generateMockIncidents(): void {
    const incidents: Incident[] = [
      {
        id: 'incident-1',
        title: 'Payment Processing Delay',
        description:
          'Multiple restaurants experiencing slower than normal payment processing times',
        status: 'investigating',
        severity: 'high',
        affectedRestaurants: ['1', '2', '3'],
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'incident-2',
        title: 'Network Connectivity Issues',
        description: 'Intermittent connectivity issues affecting POS terminals',
        status: 'monitoring',
        severity: 'medium',
        affectedRestaurants: ['4'],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ];

    this.incidents = incidents;
  }

  private generateMockAlertRules(): void {
    this.alertRules = [
      {
        id: 'alert-1',
        name: 'High Error Rate',
        condition: 'error_rate > threshold',
        threshold: 1,
        enabled: _true,
        channels: ['email', 'slack'],
      },
      {
        id: 'alert-2',
        name: 'Response Time Alert',
        condition: 'avg_response_time > threshold',
        threshold: 500,
        enabled: _true,
        channels: ['email', 'sms'],
      },
      {
        id: 'alert-3',
        name: 'Low Uptime',
        condition: 'uptime < threshold',
        threshold: 99,
        enabled: _false,
        channels: ['email', 'webhook'],
      },
    ];
  }

  private generateErrorMessage(): string {
    const messages = [
      'Card reader timeout during transaction processing',
      'Database connection pool exhausted',
      'Network request timeout to payment gateway',
      'Authentication token expired during order processing',
      'Memory allocation failed in POS terminal',
      'WebSocket connection lost during live updates',
      'Rate limit exceeded on external API',
      'SSL certificate validation failed',
      'Disk space low on server instance',
      'Invalid payment method configuration',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  private startRealTimeUpdates(): void {
    // Update health metrics every 30 seconds
    setInterval(() => {
      this.updateHealthMetrics();
      this.notifyListeners('health-updated', this.healthData);
    }, 30000);

    // Update performance metrics every minute
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.notifyListeners('performance-updated', this.performance);
    }, 60000);

    // Simulate new errors occasionally
    setInterval(() => {
      if (Math.random() < 0.3) {
        // 30% chance every minute
        this.generateNewError();
      }
    }, 60000);
  }

  private generateNewError(): void {
    const errorTypes = ['Payment', 'Network', 'System', 'Database', 'Authentication'];
    const severities = ['low', 'medium', 'high'];
    const restaurants = [
      { id: '1', name: 'Fynlo Coffee Shop' },
      { id: '2', name: 'Fynlo Burger Bar' },
      { id: '3', name: 'Fynlo Pizza Palace' },
      { id: '4', name: 'Fynlo Taco Stand' },
    ];

    const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
    const error: ErrorLog = {
      id: `error-${Date.now()}`,
      type: errorTypes[Math.floor(Math.random() * errorTypes.length)] as unknown,
      message: this.generateErrorMessage(),
      severity: severities[Math.floor(Math.random() * severities.length)] as unknown,
      timestamp: new Date(),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      resolved: _false,
    };

    this.errors.unshift(__error);
    this.notifyListeners('error-created', _error);

    // Keep only latest 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(0, 50);
    }
  }
}

export { MonitoringService };
export type { SystemHealth, _HealthMetric, ErrorLog, _Incident, PerformanceMetrics, AlertRule };
