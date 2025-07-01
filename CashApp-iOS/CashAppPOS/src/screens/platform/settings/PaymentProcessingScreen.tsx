import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../../design-system/ThemeProvider';
import { SimpleDecimalInput } from '../../../components/inputs'; // Updated import
import PlatformService from '../../../services/PlatformService';

const PaymentProcessingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Platform payment configuration state
  const [config, setConfig] = useState({
    sumupFee: 0.69,
    sumupHighVolumeFee: 0.69,
    sumupStandardFee: 1.69,
    sumupMonthlyFee: 19.00,
    sumupVolumeThreshold: 2714.00,
    cardPaymentFee: 1.4,
    cardFixedFee: 0.20,
    digitalWalletFee: 3.1,
    digitalWalletFixedFee: 0.30,
    qrCodeFee: 1.2,
    qrCodeFixedFee: 0.00,
    serviceChargeEnabled: true,
    serviceChargeRate: 12.5,
    enableSumUp: true,
    enableCardPayments: true,
    enableDigitalWallets: true,
    enableQrPayments: true,
    enableCashPayments: true,
    requireSignature: true,
    requirePin: true,
    contactlessLimit: 100.00,
    dailyTransactionLimit: 10000.00,
  });

  // Local input states for better UX
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  const timeoutRefs = useRef<{[key: string]: NodeJS.Timeout}>({});

  // Simplified input validation and formatting
  const validateDecimalInput = (value: string, maxValue: number = 100, maxDecimals: number = 2): string => {
    console.log('Input received:', value);
    
    // Handle empty value
    if (!value || value === '') {
      return '';
    }
    
    // Allow only numbers and one decimal point
    let cleaned = value.replace(/[^0-9.]/g, '');
    console.log('After cleaning:', cleaned);
    
    // Handle multiple decimal points - keep only the first one
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      cleaned = parts[0] + '.' + parts[1].substring(0, maxDecimals);
    }
    
    // Check max value
    const numericValue = parseFloat(cleaned);
    if (!isNaN(numericValue) && numericValue > maxValue) {
      return maxValue.toString();
    }
    
    console.log('Final validated value:', cleaned);
    return cleaned;
  };

  const debouncedUpdateConfig = useCallback((key: string, value: number) => {
    // Clear existing timeout
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key]);
    }
    
    // Set new timeout
    timeoutRefs.current[key] = setTimeout(() => {
      setConfig(prev => ({ ...prev, [key]: value }));
    }, 500); // 500ms debounce
  }, []);

  const handleFeeInputChange = (key: string, value: string, maxValue: number = 100) => {
    const validatedValue = validateDecimalInput(value, maxValue);
    setInputValues(prev => ({ ...prev, [key]: validatedValue }));
    
    const numericValue = parseFloat(validatedValue) || 0;
    debouncedUpdateConfig(key, numericValue);
  };

  const getDisplayValue = (key: string, configValue: number): string => {
    if (inputValues[key] !== undefined) {
      return inputValues[key];
    }
    // Don't force 2 decimal places if the value is a whole number
    return configValue % 1 === 0 ? configValue.toString() : configValue.toFixed(2);
  };

  // Load current configuration on component mount
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const platformService = PlatformService.getInstance();
        const serviceChargeConfig = await platformService.getServiceChargeConfig();
        
        setConfig(prevConfig => ({
          ...prevConfig,
          serviceChargeEnabled: serviceChargeConfig.enabled,
          serviceChargeRate: serviceChargeConfig.rate,
        }));
      } catch (error) {
        console.error('Failed to load current platform configuration:', error);
      }
    };

    loadCurrentConfig();
  }, []);

  // Debounced service charge update
  const debouncedUpdateServiceCharge = useCallback((value: number) => {
    // Clear existing timeout
    if (timeoutRefs.current['serviceCharge']) {
      clearTimeout(timeoutRefs.current['serviceCharge']);
    }
    
    // Set new timeout for service charge sync
    timeoutRefs.current['serviceCharge'] = setTimeout(async () => {
      try {
        const platformService = PlatformService.getInstance();
        await platformService.updateServiceChargeConfig(
          config.serviceChargeEnabled,
          value,
          'Real-time service charge update'
        );
        console.log('✅ Service charge updated after debounce:', value);
      } catch (error) {
        console.error('❌ Failed to update service charge:', error);
      }
    }, 1000); // 1 second debounce
  }, [config.serviceChargeEnabled]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const handleSave = async () => {
    try {
      console.log('💾 Starting save operation for Payment Processing...');
      const platformService = PlatformService.getInstance();
      
      // Save payment fee configurations
      const feeUpdates = {
        'payment.fees.sumup.high_volume': config.sumupHighVolumeFee,
        'payment.fees.sumup.standard': config.sumupStandardFee,
        'payment.fees.stripe': config.cardPaymentFee,
        'payment.fees.stripe.fixed': config.cardFixedFee,
        'payment.fees.digital_wallet': config.digitalWalletFee,
        'payment.fees.digital_wallet.fixed': config.digitalWalletFixedFee,
        'payment.fees.qr_code': config.qrCodeFee,
        'payment.fees.qr_code.fixed': config.qrCodeFixedFee,
        'platform.service_charge.enabled': config.serviceChargeEnabled,
        'platform.service_charge.rate': config.serviceChargeRate,
        'payment.methods.sumup.enabled': config.enableSumUp,
        'payment.methods.card.enabled': config.enableCardPayments,
        'payment.methods.digital_wallet.enabled': config.enableDigitalWallets,
        'payment.methods.qr.enabled': config.enableQrPayments,
        'payment.methods.cash.enabled': config.enableCashPayments,
        'security.require_signature': config.requireSignature,
        'security.require_pin': config.requirePin,
        'security.contactless_limit': config.contactlessLimit,
        'security.daily_transaction_limit': config.dailyTransactionLimit,
      };

      console.log('📊 Payment settings to update:', feeUpdates);

      // Update the service charge configuration using the dedicated service first
      try {
        console.log('🔄 Updating service charge config...');
        const serviceChargeSuccess = await platformService.updateServiceChargeConfig(
          config.serviceChargeEnabled,
          config.serviceChargeRate,
          'Platform payment processing service charge'
        );
        console.log('✅ Service charge update result:', serviceChargeSuccess);
      } catch (serviceChargeError) {
        console.warn('⚠️ Service charge update failed, continuing with other settings:', serviceChargeError);
      }

      // Bulk update all platform settings
      console.log('🔄 Updating payment processing settings...');
      const result = await platformService.bulkUpdatePlatformSettings(
        feeUpdates,
        'Platform payment processing configuration update'
      );

      console.log('📊 Bulk update result:', result);

      if (result.successful > 0) {
        const successMessage = result.failed > 0 
          ? `${result.successful} settings updated successfully. ${result.failed} failed to update.`
          : `Payment processing configuration updated successfully. ${result.successful} settings updated.`;
          
        Alert.alert(
          'Settings Saved',
          successMessage,
          [{ text: 'OK' }]
        );
        
        if (result.failed > 0) {
          console.warn('⚠️ Some payment settings failed to update:', result.errors);
        }
      } else {
        console.error('❌ All payment settings failed to update:', result.errors);
        
        let errorMessage = 'Failed to save payment processing configuration.';
        if (Object.keys(result.errors).length > 0) {
          const firstError = Object.values(result.errors)[0];
          errorMessage += ` Error: ${firstError}`;
        }
        
        Alert.alert(
          'Save Failed',
          errorMessage + ' Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Critical error saving payment processing settings:', error);
      Alert.alert(
        'Save Error',
        `An error occurred while saving settings: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  const PaymentMethodCard = ({ 
    title, 
    description, 
    icon, 
    enabled, 
    onToggle, 
    fee, 
    fixedFee, 
    feeKey, 
    fixedFeeKey
  }: any) => (
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
          <SimpleDecimalInput
            label="Percentage Fee"
            value={config[feeKey] || 0}
            onValueChange={(value) => setConfig(prev => ({ ...prev, [feeKey]: value }))}
            suffix="%"
            maxValue={50}
            minValue={0}
            decimalPlaces={2}
            placeholder="1.50"
            containerStyle={{ marginVertical: 8 }} // Changed to containerStyle
          />
          
          {fixedFee !== undefined && fixedFeeKey && (
            <SimpleDecimalInput
              label="Fixed Fee"
              value={config[fixedFeeKey] || 0}
              onValueChange={(value) => setConfig(prev => ({ ...prev, [fixedFeeKey]: value }))}
              suffix="£"
              maxValue={1000}
              minValue={0}
              decimalPlaces={2}
              placeholder="0.20"
              containerStyle={{ marginVertical: 8 }} // Changed to containerStyle
            />
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
          
          {/* Primary Payment Method - SumUp */}
          <View style={styles.primaryMethodContainer}>
            <View style={styles.primaryBadge}>
              <Icon name="star" size={16} color="#FFF" />
              <Text style={styles.primaryBadgeText}>PRIMARY METHOD</Text>
            </View>
            <PaymentMethodCard
              title="SumUp Payment Processing"
              description="0.69% for high volume (£2,714+/month) • 1.69% standard"
              icon="credit-card"
              enabled={config.enableSumUp}
              onToggle={(value: boolean) => setConfig({...config, enableSumUp: value})}
              fee={config.sumupHighVolumeFee}
              feeKey="sumupHighVolumeFee"
            />
          </View>
          
          <PaymentMethodCard
            title="Stripe (Backup)"
            description="Chip & PIN, Contactless cards"
            icon="credit-card"
            enabled={config.enableCardPayments}
            onToggle={(value: boolean) => setConfig({...config, enableCardPayments: value})}
            fee={config.cardPaymentFee}
            fixedFee={config.cardFixedFee}
            feeKey="cardPaymentFee"
            fixedFeeKey="cardFixedFee"
          />
          
          <PaymentMethodCard
            title="Digital Wallets"
            description="Apple Pay, Google Pay, Samsung Pay"
            icon="phone-android"
            enabled={config.enableDigitalWallets}
            onToggle={(value: boolean) => setConfig({...config, enableDigitalWallets: value})}
            fee={config.digitalWalletFee}
            fixedFee={config.digitalWalletFixedFee}
            feeKey="digitalWalletFee"
            fixedFeeKey="digitalWalletFixedFee"
          />
          
          <PaymentMethodCard
            title="QR Code Payments"
            description="Customer mobile app payments"
            icon="qr-code-scanner"
            enabled={config.enableQrPayments}
            onToggle={(value: boolean) => setConfig({...config, enableQrPayments: value})}
            fee={config.qrCodeFee}
            fixedFee={config.qrCodeFixedFee}
            feeKey="qrCodeFee"
            fixedFeeKey="qrCodeFixedFee"
          />
          
          <PaymentMethodCard
            title="Cash Payments"
            description="Traditional cash transactions"
            icon="attach-money"
            enabled={config.enableCashPayments}
            onToggle={(value: boolean) => setConfig({...config, enableCashPayments: value})}
            fee={0}
            feeKey="cashFee"
          />
        </View>

        {/* Platform Service Charge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Service Charge</Text>
          <Text style={styles.sectionDescription}>
            Configure the platform-wide service charge applied to all orders
          </Text>
          
          <View style={styles.paymentMethodCard}>
            <View style={styles.paymentMethodHeader}>
              <View style={styles.paymentMethodInfo}>
                <Icon name="receipt" size={24} color={theme.colors.primary} />
                <View style={styles.paymentMethodDetails}>
                  <Text style={styles.paymentMethodTitle}>Service Charge</Text>
                  <Text style={styles.paymentMethodDescription}>
                    Applied to all orders across all restaurants
                  </Text>
                </View>
              </View>
              <Switch
                value={config.serviceChargeEnabled}
                onValueChange={async (value) => {
                  setConfig({...config, serviceChargeEnabled: value});
                  
                  // IMMEDIATE SYNC: Update the service charge enabled state in real-time
                  try {
                    const platformService = PlatformService.getInstance();
                    await platformService.updateServiceChargeConfig(
                      value,
                      config.serviceChargeRate,
                      'Real-time service charge toggle'
                    );
                    console.log('✅ Service charge enabled updated immediately:', value);
                  } catch (error) {
                    console.error('❌ Failed to update service charge enabled immediately:', error);
                  }
                }}
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={config.serviceChargeEnabled ? theme.colors.white : theme.colors.mediumGray}
              />
            </View>
            
            {config.serviceChargeEnabled && (
              <View style={styles.feeConfiguration}>
                <SimpleDecimalInput
                  label="Service Charge Rate"
                  value={config.serviceChargeRate}
                  onValueChange={(value) => {
                    console.log('💰 Service charge rate changed to:', value);
                    setConfig(prev => ({ ...prev, serviceChargeRate: value }));
                    
                    // Debounced sync - update after user stops typing
                    debouncedUpdateServiceCharge(value);
                  }}
                  suffix="%"
                  maxValue={25}
                  minValue={0}
                  decimalPlaces={2}
                  placeholder="12.50"
                  containerStyle={{ marginVertical: 12 }} // Changed to containerStyle
                />
              </View>
            )}
          </View>
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
          
          <SimpleDecimalInput
            label="Contactless Limit"
            value={config.contactlessLimit}
            onValueChange={(value) => setConfig(prev => ({ ...prev, contactlessLimit: value }))}
            suffix="£"
            maxValue={1000}
            minValue={0}
            decimalPlaces={2}
            placeholder="100.00"
            containerStyle={{ marginVertical: 12 }} // Changed to containerStyle
          />
          
          <SimpleDecimalInput
            label="Daily Transaction Limit"
            value={config.dailyTransactionLimit}
            onValueChange={(value) => setConfig(prev => ({ ...prev, dailyTransactionLimit: value }))}
            suffix="£"
            maxValue={100000}
            minValue={0}
            decimalPlaces={2}
            placeholder="10000.00"
            containerStyle={{ marginVertical: 12 }} // Changed to containerStyle
          />
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
  primaryMethodContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  primaryBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#00D4AA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
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