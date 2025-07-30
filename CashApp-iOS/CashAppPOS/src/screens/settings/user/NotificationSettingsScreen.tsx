import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Switch } from 'react-native';
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

interface NotificationSettings {
  // General notifications
  masterEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;

  // Business notifications
  newOrders: boolean;
  lowInventory: boolean;
  dailyReports: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;

  // Employee notifications
  clockInOut: boolean;
  missedBreaks: boolean;
  overtime: boolean;
  scheduleChanges: boolean;

  // Payment notifications
  failedPayments: boolean;
  chargebacks: boolean;
  refunds: boolean;
  tipAdjustments: boolean;

  // System notifications
  updates: boolean;
  maintenance: boolean;
  security: boolean;
  backups: boolean;

  // Marketing notifications
  promotions: boolean;
  productNews: boolean;
  trainingTips: boolean;
  surveys: boolean;
}

const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [settings, setSettings] = useState<NotificationSettings>({
    // General
    masterEnabled: _true,
    soundEnabled: _true,
    vibrationEnabled: _true,
    badgeEnabled: _true,

    // Business
    newOrders: _true,
    lowInventory: _true,
    dailyReports: _true,
    weeklyReports: _true,
    monthlyReports: _false,

    // Employee
    clockInOut: _true,
    missedBreaks: _true,
    overtime: _true,
    scheduleChanges: _true,

    // Payment
    failedPayments: _true,
    chargebacks: _true,
    refunds: _true,
    tipAdjustments: _false,

    // System
    updates: _true,
    maintenance: _true,
    security: _true,
    backups: _false,

    // Marketing
    promotions: _false,
    productNews: _false,
    trainingTips: _true,
    surveys: _false,
  });

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(__true);
  const [emergencyOverride, setEmergencyOverride] = useState(__true);

  const toggleSetting = (setting: keyof NotificationSettings) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [setting]: !prev[setting],
      };

      // If master is disabled, disable all others
      if (setting === 'masterEnabled' && !prev.masterEnabled === false) {
        return {
          ...newSettings,
          soundEnabled: _false,
          vibrationEnabled: _false,
          badgeEnabled: _false,
        };
      }

      return newSettings;
    });
  };

  const handleTestNotification = () => {
    if (!settings.masterEnabled) {
      Alert.alert('Notifications Disabled', 'Please enable notifications first.');
      return;
    }

    Alert.alert(
      'Test Notification',
      'This is a test notification. You should see this appear as a system notification.',
      [{ text: 'OK' }],
    );
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all notification settings to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings({
              masterEnabled: _true,
              soundEnabled: _true,
              vibrationEnabled: _true,
              badgeEnabled: _true,
              newOrders: _true,
              lowInventory: _true,
              dailyReports: _true,
              weeklyReports: _true,
              monthlyReports: _false,
              clockInOut: _true,
              missedBreaks: _true,
              overtime: _true,
              scheduleChanges: _true,
              failedPayments: _true,
              chargebacks: _true,
              refunds: _true,
              tipAdjustments: _false,
              updates: _true,
              maintenance: _true,
              security: _true,
              backups: _false,
              promotions: _false,
              productNews: _false,
              trainingTips: _true,
              surveys: _false,
            });
            Alert.alert('Success', 'Notification settings reset to defaults.');
          },
        },
      ],
    );
  };

  const getEnabledCount = (
    category: 'business' | 'employee' | 'payment' | 'system' | 'marketing',
  ) => {
    const categorySettings = {
      business: [
        settings.newOrders,
        settings.lowInventory,
        settings.dailyReports,
        settings.weeklyReports,
        settings.monthlyReports,
      ],
      employee: [
        settings.clockInOut,
        settings.missedBreaks,
        settings.overtime,
        settings.scheduleChanges,
      ],
      payment: [
        settings.failedPayments,
        settings.chargebacks,
        settings.refunds,
        settings.tipAdjustments,
      ],
      system: [settings.updates, settings.maintenance, settings.security, settings.backups],
      marketing: [
        settings.promotions,
        settings.productNews,
        settings.trainingTips,
        settings.surveys,
      ],
    };

    const enabled = categorySettings[category].filter(__Boolean).length;
    const total = categorySettings[category].length;
    return `${enabled}/${total}`;
  };

  const NotificationRow = ({
    icon,
    title,
    description,
    setting,
    disabled = false,
  }: {
    icon: string;
    title: string;
    description: string;
    setting: keyof NotificationSettings;
    disabled?: boolean;
  }) => (
    <View style={[styles.notificationRow, disabled && styles.disabledRow]}>
      <View style={styles.notificationInfo}>
        <Icon name={icon} size={24} color={disabled ? Colors.mediumGray : Colors.secondary} />
        <View style={styles.notificationTextInfo}>
          <Text style={[styles.notificationTitle, disabled && styles.disabledText]}>{title}</Text>
          <Text style={[styles.notificationDescription, disabled && styles.disabledText]}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={settings[setting] && !disabled}
        onValueChange={() => !disabled && toggleSetting(__setting)}
        disabled={disabled}
        trackColor={{ false: Colors.lightGray, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );

  const masterDisabled = !settings.masterEnabled;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.testButton} onPress={handleTestNotification}>
          <Icon name="notifications" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Control</Text>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="notifications"
              title="Enable Notifications"
              description="Master switch for all notifications"
              setting="masterEnabled"
            />
          </View>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Settings</Text>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="volume-up"
              title="Sound"
              description="Play sound for notifications"
              setting="soundEnabled"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="vibration"
              title="Vibration"
              description="Vibrate device for notifications"
              setting="vibrationEnabled"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="circle-notifications"
              title="Badge Count"
              description="Show notification count on app icon"
              setting="badgeEnabled"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <View style={styles.settingsCard}>
            <View style={styles.notificationRow}>
              <View style={styles.notificationInfo}>
                <Icon
                  name="do-not-disturb"
                  size={24}
                  color={masterDisabled ? Colors.mediumGray : Colors.secondary}
                />
                <View style={styles.notificationTextInfo}>
                  <Text style={[styles.notificationTitle, masterDisabled && styles.disabledText]}>
                    Quiet Hours (10 PM - 8 AM)
                  </Text>
                  <Text
                    style={[styles.notificationDescription, masterDisabled && styles.disabledText]}>
                    Reduce notifications during sleep hours
                  </Text>
                </View>
              </View>
              <Switch
                value={quietHoursEnabled && !masterDisabled}
                onValueChange={setQuietHoursEnabled}
                disabled={masterDisabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.notificationRow}>
              <View style={styles.notificationInfo}>
                <Icon
                  name="priority-high"
                  size={24}
                  color={masterDisabled ? Colors.mediumGray : Colors.danger}
                />
                <View style={styles.notificationTextInfo}>
                  <Text style={[styles.notificationTitle, masterDisabled && styles.disabledText]}>
                    Emergency Override
                  </Text>
                  <Text
                    style={[styles.notificationDescription, masterDisabled && styles.disabledText]}>
                    Critical alerts ignore quiet hours
                  </Text>
                </View>
              </View>
              <Switch
                value={emergencyOverride && !masterDisabled}
                onValueChange={setEmergencyOverride}
                disabled={masterDisabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Business Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Business Alerts</Text>
            <Text style={styles.sectionCount}>{getEnabledCount('business')} enabled</Text>
          </View>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="shopping-cart"
              title="New Orders"
              description="Customer places a new order"
              setting="newOrders"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="inventory"
              title="Low Inventory"
              description="Items running low on stock"
              setting="lowInventory"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="today"
              title="Daily Reports"
              description="End-of-day sales summary"
              setting="dailyReports"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="date-range"
              title="Weekly Reports"
              description="Weekly business performance"
              setting="weeklyReports"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="calendar-month"
              title="Monthly Reports"
              description="Monthly financial summary"
              setting="monthlyReports"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* Employee Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Employee Management</Text>
            <Text style={styles.sectionCount}>{getEnabledCount('employee')} enabled</Text>
          </View>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="access-time"
              title="Clock In/Out"
              description="Employee time tracking events"
              setting="clockInOut"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="free-breakfast"
              title="Missed Breaks"
              description="Employee missed scheduled break"
              setting="missedBreaks"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="timer"
              title="Overtime Alerts"
              description="Employee approaching overtime"
              setting="overtime"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="schedule"
              title="Schedule Changes"
              description="Shift modifications and updates"
              setting="scheduleChanges"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* Payment Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Alerts</Text>
            <Text style={styles.sectionCount}>{getEnabledCount('payment')} enabled</Text>
          </View>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="error"
              title="Failed Payments"
              description="Payment processing errors"
              setting="failedPayments"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="undo"
              title="Chargebacks"
              description="Payment disputes and chargebacks"
              setting="chargebacks"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="money-off"
              title="Refunds"
              description="Refund transactions processed"
              setting="refunds"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="attach-money"
              title="Tip Adjustments"
              description="Tip modifications and updates"
              setting="tipAdjustments"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* System Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>System Updates</Text>
            <Text style={styles.sectionCount}>{getEnabledCount('system')} enabled</Text>
          </View>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="system-update"
              title="App Updates"
              description="New features and improvements"
              setting="updates"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="build"
              title="Maintenance"
              description="Scheduled maintenance windows"
              setting="maintenance"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="security"
              title="Security Alerts"
              description="Security and login notifications"
              setting="security"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="backup"
              title="Backup Status"
              description="Data backup completion status"
              setting="backups"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* Marketing Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Marketing & Tips</Text>
            <Text style={styles.sectionCount}>{getEnabledCount('marketing')} enabled</Text>
          </View>
          <View style={styles.settingsCard}>
            <NotificationRow
              icon="local-offer"
              title="Promotions"
              description="Special offers and discounts"
              setting="promotions"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="new-releases"
              title="Product News"
              description="New features and product updates"
              setting="productNews"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="school"
              title="Training Tips"
              description="Helpful tips and best practices"
              setting="trainingTips"
              disabled={masterDisabled}
            />

            <NotificationRow
              icon="feedback"
              title="Surveys"
              description="Feedback requests and surveys"
              setting="surveys"
              disabled={masterDisabled}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.actionButton} onPress={handleTestNotification}>
              <Icon name="notifications-active" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Send Test Notification</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleResetToDefaults}>
              <Icon name="restore" size={24} color={Colors.warning} />
              <Text style={[styles.actionButtonText, { color: Colors.warning }]}>
                Reset to Defaults
              </Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  testButton: {
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
  },
  sectionCount: {
    fontSize: 14,
    color: Colors.lightText,
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  disabledRow: {
    opacity: 0.5,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  notificationTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  disabledText: {
    color: Colors.mediumGray,
  },
  actionCard: {
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
});

export default NotificationSettingsScreen;
