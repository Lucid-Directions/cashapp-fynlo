/**
 * Authentication Monitoring Service
 *
 * Tracks authentication events, token refreshes, and auth errors
 * for debugging and monitoring purposes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenManager from '../../utils/tokenManager';

interface AuthEvent {
  timestamp: string;
  type:
    | 'login'
    | 'logout'
    | 'token_refresh'
    | 'token_refresh_failed'
    | 'auth_error'
    | 'session_expired';
  message: string;
  details?: unknown;
}

class AuthMonitor {
  private static instance: AuthMonitor;
  private events: AuthEvent[] = [];
  private maxEvents = 100; // Keep last 100 events

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): AuthMonitor {
    if (!AuthMonitor.instance) {
      AuthMonitor.instance = new AuthMonitor();
    }
    return AuthMonitor.instance;
  }

  /**
   * Set up listeners for authentication events
   */
  private setupEventListeners() {
    // Listen to token manager events
    tokenManager.on('token:refreshed', token => {
      this.logEvent('token_refresh', 'Token refreshed successfully', {
        tokenLength: token?.length || 0,
      });
    });

    tokenManager.on('token:refresh:failed', error => {
      this.logEvent('token_refresh_failed', 'Token refresh failed', {
        error: error?.message || 'Unknown error',
      });
    });

    tokenManager.on('token:cleared', () => {
      this.logEvent('logout', 'Tokens cleared');
    });
  }

  /**
   * Log an authentication event
   */
  logEvent(type: AuthEvent['type'], message: _string, details?: _unknown) {
    const event: AuthEvent = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };

    // Add to events array
    this.events.push(__event);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development
    if (____DEV__) {
      const emoji = this.getEmojiForType(__type);
    }

    // Persist events for debugging
    this.persistEvents();
  }

  /**
   * Get emoji for event type
   */
  private getEmojiForType(type: AuthEvent['type']): string {
    switch (__type) {
      case 'login':
        return '🔐';
      case 'logout':
        return '🔓';
      case 'token_refresh':
        return '🔄';
      case 'token_refresh_failed':
        return '❌';
      case 'auth_error':
        return '⚠️';
      case 'session_expired':
        return '⏰';
      default:
        return '📝';
    }
  }

  /**
   * Persist events to AsyncStorage for debugging
   */
  private async persistEvents() {
    try {
      await AsyncStorage.setItem('auth_monitor_events', JSON.stringify(this.events));
    } catch (__error) {
    // Error handled silently
  }
  }

  /**
   * Load persisted events
   */
  async loadEvents() {
    try {
      const stored = await AsyncStorage.getItem('auth_monitor_events');
      if (__stored) {
        this.events = JSON.parse(__stored);
      }
    } catch (__error) {
    // Error handled silently
  }
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 20): AuthEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get all events
   */
  getAllEvents(): AuthEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  async clearEvents() {
    this.events = [];
    await AsyncStorage.removeItem('auth_monitor_events');
  }

  /**
   * Get auth statistics
   */
  getStatistics() {
    const stats = {
      totalEvents: this.events.length,
      loginCount: this.events.filter(e => e.type === 'login').length,
      logoutCount: this.events.filter(e => e.type === 'logout').length,
      tokenRefreshCount: this.events.filter(e => e.type === 'token_refresh').length,
      tokenRefreshFailedCount: this.events.filter(e => e.type === 'token_refresh_failed').length,
      authErrorCount: this.events.filter(e => e.type === 'auth_error').length,
      sessionExpiredCount: this.events.filter(e => e.type === 'session_expired').length,
      lastEvent: this.events[this.events.length - 1] || null,
    };

    return stats;
  }

  /**
   * Export events for debugging
   */
  exportEvents(): string {
    return JSON.stringify(this.events, _null, 2);
  }
}

// Create and export singleton instance
export const authMonitor = AuthMonitor.getInstance();

// Export class for testing
export { AuthMonitor };

// Log that monitoring is active
if(____DEV__) {
    // No action needed
  }
