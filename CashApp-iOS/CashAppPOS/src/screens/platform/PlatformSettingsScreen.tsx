import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const PlatformSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const settingSections: SettingSection[] = [
    {
      id: 'payment_fees',
      title: 'Payment Processing',
      description: 'SumUp Primary (0.69%) • Configure payment fees and processing',
      icon: 'account-balance-wallet',
      color: '#00D4AA',
      onPress: () => {
        navigation.navigate('PaymentProcessing' as never);
      },
    },
    {
      id: 'commission',
      title: 'Commission Structure',
      description: 'Set platform commission rates and fee structures',
      icon: 'trending-up',
      color: theme.colors.warning,
      onPress: () => {
        navigation.navigate('CommissionStructure' as never);
      },
    },
    {
      id: 'restaurant_limits',
      title: 'Restaurant Limits',
      description: 'Configure transaction limits and restrictions',
      icon: 'policy',
      color: theme.colors.secondary,
      onPress: () => {
        Alert.alert(
          'Restaurant Limits',
          'Configure platform-wide limits:\n\nDaily Transaction Limit: £10,000\nMaximum Items per Order: 50\nRefund Time Limit: 30 days',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'tax_settings',
      title: 'Tax Configuration',
      description: 'Platform-wide tax settings and compliance',
      icon: 'receipt',
      color: theme.colors.text,
      onPress: () => {
        Alert.alert(
          'Tax Configuration',
          'Platform tax settings:\n\nVAT Rate: 20%\nService Charge: Platform Controlled\nTax Reporting: Automated\n\nRestaurants cannot modify these settings.',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'compliance',
      title: 'Compliance & Security',
      description: 'Security policies and compliance settings',
      icon: 'security',
      color: theme.colors.danger,
      onPress: () => {
        Alert.alert(
          'Compliance & Security',
          'Security settings:\n\nPCI DSS Compliance: Enabled\nData Encryption: AES-256\nAudit Logging: All Transactions\nAccess Control: Role-based',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'notifications',
      title: 'Platform Notifications',
      description: 'Configure system-wide notification settings',
      icon: 'notifications',
      color: theme.colors.primary,
      onPress: () => {
        Alert.alert(
          'Platform Notifications',
          'Notification settings:\n\nSystem Alerts: Enabled\nPayment Failures: Immediate\nDaily Reports: 9:00 AM\nMaintenance Windows: 24h notice',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'integrations',
      title: 'Third-party Integrations',
      description: 'Manage external service integrations',
      icon: 'extension',
      color: theme.colors.secondary,
      onPress: () => {
        Alert.alert(
          'Third-party Integrations',
          'Available integrations:\n\n✓ Stripe Payment Processing\n✓ QuickBooks Accounting\n✓ Mailchimp Marketing\n✓ Twilio SMS Service',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'backup',
      title: 'Data Management',
      description: 'Backup, recovery, and data retention policies',
      icon: 'backup',
      color: theme.colors.mediumGray,
      onPress: () => {
        Alert.alert(
          'Data Management',
          'Data management settings:\n\nBackup Frequency: Daily\nRetention Period: 7 years\nData Export: Available\nGDPR Compliance: Enabled',
          [{ text: 'OK' }]
        );
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Platform Settings</Text>
          <Text style={styles.headerSubtitle}>
            Configure platform-wide settings and policies
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Settings Sections */}
        {settingSections.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={styles.settingCard}
            onPress={section.onPress}
          >
            <View style={styles.settingIconContainer}>
              <Icon name={section.icon} size={24} color={section.color} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{section.title}</Text>
              <Text style={styles.settingDescription}>{section.description}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={theme.colors.mediumGray} />
          </TouchableOpacity>
        ))}

        {/* Platform Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Platform Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform Version:</Text>
              <Text style={styles.infoValue}>v2.1.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated:</Text>
              <Text style={styles.infoValue}>Today, 2:30 PM</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Active Restaurants:</Text>
              <Text style={styles.infoValue}>42</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>System Status:</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.infoValue, { color: theme.colors.success }]}>Operational</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    lineHeight: 20,
  },
  infoSection: {
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.lightText,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
});

export default PlatformSettingsScreen;