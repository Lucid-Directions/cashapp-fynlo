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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../../design-system/ThemeProvider';
import SimpleTextInput from '../../../components/inputs/SimpleTextInput';
import SimpleDecimalInput from '../../../components/inputs/SimpleDecimalInput';
import PlatformService from '../../../services/PlatformService';

const PlansAndPricingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Plans and pricing configuration state
  const [config, setConfig] = useState({
    basicPlanName: 'Starter',
    basicMonthlyFee: 29.99,
    basicDescription: 'Perfect for new restaurants getting started',
    
    premiumPlanName: 'Professional',
    premiumMonthlyFee: 79.99,
    premiumDescription: 'Advanced features for growing businesses',
    
    enterprisePlanName: 'Enterprise',
    enterpriseMonthlyFee: 199.99,
    enterpriseDescription: 'Full-scale solution for large operations',
    
    serviceChargeRate: 12.5,
    serviceChargeEnabled: true,
    freeTrialDays: 30,
    setupFee: 0.00,
    cancellationFee: 0.00,
    supportIncluded: true,
  });

  // Load current configuration on component mount
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const platformService = PlatformService.getInstance();
        
        // Load current platform settings for pricing
        const platformSettings = await platformService.getPlatformSettings('pricing');
        const billingSettings = await platformService.getPlatformSettings('billing');
        const serviceChargeConfig = await platformService.getServiceChargeConfig();
        
        // Update state with loaded values if they exist
        const settingsMap: any = {};
        
        // Process platform settings
        [...platformSettings, ...billingSettings].forEach(setting => {
          settingsMap[setting.key] = setting.value;
        });
        
        setConfig(prevConfig => ({
          ...prevConfig,
          // Map platform settings to local state
          basicPlanName: settingsMap['pricing.plans.basic.name'] || prevConfig.basicPlanName,
          basicMonthlyFee: settingsMap['pricing.plans.basic.monthly_fee'] || prevConfig.basicMonthlyFee,
          basicDescription: settingsMap['pricing.plans.basic.description'] || prevConfig.basicDescription,
          
          premiumPlanName: settingsMap['pricing.plans.premium.name'] || prevConfig.premiumPlanName,
          premiumMonthlyFee: settingsMap['pricing.plans.premium.monthly_fee'] || prevConfig.premiumMonthlyFee,
          premiumDescription: settingsMap['pricing.plans.premium.description'] || prevConfig.premiumDescription,
          
          enterprisePlanName: settingsMap['pricing.plans.enterprise.name'] || prevConfig.enterprisePlanName,
          enterpriseMonthlyFee: settingsMap['pricing.plans.enterprise.monthly_fee'] || prevConfig.enterpriseMonthlyFee,
          enterpriseDescription: settingsMap['pricing.plans.enterprise.description'] || prevConfig.enterpriseDescription,
          
          setupFee: settingsMap['billing.setup_fee'] || prevConfig.setupFee,
          cancellationFee: settingsMap['billing.cancellation_fee'] || prevConfig.cancellationFee,
          supportIncluded: settingsMap['billing.support_included'] !== undefined ? settingsMap['billing.support_included'] : prevConfig.supportIncluded,
          freeTrialDays: settingsMap['billing.free_trial_days'] || prevConfig.freeTrialDays,
          
          serviceChargeEnabled: serviceChargeConfig.enabled,
          serviceChargeRate: serviceChargeConfig.rate,
        }));
      } catch (error) {
        console.error('Failed to load current platform pricing configuration:', error);
      }
    };

    loadCurrentConfig();
  }, []);

  const handleSave = async () => {
    try {
      console.log('💾 Starting save operation for Plans & Pricing...');
      const platformService = PlatformService.getInstance();
      
      // Map local state to platform settings keys
      const settingsUpdates = {
        // Subscription plan configurations
        'pricing.plans.basic.name': config.basicPlanName,
        'pricing.plans.basic.monthly_fee': config.basicMonthlyFee,
        'pricing.plans.basic.description': config.basicDescription,
        
        'pricing.plans.premium.name': config.premiumPlanName,
        'pricing.plans.premium.monthly_fee': config.premiumMonthlyFee,
        'pricing.plans.premium.description': config.premiumDescription,
        
        'pricing.plans.enterprise.name': config.enterprisePlanName,
        'pricing.plans.enterprise.monthly_fee': config.enterpriseMonthlyFee,
        'pricing.plans.enterprise.description': config.enterpriseDescription,
        
        // Billing configuration
        'billing.setup_fee': config.setupFee,
        'billing.cancellation_fee': config.cancellationFee,
        'billing.support_included': config.supportIncluded,
        'billing.free_trial_days': config.freeTrialDays,
        
        // Service charge configuration
        'platform.service_charge.enabled': config.serviceChargeEnabled,
        'platform.service_charge.rate': config.serviceChargeRate,
      };

      console.log('📊 Settings to update:', settingsUpdates);

      // Update service charge configuration using dedicated service first
      try {
        console.log('🔄 Updating service charge config...');
        const serviceChargeSuccess = await platformService.updateServiceChargeConfig(
          config.serviceChargeEnabled,
          config.serviceChargeRate,
          'Platform pricing configuration update'
        );
        console.log('✅ Service charge update result:', serviceChargeSuccess);
      } catch (serviceChargeError) {
        console.warn('⚠️ Service charge update failed, continuing with other settings:', serviceChargeError);
      }

      // Bulk update all pricing settings
      console.log('🔄 Updating platform settings...');
      const result = await platformService.bulkUpdatePlatformSettings(
        settingsUpdates,
        'Platform pricing and subscription plans configuration update'
      );

      console.log('📊 Bulk update result:', result);

      if (result.successful > 0) {
        const successMessage = result.failed > 0 
          ? `${result.successful} settings updated successfully. ${result.failed} failed to update.`
          : `Plans and pricing configuration updated successfully. ${result.successful} settings updated.`;
          
        Alert.alert(
          'Settings Saved',
          successMessage,
          [{ text: 'OK' }]
        );
        
        if (result.failed > 0) {
          console.warn('⚠️ Some updates failed:', result.errors);
        }
      } else {
        console.error('❌ All updates failed:', result.errors);
        
        let errorMessage = 'Failed to save plans and pricing configuration.';
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
      console.error('❌ Critical error saving plans and pricing:', error);
      Alert.alert(
        'Error',
        `An error occurred while saving: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  const PlanCard = ({ planName, monthlyFee, description, nameKey, feeKey, descriptionKey }: any) => (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <SimpleTextInput
          label="Plan Name"
          value={planName}
          onValueChange={(value) => setConfig(prev => ({ ...prev, [nameKey]: value }))}
          placeholder="Enter plan name"
          style={styles.planNameInput}
        />
        <View style={styles.feeContainer}>
          <SimpleDecimalInput
            label="Monthly Fee"
            value={monthlyFee}
            onValueChange={(value) => setConfig(prev => ({ ...prev, [feeKey]: value }))}
            placeholder="0.00"
            suffix="£"
            maxValue={9999.99}
            style={styles.feeInput}
          />
        </View>
      </View>
      <SimpleTextInput
        label="Plan Description"
        value={description}
        onValueChange={(value) => setConfig(prev => ({ ...prev, [descriptionKey]: value }))}
        placeholder="Describe this plan..."
        multiline={true}
        numberOfLines={2}
        style={styles.descriptionInput}
      />
    </View>
  );

  const SettingRow = ({ title, description, value, onChangeText, unit, isSwitch = false, switchValue, onSwitchChange }: any) => {
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
          <SimpleDecimalInput
            value={typeof value === 'number' ? value : parseFloat(value) || 0}
            onValueChange={onChangeText}
            placeholder="0.00"
            suffix={unit}
            maxValue={unit === '%' ? 100 : unit === 'days' ? 365 : 9999.99}
            decimalPlaces={unit === '%' ? 1 : unit === 'days' ? 0 : 2}
            style={{ marginBottom: 0 }}
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
          <Text style={styles.headerTitle}>Plans & Pricing</Text>
          <Text style={styles.headerSubtitle}>
            Configure subscription plans and monthly pricing tiers
          </Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subscription Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Plans</Text>
          <Text style={styles.sectionDescription}>
            Configure the three main subscription tiers with custom names, pricing, and descriptions
          </Text>
          
          <PlanCard
            planName={config.basicPlanName}
            monthlyFee={config.basicMonthlyFee}
            description={config.basicDescription}
            nameKey="basicPlanName"
            feeKey="basicMonthlyFee"
            descriptionKey="basicDescription"
          />
          
          <PlanCard
            planName={config.premiumPlanName}
            monthlyFee={config.premiumMonthlyFee}
            description={config.premiumDescription}
            nameKey="premiumPlanName"
            feeKey="premiumMonthlyFee"
            descriptionKey="premiumDescription"
          />
          
          <PlanCard
            planName={config.enterprisePlanName}
            monthlyFee={config.enterpriseMonthlyFee}
            description={config.enterpriseDescription}
            nameKey="enterprisePlanName"
            feeKey="enterpriseMonthlyFee"
            descriptionKey="enterpriseDescription"
          />
        </View>

        {/* Billing Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Configuration</Text>
          
          <SettingRow
            title="Setup Fee"
            description="One-time setup fee for new restaurants"
            value={config.setupFee.toString()}
            onChangeText={(text: string) => setConfig({...config, setupFee: text === '' ? 0 : parseFloat(text) || 0})}
            unit="£"
          />
          
          <SettingRow
            title="Cancellation Fee"
            description="Fee charged when a restaurant cancels their subscription"
            value={config.cancellationFee.toString()}
            onChangeText={(text: string) => setConfig({...config, cancellationFee: text === '' ? 0 : parseFloat(text) || 0})}
            unit="£"
          />
          
          <SettingRow
            title="Include Support"
            description="Include customer support in all plans"
            isSwitch={true}
            switchValue={config.supportIncluded}
            onSwitchChange={(value: boolean) => setConfig({...config, supportIncluded: value})}
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
              description="Platform service charge percentage (e.g., 2.5, 12.5)"
              value={config.serviceChargeRate.toString()}
              onChangeText={(text: string) => setConfig({...config, serviceChargeRate: text === '' ? 0 : parseFloat(text) || 0})}
              unit="%"
            />
          )}
        </View>

        {/* Additional Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Settings</Text>
          
          <SettingRow
            title="Free Trial Period"
            description="Number of free trial days for new restaurants"
            value={config.freeTrialDays.toString()}
            onChangeText={(text: string) => setConfig({...config, freeTrialDays: text === '' ? 0 : parseInt(text) || 0})}
            unit="days"
          />
        </View>

        {/* Pricing Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Summary</Text>
          <View style={styles.pricingSummaryCard}>
            <Text style={styles.summaryTitle}>Current Plan Configuration</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{config.basicPlanName}:</Text>
              <Text style={styles.summaryValue}>£{config.basicMonthlyFee.toFixed(2)}/month</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{config.premiumPlanName}:</Text>
              <Text style={styles.summaryValue}>£{config.premiumMonthlyFee.toFixed(2)}/month</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{config.enterprisePlanName}:</Text>
              <Text style={styles.summaryValue}>£{config.enterpriseMonthlyFee.toFixed(2)}/month</Text>
            </View>
            
            {config.setupFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Setup Fee:</Text>
                <Text style={styles.summaryValue}>£{config.setupFee.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Free Trial:</Text>
              <Text style={styles.summaryValue}>{config.freeTrialDays} days</Text>
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
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planNameInput: {
    flex: 1,
    marginRight: 16,
  },
  feeContainer: {
    minWidth: 120,
  },
  feeInput: {
    minWidth: 100,
  },
  descriptionInput: {
    marginTop: 8,
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
  pricingSummaryCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});

export default PlansAndPricingScreen;