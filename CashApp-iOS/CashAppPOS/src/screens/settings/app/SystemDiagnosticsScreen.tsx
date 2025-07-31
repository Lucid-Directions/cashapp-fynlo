import React, { useState, _useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  _ActivityIndicator,
  Modal,
  _ProgressBarAndroid,
  Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface SystemMetric {
  name: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  icon: string;
  description: string;
}

interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  lastRun?: Date;
}

interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  component: string;
}

const SystemDiagnosticsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showSystemInfoModal, setShowSystemInfoModal] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');

  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([
    {
      name: 'CPU Usage',
      value: '23%',
      status: 'good',
      icon: 'memory',
      description: 'Current processor utilization',
    },
    {
      name: 'Memory Usage',
      value: '1.2GB / 3GB',
      status: 'good',
      icon: 'storage',
      description: 'RAM consumption',
    },
    {
      name: 'Storage Space',
      value: '45GB / 64GB',
      status: 'warning',
      icon: 'sd-storage',
      description: 'Available device storage',
    },
    {
      name: 'Network Speed',
      value: '52 Mbps',
      status: 'good',
      icon: 'wifi',
      description: 'Internet connection speed',
    },
    {
      name: 'Battery Level',
      value: '87%',
      status: 'good',
      icon: 'battery-full',
      description: 'Device battery status',
    },
    {
      name: 'App Performance',
      value: '94%',
      status: 'good',
      icon: 'speed',
      description: 'Overall app responsiveness',
    },
  ]);

  const [diagnosticTests, setDiagnosticTests] = useState<DiagnosticTest[]>([
    {
      id: 'network',
      name: 'Network Connectivity',
      description: 'Test internet and server connections',
      icon: 'wifi',
      status: 'pending',
      lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'database',
      name: 'Database Integrity',
      description: 'Verify data consistency and performance',
      icon: 'storage',
      status: 'pending',
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      id: 'hardware',
      name: 'Hardware Components',
      description: 'Check printer, scanner, and peripherals',
      icon: 'devices',
      status: 'pending',
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    {
      id: 'performance',
      name: 'Performance Metrics',
      description: 'Measure app speed and responsiveness',
      icon: 'speed',
      status: 'pending',
      lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      id: 'security',
      name: 'Security Scan',
      description: 'Check for vulnerabilities and updates',
      icon: 'security',
      status: 'pending',
      lastRun: new Date(Date.now() - 48 * 60 * 60 * 1000),
    },
  ]);

  const systemLogs: SystemLog[] = [
    {
      id: 'log1',
      level: 'info',
      message: 'System startup completed successfully',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      component: 'System',
    },
    {
      id: 'log2',
      level: 'warning',
      message: 'Low storage space detected',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      component: 'Storage',
    },
    {
      id: 'log3',
      level: 'info',
      message: 'Backup completed successfully',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      component: 'Backup',
    },
    {
      id: 'log4',
      level: 'error',
      message: 'Failed to connect to receipt printer',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      component: 'Hardware',
    },
    {
      id: 'log5',
      level: 'info',
      message: 'User authentication successful',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      component: 'Auth',
    },
  ];

  const systemInfo = {
    'App Version': '2.1.4',
    'Build Number': '2024.12.17.1',
    'OS Version': Platform.OS === 'ios' ? 'iOS 17.2' : 'Android 14',
    'Device Model': Platform.OS === 'ios' ? 'iPhone 15 Pro' : 'Samsung Galaxy Tab',
    RAM: '3GB',
    Storage: '64GB',
    Network: 'WiFi (5GHz)',
    'Location Services': 'Enabled',
    Notifications: 'Enabled',
    'Background Refresh': 'Enabled',
  };

  const runDiagnosticTests = async () => {
    setIsRunningTests(true);
    setTestProgress(0);
    setCurrentTest('');

    const testsToRun = diagnosticTests.filter((test) => test.status === 'pending');
    const totalTests = testsToRun.length;

    for (let i = 0; i < testsToRun.length; i++) {
      const test = testsToRun[i];
      setCurrentTest(test.name);

      // Update test status to running
      setDiagnosticTests((prev) =>
        prev.map((t) => (t.id === test.id ? { ...t, status: 'running' } : t))
      );

      // Simulate test execution
      const testDuration = Math.random() * 3000 + 1000; // 1-4 seconds
      await new Promise((resolve) => setTimeout(resolve, testDuration));

      // Simulate test result (90% pass rate)
      const passed = Math.random() > 0.1;

      setDiagnosticTests((prev) =>
        prev.map((t) =>
          t.id === test.id
            ? {
                ...t,
                status: passed ? 'passed' : 'failed',
                duration: testDuration,
                lastRun: new Date(),
              }
            : t
        )
      );

      setTestProgress(((i + 1) / totalTests) * 100);
    }

    setIsRunningTests(false);
    setCurrentTest('');

    const failedTests = diagnosticTests.filter((test) => test.status === 'failed');
    if (failedTests.length > 0) {
      Alert.alert(
        'Diagnostic Complete',
        `${failedTests.length} test(s) failed. Please check the results and take appropriate action.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'All Tests Passed',
        'System diagnostics completed successfully. Your system is running optimally.',
        [{ text: 'OK' }]
      );
    }
  };

  const runSingleTest = async (testId: string) => {
    const test = diagnosticTests.find((t) => t.id === testId);
    if (!test) return;

    setDiagnosticTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: 'running' } : t))
    );

    // Simulate test execution
    const testDuration = Math.random() * 3000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, testDuration));

    const passed = Math.random() > 0.1;

    setDiagnosticTests((prev) =>
      prev.map((t) =>
        t.id === testId
          ? {
              ...t,
              status: passed ? 'passed' : 'failed',
              duration: testDuration,
              lastRun: new Date(),
            }
          : t
      )
    );

    Alert.alert('Test Complete', `${test.name}: ${passed ? 'PASSED' : 'FAILED'}`, [{ text: 'OK' }]);
  };

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary files and may improve performance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            Alert.alert('Success', 'Cache cleared successfully. 247MB freed.');
          },
        },
      ]
    );
  };

  const optimizeDatabase = () => {
    Alert.alert(
      'Optimize Database',
      'This will reorganize database files for better performance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: () => {
            Alert.alert('Success', 'Database optimization completed successfully.');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'passed':
        return Colors.success;
      case 'warning':
        return Colors.warning;
      case 'critical':
      case 'failed':
        return Colors.danger;
      case 'running':
        return Colors.secondary;
      default:
        return Colors.mediumGray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
      case 'passed':
        return 'check-circle';
      case 'warning':
        return 'warning';
      case 'critical':
      case 'failed':
        return 'error';
      case 'running':
        return 'sync';
      default:
        return 'help';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return Colors.secondary;
      case 'warning':
        return Colors.warning;
      case 'error':
        return Colors.danger;
      default:
        return Colors.mediumGray;
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'help';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Diagnostics</Text>
        <TouchableOpacity style={styles.infoButton} onPress={() => setShowSystemInfoModal(true)}>
          <Icon name="info" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* System Health Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={styles.metricsGrid}>
            {systemMetrics.map((metric, index) => (
              <View key={index} style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Icon name={metric.icon} size={24} color={getStatusColor(metric.status)} />
                  <View
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: getStatusColor(metric.status) },
                    ]}
                  />
                </View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricName}>{metric.name}</Text>
                <Text style={styles.metricDescription}>{metric.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Diagnostic Tests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Diagnostic Tests</Text>
            <TouchableOpacity
              style={[styles.runAllButton, isRunningTests && styles.runAllButtonDisabled]}
              onPress={runDiagnosticTests}
              disabled={isRunningTests}
            >
              <Icon
                name={isRunningTests ? 'hourglass-empty' : 'play-arrow'}
                size={20}
                color={Colors.white}
              />
              <Text style={styles.runAllButtonText}>
                {isRunningTests ? 'Running...' : 'Run All'}
              </Text>
            </TouchableOpacity>
          </View>

          {isRunningTests && (
            <View style={styles.testProgress}>
              <Text style={styles.currentTestText}>Running: {currentTest}</Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${testProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(testProgress)}% Complete</Text>
            </View>
          )}

          <View style={styles.testsContainer}>
            {diagnosticTests.map((test) => (
              <View key={test.id} style={styles.testCard}>
                <View style={styles.testHeader}>
                  <View style={styles.testInfo}>
                    <View style={styles.testTitleRow}>
                      <Icon name={test.icon} size={24} color={Colors.primary} />
                      <Text style={styles.testName}>{test.name}</Text>
                      <View
                        style={[
                          styles.testStatus,
                          { backgroundColor: getStatusColor(test.status) },
                        ]}
                      >
                        <Icon name={getStatusIcon(test.status)} size={16} color={Colors.white} />
                      </View>
                    </View>
                    <Text style={styles.testDescription}>{test.description}</Text>
                    {test.lastRun && (
                      <Text style={styles.testLastRun}>
                        Last run: {test.lastRun.toLocaleDateString()} at{' '}
                        {test.lastRun.toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.testButton,
                    test.status === 'running' && styles.testButtonDisabled,
                  ]}
                  onPress={() => runSingleTest(test.id)}
                  disabled={test.status === 'running' || isRunningTests}
                >
                  <Icon
                    name={test.status === 'running' ? 'sync' : 'play-arrow'}
                    size={16}
                    color={Colors.secondary}
                  />
                  <Text style={styles.testButtonText}>
                    {test.status === 'running' ? 'Running' : 'Run Test'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Maintenance Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maintenance Tools</Text>
          <View style={styles.maintenanceCard}>
            <TouchableOpacity style={styles.maintenanceButton} onPress={clearCache}>
              <Icon name="delete-sweep" size={24} color={Colors.warning} />
              <View style={styles.maintenanceButtonContent}>
                <Text style={styles.maintenanceButtonTitle}>Clear Cache</Text>
                <Text style={styles.maintenanceButtonDescription}>
                  Remove temporary files to free up space
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.maintenanceButton} onPress={optimizeDatabase}>
              <Icon name="tune" size={24} color={Colors.secondary} />
              <View style={styles.maintenanceButtonContent}>
                <Text style={styles.maintenanceButtonTitle}>Optimize Database</Text>
                <Text style={styles.maintenanceButtonDescription}>
                  Reorganize data for better performance
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.maintenanceButton}
              onPress={() => Alert.alert('Info', 'Update check would be performed here')}
            >
              <Icon name="system-update" size={24} color={Colors.success} />
              <View style={styles.maintenanceButtonContent}>
                <Text style={styles.maintenanceButtonTitle}>Check for Updates</Text>
                <Text style={styles.maintenanceButtonDescription}>
                  Check for app and system updates
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.maintenanceButton}
              onPress={() => Alert.alert('Info', 'Performance report would be generated here')}
            >
              <Icon name="assessment" size={24} color={Colors.primary} />
              <View style={styles.maintenanceButtonContent}>
                <Text style={styles.maintenanceButtonTitle}>Generate Performance Report</Text>
                <Text style={styles.maintenanceButtonDescription}>
                  Create detailed system performance report
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* System Logs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent System Logs</Text>
            <TouchableOpacity style={styles.viewLogsButton} onPress={() => setShowLogsModal(true)}>
              <Text style={styles.viewLogsText}>View All</Text>
              <Icon name="chevron-right" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.logsContainer}>
            {systemLogs.slice(0, 3).map((log) => (
              <View key={log.id} style={styles.logItem}>
                <Icon
                  name={getLogLevelIcon(log.level)}
                  size={20}
                  color={getLogLevelColor(log.level)}
                />
                <View style={styles.logContent}>
                  <Text style={styles.logMessage}>{log.message}</Text>
                  <View style={styles.logMeta}>
                    <Text style={styles.logComponent}>{log.component}</Text>
                    <Text style={styles.logTimestamp}>{log.timestamp.toLocaleTimeString()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* System Logs Modal */}
      <Modal
        visible={showLogsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLogsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>System Logs</Text>
              <TouchableOpacity onPress={() => setShowLogsModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {systemLogs.map((log) => (
                <View key={log.id} style={styles.logItemFull}>
                  <View style={styles.logHeader}>
                    <Icon
                      name={getLogLevelIcon(log.level)}
                      size={20}
                      color={getLogLevelColor(log.level)}
                    />
                    <Text style={styles.logLevel}>{log.level.toUpperCase()}</Text>
                    <Text style={styles.logTimestampFull}>
                      {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.logMessageFull}>{log.message}</Text>
                  <Text style={styles.logComponentFull}>Component: {log.component}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* System Info Modal */}
      <Modal
        visible={showSystemInfoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSystemInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>System Information</Text>
              <TouchableOpacity onPress={() => setShowSystemInfoModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {Object.entries(systemInfo).map(([key, value]) => (
                <View key={key} style={styles.infoRow}>
                  <Text style={styles.infoKey}>{key}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  infoButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  runAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  runAllButtonDisabled: {
    opacity: 0.7,
  },
  runAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.white,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    width: '47%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  metricName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  metricDescription: {
    fontSize: 11,
    color: Colors.lightText,
    lineHeight: 14,
  },
  testProgress: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  currentTestText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  testsContainer: {
    paddingHorizontal: 16,
  },
  testCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  testHeader: {
    marginBottom: 12,
  },
  testInfo: {
    flex: 1,
  },
  testTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  testStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testDescription: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  testLastRun: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.secondary,
    gap: 4,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondary,
  },
  maintenanceCard: {
    paddingHorizontal: 16,
  },
  maintenanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  maintenanceButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  maintenanceButtonTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  maintenanceButtonDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  viewLogsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewLogsText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  logsContainer: {
    paddingHorizontal: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    gap: 12,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  logMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logComponent: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '500',
  },
  logTimestamp: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  logItemFull: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  logTimestampFull: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginLeft: 'auto',
  },
  logMessageFull: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  logComponentFull: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  infoKey: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
    textAlign: 'right',
  },
});

export default SystemDiagnosticsScreen;
