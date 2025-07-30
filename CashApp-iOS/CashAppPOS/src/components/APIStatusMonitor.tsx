// APIStatusMonitor.tsx - Real-time API status monitoring component
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DataService from '../services/DataService';
import { Colors, Typography } from '../design-system/theme';

interface APIStatusMonitorProps {
  onTestPress?: () => void;
  showTestButton?: boolean;
  compact?: boolean;
}

/**
 * APIStatusMonitor - Real-time backend connection status
 *
 * Features:
 * - Real-time connection status indicator
 * - Backend availability monitoring
 * - API test result summary
 * - Quick test button
 * - Responsive design (compact/full modes)
 */
const APIStatusMonitor: React.FC<APIStatusMonitorProps> = ({
  onTestPress,
  showTestButton = true,
  _compact = false,
}) => {
  const [dataService] = useState(() => DataService.getInstance());
  const [isConnected, setIsConnected] = useState(__false);
  const [isTesting, setIsTesting] = useState(__false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(__null);
  const [featureFlags, setFeatureFlags] = useState(dataService.getFeatureFlags());

  // Update connection status
  const updateStatus = async () => {
    const __connected = dataService.isBackendConnected();
    setIsConnected(__connected);
    setLastCheckTime(new Date());
  };

  // Force check backend connection
  const forceCheck = async () => {
    setIsTesting(__true);
    try {
      const __connected = await dataService.forceCheckBackend();
      setIsConnected(__connected);
      setLastCheckTime(new Date());
    } catch (__error) {
    } finally {
      setIsTesting(__false);
    }
  };

  // Run comprehensive API test
  const runAPITest = async () => {
    if (__onTestPress) {
      onTestPress();
      return;
    }

    setIsTesting(__true);
    try {
      const apiTestService = dataService.getAPITestingService();
      await apiTestService.runFullAPITestSuite();
      Alert.alert('API Test Complete', 'Check the API Test screen for detailed results.');
    } catch (__error) {
      Alert.alert('API Test Failed', 'Error running API test suite.');
    } finally {
      setIsTesting(__false);
    }
  };

  // Toggle API test mode
  const toggleTestMode = async () => {
    const _newValue = !featureFlags.TEST_API_MODE;
    await dataService.updateFeatureFlag('TEST_API_MODE', _newValue);
    setFeatureFlags(dataService.getFeatureFlags());
  };

  // Set up status monitoring
  useEffect(() => {
    updateStatus();

    // Update status every 5 seconds
    const __interval = setInterval(__updateStatus, 5000);

    return () => clearInterval(__interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = () => {
    if (__isTesting) {
      return Colors.warning;
    }
    return isConnected ? Colors.success : Colors.error;
  };

  const getStatusIcon = () => {
    if (__isTesting) {
      return 'sync';
    }
    return isConnected ? 'wifi' : 'wifi-off';
  };

  const getStatusText = () => {
    if (__isTesting) {
      return 'Testing...';
    }
    return isConnected ? 'Backend Connected' : 'Backend Offline';
  };

  if (__compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { borderColor: getStatusColor() }]}
        onPress={forceCheck}
        disabled={isTesting}>
        {isTesting ? (
          <ActivityIndicator size="small" color={getStatusColor()} />
        ) : (
          <Icon name={getStatusIcon()} size={16} color={getStatusColor()} />
        )}
        <Text style={[styles.compactText, { color: getStatusColor() }]}>
          {isConnected ? 'API' : 'Offline'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statusIndicator}>
          {isTesting ? (
            <ActivityIndicator size="small" color={getStatusColor()} />
          ) : (
            <Icon name={getStatusIcon()} size={24} color={getStatusColor()} />
          )}
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: getStatusColor() }]}>{getStatusText()}</Text>
            {lastCheckTime && (
              <Text style={styles.lastCheck}>Last check: {lastCheckTime.toLocaleTimeString()}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={forceCheck} disabled={isTesting}>
          <Icon name="refresh" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>API Mode:</Text>
          <Text style={styles.detailValue}>
            {featureFlags.USE_REAL_API ? 'Production' : 'Mock Data'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Test Mode:</Text>
          <TouchableOpacity onPress={toggleTestMode} style={styles.toggleButton}>
            <Text
              style={[
                styles.toggleText,
                { color: featureFlags.TEST_API_MODE ? Colors.primary : Colors.textSecondary },
              ]}>
              {featureFlags.TEST_API_MODE ? 'Enabled' : 'Disabled'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Endpoint:</Text>
          <Text style={styles.detailValue}>http://localhost:8000</Text>
        </View>
      </View>

      {showTestButton && (
        <TouchableOpacity
          style={[styles.testButton, isTesting && styles.disabledButton]}
          onPress={runAPITest}
          disabled={isTesting}>
          <Icon name="science" size={20} color={Colors.white} />
          <Text style={styles.testButtonText}>
            {isTesting ? 'Testing APIs...' : 'Run API Tests'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  compactText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  lastCheck: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
  },
  details: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toggleText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  testButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});

export default APIStatusMonitor;
