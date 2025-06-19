import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MonitoringService, SystemHealth, ErrorLog, Incident, PerformanceMetrics } from '../../services/MonitoringService';

// Fynlo POS Color Scheme
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

const SystemMonitoringScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'health' | 'errors' | 'incidents'>('health');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const monitoringService = MonitoringService.getInstance();
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    loadMonitoringData();
    setupRealTimeUpdates();

    return () => {
      // Cleanup subscriptions
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      const [health, errors, incidents, performance] = await Promise.all([
        monitoringService.getSystemHealth(),
        monitoringService.getRecentErrors(10),
        monitoringService.getActiveIncidents(),
        monitoringService.getPerformanceMetrics(),
      ]);

      setSystemHealth(health);
      setRecentErrors(errors);
      setActiveIncidents(incidents);
      setPerformanceMetrics(performance);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
      Alert.alert('Error', 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeUpdates = () => {
    // Subscribe to real-time updates
    const healthUnsubscribe = monitoringService.subscribe('health-updated', (health: SystemHealth) => {
      setSystemHealth(health);
    });

    const errorUnsubscribe = monitoringService.subscribe('error-created', (error: ErrorLog) => {
      setRecentErrors(prev => [error, ...prev.slice(0, 9)]);
    });

    const incidentUnsubscribe = monitoringService.subscribe('incident-updated', (incident: Incident) => {
      setActiveIncidents(prev => 
        prev.map(i => i.id === incident.id ? incident : i)
      );
    });

    const performanceUnsubscribe = monitoringService.subscribe('performance-updated', (performance: PerformanceMetrics) => {
      setPerformanceMetrics(performance);
    });

    unsubscribeRefs.current = [healthUnsubscribe, errorUnsubscribe, incidentUnsubscribe, performanceUnsubscribe];
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMonitoringData();
    setRefreshing(false);
  };

  const handleCreateIncident = () => {
    Alert.prompt(
      'Create Incident',
      'Enter incident title:',
      async (title) => {
        if (title) {
          try {
            const incident = await monitoringService.createIncident(
              title,
              'New incident created from monitoring dashboard',
              'medium',
              ['1', '2']
            );
            setActiveIncidents(prev => [incident, ...prev]);
            Alert.alert('Success', 'Incident created successfully');
          } catch (error) {
            Alert.alert('Error', 'Failed to create incident');
          }
        }
      }
    );
  };

  const handleUpdateIncident = (incident: Incident) => {
    const statusOptions = ['investigating', 'monitoring', 'resolved', 'closed'];
    
    Alert.alert(
      'Update Incident',
      'Choose new status:',
      statusOptions.map(status => ({
        text: status.charAt(0).toUpperCase() + status.slice(1),
        onPress: async () => {
          try {
            await monitoringService.updateIncidentStatus(incident.id, status as any);
            Alert.alert('Success', 'Incident status updated');
          } catch (error) {
            Alert.alert('Error', 'Failed to update incident');
          }
        },
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const handleResolveError = async (errorId: string) => {
    try {
      await monitoringService.resolveError(errorId);
      setRecentErrors(prev => 
        prev.map(error => error.id === errorId ? { ...error, resolved: true } : error)
      );
      Alert.alert('Success', 'Error marked as resolved');
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve error');
    }
  };

  const handleMonitoringAction = (action: string) => {
    switch (action) {
      case 'Real-time Logs':
        Alert.alert('Real-time Logs', 'Opening system logs dashboard...');
        break;
      case 'Performance Dashboard':
        Alert.alert('Performance Dashboard', 'Opening detailed performance metrics...');
        break;
      case 'Alert Rules':
        Alert.alert('Alert Rules', 'Opening alert configuration...');
        break;
      case 'System Diagnostics':
        Alert.alert('Diagnostics', 'Running system diagnostics...');
        break;
      case 'View Error Details':
        Alert.alert('Error Details', 'Opening detailed error information...');
        break;
      case 'View All Errors':
        Alert.alert('All Errors', 'Opening error log viewer...');
        break;
      default:
        Alert.alert('Monitoring', `${action} functionality available`);
    }
  };

  if (loading && !systemHealth) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading monitoring data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return Colors.success;
      case 'warning': return Colors.warning;
      case 'error': return Colors.danger;
      default: return Colors.mediumGray;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return Colors.danger;
      case 'medium': return Colors.warning;
      case 'low': return Colors.secondary;
      default: return Colors.mediumGray;
    }
  };

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'investigating': return Colors.warning;
      case 'monitoring': return Colors.secondary;
      case 'resolved': return Colors.success;
      default: return Colors.mediumGray;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>System Monitoring</Text>
          <Text style={styles.headerSubtitle}>Real-time platform health</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSelector}>
        {[
          { key: 'health', label: 'System Health', badge: null },
          { key: 'errors', label: 'Errors', badge: recentErrors.filter(e => !e.resolved).length || 0 },
          { key: 'incidents', label: 'Incidents', badge: activeIncidents.length || 0 },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              selectedTab === tab.key && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text style={[
              styles.tabButtonText,
              selectedTab === tab.key && styles.tabButtonTextActive
            ]}>
              {tab.label}
            </Text>
            {tab.badge !== null && tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {selectedTab === 'health' && (
          <>
            {/* System Health Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System Health</Text>
              <View style={styles.healthGrid}>
                {systemHealth && Object.values(systemHealth).map((item, index) => (
                  <View key={index} style={styles.healthCard}>
                    <View style={styles.healthHeader}>
                      <Icon name={item.icon} size={24} color={getStatusColor(item.status)} />
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    </View>
                    <Text style={styles.healthValue}>{item.value || 'N/A'}</Text>
                    <Text style={styles.healthLabel}>{item.name || 'Unknown'}</Text>
                    <Text style={[styles.trendText, { color: (item.trend || 0) > 0 ? Colors.danger : Colors.success }]}>
                      {(item.trend || 0) > 0 ? '+' : ''}{(item.trend || 0).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Performance Metrics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Metrics</Text>
              <View style={styles.card}>
                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics?.uptime?.toFixed(1) || '0'}%</Text>
                    <Text style={styles.metricLabel}>Uptime (30 days)</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics ? (performanceMetrics.requestsPerDay / 1000000).toFixed(1) : '0'}M</Text>
                    <Text style={styles.metricLabel}>Requests/day</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics?.errorRate?.toFixed(2) || '0'}%</Text>
                    <Text style={styles.metricLabel}>Error Rate</Text>
                  </View>
                </View>
                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics?.avgResponseTime?.toFixed(0) || '0'}ms</Text>
                    <Text style={styles.metricLabel}>Avg Response</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics?.memoryUsage?.toFixed(1) || '0'}%</Text>
                    <Text style={styles.metricLabel}>Memory Usage</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{performanceMetrics?.cpuUsage?.toFixed(1) || '0'}%</Text>
                    <Text style={styles.metricLabel}>CPU Usage</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {selectedTab === 'errors' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Errors</Text>
            {recentErrors.map((error) => (
              <View key={error.id} style={[styles.errorCard, error.resolved && styles.resolvedError]}>
                <View style={styles.errorHeader}>
                  <View style={styles.errorInfo}>
                    <View style={styles.errorTypeRow}>
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(error.severity) }]}>
                        <Text style={styles.severityText}>{error.severity.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.errorType}>{error.type}</Text>
                      {error.resolved && (
                        <View style={styles.resolvedBadge}>
                          <Text style={styles.resolvedText}>RESOLVED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    <Text style={styles.errorTime}>
                      {error.restaurantName ? `${error.restaurantName} • ` : ''}
                      {error.timestamp ? new Date(error.timestamp).toLocaleTimeString() : 'Unknown time'}
                    </Text>
                  </View>
                  <View style={styles.errorActions}>
                    {!error.resolved && (
                      <TouchableOpacity onPress={() => handleResolveError(error.id)} style={styles.resolveButton}>
                        <Icon name="check" size={16} color={Colors.success} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleMonitoringAction('View Error Details')}>
                      <Icon name="chevron-right" size={20} color={Colors.mediumGray} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => handleMonitoringAction('View All Errors')}
            >
              <Text style={styles.viewAllButtonText}>View All Errors</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedTab === 'incidents' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Incidents</Text>
            {activeIncidents.map((incident) => (
              <View key={incident.id} style={styles.incidentCard}>
                <View style={styles.incidentHeader}>
                  <Text style={styles.incidentTitle}>{incident.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getIncidentStatusColor(incident.status) }]}>
                    <Text style={styles.statusText}>{incident.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.incidentDetails}>
                  <Text style={styles.incidentInfo}>
                    {incident.affectedRestaurants.length} restaurants affected
                  </Text>
                  <Text style={styles.incidentTime}>
                    Created {incident.createdAt ? new Date(incident.createdAt).toLocaleString() : 'Unknown date'}
                  </Text>
                  {incident.description && (
                    <Text style={styles.incidentDescription}>{incident.description}</Text>
                  )}
                </View>
                <View style={styles.incidentActions}>
                  <TouchableOpacity
                    style={styles.incidentButton}
                    onPress={() => handleMonitoringAction('View Incident')}
                  >
                    <Text style={styles.incidentButtonText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.incidentButton}
                    onPress={() => handleUpdateIncident(incident)}
                  >
                    <Text style={styles.incidentButtonText}>Update Status</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.createIncidentButton}
              onPress={handleCreateIncident}
            >
              <Icon name="add" size={20} color={Colors.white} />
              <Text style={styles.createIncidentButtonText}>Create Incident</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Monitoring Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monitoring Tools</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleMonitoringAction('Real-time Logs')}
            >
              <Icon name="article" size={32} color={Colors.primary} />
              <Text style={styles.toolText}>Real-time Logs</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleMonitoringAction('Performance Dashboard')}
            >
              <Icon name="dashboard" size={32} color={Colors.secondary} />
              <Text style={styles.toolText}>Performance Dashboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleMonitoringAction('Alert Rules')}
            >
              <Icon name="notifications-active" size={32} color={Colors.warning} />
              <Text style={styles.toolText}>Alert Rules</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleMonitoringAction('System Diagnostics')}
            >
              <Icon name="bug-report" size={32} color={Colors.danger} />
              <Text style={styles.toolText}>Diagnostics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  tabButtonTextActive: {
    color: Colors.white,
  },
  tabBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  tabBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  healthCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  healthLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resolvedError: {
    opacity: 0.6,
  },
  resolvedBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  resolvedText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resolveButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: Colors.background,
  },
  errorInfo: {
    flex: 1,
  },
  errorTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  severityText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorType: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  errorTime: {
    fontSize: 12,
    color: Colors.lightText,
  },
  viewAllButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  viewAllButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  incidentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  incidentDetails: {
    marginBottom: 12,
  },
  incidentInfo: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  incidentTime: {
    fontSize: 12,
    color: Colors.lightText,
  },
  incidentDescription: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
    fontStyle: 'italic',
  },
  incidentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  incidentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  incidentButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  createIncidentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  createIncidentButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SystemMonitoringScreen;