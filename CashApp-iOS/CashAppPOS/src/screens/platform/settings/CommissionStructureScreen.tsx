import React, { useState } from 'react';
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
import FastInput from '../../../components/ui/FastInput';

const CommissionStructureScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Commission configuration state
  const [config, setConfig] = useState({
    baseCommissionRate: 8.0,
    premiumCommissionRate: 6.0,
    enterpriseCommissionRate: 4.0,
    serviceChargeRate: 12.5,
    serviceChargeEnabled: true,
    minimumMonthlyFee: 29.99,
    freeTrialDays: 30,
    volumeDiscounts: true,
    earlyPaymentDiscount: 2.0,
    referralBonus: 50.00,
  });

  const handleSave = () => {
    // TODO: Save to backend
    Alert.alert(
      'Settings Saved',
      'Commission structure has been updated.',
      [{ text: 'OK' }]
    );
  };

  const TierCard = ({ title, rate, description, features }: any) => (
    <View style={styles.tierCard}>
      <View style={styles.tierHeader}>
        <Text style={styles.tierTitle}>{title}</Text>
        <View style={styles.rateContainer}>
          <Text style={styles.rateValue}>{rate}%</Text>
          <Text style={styles.rateLabel}>Commission</Text>
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
          <Text style={styles.headerTitle}>Commission Structure</Text>
          <Text style={styles.headerSubtitle}>
            Set platform commission rates and fee structures
          </Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Commission Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Tiers</Text>
          <Text style={styles.sectionDescription}>
            Different commission rates based on subscription tier
          </Text>
          
          <TierCard
            title="Basic Tier"
            rate={config.baseCommissionRate}
            description="Standard plan for new restaurants"
            features={[
              'Basic POS functionality',
              'Standard reporting',
              'Email support',
              'Payment processing'
            ]}
          />
          
          <TierCard
            title="Premium Tier"
            rate={config.premiumCommissionRate}
            description="Enhanced features and lower commission"
            features={[
              'Advanced analytics',
              'Priority support',
              'Custom branding',
              'Advanced integrations',
              'Reduced commission rate'
            ]}
          />
          
          <TierCard
            title="Enterprise Tier"
            rate={config.enterpriseCommissionRate}
            description="Lowest commission for high-volume restaurants"
            features={[
              'Dedicated account manager',
              'Custom development',
              'White-label options',
              'API access',
              'Lowest commission rate'
            ]}
          />
        </View>

        {/* Commission Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Configuration</Text>
          
          <SettingRow
            title="Basic Tier Commission"
            description="Commission rate for basic tier restaurants"
            value={config.baseCommissionRate.toString()}
            onChangeText={(text: string) => setConfig({...config, baseCommissionRate: text === '' ? 0 : parseFloat(text) || 0})}
            unit="%"
          />
          
          <SettingRow
            title="Premium Tier Commission"
            description="Commission rate for premium tier restaurants"
            value={config.premiumCommissionRate.toString()}
            onChangeText={(text: string) => setConfig({...config, premiumCommissionRate: text === '' ? 0 : parseFloat(text) || 0})}
            unit="%"
          />
          
          <SettingRow
            title="Enterprise Tier Commission"
            description="Commission rate for enterprise tier restaurants"
            value={config.enterpriseCommissionRate.toString()}
            onChangeText={(text: string) => setConfig({...config, enterpriseCommissionRate: text === '' ? 0 : parseFloat(text) || 0})}
            unit="%"
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
              <Text style={styles.calculationLabel}>Commission ({config.premiumCommissionRate}%):</Text>
              <Text style={styles.calculationValue}>£{(10000 * config.premiumCommissionRate / 100).toFixed(2)}</Text>
            </View>
            
            {config.serviceChargeEnabled && (
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>Service Charge ({config.serviceChargeRate}%):</Text>
                <Text style={styles.calculationValue}>£{(10000 * config.serviceChargeRate / 100).toFixed(2)}</Text>
              </View>
            )}
            
            <View style={[styles.calculationRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Platform Revenue:</Text>
              <Text style={styles.totalValue}>
                £{((10000 * config.premiumCommissionRate / 100) + 
                   (config.serviceChargeEnabled ? 10000 * config.serviceChargeRate / 100 : 0)).toFixed(2)}
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
});

export default CommissionStructureScreen;