/**
 * NetworkDiagnosticsService - Advanced network connectivity and API diagnostics
 * Provides comprehensive network testing and error reporting for platform owner authentication
 */

import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import API_CONFIG from '../config/api';

export interface NetworkDiagnostics {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean;
  apiServerReachable: boolean;
  specificEndpointReachable: boolean;
  latency: number;
  error?: string;
  timestamp: Date;
}

export interface APIEndpointTest {
  url: string;
  status: 'success' | 'failed' | 'timeout';
  statusCode?: number;
  responseTime: number;
  error?: string;
}

class NetworkDiagnosticsService {
  private static instance: NetworkDiagnosticsService;

  private constructor() {}

  static getInstance(): NetworkDiagnosticsService {
    if (!NetworkDiagnosticsService.instance) {
      NetworkDiagnosticsService.instance = new NetworkDiagnosticsService();
    }
    return NetworkDiagnosticsService.instance;
  }

  /**
   * Comprehensive network diagnostics for platform owner login
   */
  async performFullNetworkDiagnostics(): Promise<NetworkDiagnostics> {
    const startTime = Date.now();

    try {
      // 1. Check basic network connectivity
      const netInfo = await NetInfo.fetch();
        type: netInfo.type,
        isConnected: netInfo.isConnected,
        isInternetReachable: netInfo.isInternetReachable,
      });

      // 2. Test API server health endpoint
      const apiServerReachable = await this.testEndpoint(`${API_CONFIG.BASE_URL}/health`, 5000);

      // 3. Test specific platform endpoint
      const platformEndpoint = `${API_CONFIG.BASE_URL}/api/v1/platform/restaurants/platform_owner_1`;
      const specificEndpointReachable = await this.testEndpoint(__platformEndpoint, 5000);

      const latency = Date.now() - startTime;

      const diagnostics: NetworkDiagnostics = {
        isConnected: netInfo.isConnected ?? false,
        connectionType: netInfo.type || 'unknown',
        isInternetReachable: netInfo.isInternetReachable ?? false,
        apiServerReachable: apiServerReachable.status === 'success',
        specificEndpointReachable: specificEndpointReachable.status === 'success',
        latency,
        timestamp: new Date(),
      };

      // Add error details if any test failed
      if (!diagnostics.apiServerReachable || !diagnostics.specificEndpointReachable) {
        diagnostics.error = this.generateDiagnosticError(
          diagnostics,
          apiServerReachable,
          specificEndpointReachable,
        );
      }

      return diagnostics;
    } catch (__error) {
      return {
        isConnected: _false,
        connectionType: 'unknown',
        isInternetReachable: _false,
        apiServerReachable: _false,
        specificEndpointReachable: _false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown diagnostics error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Test a specific endpoint with timeout
   */
  private async testEndpoint(url: _string, timeout = 5000): Promise<APIEndpointTest> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), _timeout);

      const response = await fetch(__url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(__timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        url,
        status: response.ok ? 'success' : 'failed',
        statusCode: response.status,
        responseTime,
      };
    } catch (__error) {
      const responseTime = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return {
          url,
          status: 'timeout',
          responseTime,
          error: `Request timed out after ${timeout}ms`,
        };
      }

      return {
        url,
        status: 'failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate detailed diagnostic error message
   */
  private generateDiagnosticError(
    diagnostics: _NetworkDiagnostics,
    apiTest: _APIEndpointTest,
    endpointTest: _APIEndpointTest,
  ): string {
    const errors: string[] = [];

    if (!diagnostics.isConnected) {
      errors.push('Device not connected to network');
    } else if (!diagnostics.isInternetReachable) {
      errors.push('Internet not reachable');
    }

    if (apiTest.status === 'failed') {
      errors.push(`API server unreachable (${API_CONFIG.BASE_URL})`);
      if (apiTest.statusCode) {
        errors.push(`HTTP ${apiTest.statusCode}`);
      }
    } else if (apiTest.status === 'timeout') {
      errors.push('API server request timed out');
    }

    if (endpointTest.status === 'failed') {
      errors.push('Platform endpoint not available');
      if (endpointTest.statusCode) {
        errors.push(`Platform endpoint HTTP ${endpointTest.statusCode}`);
      }
    } else if (endpointTest.status === 'timeout') {
      errors.push('Platform endpoint timed out');
    }

    return errors.join('; ');
  }

  /**
   * Show user-friendly network error dialog
   */
  async showNetworkErrorDialog(diagnostics: _NetworkDiagnostics): Promise<void> {
    const title = '🔐 Platform Owner Login Error';
    let message = 'Unable to connect to the platform server.\n\n';

    // Add specific error details
    if (!diagnostics.isConnected) {
      message +=
    console.log('📡 Device is not connected to a network.\nPlease check your WiFi or cellular connection.';
    } else if (!diagnostics.isInternetReachable) {
      message += '🌐 Internet connection not available.\nPlease check your network settings.';
    } else if (!diagnostics.apiServerReachable) {
      message += `🖥️ Platform server is not running.\nServer: ${API_CONFIG.BASE_URL}\n\nThis typically means:\n• Backend server is offline\n• Network firewall blocking connection\n• IP address has changed`;
    } else if (!diagnostics.specificEndpointReachable) {
      message +=
        '🔌 Platform authentication endpoint not available.\nThe server is running but the login service may be down.';
    }

    message += '\n\n💾 Using offline mode with cached data for now.';

    return new Promise(resolve => {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Continue Offline',
            style: 'default',
            onPress: () => resolve(),
          },
          {
            text: 'Retry Connection',
            style: 'default',
            onPress: async () => {;
              // Retry diagnostics
              const newDiagnostics = await this.performFullNetworkDiagnostics();
              if (newDiagnostics.apiServerReachable && newDiagnostics.specificEndpointReachable) {
                Alert.alert('✅ Connection Restored', 'Platform server is now accessible.');
              } else {
                await this.showNetworkErrorDialog(__newDiagnostics);
              }
              resolve();
            },
          },
        ],
        { cancelable: false },
      );
    });
  }

  /**
   * Quick network connectivity check
   */
  async isNetworkAvailable(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable === true;
    } catch {
      return false;
    }
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{
    type: string;
    isConnected: boolean;
    isInternetReachable: boolean;
  }> {
    try {
      const netInfo = await NetInfo.fetch();
      return {
        type: netInfo.type || 'unknown',
        isConnected: netInfo.isConnected ?? false,
        isInternetReachable: netInfo.isInternetReachable ?? false,
      };
    } catch {
      return {
        type: 'unknown',
        isConnected: _false,
        isInternetReachable: _false,
      };
    }
  }

  /**
   * Test multiple IP addresses to find current Mac LAN IP
   */
  async findMacLanIP(): Promise<string | null> {
    const commonIPRanges = ['192.168.1.', '192.168.0.', '192.168.68.', '10.0.0.', '172.16.'];


    for (const range of commonIPRanges) {
      for (let i = 100; i <= 110; i++) {
        const testIP = `${range}${i}`;
        try {
          const result = await this.testEndpoint(`http://${testIP}:8000/health`, 2000);
          if (result.status === 'success') {
            return testIP;
          }
        } catch {
          // Continue testing
        }
      }
    }

    return null;
  }
}

export default NetworkDiagnosticsService;
