import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

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

const SystemMonitoringScreen: React.FC = () => {
  const navigation = useNavigation();
  const [selectedTab, setSelectedTab] = useState<'health' | 'errors' | 'incidents'>('health');

  const handleMonitoringAction = (action: string) => {
    Alert.alert('System Monitoring', `${action} functionality will be implemented in Phase 3`);
  };

  const systemHealthData = [
    { name: 'API Response Time', value: '125ms', status: 'good', icon: 'speed' },
    { name: 'Database Performance', value: '98.9%', status: 'good', icon: 'storage' },
    { name: 'Payment Gateway', value: '99.8%', status: 'good', icon: 'payment' },
    { name: 'Network Latency', value: '45ms', status: 'warning', icon: 'network-check' },
  ];

  const recentErrors = [
    { id: 1, type: 'Payment', message: 'Card reader timeout - Fynlo Fine Dining', time: '2 min ago', severity: 'high' },
    { id: 2, type: 'Network', message: 'Connection timeout - Fynlo Pizza Palace', time: '15 min ago', severity: 'medium' },
    { id: 3, type: 'System', message: 'Database slow query warning', time: '1 hour ago', severity: 'low' },
  ];

  const activeIncidents = [
    { id: 1, title: 'Payment Processing Delay', status: 'investigating', affected: 3, created: '30 min ago' },
    { id: 2, title: 'Network Connectivity Issues', status: 'monitoring', affected: 1, created: '2 hours ago' },
  ];

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
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PlatformDashboard' as never)}
          >
            <Icon name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>System Monitoring</Text>
            <Text style={styles.headerSubtitle}>Real-time platform health</Text>
          </View>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSelector}>
        {[
          { key: 'health', label: 'System Health', badge: null },
          { key: 'errors', label: 'Errors', badge: 3 },
          { key: 'incidents', label: 'Incidents', badge: 2 },
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
            {tab.badge && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedTab === 'health' && (
          <>
            {/* System Health Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System Health</Text>
              <View style={styles.healthGrid}>
                {systemHealthData.map((item, index) => (
                  <View key={index} style={styles.healthCard}>
                    <View style={styles.healthHeader}>
                      <Icon name={item.icon} size={24} color={getStatusColor(item.status)} />
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    </View>
                    <Text style={styles.healthValue}>{item.value}</Text>
                    <Text style={styles.healthLabel}>{item.name}</Text>
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
                    <Text style={styles.metricValue}>99.9%</Text>
                    <Text style={styles.metricLabel}>Uptime (30 days)</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>2.3M</Text>
                    <Text style={styles.metricLabel}>Requests/day</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>0.01%</Text>
                    <Text style={styles.metricLabel}>Error Rate</Text>
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
              <View key={error.id} style={styles.errorCard}>
                <View style={styles.errorHeader}>
                  <View style={styles.errorInfo}>
                    <View style={styles.errorTypeRow}>
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(error.severity) }]}>
                        <Text style={styles.severityText}>{error.severity.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.errorType}>{error.type}</Text>
                    </View>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    <Text style={styles.errorTime}>{error.time}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleMonitoringAction('View Error Details')}>
                    <Icon name="chevron-right" size={20} color={Colors.mediumGray} />
                  </TouchableOpacity>
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
                  <Text style={styles.incidentInfo}>{incident.affected} restaurants affected</Text>
                  <Text style={styles.incidentTime}>Created {incident.created}</Text>
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
                    onPress={() => handleMonitoringAction('Update Incident')}
                  >
                    <Text style={styles.incidentButtonText}>Update Status</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.createIncidentButton}
              onPress={() => handleMonitoringAction('Create Incident')}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginRight: 12,
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