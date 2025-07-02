/**
 * InventoryAuditService - Comprehensive audit trail and compliance tracking
 * Provides detailed logging, compliance reporting, and audit trail functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem, StockMovement, Recipe, Order } from '../types';
import * as InventoryApiService from './InventoryApiService';

export interface AuditEvent {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  entityType: 'inventory' | 'recipe' | 'order' | 'user' | 'system';
  entityId: string;
  userId: string;
  deviceId: string;
  action: string;
  previousValue?: any;
  newValue?: any;
  metadata: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
  sessionId: string;
}

export type AuditEventType = 
  | 'STOCK_ADJUSTMENT' 
  | 'STOCK_RESTOCK' 
  | 'STOCK_DEDUCTION' 
  | 'STOCK_WASTE'
  | 'RECIPE_CREATED' 
  | 'RECIPE_UPDATED' 
  | 'RECIPE_DELETED'
  | 'ORDER_COMPLETED'
  | 'COST_UPDATED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SYSTEM_SYNC'
  | 'DATA_EXPORT'
  | 'COMPLIANCE_CHECK';

export interface AuditMetadata {
  reason?: string;
  orderId?: number;
  batchId?: string;
  automaticAction?: boolean;
  complianceFlags?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  financialImpact?: number;
  supplierInfo?: {
    supplierId: string;
    supplierName: string;
    poNumber?: string;
  };
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  entityTypes?: string[];
  userIds?: string[];
  riskLevels?: string[];
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: { [key in AuditEventType]?: number };
  userActivity: { userId: string; eventCount: number; lastActivity: number }[];
  riskDistribution: { [key: string]: number };
  financialImpact: {
    totalValue: number;
    positiveAdjustments: number;
    negativeAdjustments: number;
    wasteValue: number;
  };
  complianceIssues: {
    flaggedEvents: number;
    criticalAlerts: number;
    pendingReview: number;
  };
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: number;
  reportPeriod: {
    startDate: number;
    endDate: number;
  };
  stockMovements: {
    totalMovements: number;
    inboundValue: number;
    outboundValue: number;
    adjustmentValue: number;
    wasteValue: number;
  };
  userActivity: {
    activeUsers: number;
    stockAdjustments: number;
    suspiciousActivity: AuditEvent[];
  };
  complianceMetrics: {
    dataIntegrity: number; // Percentage
    auditCoverage: number; // Percentage
    riskScore: number; // 0-100
  };
  recommendations: string[];
}

class InventoryAuditService {
  private sessionId: string = '';
  private deviceId: string = '';
  private userId: string = '';
  private pendingEvents: AuditEvent[] = [];
  private batchSize: number = 50;

  constructor() {
    this.initializeSession();
  }

  private async initializeSession() {
    try {
      this.sessionId = this.generateSessionId();
      this.deviceId = await this.getDeviceId();
      this.userId = await this.getCurrentUserId();
    } catch (error) {
      console.error('Failed to initialize audit session:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      return `device_fallback_${Date.now()}`;
    }
  }

  private async getCurrentUserId(): Promise<string> {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        return user.id || user.userId || 'unknown';
      }
    } catch (error) {
      console.error('Failed to get user ID:', error);
    }
    return 'unknown';
  }

  /**
   * Log stock movement event with full audit trail
   */
  async logStockMovement(
    item: InventoryItem,
    previousQuantity: number,
    newQuantity: number,
    movementType: 'RESTOCK' | 'DEDUCTION' | 'ADJUSTMENT' | 'WASTE',
    metadata: Partial<AuditMetadata> = {}
  ): Promise<void> {
    const quantityChange = newQuantity - previousQuantity;
    const financialImpact = Math.abs(quantityChange) * (item.cost_per_unit || 0) / 1000;

    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: `STOCK_${movementType}` as AuditEventType,
      entityType: 'inventory',
      entityId: item.sku,
      userId: this.userId,
      deviceId: this.deviceId,
      action: `Stock ${movementType.toLowerCase()}: ${item.name}`,
      previousValue: {
        quantity: previousQuantity,
        value: previousQuantity * (item.cost_per_unit || 0) / 1000
      },
      newValue: {
        quantity: newQuantity,
        value: newQuantity * (item.cost_per_unit || 0) / 1000
      },
      metadata: {
        ...metadata,
        financialImpact,
        riskLevel: this.calculateRiskLevel(movementType, quantityChange, financialImpact),
        automaticAction: metadata.automaticAction || false,
      },
      sessionId: this.sessionId,
    };

    await this.recordEvent(auditEvent);
  }

  /**
   * Log recipe changes
   */
  async logRecipeChange(
    recipeId: string,
    action: 'CREATED' | 'UPDATED' | 'DELETED',
    previousRecipe?: Recipe,
    newRecipe?: Recipe,
    metadata: Partial<AuditMetadata> = {}
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: `RECIPE_${action}` as AuditEventType,
      entityType: 'recipe',
      entityId: recipeId,
      userId: this.userId,
      deviceId: this.deviceId,
      action: `Recipe ${action.toLowerCase()}: ${newRecipe?.item_name || previousRecipe?.item_name || 'Unknown'}`,
      previousValue: previousRecipe,
      newValue: newRecipe,
      metadata: {
        ...metadata,
        riskLevel: action === 'DELETED' ? 'medium' : 'low',
      },
      sessionId: this.sessionId,
    };

    await this.recordEvent(auditEvent);
  }

  /**
   * Log order completion and inventory deductions
   */
  async logOrderCompletion(
    order: Order,
    inventoryDeductions: { sku: string; quantity: number; cost: number }[],
    metadata: Partial<AuditMetadata> = {}
  ): Promise<void> {
    const totalCost = inventoryDeductions.reduce((sum, deduction) => sum + deduction.cost, 0);

    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: 'ORDER_COMPLETED',
      entityType: 'order',
      entityId: order.id?.toString() || 'unknown',
      userId: this.userId,
      deviceId: this.deviceId,
      action: `Order completed: ${order.items.length} items`,
      previousValue: null,
      newValue: {
        orderId: order.id,
        itemCount: order.items.length,
        totalValue: order.total,
        inventoryDeductions,
        totalCOGS: totalCost,
      },
      metadata: {
        ...metadata,
        orderId: order.id,
        financialImpact: totalCost,
        riskLevel: 'low',
        automaticAction: true,
      },
      sessionId: this.sessionId,
    };

    await this.recordEvent(auditEvent);
  }

  /**
   * Log user authentication events
   */
  async logUserActivity(
    action: 'LOGIN' | 'LOGOUT',
    metadata: Partial<AuditMetadata> = {}
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: `USER_${action}` as AuditEventType,
      entityType: 'user',
      entityId: this.userId,
      userId: this.userId,
      deviceId: this.deviceId,
      action: `User ${action.toLowerCase()}`,
      metadata: {
        ...metadata,
        riskLevel: 'low',
      },
      sessionId: this.sessionId,
    };

    await this.recordEvent(auditEvent);
  }

  /**
   * Query audit events with filtering
   */
  async queryAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      // In production, this would call the backend API
      const events = await this.getStoredEvents();
      
      return this.filterEvents(events, query);
    } catch (error) {
      console.error('Failed to query audit events:', error);
      return [];
    }
  }

  /**
   * Generate audit summary for reporting
   */
  async generateAuditSummary(
    startDate: Date,
    endDate: Date
  ): Promise<AuditSummary> {
    const events = await this.queryAuditEvents({
      startDate,
      endDate,
    });

    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as { [key in AuditEventType]?: number });

    const userActivity = this.calculateUserActivity(events);
    const riskDistribution = this.calculateRiskDistribution(events);
    const financialImpact = this.calculateFinancialImpact(events);
    const complianceIssues = this.calculateComplianceIssues(events);

    return {
      totalEvents: events.length,
      eventsByType,
      userActivity,
      riskDistribution,
      financialImpact,
      complianceIssues,
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const events = await this.queryAuditEvents({
      startDate,
      endDate,
    });

    const stockMovements = this.analyzeStockMovements(events);
    const userActivity = this.analyzeUserActivity(events);
    const complianceMetrics = this.calculateComplianceMetrics(events);
    const recommendations = this.generateRecommendations(events);

    return {
      reportId: this.generateEventId(),
      generatedAt: Date.now(),
      reportPeriod: {
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
      },
      stockMovements,
      userActivity,
      complianceMetrics,
      recommendations,
    };
  }

  /**
   * Export audit data for external compliance systems
   */
  async exportAuditData(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const events = await this.queryAuditEvents(query);
    
    // Log the export event
    await this.recordEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: 'DATA_EXPORT',
      entityType: 'system',
      entityId: 'audit_export',
      userId: this.userId,
      deviceId: this.deviceId,
      action: `Audit data export: ${events.length} events`,
      metadata: {
        format,
        eventCount: events.length,
        riskLevel: 'medium',
      },
      sessionId: this.sessionId,
    });

    if (format === 'csv') {
      return this.convertToCSV(events);
    }

    return JSON.stringify(events, null, 2);
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRiskLevel(
    movementType: string,
    quantityChange: number,
    financialImpact: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (movementType === 'WASTE' && financialImpact > 100) return 'high';
    if (Math.abs(quantityChange) > 10000) return 'medium'; // Large quantity changes
    if (financialImpact > 500) return 'medium';
    return 'low';
  }

  private async recordEvent(event: AuditEvent): Promise<void> {
    try {
      // Add to pending events for batch processing
      this.pendingEvents.push(event);

      // Store locally for offline capability
      await this.storeEventLocally(event);

      // Send to server in batches
      if (this.pendingEvents.length >= this.batchSize) {
        await this.flushPendingEvents();
      }
    } catch (error) {
      console.error('Failed to record audit event:', error);
    }
  }

  private async storeEventLocally(event: AuditEvent): Promise<void> {
    try {
      const existingEvents = await AsyncStorage.getItem('audit_events');
      const events = existingEvents ? JSON.parse(existingEvents) : [];
      
      events.push(event);
      
      // Keep only last 1000 events locally
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }
      
      await AsyncStorage.setItem('audit_events', JSON.stringify(events));
    } catch (error) {
      console.error('Failed to store audit event locally:', error);
    }
  }

  private async getStoredEvents(): Promise<AuditEvent[]> {
    try {
      const storedEvents = await AsyncStorage.getItem('audit_events');
      return storedEvents ? JSON.parse(storedEvents) : [];
    } catch (error) {
      console.error('Failed to get stored events:', error);
      return [];
    }
  }

  private async flushPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    try {
      // In production, send to backend API
      await InventoryApiService.submitAuditEvents(this.pendingEvents);
      
      this.pendingEvents = [];
    } catch (error) {
      console.error('Failed to flush audit events:', error);
      // Events remain in pending queue for retry
    }
  }

  private filterEvents(events: AuditEvent[], query: AuditQuery): AuditEvent[] {
    return events.filter(event => {
      if (query.startDate && event.timestamp < query.startDate.getTime()) return false;
      if (query.endDate && event.timestamp > query.endDate.getTime()) return false;
      if (query.eventTypes && !query.eventTypes.includes(event.eventType)) return false;
      if (query.entityTypes && !query.entityTypes.includes(event.entityType)) return false;
      if (query.userIds && !query.userIds.includes(event.userId)) return false;
      if (query.riskLevels && !query.riskLevels.includes(event.metadata.riskLevel || 'low')) return false;
      
      return true;
    }).slice(query.offset || 0, (query.offset || 0) + (query.limit || 100));
  }

  private calculateUserActivity(events: AuditEvent[]): { userId: string; eventCount: number; lastActivity: number }[] {
    const userMap = new Map<string, { eventCount: number; lastActivity: number }>();

    events.forEach(event => {
      const existing = userMap.get(event.userId) || { eventCount: 0, lastActivity: 0 };
      userMap.set(event.userId, {
        eventCount: existing.eventCount + 1,
        lastActivity: Math.max(existing.lastActivity, event.timestamp),
      });
    });

    return Array.from(userMap.entries()).map(([userId, stats]) => ({
      userId,
      ...stats,
    }));
  }

  private calculateRiskDistribution(events: AuditEvent[]): { [key: string]: number } {
    return events.reduce((acc, event) => {
      const riskLevel = event.metadata.riskLevel || 'low';
      acc[riskLevel] = (acc[riskLevel] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private calculateFinancialImpact(events: AuditEvent[]): AuditSummary['financialImpact'] {
    const result = {
      totalValue: 0,
      positiveAdjustments: 0,
      negativeAdjustments: 0,
      wasteValue: 0,
    };

    events.forEach(event => {
      const impact = event.metadata.financialImpact || 0;
      result.totalValue += Math.abs(impact);

      if (event.eventType === 'STOCK_WASTE') {
        result.wasteValue += impact;
      } else if (event.eventType === 'STOCK_RESTOCK') {
        result.positiveAdjustments += impact;
      } else if (event.eventType === 'STOCK_DEDUCTION') {
        result.negativeAdjustments += impact;
      }
    });

    return result;
  }

  private calculateComplianceIssues(events: AuditEvent[]): AuditSummary['complianceIssues'] {
    const flaggedEvents = events.filter(e => 
      e.metadata.complianceFlags && e.metadata.complianceFlags.length > 0
    ).length;

    const criticalAlerts = events.filter(e => 
      e.metadata.riskLevel === 'critical'
    ).length;

    return {
      flaggedEvents,
      criticalAlerts,
      pendingReview: flaggedEvents - criticalAlerts,
    };
  }

  private analyzeStockMovements(events: AuditEvent[]): ComplianceReport['stockMovements'] {
    const stockEvents = events.filter(e => e.entityType === 'inventory');
    
    return {
      totalMovements: stockEvents.length,
      inboundValue: stockEvents
        .filter(e => e.eventType === 'STOCK_RESTOCK')
        .reduce((sum, e) => sum + (e.metadata.financialImpact || 0), 0),
      outboundValue: stockEvents
        .filter(e => e.eventType === 'STOCK_DEDUCTION')
        .reduce((sum, e) => sum + (e.metadata.financialImpact || 0), 0),
      adjustmentValue: stockEvents
        .filter(e => e.eventType === 'STOCK_ADJUSTMENT')
        .reduce((sum, e) => sum + (e.metadata.financialImpact || 0), 0),
      wasteValue: stockEvents
        .filter(e => e.eventType === 'STOCK_WASTE')
        .reduce((sum, e) => sum + (e.metadata.financialImpact || 0), 0),
    };
  }

  private analyzeUserActivity(events: AuditEvent[]): ComplianceReport['userActivity'] {
    const users = new Set(events.map(e => e.userId));
    const stockAdjustments = events.filter(e => 
      e.eventType === 'STOCK_ADJUSTMENT' || e.eventType === 'STOCK_RESTOCK'
    ).length;
    
    const suspiciousActivity = events.filter(e => 
      e.metadata.riskLevel === 'high' || e.metadata.riskLevel === 'critical'
    );

    return {
      activeUsers: users.size,
      stockAdjustments,
      suspiciousActivity,
    };
  }

  private calculateComplianceMetrics(events: AuditEvent[]): ComplianceReport['complianceMetrics'] {
    const stockEvents = events.filter(e => e.entityType === 'inventory');
    const completenessRatio = stockEvents.length > 0 ? 
      stockEvents.filter(e => e.previousValue && e.newValue).length / stockEvents.length : 1;
    
    const riskEvents = events.filter(e => 
      e.metadata.riskLevel === 'high' || e.metadata.riskLevel === 'critical'
    );
    const riskScore = Math.max(0, 100 - (riskEvents.length / events.length * 100));

    return {
      dataIntegrity: completenessRatio * 100,
      auditCoverage: 85, // This would be calculated based on expected vs actual events
      riskScore,
    };
  }

  private generateRecommendations(events: AuditEvent[]): string[] {
    const recommendations: string[] = [];
    
    const highRiskEvents = events.filter(e => e.metadata.riskLevel === 'high').length;
    if (highRiskEvents > 10) {
      recommendations.push('Review high-risk stock adjustments for potential process improvements');
    }

    const wasteEvents = events.filter(e => e.eventType === 'STOCK_WASTE');
    if (wasteEvents.length > 50) {
      recommendations.push('Implement waste reduction strategies for frequently wasted items');
    }

    const userActivityMap = this.calculateUserActivity(events);
    const highActivityUsers = userActivityMap.filter(u => u.eventCount > 100);
    if (highActivityUsers.length > 0) {
      recommendations.push('Consider implementing additional approval workflows for high-activity users');
    }

    return recommendations;
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID', 'Timestamp', 'Event Type', 'Entity Type', 'Entity ID',
      'User ID', 'Action', 'Risk Level', 'Financial Impact'
    ];

    const rows = events.map(event => [
      event.id,
      new Date(event.timestamp).toISOString(),
      event.eventType,
      event.entityType,
      event.entityId,
      event.userId,
      event.action,
      event.metadata.riskLevel || 'low',
      event.metadata.financialImpact || 0,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Force flush all pending audit events
   */
  async forceSyncAuditEvents(): Promise<void> {
    await this.flushPendingEvents();
  }

  /**
   * Get pending audit events count
   */
  getPendingEventsCount(): number {
    return this.pendingEvents.length;
  }
}

// Create singleton instance
export const inventoryAuditService = new InventoryAuditService();

export default InventoryAuditService;