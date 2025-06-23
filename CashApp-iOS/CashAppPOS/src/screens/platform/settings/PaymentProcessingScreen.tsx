import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../../design-system/ThemeProvider';

const PaymentProcessingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Platform payment configuration state
  const [config, setConfig] = useState({
    cardPaymentFee: 2.9,
    cardFixedFee: 0.30,
    digitalWalletFee: 3.1,
    digitalWalletFixedFee: 0.30,
    qrCodeFee: 1.2,
    qrCodeFixedFee: 0.00,
    enableCardPayments: true,
    enableDigitalWallets: true,
    enableQrPayments: true,
    enableCashPayments: true,
    requireSignature: true,
    requirePin: true,
    contactlessLimit: 100.00,
    dailyTransactionLimit: 10000.00,
  });

  const handleSave = () => {
    // TODO: Save to backend
    Alert.alert(
      'Settings Saved',
      'Payment processing configuration has been updated.',
      [{ text: 'OK' }]
    );
  };

  const PaymentMethodCard = ({ title, description, icon, enabled, onToggle, fee, fixedFee, onFeeChange, onFixedFeeChange }: any) => (
    <View style={styles.paymentMethodCard}>
      <View style={styles.paymentMethodHeader}>
        <View style={styles.paymentMethodInfo}>
          <Icon name={icon} size={24} color={theme.colors.primary} />
          <View style={styles.paymentMethodDetails}>
            <Text style={styles.paymentMethodTitle}>{title}</Text>
            <Text style={styles.paymentMethodDescription}>{description}</Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
          thumbColor={enabled ? theme.colors.white : theme.colors.mediumGray}
        />
      </View>
      
      {enabled && (
        <View style={styles.feeConfiguration}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Percentage Fee:</Text>
            <View style={styles.feeInputContainer}>
              <TextInput
                style={styles.feeInput}
                value={fee.toString()}
                onChangeText={(text) => {
                  const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
                  onFeeChange && onFeeChange(numericValue);
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                clearButtonMode="while-editing"
              />
              <Text style={styles.feeUnit}>%</Text>
            </View>
          </View>
          
          {fixedFee !== undefined && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Fixed Fee:</Text>
              <View style={styles.feeInputContainer}>
                <Text style={styles.currencySymbol}>£</Text>
                <TextInput
                  style={styles.feeInput}
                  value={fixedFee.toFixed(2)}
                  onChangeText={(text) => {
                    const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
                    onFixedFeeChange && onFixedFeeChange(numericValue);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  autoCorrect={false}
                  autoCapitalize="none"
                  selectTextOnFocus={true}
                  clearButtonMode="while-editing"
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );

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
          <Text style={styles.headerTitle}>Payment Processing</Text>
          <Text style={styles.headerSubtitle}>
            Configure platform-wide payment fees and methods
          </Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <Text style={styles.sectionDescription}>
            Configure which payment methods are available across all restaurants
          </Text>
          
          <PaymentMethodCard
            title="Card Payments"
            description="Chip & PIN, Contactless cards"
            icon="credit-card"
            enabled={config.enableCardPayments}
            onToggle={(value: boolean) => setConfig({...config, enableCardPayments: value})}
            fee={config.cardPaymentFee}
            fixedFee={config.cardFixedFee}
            onFeeChange={(value: number) => setConfig({...config, cardPaymentFee: value})}
            onFixedFeeChange={(value: number) => setConfig({...config, cardFixedFee: value})}
          />
          
          <PaymentMethodCard
            title="Digital Wallets"
            description="Apple Pay, Google Pay, Samsung Pay"
            icon="phone-android"
            enabled={config.enableDigitalWallets}
            onToggle={(value: boolean) => setConfig({...config, enableDigitalWallets: value})}
            fee={config.digitalWalletFee}
            fixedFee={config.digitalWalletFixedFee}
            onFeeChange={(value: number) => setConfig({...config, digitalWalletFee: value})}
            onFixedFeeChange={(value: number) => setConfig({...config, digitalWalletFixedFee: value})}
          />
          
          <PaymentMethodCard
            title="QR Code Payments"
            description="Customer mobile app payments"
            icon="qr-code-scanner"
            enabled={config.enableQrPayments}
            onToggle={(value: boolean) => setConfig({...config, enableQrPayments: value})}
            fee={config.qrCodeFee}
            fixedFee={config.qrCodeFixedFee}
            onFeeChange={(value: number) => setConfig({...config, qrCodeFee: value})}
            onFixedFeeChange={(value: number) => setConfig({...config, qrCodeFixedFee: value})}
          />
          
          <PaymentMethodCard
            title="Cash Payments"
            description="Traditional cash transactions"
            icon="attach-money"
            enabled={config.enableCashPayments}
            onToggle={(value: boolean) => setConfig({...config, enableCashPayments: value})}
            fee={0}
            onFeeChange={() => {}} // Cash payments don't have fees, but provide empty callback
          />
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Require Signature</Text>
              <Text style={styles.settingDescription}>Require customer signature for card payments</Text>
            </View>
            <Switch
              value={config.requireSignature}
              onValueChange={(value) => setConfig({...config, requireSignature: value})}
              trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
              thumbColor={config.requireSignature ? theme.colors.white : theme.colors.mediumGray}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Require PIN</Text>
              <Text style={styles.settingDescription}>Require PIN for card transactions</Text>
            </View>
            <Switch
              value={config.requirePin}
              onValueChange={(value) => setConfig({...config, requirePin: value})}
              trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
              thumbColor={config.requirePin ? theme.colors.white : theme.colors.mediumGray}
            />
          </View>
        </View>

        {/* Transaction Limits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Limits</Text>
          
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Contactless Limit</Text>
            <View style={styles.limitInputContainer}>
              <Text style={styles.currencySymbol}>£</Text>
              <TextInput
                style={styles.limitInput}
                value={config.contactlessLimit.toFixed(2)}
                onChangeText={(text) => {
                  const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
                  setConfig({...config, contactlessLimit: numericValue});
                }}
                keyboardType="decimal-pad"
                placeholder="100.00"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                clearButtonMode="while-editing"
              />
            </View>
          </View>
          
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Daily Transaction Limit</Text>
            <View style={styles.limitInputContainer}>
              <Text style={styles.currencySymbol}>£</Text>
              <TextInput
                style={styles.limitInput}
                value={config.dailyTransactionLimit.toFixed(2)}
                onChangeText={(text) => {
                  const numericValue = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
                  setConfig({...config, dailyTransactionLimit: numericValue});
                }}
                keyboardType="decimal-pad"
                placeholder="10000.00"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Icon name="info-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              These payment processing settings apply to all restaurants on the platform. 
              Changes may take up to 24 hours to take effect.
            </Text>
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
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginBottom: 16,
  },
  paymentMethodCard: {
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
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodDetails: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginTop: 2,
  },
  feeConfiguration: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  feeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  feeInput: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
    flex: 1,
  },
  feeUnit: {
    fontSize: 16,
    color: theme.colors.mediumGray,
    marginLeft: 4,
  },
  currencySymbol: {
    fontSize: 16,
    color: theme.colors.mediumGray,
    marginRight: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginTop: 2,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  limitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  limitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  limitInput: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'right',
    flex: 1,
  },
  infoSection: {
    marginTop: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.lightText,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
});

export default PaymentProcessingScreen;