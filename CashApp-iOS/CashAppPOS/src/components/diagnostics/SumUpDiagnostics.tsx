/**
 * SumUp Diagnostics Component
 * Provides comprehensive diagnostics for SumUp native module integration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../utils/logger';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Theme } from '../../design-system/theme';

interface DiagnosticResult {
  moduleAvailable: boolean;
  initializationAttempted: boolean;
  initializationSucceeded: boolean;
  lastError: string | null;
  sdkVersion: string;
  capabilities: string[];
  timestamp: string;
  platform: string;
  platformVersion: string | number;
  availableModules: string[];
  tapToPayAvailable?: boolean;
  tapToPayActivated?: boolean;
  isLoggedIn?: boolean;
  merchantInfo?: any;
}

const SumUpDiagnostics: React.FC = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    
    const result: DiagnosticResult = {
      moduleAvailable: false,
      initializationAttempted: false,
      initializationSucceeded: false,
      lastError: null,
      sdkVersion: 'unknown',
      capabilities: [],
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      platformVersion: Platform.Version,
      availableModules: Object.keys(NativeModules),
    };

    try {
      // Check if SumUp module exists
      const { SumUpTapToPayModule } = NativeModules;
      result.moduleAvailable = !!SumUpTapToPayModule;
      
      if (result.moduleAvailable) {
        logger.info('✅ SumUp native module found');
        result.capabilities.push('Module Registered');
        
        // Try to check if logged in
        try {
          const loginStatus = await SumUpTapToPayModule.isLoggedIn();
          result.isLoggedIn = loginStatus.isLoggedIn;
          if (loginStatus.isLoggedIn) {
            result.capabilities.push('Logged In');
          }
        } catch (error) {
          logger.warn('Could not check login status:', error);
        }
        
        // Try to check Tap to Pay availability
        try {
          const tapToPayStatus = await SumUpTapToPayModule.checkTapToPayAvailability();
          result.tapToPayAvailable = tapToPayStatus.isAvailable;
          result.tapToPayActivated = tapToPayStatus.isActivated;
          
          if (tapToPayStatus.isAvailable) {
            result.capabilities.push('Tap to Pay Available');
          }
          if (tapToPayStatus.isActivated) {
            result.capabilities.push('Tap to Pay Activated');
          }
        } catch (error) {
          logger.warn('Could not check Tap to Pay status:', error);
          result.lastError = `Tap to Pay check failed: ${error}`;
        }
        
        // Try to get merchant info
        try {
          const merchant = await SumUpTapToPayModule.getCurrentMerchant();
          if (merchant) {
            result.merchantInfo = merchant;
            result.capabilities.push('Merchant Connected');
          }
        } catch (error) {
          logger.warn('Could not get merchant info:', error);
        }
        
        // Check SDK version if available
        if (SumUpTapToPayModule.SDK_VERSION) {
          result.sdkVersion = SumUpTapToPayModule.SDK_VERSION;
        }
        
      } else {
        logger.error('❌ SumUp native module NOT found');
        result.lastError = 'Native module not registered in NativeModules';
        
        // Log available modules for debugging
        logger.info('Available native modules:', result.availableModules.filter(m => 
          m.toLowerCase().includes('sum') || 
          m.toLowerCase().includes('pay') ||
          m.toLowerCase().includes('tap')
        ));
      }
      
    } catch (error) {
      logger.error('Diagnostic error:', error);
      result.lastError = String(error);
    }
    
    setDiagnostics(result);
    setLoading(false);
  };

  const getStatusColor = (status: boolean | undefined) => {
    if (status === true) return theme.colors.success;
    if (status === false) return theme.colors.error;
    return theme.colors.textSecondary;
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === true) return 'check-circle';
    if (status === false) return 'cancel';
    return 'help-outline';
  };

  const copyDiagnostics = () => {
    if (!diagnostics) return;
    
    const report = JSON.stringify(diagnostics, null, 2);
    // In a real app, you'd copy to clipboard
    Alert.alert('Diagnostic Report', report.substring(0, 500) + '...');
  };

  const testPayment = async () => {
    if (!diagnostics?.moduleAvailable) {
      Alert.alert('Module Not Available', 'Cannot test payment without native module');
      return;
    }

    try {
      const { SumUpTapToPayModule } = NativeModules;
      const result = await SumUpTapToPayModule.checkout(
        1.00, // £1.00 test amount
        'Diagnostic Test Payment',
        'GBP',
        `TEST-${Date.now()}`,
        true // Use Tap to Pay
      );
      
      if (result.success) {
        Alert.alert('Test Successful', `Transaction: ${result.transactionCode}`);
      } else {
        Alert.alert('Test Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Test Error', String(error));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Running diagnostics...</Text>
      </View>
    );
  }

  if (!diagnostics) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to run diagnostics</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Icon 
            name={getStatusIcon(diagnostics.moduleAvailable)} 
            size={24} 
            color={getStatusColor(diagnostics.moduleAvailable)} 
          />
          <Text style={styles.headerTitle}>SumUp Diagnostics</Text>
        </View>
        <Icon 
          name={expanded ? 'expand-less' : 'expand-more'} 
          size={24} 
          color={theme.colors.text} 
        />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.content}>
          {/* Module Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Module Status</Text>
            <DiagnosticRow
              label="Native Module"
              status={diagnostics.moduleAvailable}
              value={diagnostics.moduleAvailable ? 'Available' : 'Not Found'}
              theme={theme}
            />
            <DiagnosticRow
              label="Platform"
              status={true}
              value={`${diagnostics.platform} ${diagnostics.platformVersion}`}
              theme={theme}
            />
            <DiagnosticRow
              label="SDK Version"
              status={diagnostics.sdkVersion !== 'unknown'}
              value={diagnostics.sdkVersion}
              theme={theme}
            />
          </View>

          {/* Tap to Pay Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tap to Pay</Text>
            <DiagnosticRow
              label="Available"
              status={diagnostics.tapToPayAvailable}
              value={diagnostics.tapToPayAvailable ? 'Yes' : 'No'}
              theme={theme}
            />
            <DiagnosticRow
              label="Activated"
              status={diagnostics.tapToPayActivated}
              value={diagnostics.tapToPayActivated ? 'Yes' : 'No'}
              theme={theme}
            />
          </View>

          {/* Authentication */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authentication</Text>
            <DiagnosticRow
              label="Logged In"
              status={diagnostics.isLoggedIn}
              value={diagnostics.isLoggedIn ? 'Yes' : 'No'}
              theme={theme}
            />
            {diagnostics.merchantInfo && (
              <DiagnosticRow
                label="Merchant"
                status={true}
                value={diagnostics.merchantInfo.name || diagnostics.merchantInfo.merchantCode}
                theme={theme}
              />
            )}
          </View>

          {/* Capabilities */}
          {diagnostics.capabilities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Capabilities</Text>
              {diagnostics.capabilities.map((cap, index) => (
                <View key={index} style={styles.capability}>
                  <Icon name="check" size={16} color={theme.colors.success} />
                  <Text style={styles.capabilityText}>{cap}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Errors */}
          {diagnostics.lastError && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Errors</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorMessage}>{diagnostics.lastError}</Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={runDiagnostics}>
              <Icon name="refresh" size={20} color={theme.colors.onPrimary} />
              <Text style={styles.buttonText}>Re-run Diagnostics</Text>
            </TouchableOpacity>
            
            {diagnostics.moduleAvailable && (
              <TouchableOpacity 
                style={[styles.button, styles.testButton]} 
                onPress={testPayment}
              >
                <Icon name="payment" size={20} color={theme.colors.onPrimary} />
                <Text style={styles.buttonText}>Test Payment</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={copyDiagnostics}
            >
              <Icon name="content-copy" size={20} color={theme.colors.primary} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Copy Report
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Diagnostic Row Component
const DiagnosticRow: React.FC<{
  label: string;
  status: boolean | undefined;
  value: string;
  theme: Theme;
}> = ({ label, status, value, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}:</Text>
      <View style={styles.rowValue}>
        <Icon 
          name={status ? 'check' : status === false ? 'close' : 'remove'} 
          size={16} 
          color={status ? theme.colors.success : status === false ? theme.colors.error : theme.colors.textSecondary} 
        />
        <Text style={[styles.rowValueText, { 
          color: status ? theme.colors.text : theme.colors.textSecondary 
        }]}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  rowLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValueText: {
    fontSize: 14,
    marginLeft: theme.spacing.xs,
  },
  capability: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  capabilityText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  errorBox: {
    backgroundColor: theme.colors.error + '20',
    padding: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
  },
  errorMessage: {
    fontSize: 12,
    color: theme.colors.error,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    padding: theme.spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  testButton: {
    backgroundColor: theme.colors.success,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onPrimary,
    marginLeft: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    padding: theme.spacing.md,
    textAlign: 'center',
  },
});

export default SumUpDiagnostics;