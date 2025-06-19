import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Import step components
import RestaurantDetailsStep from './RestaurantDetailsStep';
import SubscriptionTierStep from './SubscriptionTierStep';
import BusinessHoursStep from './BusinessHoursStep';
import PaymentSetupStep from './PaymentSetupStep';
import ReviewConfirmStep from './ReviewConfirmStep';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

export interface RestaurantOnboardingData {
  // Restaurant Details
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  cuisineType: string;
  
  // Subscription
  subscriptionTier: 'basic' | 'premium' | 'enterprise';
  commissionRate: number;
  
  // Business Hours
  businessHours: {
    [key: string]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
  };
  
  // Payment Method
  paymentMethod: {
    type: 'bank_transfer' | 'card';
    bankName?: string;
    accountNumber?: string;
    sortCode?: string;
    cardLastFour?: string;
  };
}

const RestaurantOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<RestaurantOnboardingData>({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'UK',
    phone: '',
    email: '',
    cuisineType: 'other',
    subscriptionTier: 'basic',
    commissionRate: 2.5,
    businessHours: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
      saturday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
      sunday: { isOpen: false, openTime: '09:00', closeTime: '21:00' },
    },
    paymentMethod: {
      type: 'bank_transfer',
    },
  });

  const steps = [
    { title: 'Restaurant Details', icon: 'store' },
    { title: 'Subscription', icon: 'card-membership' },
    { title: 'Business Hours', icon: 'schedule' },
    { title: 'Payment Setup', icon: 'payment' },
    { title: 'Review & Confirm', icon: 'check-circle' },
  ];

  const updateFormData = (updates: Partial<RestaurantOnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    try {
      // Show loading state
      Alert.alert(
        'Creating Restaurant',
        'Please wait while we set up your restaurant...'
      );

      // Simulate API call
      setTimeout(() => {
        Alert.alert(
          'Success!',
          'Restaurant has been successfully created.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to create restaurant. Please try again.');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <RestaurantDetailsStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 1:
        return (
          <SubscriptionTierStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 2:
        return (
          <BusinessHoursStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 3:
        return (
          <PaymentSetupStep
            data={formData}
            onUpdate={updateFormData}
          />
        );
      case 4:
        return (
          <ReviewConfirmStep
            data={formData}
            onEdit={(step) => setCurrentStep(step)}
          />
        );
      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return (
          formData.name.trim() !== '' &&
          formData.address.trim() !== '' &&
          formData.city.trim() !== '' &&
          formData.postalCode.trim() !== '' &&
          formData.phone.trim() !== '' &&
          formData.email.trim() !== ''
        );
      case 1:
        return true; // Subscription tier is always valid
      case 2:
        return true; // Business hours are always valid
      case 3:
        return formData.paymentMethod.type !== null;
      case 4:
        return true; // Review step is always valid
      default:
        return false;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Restaurant</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Icon name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepIndicator}>
            <View
              style={[
                styles.stepCircle,
                index === currentStep && styles.stepCircleActive,
                index < currentStep && styles.stepCircleCompleted,
              ]}
            >
              {index < currentStep ? (
                <Icon name="check" size={16} color={Colors.white} />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    (index === currentStep || index < currentStep) && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  index < currentStep && styles.stepLineCompleted,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {/* Step Title */}
      <View style={styles.stepTitleContainer}>
        <Icon
          name={steps[currentStep].icon}
          size={24}
          color={Colors.primary}
          style={styles.stepIcon}
        />
        <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
      </View>

      {/* Step Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleBack}
        >
          <Text style={styles.buttonSecondaryText}>
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, !isStepValid() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!isStepValid()}
        >
          <Text style={styles.buttonPrimaryText}>
            {currentStep === steps.length - 1 ? 'Create Restaurant' : 'Next'}
          </Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: Colors.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  stepNumberActive: {
    color: Colors.white,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: Colors.success,
  },
  stepTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepIcon: {
    marginRight: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RestaurantOnboardingScreen;