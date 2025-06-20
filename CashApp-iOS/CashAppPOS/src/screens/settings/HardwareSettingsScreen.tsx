import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
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

interface HardwareSettingsItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  status?: 'connected' | 'disconnected' | 'warning';
  connectionInfo?: string;
}

const HardwareSettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const hardwareSettings: HardwareSettingsItem[] = [
    {
      id: 'printer-setup',
      title: 'Printer Setup',
      description: 'Receipt and kitchen printer configuration',
      icon: 'print',
      route: 'PrinterSetup',
      status: 'connected',
      connectionInfo: 'Epson TM-T88V connected',
    },
    {
      id: 'cash-drawer',
      title: 'Cash Drawer',
      description: 'Drawer kick settings and security',
      icon: 'inventory-2',
      route: 'CashDrawer',
      status: 'connected',
      connectionInfo: 'Connected via printer',
    },
    {
      id: 'barcode-scanner',
      title: 'Barcode Scanner',
      description: 'Scanner configuration and test scans',
      icon: 'qr-code-scanner',
      route: 'BarcodeScanner',
      status: 'warning',
      connectionInfo: 'USB scanner detected',
    },
    {
      id: 'card-reader',
      title: 'Card Reader',
      description: 'Payment terminal setup and testing',
      icon: 'credit-card',
      route: 'CardReader',
      status: 'disconnected',
      connectionInfo: 'No card reader detected',
    },
    {
      id: 'hardware-diagnostics',
      title: 'Hardware Diagnostics',
      description: 'Device connectivity and status monitoring',
      icon: 'computer',
      route: 'HardwareDiagnostics',
    },
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected':
        return Colors.success;
      case 'disconnected':
        return Colors.danger;
      case 'warning':
        return Colors.warning;
      default:
        return Colors.mediumGray;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'connected':
        return 'wifi';
      case 'disconnected':
        return 'wifi-off';
      case 'warning':
        return 'warning';
      default:
        return 'help-outline';
    }
  };

  const handleSettingPress = (item: HardwareSettingsItem) => {
    navigation.navigate(item.route as never);
  };

  const renderSettingItem = ({ item }: { item: HardwareSettingsItem }) => (
    <TouchableOpacity
      style={styles.settingCard}
      onPress={() => handleSettingPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${Colors.secondary}15` }]}>
        <Icon name={item.icon} size={24} color={Colors.secondary} />
      </View>
      
      <View style={styles.settingContent}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          {item.status && (
            <View style={styles.statusIndicator}>
              <Icon 
                name={getStatusIcon(item.status)} 
                size={16} 
                color={getStatusColor(item.status)} 
              />
            </View>
          )}
        </View>
        <Text style={styles.settingDescription}>{item.description}</Text>
        {item.connectionInfo && (
          <Text style={[styles.connectionInfo, { color: getStatusColor(item.status) }]}>
            {item.connectionInfo}
          </Text>
        )}
      </View>
      
      <Icon name="chevron-right" size={24} color={Colors.lightGray} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.secondary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Hardware Configuration</Text>
          <Text style={styles.headerSubtitle}>Manage connected devices</Text>
        </View>
        
        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Hardware Status Summary */}
      <View style={styles.statusSummary}>
        <View style={styles.statusItem}>
          <Icon name="check-circle" size={16} color={Colors.success} />
          <Text style={styles.statusText}>2 Connected</Text>
        </View>
        <View style={styles.statusItem}>
          <Icon name="warning" size={16} color={Colors.warning} />
          <Text style={styles.statusText}>1 Warning</Text>
        </View>
        <View style={styles.statusItem}>
          <Icon name="error" size={16} color={Colors.danger} />
          <Text style={styles.statusText}>1 Disconnected</Text>
        </View>
      </View>

      {/* Hardware Settings List */}
      <FlatList
        data={hardwareSettings}
        renderItem={renderSettingItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="refresh" size={20} color={Colors.secondary} />
          <Text style={styles.footerButtonText}>Scan for Devices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="computer" size={20} color={Colors.secondary} />
          <Text style={styles.footerButtonText}>Run Diagnostics</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  helpButton: {
    padding: 8,
  },
  statusSummary: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  settingsList: {
    padding: 16,
  },
  settingCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  connectionInfo: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    gap: 8,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondary,
  },
});

export default HardwareSettingsScreen;