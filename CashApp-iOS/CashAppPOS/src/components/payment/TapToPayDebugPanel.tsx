/**
 * TapToPayDebugPanel - Debug panel for tap to pay diagnostics
 * 
 * Shows diagnostic information in development mode
 * Helps debug tap to pay issues during testing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import NativeSumUpService from '../../services/NativeSumUpService';
import TapToPayDiagnostics from '../../services/TapToPayDiagnostics';
import { logger } from '../../utils/logger';

interface DebugPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

const TapToPayDebugPanel: React.FC<DebugPanelProps> = ({ 
  visible = __DEV__, 
  onClose 
}) => {
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      runDiagnostics();
    }
  }, [visible]);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const report = await NativeSumUpService.getInstance().runDiagnostics();
      setDiagnosticReport(report);
      setLastUpdate(new Date());
    } catch (error) {
      logger.error('[TAP_TO_PAY_DEBUG] Failed to run diagnostics:', error);
      Alert.alert('Diagnostic Error', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const testTapToPay = async () => {
    try {
      const service = NativeSumUpService.getInstance();
      
      // Check availability
      const availability = await service.checkTapToPayAvailability();
      Alert.alert(
        'Tap to Pay Status',
        `Available: ${availability.isAvailable ? 'Yes' : 'No'}\n` +
        `Activated: ${availability.isActivated ? 'Yes' : 'No'}`
      );
    } catch (error) {
      Alert.alert('Test Failed', String(error));
    }
  };

  const clearDiagnostics = () => {
    TapToPayDiagnostics.clearHistory();
    setDiagnosticReport(null);
    Alert.alert('Diagnostics Cleared', 'History has been cleared');
  };

  if (!visible || !__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Tap to Pay Debug Panel</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdate}>
          Last Update: {lastUpdate.toLocaleTimeString()}
        </Text>

        {diagnosticReport && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📱 Platform</Text>
              <Text style={styles.info}>OS: {diagnosticReport.platform.os} {diagnosticReport.platform.version}</Text>
              <Text style={styles.info}>Device: {diagnosticReport.platform.deviceModel}</Text>
              <Text style={styles.info}>
                Simulator: {diagnosticReport.platform.isSimulator ? '⚠️ YES' : '✅ NO'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔧 SDK Status</Text>
              <Text style={styles.info}>
                Available: {diagnosticReport.sdk.isAvailable ? '✅' : '❌'}
              </Text>
              <Text style={styles.info}>
                Setup: {diagnosticReport.sdk.isSetup ? '✅' : '❌'}
              </Text>
              <Text style={styles.info}>
                Early Init: {diagnosticReport.sdk.wasInitializedEarly ? '✅' : '❌'}
              </Text>
              <Text style={styles.info}>
                Logged In: {diagnosticReport.sdk.isLoggedIn ? '✅' : '❌'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💳 Tap to Pay</Text>
              <Text style={styles.info}>
                Available: {diagnosticReport.tapToPay.isAvailable ? '✅' : '❌'}
              </Text>
              <Text style={styles.info}>
                Activated: {diagnosticReport.tapToPay.isActivated ? '✅' : '❌'}
              </Text>
              {diagnosticReport.tapToPay.lastError && (
                <Text style={styles.error}>
                  Error: {diagnosticReport.tapToPay.lastError}
                </Text>
              )}
            </View>

            {diagnosticReport.errors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>❌ Errors</Text>
                {diagnosticReport.errors.map((error: string, index: number) => (
                  <Text key={index} style={styles.error}>{error}</Text>
                ))}
              </View>
            )}

            {diagnosticReport.warnings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚠️ Warnings</Text>
                {diagnosticReport.warnings.map((warning: string, index: number) => (
                  <Text key={index} style={styles.warning}>{warning}</Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={runDiagnostics}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Running...' : 'Refresh'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={testTapToPay}
        >
          <Text style={styles.buttonText}>Test Tap to Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonDanger]} 
          onPress={clearDiagnostics}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 5,
  },
  content: {
    padding: 15,
    flex: 1,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  error: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 4,
  },
  warning: {
    fontSize: 14,
    color: '#f57c00',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonDanger: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default TapToPayDebugPanel;