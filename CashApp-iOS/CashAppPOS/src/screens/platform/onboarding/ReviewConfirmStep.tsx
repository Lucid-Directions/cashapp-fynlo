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
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface ReviewConfirmStepProps {
  data: RestaurantOnboardingData;
  onEdit: (step: number) => void;
}

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({ data, onEdit }) => {
  const formatBusinessHours = () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return days.map((day, index) => {
      const hours = data.businessHours[day];
      if (!hours.isOpen) {
        return `${dayNames[index]}: Closed`;
      }
      
      const formatTime = (time: string) => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${m} ${ampm}`;
      };
      
      return `${dayNames[index]}: ${formatTime(hours.openTime)} - ${formatTime(hours.closeTime)}`;
    });
  };

  const getSubscriptionDetails = () => {
    switch (data.subscriptionTier) {
      case 'basic':
        return { name: 'Basic', price: '£29/month', commission: '2.5%' };
      case 'premium':
        return { name: 'Premium', price: '£79/month', commission: '2.0%' };
      case 'enterprise':
        return { name: 'Enterprise', price: '£149/month', commission: '1.5%' };
      default:
        return { name: 'Basic', price: '£29/month', commission: '2.5%' };
    }
  };

  const subscription = getSubscriptionDetails();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Your Information</Text>
        <Text style={styles.subtitle}>
          Please review all details before creating your restaurant
        </Text>
      </View>

      {/* Restaurant Details Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Restaurant Details</Text>
          <TouchableOpacity onPress={() => onEdit(0)}>
            <Icon name="edit" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Name</Text>
          <Text style={styles.detailValue}>{data.name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cuisine Type</Text>
          <Text style={styles.detailValue}>
            {data.cuisineType.charAt(0).toUpperCase() + data.cuisineType.slice(1)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Address</Text>
          <Text style={styles.detailValue}>
            {data.address}{'\n'}
            {data.city}, {data.postalCode}{'\n'}
            {data.country}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone</Text>
          <Text style={styles.detailValue}>{data.phone}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text style={styles.detailValue}>{data.email}</Text>
        </View>
        
        {data.website && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Website</Text>
            <Text style={styles.detailValue}>{data.website}</Text>
          </View>
        )}
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Subscription Plan</Text>
          <TouchableOpacity onPress={() => onEdit(1)}>
            <Icon name="edit" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Text style={styles.subscriptionName}>{subscription.name}</Text>
            <Text style={styles.subscriptionPrice}>{subscription.price}</Text>
          </View>
          <Text style={styles.subscriptionCommission}>
            {subscription.commission} transaction fee
          </Text>
        </View>
      </View>

      {/* Business Hours Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Business Hours</Text>
          <TouchableOpacity onPress={() => onEdit(2)}>
            <Icon name="edit" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.hoursContainer}>
          {formatBusinessHours().map((hours, index) => (
            <Text key={index} style={styles.hoursText}>{hours}</Text>
          ))}
        </View>
      </View>

      {/* Payment Method Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity onPress={() => onEdit(3)}>
            <Icon name="edit" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        {data.paymentMethod.type === 'bank_transfer' ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>Bank Transfer</Text>
            </View>
            {data.paymentMethod.bankName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bank</Text>
                <Text style={styles.detailValue}>{data.paymentMethod.bankName}</Text>
              </View>
            )}
            {data.paymentMethod.accountNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account</Text>
                <Text style={styles.detailValue}>
                  ****{data.paymentMethod.accountNumber.slice(-4)}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>Debit Card</Text>
          </View>
        )}
      </View>

      {/* Terms and Conditions */}
      <View style={styles.termsContainer}>
        <Icon name="check-circle" size={20} color={Colors.primary} />
        <Text style={styles.termsText}>
          By creating this restaurant, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
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
  section: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.lightText,
  },
  detailValue: {
    flex: 2,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'right',
  },
  subscriptionCard: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  subscriptionPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
  subscriptionCommission: {
    fontSize: 14,
    color: Colors.lightText,
  },
  hoursContainer: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 8,
  },
  hoursText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  termsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});

export default ReviewConfirmStep;