/**
 * Offline Queue Configuration Management
 * 
 * CRITICAL: Production-ready configuration for SecureOfflineQueueService
 * Provides environment-specific settings for security, performance, and monitoring
 * 
 * Features:
 * - Environment detection (production/staging/development)
 * - Dynamic configuration based on environment
 * - Security settings with encryption rotation
 * - Performance tuning per environment
 * - Monitoring and alerting configuration
 * - Rate limiting and throttling
 */

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Environment types
export enum Environment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development',
  TEST = 'test',
}

// Configuration types
export interface OfflineQueueConfig {
  // Core settings
  environment: Environment;
  maxQueueSize: number;
  maxMemoryItems: number;
  maxRetries: number;
  retryBaseDelay: number;
  retryMaxDelay: number;
  batchSize: number;
  syncInterval: number;
  cleanupInterval: number;
  
  // Security settings
  enableEncryption: boolean;
  enableCompression: boolean;
  enableAuditLog: boolean;
  encryptionKeyRotationDays: number;
  maxPayloadSize: number;
  maxStringLength: number;
  maxEndpointLength: number;
  maxQueueAgeDays: number;
  
  // Performance settings
  enableBatching: boolean;
  enablePrioritization: boolean;
  enableSmartEviction: boolean;
  evictionThreshold: number;
  evictionPercentage: number;
  memoryWarningThreshold: number;
  
  // Rate limiting
  rateLimitEnabled: boolean;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstLimit: number;
  throttleDelay: number;
  
  // Monitoring
  enableMetrics: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  metricsInterval: number;
  alertThresholds: {
    queueSize: number;
    failureRate: number;
    syncDelay: number;
    memoryUsage: number;
  };
  
  // Network settings
  connectionTimeout: number;
  requestTimeout: number;
  enableAutoSync: boolean;
  enableOfflineMode: boolean;
  wifiOnlySync: boolean;
  
  // Feature flags
  features: {
    enableConflictResolution: boolean;
    enableDependencyTracking: boolean;
    enableIdempotency: boolean;
    enableChecksum: boolean;
    enableDataMigration: boolean;
    enableBackgroundSync: boolean;
    enablePushNotifications: boolean;
  };
}

// Environment detection
class EnvironmentDetector {
  private static instance: EnvironmentDetector;
  private environment: Environment;
  private readonly bundleId: string;
  private readonly isDebugMode: boolean;

  private constructor() {
    this.bundleId = DeviceInfo.getBundleId();
    this.isDebugMode = __DEV__;
    this.environment = this.detectEnvironment();
  }

  public static getInstance(): EnvironmentDetector {
    if (!EnvironmentDetector.instance) {
      EnvironmentDetector.instance = new EnvironmentDetector();
    }
    return EnvironmentDetector.instance;
  }

  private detectEnvironment(): Environment {
    // Check for explicit environment variable
    if (process.env.REACT_APP_ENV) {
      return process.env.REACT_APP_ENV as Environment;
    }

    // Check bundle ID patterns
    if (this.bundleId.includes('.dev') || this.bundleId.includes('.debug')) {
      return Environment.DEVELOPMENT;
    }
    
    if (this.bundleId.includes('.staging') || this.bundleId.includes('.beta')) {
      return Environment.STAGING;
    }
    
    if (this.bundleId.includes('.test')) {
      return Environment.TEST;
    }

    // Check debug mode
    if (this.isDebugMode) {
      return Environment.DEVELOPMENT;
    }

    // Check API endpoint
    const apiUrl = process.env.REACT_APP_API_URL || '';
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      return Environment.DEVELOPMENT;
    }
    if (apiUrl.includes('staging') || apiUrl.includes('dev')) {
      return Environment.STAGING;
    }

    // Default to production
    return Environment.PRODUCTION;
  }

  public getEnvironment(): Environment {
    return this.environment;
  }

  public isDevelopment(): boolean {
    return this.environment === Environment.DEVELOPMENT;
  }

  public isStaging(): boolean {
    return this.environment === Environment.STAGING;
  }

  public isProduction(): boolean {
    return this.environment === Environment.PRODUCTION;
  }

  public isTest(): boolean {
    return this.environment === Environment.TEST;
  }
}

// Configuration factory
class OfflineConfigFactory {
  private static readonly configs: Record<Environment, OfflineQueueConfig> = {
    // PRODUCTION Configuration - Optimized for reliability and security
    [Environment.PRODUCTION]: {
      environment: Environment.PRODUCTION,
      
      // Core settings - Conservative for stability
      maxQueueSize: 1000,
      maxMemoryItems: 50,
      maxRetries: 5,
      retryBaseDelay: 2000,
      retryMaxDelay: 120000,
      batchSize: 5,
      syncInterval: 60000, // 1 minute
      cleanupInterval: 3600000, // 1 hour
      
      // Security - Maximum protection
      enableEncryption: true,
      enableCompression: true,
      enableAuditLog: true,
      encryptionKeyRotationDays: 30,
      maxPayloadSize: 512 * 1024, // 512KB
      maxStringLength: 5000,
      maxEndpointLength: 256,
      maxQueueAgeDays: 3,
      
      // Performance - Balanced
      enableBatching: true,
      enablePrioritization: true,
      enableSmartEviction: true,
      evictionThreshold: 0.9,
      evictionPercentage: 0.2,
      memoryWarningThreshold: 0.8,
      
      // Rate limiting - Strict
      rateLimitEnabled: true,
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 2000,
      burstLimit: 10,
      throttleDelay: 1000,
      
      // Monitoring - Full
      enableMetrics: true,
      enableErrorReporting: true,
      enablePerformanceMonitoring: true,
      metricsInterval: 300000, // 5 minutes
      alertThresholds: {
        queueSize: 800,
        failureRate: 0.1,
        syncDelay: 300000,
        memoryUsage: 0.85,
      },
      
      // Network - Conservative
      connectionTimeout: 10000,
      requestTimeout: 30000,
      enableAutoSync: true,
      enableOfflineMode: true,
      wifiOnlySync: false,
      
      // Features - Full
      features: {
        enableConflictResolution: true,
        enableDependencyTracking: true,
        enableIdempotency: true,
        enableChecksum: true,
        enableDataMigration: true,
        enableBackgroundSync: true,
        enablePushNotifications: true,
      },
    },
    
    // STAGING Configuration - Production-like with more logging
    [Environment.STAGING]: {
      environment: Environment.STAGING,
      
      // Core settings - Similar to production
      maxQueueSize: 800,
      maxMemoryItems: 75,
      maxRetries: 4,
      retryBaseDelay: 1500,
      retryMaxDelay: 90000,
      batchSize: 8,
      syncInterval: 45000,
      cleanupInterval: 1800000, // 30 minutes
      
      // Security - Strong but with debugging
      enableEncryption: true,
      enableCompression: true,
      enableAuditLog: true,
      encryptionKeyRotationDays: 60,
      maxPayloadSize: 1024 * 1024, // 1MB
      maxStringLength: 8000,
      maxEndpointLength: 400,
      maxQueueAgeDays: 5,
      
      // Performance - More aggressive
      enableBatching: true,
      enablePrioritization: true,
      enableSmartEviction: true,
      evictionThreshold: 0.85,
      evictionPercentage: 0.25,
      memoryWarningThreshold: 0.75,
      
      // Rate limiting - Moderate
      rateLimitEnabled: true,
      maxRequestsPerMinute: 120,
      maxRequestsPerHour: 4000,
      burstLimit: 20,
      throttleDelay: 500,
      
      // Monitoring - Verbose
      enableMetrics: true,
      enableErrorReporting: true,
      enablePerformanceMonitoring: true,
      metricsInterval: 120000, // 2 minutes
      alertThresholds: {
        queueSize: 600,
        failureRate: 0.15,
        syncDelay: 180000,
        memoryUsage: 0.8,
      },
      
      // Network - Flexible
      connectionTimeout: 15000,
      requestTimeout: 45000,
      enableAutoSync: true,
      enableOfflineMode: true,
      wifiOnlySync: false,
      
      // Features - Full
      features: {
        enableConflictResolution: true,
        enableDependencyTracking: true,
        enableIdempotency: true,
        enableChecksum: true,
        enableDataMigration: true,
        enableBackgroundSync: true,
        enablePushNotifications: true,
      },
    },
    
    // DEVELOPMENT Configuration - Maximum flexibility
    [Environment.DEVELOPMENT]: {
      environment: Environment.DEVELOPMENT,
      
      // Core settings - Aggressive for testing
      maxQueueSize: 500,
      maxMemoryItems: 100,
      maxRetries: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      batchSize: 10,
      syncInterval: 15000, // 15 seconds
      cleanupInterval: 600000, // 10 minutes
      
      // Security - Relaxed for debugging
      enableEncryption: false,
      enableCompression: false,
      enableAuditLog: true,
      encryptionKeyRotationDays: 90,
      maxPayloadSize: 2048 * 1024, // 2MB
      maxStringLength: 10000,
      maxEndpointLength: 500,
      maxQueueAgeDays: 7,
      
      // Performance - Aggressive
      enableBatching: true,
      enablePrioritization: true,
      enableSmartEviction: true,
      evictionThreshold: 0.8,
      evictionPercentage: 0.3,
      memoryWarningThreshold: 0.7,
      
      // Rate limiting - Disabled
      rateLimitEnabled: false,
      maxRequestsPerMinute: 999,
      maxRequestsPerHour: 99999,
      burstLimit: 100,
      throttleDelay: 0,
      
      // Monitoring - Debug level
      enableMetrics: true,
      enableErrorReporting: true,
      enablePerformanceMonitoring: true,
      metricsInterval: 30000, // 30 seconds
      alertThresholds: {
        queueSize: 400,
        failureRate: 0.25,
        syncDelay: 60000,
        memoryUsage: 0.7,
      },
      
      // Network - Fast
      connectionTimeout: 30000,
      requestTimeout: 60000,
      enableAutoSync: true,
      enableOfflineMode: true,
      wifiOnlySync: false,
      
      // Features - Experimental
      features: {
        enableConflictResolution: true,
        enableDependencyTracking: true,
        enableIdempotency: true,
        enableChecksum: true,
        enableDataMigration: true,
        enableBackgroundSync: false,
        enablePushNotifications: false,
      },
    },
    
    // TEST Configuration - For automated testing
    [Environment.TEST]: {
      environment: Environment.TEST,
      
      // Core settings - Minimal for speed
      maxQueueSize: 100,
      maxMemoryItems: 50,
      maxRetries: 1,
      retryBaseDelay: 100,
      retryMaxDelay: 1000,
      batchSize: 20,
      syncInterval: 1000,
      cleanupInterval: 60000,
      
      // Security - Disabled for speed
      enableEncryption: false,
      enableCompression: false,
      enableAuditLog: false,
      encryptionKeyRotationDays: 999,
      maxPayloadSize: 4096 * 1024, // 4MB
      maxStringLength: 50000,
      maxEndpointLength: 1000,
      maxQueueAgeDays: 30,
      
      // Performance - Maximum
      enableBatching: false,
      enablePrioritization: false,
      enableSmartEviction: false,
      evictionThreshold: 0.95,
      evictionPercentage: 0.5,
      memoryWarningThreshold: 0.9,
      
      // Rate limiting - Disabled
      rateLimitEnabled: false,
      maxRequestsPerMinute: 9999,
      maxRequestsPerHour: 999999,
      burstLimit: 1000,
      throttleDelay: 0,
      
      // Monitoring - Minimal
      enableMetrics: false,
      enableErrorReporting: false,
      enablePerformanceMonitoring: false,
      metricsInterval: 999999,
      alertThresholds: {
        queueSize: 90,
        failureRate: 0.5,
        syncDelay: 10000,
        memoryUsage: 0.95,
      },
      
      // Network - Instant
      connectionTimeout: 100,
      requestTimeout: 1000,
      enableAutoSync: false,
      enableOfflineMode: true,
      wifiOnlySync: false,
      
      // Features - Minimal
      features: {
        enableConflictResolution: false,
        enableDependencyTracking: false,
        enableIdempotency: false,
        enableChecksum: false,
        enableDataMigration: false,
        enableBackgroundSync: false,
        enablePushNotifications: false,
      },
    },
  };

  public static getConfig(environment?: Environment): OfflineQueueConfig {
    const env = environment || EnvironmentDetector.getInstance().getEnvironment();
    const config = this.configs[env];
    
    if (!config) {
      console.warn(`No configuration found for environment: ${env}, defaulting to production`);
      return this.configs[Environment.PRODUCTION];
    }
    
    // Apply platform-specific overrides
    return this.applyPlatformOverrides(config);
  }

  private static applyPlatformOverrides(config: OfflineQueueConfig): OfflineQueueConfig {
    const overridden = { ...config };
    
    if (Platform.OS === 'ios') {
      // iOS specific adjustments
      overridden.maxMemoryItems = Math.min(config.maxMemoryItems, 75);
      overridden.batchSize = Math.min(config.batchSize, 8);
    } else if (Platform.OS === 'android') {
      // Android specific adjustments
      overridden.maxMemoryItems = Math.min(config.maxMemoryItems, 50);
      overridden.cleanupInterval = Math.max(config.cleanupInterval, 1800000);
    }
    
    // Low-end device detection
    const totalMemory = DeviceInfo.getTotalMemorySync();
    if (totalMemory < 2 * 1024 * 1024 * 1024) { // Less than 2GB
      overridden.maxQueueSize = Math.min(config.maxQueueSize, 300);
      overridden.maxMemoryItems = Math.min(config.maxMemoryItems, 30);
      overridden.enableCompression = true;
    }
    
    return overridden;
  }
}

// Dynamic configuration manager
export class OfflineConfigManager {
  private static instance: OfflineConfigManager;
  private config: OfflineQueueConfig;
  private readonly detector: EnvironmentDetector;
  private configOverrides: Partial<OfflineQueueConfig> = {};
  private listeners: Set<(config: OfflineQueueConfig) => void> = new Set();

  private constructor() {
    this.detector = EnvironmentDetector.getInstance();
    this.config = OfflineConfigFactory.getConfig();
    this.loadPersistedOverrides();
    this.startConfigRefresh();
  }

  public static getInstance(): OfflineConfigManager {
    if (!OfflineConfigManager.instance) {
      OfflineConfigManager.instance = new OfflineConfigManager();
    }
    return OfflineConfigManager.instance;
  }

  public getConfig(): OfflineQueueConfig {
    return { ...this.config, ...this.configOverrides };
  }

  public updateConfig(overrides: Partial<OfflineQueueConfig>): void {
    this.configOverrides = { ...this.configOverrides, ...overrides };
    this.persistOverrides();
    this.notifyListeners();
  }

  public resetConfig(): void {
    this.configOverrides = {};
    this.config = OfflineConfigFactory.getConfig();
    this.persistOverrides();
    this.notifyListeners();
  }

  public subscribe(listener: (config: OfflineQueueConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const currentConfig = this.getConfig();
    this.listeners.forEach(listener => listener(currentConfig));
  }

  private async loadPersistedOverrides(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const stored = await AsyncStorage.getItem('offline_config_overrides');
      if (stored) {
        this.configOverrides = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load config overrides:', error);
    }
  }

  private async persistOverrides(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('offline_config_overrides', JSON.stringify(this.configOverrides));
    } catch (error) {
      console.error('Failed to persist config overrides:', error);
    }
  }

  private startConfigRefresh(): void {
    // Refresh configuration periodically in development
    if (this.detector.isDevelopment()) {
      setInterval(() => {
        this.config = OfflineConfigFactory.getConfig();
        this.notifyListeners();
      }, 60000); // Every minute
    }
  }

  // Utility methods for common operations
  public shouldEncrypt(entityType: string): boolean {
    const config = this.getConfig();
    if (!config.enableEncryption) return false;
    
    const sensitiveEntities = ['payment', 'customer', 'employee', 'user'];
    return sensitiveEntities.includes(entityType.toLowerCase());
  }

  public getRetryDelay(retryCount: number): number {
    const config = this.getConfig();
    const exponentialDelay = Math.min(
      config.retryBaseDelay * Math.pow(2, retryCount),
      config.retryMaxDelay
    );
    
    // Add jitter (±30%)
    const jitter = 0.3;
    const minDelay = exponentialDelay * (1 - jitter);
    const maxDelay = exponentialDelay * (1 + jitter);
    
    return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
  }

  public shouldEvict(queueSize: number): boolean {
    const config = this.getConfig();
    return queueSize >= config.maxQueueSize * config.evictionThreshold;
  }

  public getEvictionCount(queueSize: number): number {
    const config = this.getConfig();
    return Math.ceil(queueSize * config.evictionPercentage);
  }

  public isRateLimited(requestCount: number, timeWindow: 'minute' | 'hour'): boolean {
    const config = this.getConfig();
    if (!config.rateLimitEnabled) return false;
    
    if (timeWindow === 'minute') {
      return requestCount >= config.maxRequestsPerMinute;
    } else {
      return requestCount >= config.maxRequestsPerHour;
    }
  }

  public getEnvironmentName(): string {
    return this.detector.getEnvironment();
  }

  public isProductionEnvironment(): boolean {
    return this.detector.isProduction();
  }

  public isDevelopmentEnvironment(): boolean {
    return this.detector.isDevelopment();
  }
}

// Export singleton instance and utilities
export const offlineConfig = OfflineConfigManager.getInstance();
export const getOfflineConfig = () => offlineConfig.getConfig();
export const updateOfflineConfig = (overrides: Partial<OfflineQueueConfig>) => offlineConfig.updateConfig(overrides);
export const resetOfflineConfig = () => offlineConfig.resetConfig();

// Export for monitoring and debugging
export const getConfigMetrics = () => {
  const config = offlineConfig.getConfig();
  return {
    environment: config.environment,
    maxQueueSize: config.maxQueueSize,
    encryptionEnabled: config.enableEncryption,
    rateLimitEnabled: config.rateLimitEnabled,
    features: config.features,
  };
};

export default offlineConfig;
