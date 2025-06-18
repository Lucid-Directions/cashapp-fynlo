import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useAppStore from '../../store/useAppStore';
import Logo from '../../components/Logo';

const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  success: '#27AE60',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

const SettingsScreen: React.FC = () => {
  const { logout } = useAppStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout 
        },
      ]
    );
  };

  const SettingItem = ({ 
    title, 
    icon, 
    onPress, 
    showArrow = true,
    color = Colors.text,
  }: {
    title: string;
    icon: string;
    onPress?: () => void;
    showArrow?: boolean;
    color?: string;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={color} />
        <Text style={[styles.settingTitle, { color }]}>{title}</Text>
      </View>
      {showArrow && (
        <Icon name="chevron-right" size={24} color={Colors.lightText} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Notifications"
              icon="notifications"
              onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available soon')}
            />
            <SettingItem
              title="Display"
              icon="display-settings"
              onPress={() => Alert.alert('Coming Soon', 'Display settings will be available soon')}
            />
            <SettingItem
              title="Language"
              icon="language"
              onPress={() => Alert.alert('Coming Soon', 'Language settings will be available soon')}
            />
          </View>
        </View>

        {/* POS Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Point of Sale</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Payment Methods"
              icon="payment"
              onPress={() => Alert.alert('Coming Soon', 'Payment method settings will be available soon')}
            />
            <SettingItem
              title="Receipt Settings"
              icon="receipt"
              onPress={() => Alert.alert('Coming Soon', 'Receipt settings will be available soon')}
            />
            <SettingItem
              title="Tax Settings"
              icon="calculate"
              onPress={() => Alert.alert('Coming Soon', 'Tax settings will be available soon')}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Privacy Policy"
              icon="privacy-tip"
              onPress={() => Alert.alert('Coming Soon', 'Privacy policy will be available soon')}
            />
            <SettingItem
              title="Terms of Service"
              icon="article"
              onPress={() => Alert.alert('Coming Soon', 'Terms of service will be available soon')}
            />
            <SettingItem
              title="Help & Support"
              icon="help"
              onPress={() => Alert.alert('Coming Soon', 'Help & support will be available soon')}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Logout"
              icon="logout"
              onPress={handleLogout}
              showArrow={false}
              color={Colors.danger}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Logo size="small" showText={false} style={styles.appLogo} />
          <Text style={styles.appInfoText}>Fynlo POS v1.0.0</Text>
          <Text style={styles.appInfoText}>Powered by CashApp</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  settingsGroup: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  appLogo: {
    marginBottom: 12,
  },
  appInfoText: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
});

export default SettingsScreen;