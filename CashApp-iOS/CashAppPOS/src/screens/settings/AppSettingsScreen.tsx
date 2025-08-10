import { useNavigation } from '@react-navigation/native';
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

interface AppSettingsItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  status?: 'enabled' | 'disabled' | 'warning';
  isDeveloper?: boolean;
}

const AppSettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const appSettings: AppSettingsItem[] = [
    {
      id: 'menu-management',
      title: 'Menu Management',
      description: 'Categories, items, and modifiers',
      icon: 'restaurant-menu',
      route: 'SettingsMenuManagement',
      status: 'enabled',
    },
    {
      id: 'pricing-discounts',
      title: 'Pricing & Discounts',
      description: 'Price rules and promotional codes',
      icon: 'local-offer',
      route: 'PricingDiscounts',
      status: 'enabled',
    },
    {
      id: 'backup-restore',
      title: 'Backup & Restore',
      description: 'Cloud sync and local backups',
      icon: 'backup',
      route: 'BackupRestore',
      status: 'warning',
    },
    {
      id: 'data-export',
      title: 'Data Export',
      description: 'Export reports and transaction history',
      icon: 'file-download',
      route: 'DataExport',
    },
    {
      id: 'system-diagnostics',
      title: 'System Diagnostics',
      description: 'App health and performance metrics',
      icon: 'bug-report',
      route: 'SystemDiagnostics',
    },
    ...(__DEV__
      ? [
          {
            id: 'developer-settings',
            title: 'Developer Settings',
            description: 'Mock data, API toggles, and debug options',
            icon: 'developer-mode',
            route: 'DeveloperSettings',
            isDeveloper: true,
          },
        ]
      : []),
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'enabled':
        return Colors.success;
      case 'disabled':
        return Colors.danger;
      case 'warning':
        return Colors.warning;
      default:
        return Colors.mediumGray;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'enabled':
        return 'check-circle';
      case 'disabled':
        return 'cancel';
      case 'warning':
        return 'warning';
      default:
        return null;
    }
  };

  const handleSettingPress = (item: AppSettingsItem) => {
    navigation.navigate(item.route as never);
  };

  const renderSettingItem = ({ item }: { item: AppSettingsItem }) => (
    <TouchableOpacity
      style={[styles.settingCard, item.isDeveloper && styles.developerCard]}
      onPress={() => handleSettingPress(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.settingIcon,
          { backgroundColor: item.isDeveloper ? `${Colors.warning}15` : `${Colors.darkGray}15` },
        ]}
      >
        <Icon
          name={item.icon}
          size={24}
          color={item.isDeveloper ? Colors.warning : Colors.darkGray}
        />
      </View>

      <View style={styles.settingContent}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          {item.status && getStatusIcon(item.status) && (
            <Icon
              name={getStatusIcon(item.status)!}
              size={16}
              color={getStatusColor(item.status)}
            />
          )}
        </View>
        <Text style={styles.settingDescription}>{item.description}</Text>
        {item.isDeveloper && <Text style={styles.developerBadge}>Development Only</Text>}
      </View>

      <Icon name="chevron-right" size={24} color={Colors.lightGray} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.darkGray} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>App Configuration</Text>
          <Text style={styles.headerSubtitle}>Manage app settings and data</Text>
        </View>

        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* System Status */}
      <View style={styles.systemStatus}>
        <View style={styles.statusCard}>
          <Icon name="storage" size={20} color={Colors.primary} />
          <Text style={styles.statusLabel}>Storage Used</Text>
          <Text style={styles.statusValue}>2.3 GB</Text>
        </View>
        <View style={styles.statusCard}>
          <Icon name="update" size={20} color={Colors.secondary} />
          <Text style={styles.statusLabel}>Last Backup</Text>
          <Text style={styles.statusValue}>2 hours ago</Text>
        </View>
        <View style={styles.statusCard}>
          <Icon name="sync" size={20} color={Colors.warning} />
          <Text style={styles.statusLabel}>Sync Status</Text>
          <Text style={styles.statusValue}>Pending</Text>
        </View>
      </View>

      {/* App Settings List */}
      <FlatList
        data={appSettings}
        renderItem={renderSettingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="refresh" size={20} color={Colors.secondary} />
          <Text style={styles.footerButtonText}>Refresh Data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="settings-backup-restore" size={20} color={Colors.primary} />
          <Text style={styles.footerButtonText}>Backup Now</Text>
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
    backgroundColor: Colors.darkGray,
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
  systemStatus: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 4,
    textAlign: 'center',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
    textAlign: 'center',
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
  developerCard: {
    borderWidth: 1,
    borderColor: Colors.warning,
    backgroundColor: `${Colors.warning}05`,
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
  settingDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  developerBadge: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
    textTransform: 'uppercase',
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

export default AppSettingsScreen;
