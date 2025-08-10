import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DataService from '../../services/DataService';

const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  danger: '#E74C3C',
  warning: '#FF6B35',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#999999',
};

const DeveloperSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const dataService = DataService.getInstance();
  const [flags, setFlags] = useState(dataService.getFeatureFlags());
  const [connectionStatus, setConnectionStatus] = useState(dataService.getConnectionStatus());

  useEffect(() => {
    // Refresh connection status every 5 seconds
    const interval = setInterval(() => {
      setConnectionStatus(dataService.getConnectionStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const toggleFlag = async (flag: keyof typeof flags) => {
    const newValue = !flags[flag];
    await dataService.updateFeatureFlag(flag, newValue);
    setFlags({ ...flags, [flag]: newValue });
    setConnectionStatus(dataService.getConnectionStatus());
  };

  const resetToMock = async () => {
    Alert.alert(
      'Reset to Mock Data',
      'This will disable all real API connections and use mock data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await dataService.resetToMockData();
            setFlags(dataService.getFeatureFlags());
            Alert.alert('Success', 'Reset to mock data mode');
          },
        },
      ]
    );
  };

  const enableRealAPI = async () => {
    Alert.alert(
      'Enable Real API',
      'This will attempt to connect to the backend server. Make sure the server is running. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            await dataService.enableRealAPI();
            setFlags(dataService.getFeatureFlags());
            setConnectionStatus(dataService.getConnectionStatus());

            if (!connectionStatus.backend) {
              Alert.alert('Warning', 'Backend server is not available. Falling back to mock data.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Developer Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Data Mode:</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    connectionStatus.mode === 'REAL' ? Colors.success : Colors.warning,
                },
              ]}
            >
              <Text style={styles.statusBadgeText}>{connectionStatus.mode}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Backend Available:</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: connectionStatus.backend ? Colors.success : Colors.danger },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {connectionStatus.backend ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusHint}>
            {connectionStatus.backend
              ? 'Backend server is running at http://localhost:8000'
              : 'Backend server is not available. Using mock data.'}
          </Text>
        </View>

        {/* Feature Flags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Flags</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Use Real API</Text>
              <Text style={styles.settingDescription}>
                Connect to backend server instead of mock data
              </Text>
            </View>
            <Switch
              value={flags.USE_REAL_API}
              onValueChange={() => toggleFlag('USE_REAL_API')}
              trackColor={{ false: Colors.lightGray, true: Colors.success }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Payments</Text>
              <Text style={styles.settingDescription}>
                Process real payments (requires payment SDK)
              </Text>
            </View>
            <Switch
              value={flags.ENABLE_PAYMENTS}
              onValueChange={() => toggleFlag('ENABLE_PAYMENTS')}
              trackColor={{ false: Colors.lightGray, true: Colors.success }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Hardware</Text>
              <Text style={styles.settingDescription}>
                Connect to printers, cash drawers, scanners
              </Text>
            </View>
            <Switch
              value={flags.ENABLE_HARDWARE}
              onValueChange={() => toggleFlag('ENABLE_HARDWARE')}
              trackColor={{ false: Colors.lightGray, true: Colors.success }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Mock Authentication</Text>
              <Text style={styles.settingDescription}>
                Use demo accounts (demo/demo, manager/manager)
              </Text>
            </View>
            <Switch
              value={flags.MOCK_AUTHENTICATION}
              onValueChange={() => toggleFlag('MOCK_AUTHENTICATION')}
              trackColor={{ false: Colors.lightGray, true: Colors.success }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.warning }]}
            onPress={resetToMock}
          >
            <Icon name="refresh" size={20} color={Colors.white} />
            <Text style={styles.actionButtonText}>Reset to Mock Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.success }]}
            onPress={enableRealAPI}
          >
            <Icon name="cloud-upload" size={20} color={Colors.white} />
            <Text style={styles.actionButtonText}>Enable Real API</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Icon name="info" size={24} color={Colors.secondary} />
          <Text style={styles.infoText}>
            Developer settings allow you to switch between mock data (for demos) and real API
            connections. Changes take effect immediately. Mock data provides a beautiful showcase
            experience, while real API connects to your backend server.
          </Text>
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
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  statusHint: {
    fontSize: 14,
    color: Colors.lightText,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  settingRow: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.secondary,
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default DeveloperSettingsScreen;
