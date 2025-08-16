/**
 * TapToPayDiagnostics - Comprehensive diagnostic service for tap to pay
 * 
 * This service provides detailed logging and diagnostic capabilities
 * for debugging tap to pay issues in production and development.
 * Critical for production monitoring and troubleshooting.
 */

import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import NativeSumUpService from './NativeSumUpService';
import DeviceInfo from 'react-native-device-info';

interface DiagnosticReport {
  timestamp: string;
  platform: {
    os: string;
    version: string;
    isSimulator: boolean;
    deviceModel: string;
  };
  sdk: {
    isAvailable: boolean;
    isSetup: boolean;
    wasInitializedEarly: boolean;
    isLoggedIn: boolean;
  };
  tapToPay: {
    isAvailable: boolean;
    isActivated: boolean;
    lastError?: string;
  };
  merchant: {
    isLoggedIn: boolean;
    currencyCode?: string;
    merchantCode?: string;
  };
  environment: {
    hasAPIKey: boolean;
    buildType: string;
    appVersion: string;
  };
  errors: string[];
  warnings: string[];
}

class TapToPayDiagnostics {
  private static instance: TapToPayDiagnostics;
  private lastReport: DiagnosticReport | null = null;
  private errors: string[] = [];
  private warnings: string[] = [];

  private constructor() {
    logger.info('[TAP_TO_PAY_DIAGNOSTICS] Service initialized');
  }

  static getInstance(): TapToPayDiagnostics {
    if (!TapToPayDiagnostics.instance) {
      TapToPayDiagnostics.instance = new TapToPayDiagnostics();
    }
    return TapToPayDiagnostics.instance;
  }

  /**
   * Log a diagnostic event with detailed context
   */
  logEvent(event: string, data?: any, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      event,
      platform: Platform.OS,
      ...data,
    };

    const message = `[TAP_TO_PAY] ${event}`;
    
    switch (level) {
      case 'error':
        logger.error(message, logData);
        this.errors.push(`${timestamp}: ${event}`);
        break;
      case 'warn':
        logger.warn(message, logData);
        this.warnings.push(`${timestamp}: ${event}`);
        break;
      default:
        logger.info(message, logData);
    }
  }

  /**
   * Generate comprehensive diagnostic report
   */
  async generateReport(): Promise<DiagnosticReport> {
    this.logEvent('Generating diagnostic report');
    
    const sumUpService = NativeSumUpService;
    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      platform: {
        os: Platform.OS,
        version: Platform.Version ? String(Platform.Version) : 'unknown',
        isSimulator: await this.isSimulator(),
        deviceModel: await this.getDeviceModel(),
      },
      sdk: {
        isAvailable: false,
        isSetup: false,
        wasInitializedEarly: false,
        isLoggedIn: false,
      },
      tapToPay: {
        isAvailable: false,
        isActivated: false,
      },
      merchant: {
        isLoggedIn: false,
      },
      environment: {
        hasAPIKey: false,
        buildType: __DEV__ ? 'development' : 'production',
        appVersion: DeviceInfo.getVersion(),
      },
      errors: [...this.errors],
      warnings: [...this.warnings],
    };

    // Check SDK availability
    try {
      report.sdk.isAvailable = sumUpService.isAvailable();
      this.logEvent('SDK availability check', { available: report.sdk.isAvailable });
    } catch (error) {
      this.logEvent('SDK availability check failed', { error }, 'error');
      report.tapToPay.lastError = String(error);
    }

    // Check SDK setup
    try {
      report.sdk.isSetup = sumUpService.isSDKSetup();
      this.logEvent('SDK setup status', { isSetup: report.sdk.isSetup });
    } catch (error) {
      this.logEvent('SDK setup check failed', { error }, 'error');
    }

    // Check early initialization
    try {
      report.sdk.wasInitializedEarly = await sumUpService.wasInitializedEarly();
      this.logEvent('Early initialization status', { wasInitializedEarly: report.sdk.wasInitializedEarly });
    } catch (error) {
      this.logEvent('Early initialization check failed', { error }, 'warn');
    }

    // Check login status
    try {
      const loginStatus = await sumUpService.isLoggedIn();
      report.sdk.isLoggedIn = loginStatus;
      report.merchant.isLoggedIn = loginStatus;
      this.logEvent('Login status', { isLoggedIn: loginStatus });
    } catch (error) {
      this.logEvent('Login status check failed', { error }, 'warn');
    }

    // Check tap to pay availability
    if (report.sdk.isAvailable && report.sdk.isSetup) {
      try {
        const tapToPayStatus = await sumUpService.checkTapToPayAvailability();
        report.tapToPay.isAvailable = tapToPayStatus.isAvailable;
        report.tapToPay.isActivated = tapToPayStatus.isActivated;
        this.logEvent('Tap to pay status', tapToPayStatus);
      } catch (error) {
        this.logEvent('Tap to pay check failed', { error }, 'error');
        report.tapToPay.lastError = String(error);
      }
    }

    // Check merchant info
    if (report.merchant.isLoggedIn) {
      try {
        const merchant = await sumUpService.getCurrentMerchant();
        if (merchant) {
          report.merchant.currencyCode = merchant.currencyCode;
          report.merchant.merchantCode = merchant.merchantCode;
          this.logEvent('Merchant info retrieved', merchant);
        }
      } catch (error) {
        this.logEvent('Merchant info retrieval failed', { error }, 'warn');
      }
    }

    // Device capability checks
    this.performDeviceChecks(report);

    // Store the report
    this.lastReport = report;
    
    this.logEvent('Diagnostic report generated', { 
      hasErrors: report.errors.length > 0,
      hasWarnings: report.warnings.length > 0,
    });

    return report;
  }

  /**
   * Perform device-specific checks
   */
  private performDeviceChecks(report: DiagnosticReport) {
    // Check iOS version for tap to pay
    if (Platform.OS === 'ios') {
      const iosVersion = parseFloat(String(Platform.Version));
      if (iosVersion < 16.4) {
        const warning = `iOS ${iosVersion} detected. Tap to Pay requires iOS 16.4 or later`;
        this.logEvent(warning, { iosVersion }, 'warn');
        report.warnings.push(warning);
      }
      
      // Check device model
      const model = report.platform.deviceModel;
      if (model && !this.isTapToPayCompatibleDevice(model)) {
        const warning = `Device ${model} may not support Tap to Pay. Requires iPhone XS or later`;
        this.logEvent(warning, { model }, 'warn');
        report.warnings.push(warning);
      }
    }

    // Warn if simulator
    if (report.platform.isSimulator) {
      const warning = 'Running on simulator. Tap to Pay requires physical device';
      this.logEvent(warning, {}, 'warn');
      report.warnings.push(warning);
    }
  }

  /**
   * Check if device supports tap to pay
   */
  private isTapToPayCompatibleDevice(model: string): boolean {
    // iPhone XS and later support tap to pay
    const compatibleModels = [
      'iPhone XS', 'iPhone XR', 'iPhone 11', 'iPhone 12', 
      'iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 16'
    ];
    return compatibleModels.some(m => model.includes(m));
  }

  /**
   * Check if running on simulator
   */
  private async isSimulator(): Promise<boolean> {
    try {
      return await DeviceInfo.isEmulator();
    } catch {
      return false;
    }
  }

  /**
   * Get device model
   */
  private async getDeviceModel(): Promise<string> {
    try {
      return await DeviceInfo.getModel();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get last diagnostic report
   */
  getLastReport(): DiagnosticReport | null {
    return this.lastReport;
  }

  /**
   * Clear diagnostic history
   */
  clearHistory() {
    this.errors = [];
    this.warnings = [];
    this.lastReport = null;
    this.logEvent('Diagnostic history cleared');
  }

  /**
   * Log payment attempt for diagnostics
   */
  logPaymentAttempt(amount: number, currency: string, useTapToPay: boolean) {
    this.logEvent('Payment attempt started', {
      amount,
      currency,
      useTapToPay,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log payment result for diagnostics
   */
  logPaymentResult(success: boolean, transactionCode?: string, error?: any) {
    const level = success ? 'info' : 'error';
    this.logEvent(
      success ? 'Payment completed successfully' : 'Payment failed',
      {
        success,
        transactionCode,
        error: error ? String(error) : undefined,
        timestamp: new Date().toISOString(),
      },
      level
    );
  }

  /**
   * Format report for display
   */
  formatReportForDisplay(report: DiagnosticReport): string {
    const lines = [
      '=== TAP TO PAY DIAGNOSTIC REPORT ===',
      `Generated: ${report.timestamp}`,
      '',
      '📱 PLATFORM',
      `  OS: ${report.platform.os} ${report.platform.version}`,
      `  Device: ${report.platform.deviceModel}`,
      `  Simulator: ${report.platform.isSimulator ? '⚠️ YES' : '✅ NO'}`,
      '',
      '🔧 SDK STATUS',
      `  Available: ${report.sdk.isAvailable ? '✅' : '❌'}`,
      `  Setup: ${report.sdk.isSetup ? '✅' : '❌'}`,
      `  Early Init: ${report.sdk.wasInitializedEarly ? '✅' : '❌'}`,
      `  Logged In: ${report.sdk.isLoggedIn ? '✅' : '❌'}`,
      '',
      '💳 TAP TO PAY',
      `  Available: ${report.tapToPay.isAvailable ? '✅' : '❌'}`,
      `  Activated: ${report.tapToPay.isActivated ? '✅' : '❌'}`,
    ];

    if (report.tapToPay.lastError) {
      lines.push(`  Last Error: ${report.tapToPay.lastError}`);
    }

    lines.push(
      '',
      '🏪 MERCHANT',
      `  Logged In: ${report.merchant.isLoggedIn ? '✅' : '❌'}`
    );

    if (report.merchant.merchantCode) {
      lines.push(`  Code: ${report.merchant.merchantCode}`);
      lines.push(`  Currency: ${report.merchant.currencyCode}`);
    }

    lines.push(
      '',
      '⚙️ ENVIRONMENT',
      `  Build: ${report.environment.buildType}`,
      `  Version: ${report.environment.appVersion}`
    );

    if (report.errors.length > 0) {
      lines.push('', '❌ ERRORS:');
      report.errors.forEach(error => lines.push(`  - ${error}`));
    }

    if (report.warnings.length > 0) {
      lines.push('', '⚠️ WARNINGS:');
      report.warnings.forEach(warning => lines.push(`  - ${warning}`));
    }

    lines.push('', '=== END REPORT ===');
    return lines.join('\n');
  }
}

export default TapToPayDiagnostics.getInstance();