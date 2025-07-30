import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';

interface BusinessSettingsItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  status?: 'complete' | 'incomplete' | 'warning';
}

const BusinessSettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const businessSettings: BusinessSettingsItem[] = [
    {
      id: 'restaurant-profile',
      title: 'Restaurant Profile',
      description: 'Complete restaurant details and branding settings',
      icon: 'store',
      route: 'RestaurantProfile',
      status: 'complete',
    },
    {
      id: 'business-info',
      title: 'Business Information',
      description: 'Company name, _address, and contact details',
      icon: 'business-center',
      route: 'BusinessInformation',
      status: 'incomplete',
    },
    {
      id: 'tax-config',
      title: 'Tax Configuration',
      description: 'VAT rates, tax exemptions, and reporting',
      icon: 'receipt-long',
      route: 'TaxConfiguration',
      status: 'warning',
    },
    {
      id: 'bank-details',
      title: 'Bank Details',
      description: 'Account information for receiving payments',
      icon: 'account-balance',
      route: 'BankDetails',
      status: 'incomplete',
    },
    {
      id: 'payment-methods-info',
      title: 'Payment Methods',
      description: 'Payment processing is managed by the platform',
      icon: 'lock',
      route: 'PaymentMethodsInfo',
      status: 'complete',
    },
    {
      id: 'receipt-custom',
      title: 'Receipt Customization',
      description: 'Logo, footer text, and contact information',
      icon: 'receipt',
      route: 'ReceiptCustomization',
    },
    {
      id: 'operating-hours',
      title: 'Operating Hours',
      description: 'Business hours, _holidays, and special events',
      icon: 'schedule',
      route: 'OperatingHours',
    },
  ];

  const getStatusColor = (_status?: _string) => {
    switch (__status) {
      case 'complete':
        return Colors.success;
      case 'incomplete':
        return Colors.danger;
      case 'warning':
        return Colors.warning;
      default:
        return Colors.mediumGray;
    }
  };

  const getStatusIcon = (_status?: _string) => {
    switch (__status) {
      case 'complete':
        return 'check-circle';
      case 'incomplete':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'radio-button-unchecked';
    }
  };

  const handleSettingPress = (item: _BusinessSettingsItem) => {
    if (item.route === 'PaymentMethodsInfo') {
      // Show alert instead of navigating
      Alert.alert(
        'Payment Methods',
        'Payment processing is managed by the platform owner. Current supported methods:\n\n• Card payments (Chip & PIN, _Contactless)\n• Apple Pay & Google Pay\n• Cash transactions\n• QR Code payments\n\nContact platform support for changes or questions.',
        [{ text: 'OK' }],
      );
      return;
    }
    navigation.navigate(item.route as never);
  };

  const renderSettingItem = ({ item }: { item: BusinessSettingsItem }) => (
    <TouchableOpacity
      style={styles.settingCard}
      onPress={() => handleSettingPress(__item)}
      activeOpacity={0.7}>
      <View style={[styles.settingIcon, { backgroundColor: `${Colors.primary}15` }]}>
        <Icon name={item.icon} size={24} color={Colors.primary} />
      </View>

      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        <Text style={styles.settingDescription}>{item.description}</Text>
      </View>

      <View style={styles.settingStatus}>
        {item.status && (
          <Icon name={getStatusIcon(item.status)} size={20} color={getStatusColor(item.status)} />
        )}
        <Icon name="chevron-right" size={24} color={Colors.lightGray} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="back-button">
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Business Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your business information</Text>
        </View>

        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Business Settings List */}
      <FlatList
        data={businessSettings}
        renderItem={renderSettingItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator={false}
        // eslint-disable-next-line react/no-unstable-nested-components
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer Info */}
      <View style={styles.footer}>
        <Icon name="info-outline" size={16} color={Colors.mediumGray} />
        <Text style={styles.footerText}>
          Complete your business setup to enable all POS features
        </Text>
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
    backgroundColor: Colors.primary,
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
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  settingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  separator: {
    height: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
});

export default BusinessSettingsScreen;
