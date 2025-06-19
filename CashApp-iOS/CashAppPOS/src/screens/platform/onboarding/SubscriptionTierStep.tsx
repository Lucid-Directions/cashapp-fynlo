import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RestaurantOnboardingData } from './RestaurantOnboardingScreen';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface SubscriptionTierStepProps {
  data: RestaurantOnboardingData;
  onUpdate: (updates: Partial<RestaurantOnboardingData>) => void;
}

const subscriptionTiers = [
  {
    id: 'basic',
    name: 'Basic',
    price: '£29',
    period: 'per month',
    commission: 2.5,
    features: [
      'Point of Sale System',
      'Basic Reporting',
      'Email Support',
      'Up to 3 Staff Accounts',
      'Standard Payment Processing',
    ],
    color: Colors.mediumGray,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '£79',
    period: 'per month',
    commission: 2.0,
    features: [
      'Everything in Basic',
      'Advanced Analytics',
      'Priority Support',
      'Unlimited Staff Accounts',
      'Inventory Management',
      'Customer Loyalty Program',
      'API Access',
    ],
    color: Colors.primary,
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '£149',
    period: 'per month',
    commission: 1.5,
    features: [
      'Everything in Premium',
      'Multi-Location Support',
      'Dedicated Account Manager',
      '24/7 Phone Support',
      'Custom Integrations',
      'Advanced Security Features',
      'White-Label Options',
      'Priority Feature Requests',
    ],
    color: Colors.secondary,
  },
];

const SubscriptionTierStep: React.FC<SubscriptionTierStepProps> = ({ data, onUpdate }) => {
  const handleTierSelect = (tierId: string, commission: number) => {
    onUpdate({
      subscriptionTier: tierId as 'basic' | 'premium' | 'enterprise',
      commissionRate: commission,
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Subscription Plan</Text>
        <Text style={styles.subtitle}>
          Select the plan that best fits your restaurant's needs
        </Text>
      </View>

      {subscriptionTiers.map((tier) => (
        <TouchableOpacity
          key={tier.id}
          style={[
            styles.tierCard,
            data.subscriptionTier === tier.id && styles.tierCardActive,
            tier.recommended && styles.tierCardRecommended,
          ]}
          onPress={() => handleTierSelect(tier.id, tier.commission)}
        >
          {tier.recommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>RECOMMENDED</Text>
            </View>
          )}

          <View style={styles.tierHeader}>
            <View>
              <Text style={[styles.tierName, { color: tier.color }]}>
                {tier.name}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{tier.price}</Text>
                <Text style={styles.period}>{tier.period}</Text>
              </View>
              <Text style={styles.commission}>
                {tier.commission}% transaction fee
              </Text>
            </View>
            {data.subscriptionTier === tier.id && (
              <View style={[styles.checkCircle, { backgroundColor: tier.color }]}>
                <Icon name="check" size={20} color={Colors.white} />
              </View>
            )}
          </View>

          <View style={styles.featuresSection}>
            {tier.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Icon 
                  name="check-circle" 
                  size={16} 
                  color={data.subscriptionTier === tier.id ? tier.color : Colors.mediumGray}
                />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <Icon name="info" size={20} color={Colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Transaction Fees</Text>
            <Text style={styles.infoText}>
              Transaction fees are charged on each sale processed through the POS system.
              Higher tier plans have lower transaction fees.
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Icon name="sync" size={20} color={Colors.secondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Flexible Plans</Text>
            <Text style={styles.infoText}>
              You can upgrade or downgrade your plan at any time. Changes take effect
              at the start of your next billing cycle.
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
  tierCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  tierCardActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  tierCardRecommended: {
    borderColor: Colors.primary,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  period: {
    fontSize: 16,
    color: Colors.lightText,
    marginLeft: 8,
  },
  commission: {
    fontSize: 14,
    color: Colors.lightText,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
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

export default SubscriptionTierStep;