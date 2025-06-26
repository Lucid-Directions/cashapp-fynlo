import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { ErrorMonitoringService, PaymentError, PaymentAttempt } from '../../services/ErrorMonitoringService';
import SumUpService from '../../services/SumUpService';

export default function DiagnosticsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiagnostics = async () => {
    try {
      setLoading(true);
      const report = await ErrorMonitoringService.generateDiagnosticReport();
      
      // Add SumUp service info
      const sumUpInfo = SumUpService.getProviderInfo();
      const isLoggedIn = await SumUpService.isLoggedIn().catch(() => false);
      const sdkVersion = await SumUpService.getSDKVersion().catch(() => null);
      
      report.systemInfo.sumUpStatus = {
        available: sumUpInfo.available,
        loggedIn: isLoggedIn,
        sdkVersion,
        apiConfigured: !!sumUpInfo.sdkVersion
      };

      setDiagnosticData(report);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      Alert.alert('Error', 'Failed to load diagnostic information');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiagnostics();
    setRefreshing(false);
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const exportDiagnostics = async () => {
    if (!diagnosticData) return;

    try {
      const report = JSON.stringify(diagnosticData, null, 2);
      await Share.share({
        message: `Payment System Diagnostics Report\n\nGenerated: ${new Date().toISOString()}\n\n${report}`,
        title: 'Payment Diagnostics Report'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export diagnostics');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'cancelled': return '#FF9800';
      case 'processing': return '#2196F3';
      default: return theme.colors.text;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#D32F2F';
      case 'high': return '#F57C00';
      case 'medium': return '#FBC02D';
      case 'low': return '#689F38';
      default: return theme.colors.text;
    }
  };

  const renderSystemStatus = () => {
    if (!diagnosticData?.systemInfo) return null;

    const { systemInfo } = diagnosticData;
    const sumUpStatus = systemInfo.sumUpStatus;

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>System Status</Text>
        
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Icon 
              name={systemInfo.networkStatus === 'connected' ? 'wifi' : 'wifi-off'} 
              size={24} 
              color={systemInfo.networkStatus === 'connected' ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[styles.statusLabel, { color: theme.colors.text }]}>Network</Text>
            <Text style={[styles.statusValue, { color: theme.colors.textSecondary }]}>
              {systemInfo.networkStatus}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Icon 
              name={sumUpStatus?.available ? 'payment' : 'payment-off'} 
              size={24} 
              color={sumUpStatus?.available ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[styles.statusLabel, { color: theme.colors.text }]}>SumUp SDK</Text>
            <Text style={[styles.statusValue, { color: theme.colors.textSecondary }]}>
              {sumUpStatus?.available ? 'Available' : 'Unavailable'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Icon 
              name={sumUpStatus?.loggedIn ? 'account-circle' : 'account-circle-off'} 
              size={24} 
              color={sumUpStatus?.loggedIn ? '#4CAF50' : '#F44336'} 
            />
            <Text style={[styles.statusLabel, { color: theme.colors.text }]}>Login Status</Text>
            <Text style={[styles.statusValue, { color: theme.colors.textSecondary }]}>
              {sumUpStatus?.loggedIn ? 'Logged In' : 'Not Logged In'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Icon 
              name="info" 
              size={24} 
              color={theme.colors.text} 
            />
            <Text style={[styles.statusLabel, { color: theme.colors.text }]}>Platform</Text>
            <Text style={[styles.statusValue, { color: theme.colors.textSecondary }]}>
              {systemInfo.platform} {systemInfo.version}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSummary = () => {
    if (!diagnosticData?.summary) return null;

    const { summary } = diagnosticData;
    const successRate = summary.totalAttempts > 0 
      ? ((summary.successfulAttempts / summary.totalAttempts) * 100).toFixed(1)
      : '0';

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Summary</Text>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
              {summary.totalAttempts}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Attempts
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
              {summary.successfulAttempts}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Successful
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#F44336' }]}>
              {summary.failedAttempts}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Failed
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
              {successRate}%
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Success Rate
            </Text>
          </View>
        </View>

        {summary.averagePaymentTime > 0 && (
          <Text style={[styles.averageTime, { color: theme.colors.textSecondary }]}>
            Average payment time: {summary.averagePaymentTime.toFixed(1)}s
          </Text>
        )}
      </View>
    );
  };

  const renderRecentErrors = () => {
    if (!diagnosticData?.recentErrors?.length) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Errors</Text>
        
        {diagnosticData.recentErrors.slice(0, 5).map((error: PaymentError) => (
          <View key={error.id} style={[styles.errorItem, { borderLeftColor: getSeverityColor(error.severity) }]}>
            <View style={styles.errorHeader}>
              <View style={styles.errorType}>
                <Icon name="error" size={16} color={getSeverityColor(error.severity)} />
                <Text style={[styles.errorTypeText, { color: theme.colors.text }]}>
                  {error.type.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.errorTime, { color: theme.colors.textSecondary }]}>
                {new Date(error.context.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            
            <Text style={[styles.errorMessage, { color: theme.colors.text }]}>
              {error.userFriendlyMessage}
            </Text>
            
            {error.retryable && (
              <Text style={[styles.errorAction, { color: theme.colors.primary }]}>
                💡 {error.suggestedAction}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderRecentAttempts = () => {
    if (!diagnosticData?.recentAttempts?.length) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Payment Attempts</Text>
        
        {diagnosticData.recentAttempts.slice(-5).reverse().map((attempt: PaymentAttempt) => (
          <View key={attempt.id} style={styles.attemptItem}>
            <View style={styles.attemptHeader}>
              <View style={styles.attemptInfo}>
                <Text style={[styles.attemptAmount, { color: theme.colors.text }]}>
                  £{attempt.amount.toFixed(2)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(attempt.status) }]}>
                  <Text style={styles.statusText}>{attempt.status}</Text>
                </View>
              </View>
              <Text style={[styles.attemptTime, { color: theme.colors.textSecondary }]}>
                {new Date(attempt.startTime).toLocaleTimeString()}
              </Text>
            </View>

            {attempt.error && (
              <Text style={[styles.attemptError, { color: '#F44336' }]}>
                Error: {attempt.error.userFriendlyMessage}
              </Text>
            )}

            <Text style={[styles.attemptSteps, { color: theme.colors.textSecondary }]}>
              {attempt.steps.length} steps • {attempt.paymentMethod}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading diagnostics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Payment Diagnostics</Text>
        <TouchableOpacity onPress={exportDiagnostics} style={styles.exportButton}>
          <Icon name="share" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderSystemStatus()}
        {renderSummary()}
        {renderRecentErrors()}
        {renderRecentAttempts()}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Session: {diagnosticData?.systemInfo?.sessionId?.slice(-8)}
          </Text>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Last updated: {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  exportButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  statusValue: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  averageTime: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorItem: {
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorTypeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  errorTime: {
    fontSize: 12,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorAction: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  attemptItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  attemptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attemptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attemptAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  attemptTime: {
    fontSize: 12,
  },
  attemptError: {
    fontSize: 12,
    marginBottom: 4,
  },
  attemptSteps: {
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
});