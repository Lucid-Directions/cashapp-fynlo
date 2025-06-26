import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../../design-system/ThemeProvider';
import FastInput from '../../../components/ui/FastInput';
import PlatformService from '../../../services/PlatformService';
import SettingsResolver from '../../../services/SettingsResolver';

const PricingPlansScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Pricing plans configuration state
  const [config, setConfig] = useState({
    basicServiceFeeRate: 8.0,
    premiumServiceFeeRate: 6.0,
    enterpriseServiceFeeRate: 4.0,
    platformServiceCharge: 0, // Will be loaded from platform settings
    serviceChargeEnabled: true,
    minimumMonthlyFee: 29.99,
    freeTrialDays: 30,
    volumeDiscounts: true,
    earlyPaymentDiscount: 2.0,
    referralBonus: 50.00,
  });
  
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load current platform settings on mount
  useEffect(() => {
    const loadPlatformSettings = async () => {
      try {
        setLoading(true);
        setSaveError(null);
        const platformService = PlatformService.getInstance();
        const settings = await platformService.getSettings();
        
        console.log('📊 Loading platform settings for pricing:', settings);
        
        setConfig(prev => ({
          ...prev,
          platformServiceCharge: settings?.fees?.serviceTaxRate || 12.5,
          serviceChargeEnabled: settings?.fees?.serviceTaxEnabled ?? true,
        }));
      } catch (error) {
        console.error('Error loading platform settings:', error);
        setSaveError('Failed to load current settings. Using defaults.');
        // Keep default values if loading fails
        setConfig(prev => ({
          ...prev,
          platformServiceCharge: 12.5,
          serviceChargeEnabled: true,
        }));
      } finally {
        setLoading(false);
      }
    };
    
    loadPlatformSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaveError(null);
      
      // Validate input values
      if (config.platformServiceCharge < 0 || config.platformServiceCharge > 100) {
        Alert.alert(
          'Invalid Input',
          'Service charge must be between 0% and 100%.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const platformService = PlatformService.getInstance();
      
      // Save service charge rate to platform settings
      const success = await platformService.updatePlatformSetting(
        'fees.service_tax_rate',
        config.platformServiceCharge,
        'Updated service charge rate from Pricing Plans screen'
      );
      
      if (success) {
        // Clear settings cache so effective settings will be refreshed
        SettingsResolver.clearCache();
        
        console.log('✅ Platform service charge updated:', config.platformServiceCharge);
        Alert.alert(
          'Settings Saved',
          `Pricing plans have been updated. Service charge is now ${config.platformServiceCharge.toFixed(2)}%.\n\nThis will affect all restaurants on your platform.`,
          [{ text: 'OK' }]
        );
      } else {
        setSaveError('Failed to save platform settings. Please try again.');
        Alert.alert(
          'Save Error',
          'Failed to save platform settings. Changes are local only.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error saving pricing plans:', error);
      setSaveError('An error occurred while saving. Please try again.');
      Alert.alert(
        'Save Error',
        'An error occurred while saving. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const TierCard = ({ title, rate, description, features, onRateChange, titleEditable = false, onTitleChange }: any) => (
    <View style={styles.tierCard}>
      <View style={styles.tierHeader}>
        {titleEditable ? (
          <FastInput
            inputType="text"
            value={title}
            onChangeText={onTitleChange}
            placeholder="Plan Name"
            containerStyle={styles.titleInputContainer}
            inputStyle={styles.titleInput}
          />
        ) : (
          <Text style={styles.tierTitle}>{title}</Text>
        )}
        <View style={styles.rateContainer}>
          <FastInput
            inputType="percentage"
            value={rate.toString()}
            onChangeText={onRateChange}
            placeholder="0.0"
            unit="%"
            unitPosition="right"
            containerStyle={styles.rateInputContainer}
            inputStyle={styles.rateInput}
          />
          <Text style={styles.rateLabel}>Service Fee</Text>
        </View>
      </View>
      <Text style={styles.tierDescription}>{description}</Text>
      <View style={styles.featuresContainer}>
        {features.map((feature: string, index: number) => (
          <View key={index} style={styles.featureRow}>
            <Icon name="check-circle" size={16} color={theme.colors.success} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const SettingRow = ({ title, description, value, onChangeText, unit, isSwitch = false, switchValue, onSwitchChange }: any) => {
    const getInputType = () => {
      if (unit === '%') return 'percentage';
      if (unit === '£') return 'currency';
      if (unit === 'days') return 'number';
      return 'decimal';
    };

    return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
          thumbColor={switchValue ? theme.colors.white : theme.colors.mediumGray}
        />
      ) : (
        <View style={styles.inputContainer}>
          <FastInput
            inputType={getInputType()}
            value={value}
            onChangeText={onChangeText}
            placeholder="0.00"
            unit={unit}
            unitPosition={unit === '£' ? 'left' : 'right'}
            containerStyle={{ marginBottom: 0 }}
            inputStyle={styles.fastInputStyle}
          />
        </View>
      )}
    </View>
    );
  };

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
          <Text style={styles.headerTitle}>Pricing Plans and Tiers</Text>
          <Text style={styles.headerSubtitle}>
            Configure service fees and pricing plans for restaurants
          </Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading platform settings...</Text>
        </View>
      )}
      
      {/* Error Message */}
      {saveError && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={20} color={theme.colors.error} />
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pricing Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Tiers</Text>
          <Text style={styles.sectionDescription}>
            Different service fee rates based on subscription tier
          </Text>
          
          <TierCard
            title="Basic Tier"
            rate={config.basicServiceFeeRate}
            description="Standard plan for new restaurants"
            features={[
              'Basic POS functionality',
              'Standard reporting',
              'Email support',
              'Payment processing'
            ]}
            onRateChange={(value: string) => setConfig({...config, basicServiceFeeRate: parseFloat(value) || 0})}
          />
          
          <TierCard
            title="Premium Tier"
            rate={config.premiumServiceFeeRate}
            description="Enhanced features and lower service fee"
            features={[
              'Advanced analytics',
              'Priority support',
              'Custom branding',
              'Advanced integrations',
              'Reduced service fee rate'
            ]}
            onRateChange={(value: string) => setConfig({...config, premiumServiceFeeRate: parseFloat(value) || 0})}
          />
          
          <TierCard
            title="Enterprise Tier"
            rate={config.enterpriseServiceFeeRate}
            description="Lowest service fee for high-volume restaurants"
            features={[
              'Dedicated account manager',
              'Custom development',
              'White-label options',
              'API access',
              'Lowest service fee rate'
            ]}
            onRateChange={(value: string) => setConfig({...config, enterpriseServiceFeeRate: parseFloat(value) || 0})}
          />
        </View>


        {/* Service Charge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Charge</Text>
          
          <SettingRow
            title="Enable Service Charge"
            description="Apply platform service charge to all transactions"
            isSwitch={true}
            switchValue={config.serviceChargeEnabled}
            onSwitchChange={(value: boolean) => setConfig({...config, serviceChargeEnabled: value})}
          />
          
          {config.serviceChargeEnabled && (
            <SettingRow
              title="Service Charge Rate"
              description="Platform service charge percentage (e.g., 2.5, 12.5). Supports decimal values."
              value={config.platformServiceCharge.toString()}
              onChangeText={(text: string) => {
                // Handle empty string and invalid input gracefully
                const numValue = text === '' ? 0 : parseFloat(text);
                if (!isNaN(numValue)) {
                  setConfig({...config, platformServiceCharge: numValue});
                }
              }}
              unit="%"
            />
          )}
        </View>

        {/* Additional Fees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Fees</Text>
          
          <SettingRow
            title="Minimum Monthly Fee"
            description="Minimum monthly fee per restaurant"
            value={config.minimumMonthlyFee.toFixed(2)}
            onChangeText={(text: string) => setConfig({...config, minimumMonthlyFee: text === '' ? 0 : parseFloat(text) || 0})}
            unit="£"
          />
          
          <SettingRow
            title="Free Trial Period"
            description="Number of free trial days for new restaurants"
            value={config.freeTrialDays.toString()}
            onChangeText={(text: string) => setConfig({...config, freeTrialDays: text === '' ? 0 : parseInt(text) || 0})}
            unit="days"
          />
        </View>

        {/* Discounts & Incentives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discounts & Incentives</Text>
          
          <SettingRow
            title="Volume Discounts"
            description="Enable automatic volume-based commission discounts"
            isSwitch={true}
            switchValue={config.volumeDiscounts}
            onSwitchChange={(value: boolean) => setConfig({...config, volumeDiscounts: value})}
          />
          
          <SettingRow
            title="Early Payment Discount"
            description="Discount for payments within 7 days (e.g., 2.5%)"
            value={config.earlyPaymentDiscount.toString()}
            onChangeText={(text: string) => setConfig({...config, earlyPaymentDiscount: text === '' ? 0 : parseFloat(text) || 0})}
            unit="%"
          />
          
          <SettingRow
            title="Referral Bonus"
            description="Bonus for successful restaurant referrals"
            value={config.referralBonus.toFixed(2)}
            onChangeText={(text: string) => setConfig({...config, referralBonus: text === '' ? 0 : parseFloat(text) || 0})}
            unit="£"
          />
        </View>

        {/* Revenue Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue Calculation Example</Text>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueTitle}>Monthly Revenue Calculation</Text>
            <Text style={styles.revenueDescription}>
              Example: Restaurant with £10,000 monthly sales on Premium tier
            </Text>
            
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Sales Volume:</Text>
              <Text style={styles.calculationValue}>£10,000.00</Text>
            </View>
            
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Service Fee ({config.premiumServiceFeeRate}%):</Text>
              <Text style={styles.calculationValue}>£{(10000 * config.premiumServiceFeeRate / 100).toFixed(2)}</Text>
            </View>
            
            {config.serviceChargeEnabled && (
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>Service Charge ({config.platformServiceCharge}%):</Text>
                <Text style={styles.calculationValue}>£{(10000 * config.platformServiceCharge / 100).toFixed(2)}</Text>
              </View>
            )}
            
            <View style={[styles.calculationRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Platform Revenue:</Text>
              <Text style={styles.totalValue}>
                £{((10000 * config.premiumServiceFeeRate / 100) + 
                   (config.serviceChargeEnabled ? 10000 * config.platformServiceCharge / 100 : 0)).toFixed(2)}
              </Text>
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.lightGray,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.lightText,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.errorBackground || '#FFEBEE',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.error,
    flex: 1,
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
  tierCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  rateContainer: {
    alignItems: 'center',
  },
  rateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  rateLabel: {
    fontSize: 12,
    color: theme.colors.lightText,
  },
  tierDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginBottom: 16,
  },
  featuresContainer: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
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
  inputContainer: {
    flex: 1,
    marginLeft: 16,
    maxWidth: 120,
  },
  fastInputStyle: {
    fontSize: 16,
    minHeight: 40,
  },
  revenueCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  revenueDescription: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginBottom: 16,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  titleInputContainer: {
    marginBottom: 0,
    flex: 1,
    marginRight: 12,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rateInputContainer: {
    marginBottom: 0,
    minWidth: 80,
  },
  rateInput: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PricingPlansScreen;