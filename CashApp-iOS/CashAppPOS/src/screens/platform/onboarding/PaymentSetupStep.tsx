import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RestaurantOnboardingData } from './RestaurantOnboardingScreen';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
  danger: '#E74C3C',
};

interface PaymentSetupStepProps {
  data: RestaurantOnboardingData;
  onUpdate: (updates: Partial<RestaurantOnboardingData>) => void;
}

const PaymentSetupStep: React.FC<PaymentSetupStepProps> = ({ data, onUpdate }) => {
  const [showBankDetails, setShowBankDetails] = useState(data.paymentMethod.type === 'bank_transfer');
  const [showCardDetails, setShowCardDetails] = useState(data.paymentMethod.type === 'card');

  const handlePaymentTypeSelect = (type: 'bank_transfer' | 'card') => {
    onUpdate({
      paymentMethod: {
        type,
        // Clear previous details when switching
        bankName: undefined,
        accountNumber: undefined,
        sortCode: undefined,
        cardLastFour: undefined,
      },
    });
    setShowBankDetails(type === 'bank_transfer');
    setShowCardDetails(type === 'card');
  };

  const updatePaymentMethod = (field: string, value: string) => {
    onUpdate({
      paymentMethod: {
        ...data.paymentMethod,
        [field]: value,
      },
    });
  };

  const formatSortCode = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as XX-XX-XX
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Setup</Text>
        <Text style={styles.subtitle}>
          Choose how you'd like to receive payments from your restaurant sales
        </Text>
      </View>

      <View style={styles.paymentOptions}>
        <TouchableOpacity
          style={[
            styles.paymentOption,
            data.paymentMethod.type === 'bank_transfer' && styles.paymentOptionActive,
          ]}
          onPress={() => handlePaymentTypeSelect('bank_transfer')}
        >
          <View style={styles.paymentOptionHeader}>
            <Icon 
              name="account-balance" 
              size={32} 
              color={data.paymentMethod.type === 'bank_transfer' ? Colors.primary : Colors.mediumGray}
            />
            <View style={styles.paymentOptionInfo}>
              <Text style={styles.paymentOptionTitle}>Bank Transfer</Text>
              <Text style={styles.paymentOptionDesc}>
                Direct deposit to your bank account
              </Text>
            </View>
            <View
              style={[
                styles.radio,
                data.paymentMethod.type === 'bank_transfer' && styles.radioActive,
              ]}
            >
              {data.paymentMethod.type === 'bank_transfer' && (
                <View style={styles.radioInner} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {showBankDetails && (
          <View style={styles.detailsSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                value={data.paymentMethod.bankName || ''}
                onChangeText={(text) => updatePaymentMethod('bankName', text)}
                placeholder="e.g. Barclays Bank"
                placeholderTextColor={Colors.mediumGray}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Number *</Text>
              <TextInput
                style={styles.input}
                value={data.paymentMethod.accountNumber || ''}
                onChangeText={(text) => updatePaymentMethod('accountNumber', text)}
                placeholder="12345678"
                placeholderTextColor={Colors.mediumGray}
                keyboardType="numeric"
                maxLength={8}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sort Code *</Text>
              <TextInput
                style={styles.input}
                value={formatSortCode(data.paymentMethod.sortCode || '')}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  if (digits.length <= 6) {
                    updatePaymentMethod('sortCode', digits);
                  }
                }}
                placeholder="12-34-56"
                placeholderTextColor={Colors.mediumGray}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.paymentOption,
            data.paymentMethod.type === 'card' && styles.paymentOptionActive,
          ]}
          onPress={() => handlePaymentTypeSelect('card')}
        >
          <View style={styles.paymentOptionHeader}>
            <Icon 
              name="credit-card" 
              size={32} 
              color={data.paymentMethod.type === 'card' ? Colors.primary : Colors.mediumGray}
            />
            <View style={styles.paymentOptionInfo}>
              <Text style={styles.paymentOptionTitle}>Debit Card</Text>
              <Text style={styles.paymentOptionDesc}>
                Fast payments to your debit card
              </Text>
            </View>
            <View
              style={[
                styles.radio,
                data.paymentMethod.type === 'card' && styles.radioActive,
              ]}
            >
              {data.paymentMethod.type === 'card' && (
                <View style={styles.radioInner} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {showCardDetails && (
          <View style={styles.detailsSection}>
            <View style={styles.cardNotice}>
              <Icon name="info" size={20} color={Colors.primary} />
              <Text style={styles.cardNoticeText}>
                You'll be redirected to our secure payment processor to add your
                debit card details after completing the onboarding.
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <Icon name="security" size={20} color={Colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Bank-Level Security</Text>
            <Text style={styles.infoText}>
              Your payment information is encrypted and stored securely.
              We use industry-standard security measures to protect your data.
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Icon name="schedule" size={20} color={Colors.secondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Payment Schedule</Text>
            <Text style={styles.infoText}>
              Payments are processed daily and typically arrive in your account
              within 1-2 business days.
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Icon name="help" size={20} color={Colors.warning} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Need Help?</Text>
            <Text style={styles.infoText}>
              You can update your payment method anytime from your restaurant
              settings or contact our support team for assistance.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.lightText,
  },
  paymentOptions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  paymentOption: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  paymentOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  paymentOptionDesc: {
    fontSize: 14,
    color: Colors.lightText,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  detailsSection: {
    backgroundColor: Colors.background,
    marginHorizontal: -16,
    marginBottom: -12,
    marginTop: 16,
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  cardNotice: {
    flexDirection: 'row',
    backgroundColor: `${Colors.primary}10`,
    padding: 16,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  cardNoticeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    lineHeight: 20,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
});

export default PaymentSetupStep;