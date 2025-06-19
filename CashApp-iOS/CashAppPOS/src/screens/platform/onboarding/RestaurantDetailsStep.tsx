import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
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
  danger: '#E74C3C',
};

interface RestaurantDetailsStepProps {
  data: RestaurantOnboardingData;
  onUpdate: (updates: Partial<RestaurantOnboardingData>) => void;
}

const cuisineTypes = [
  { value: 'mexican', label: 'Mexican', icon: '🌮' },
  { value: 'italian', label: 'Italian', icon: '🍝' },
  { value: 'american', label: 'American', icon: '🍔' },
  { value: 'chinese', label: 'Chinese', icon: '🥟' },
  { value: 'indian', label: 'Indian', icon: '🍛' },
  { value: 'japanese', label: 'Japanese', icon: '🍱' },
  { value: 'thai', label: 'Thai', icon: '🍜' },
  { value: 'british', label: 'British', icon: '🇬🇧' },
  { value: 'french', label: 'French', icon: '🥐' },
  { value: 'other', label: 'Other', icon: '🍽️' },
];

const RestaurantDetailsStep: React.FC<RestaurantDetailsStepProps> = ({ data, onUpdate }) => {
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Restaurant Name *</Text>
          <TextInput
            style={styles.input}
            value={data.name}
            onChangeText={(text) => onUpdate({ name: text })}
            placeholder="Enter restaurant name"
            placeholderTextColor={Colors.mediumGray}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cuisine Type *</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.cuisineScroll}
          >
            {cuisineTypes.map((cuisine) => (
              <TouchableOpacity
                key={cuisine.value}
                style={[
                  styles.cuisineOption,
                  data.cuisineType === cuisine.value && styles.cuisineOptionActive,
                ]}
                onPress={() => onUpdate({ cuisineType: cuisine.value })}
              >
                <Text style={styles.cuisineIcon}>{cuisine.icon}</Text>
                <Text
                  style={[
                    styles.cuisineLabel,
                    data.cuisineType === cuisine.value && styles.cuisineLabelActive,
                  ]}
                >
                  {cuisine.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            value={data.address}
            onChangeText={(text) => onUpdate({ address: text })}
            placeholder="123 Main Street"
            placeholderTextColor={Colors.mediumGray}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex1]}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              value={data.city}
              onChangeText={(text) => onUpdate({ city: text })}
              placeholder="London"
              placeholderTextColor={Colors.mediumGray}
            />
          </View>
          
          <View style={[styles.inputGroup, styles.flex1, styles.marginLeft]}>
            <Text style={styles.label}>Postal Code *</Text>
            <TextInput
              style={styles.input}
              value={data.postalCode}
              onChangeText={(text) => onUpdate({ postalCode: text })}
              placeholder="SW1A 1AA"
              placeholderTextColor={Colors.mediumGray}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Country *</Text>
          <TouchableOpacity style={styles.selectInput}>
            <Text style={styles.selectText}>{data.country}</Text>
            <Icon name="arrow-drop-down" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[
              styles.input,
              data.phone && !validatePhone(data.phone) && styles.inputError,
            ]}
            value={data.phone}
            onChangeText={(text) => onUpdate({ phone: text })}
            placeholder="+44 20 1234 5678"
            placeholderTextColor={Colors.mediumGray}
            keyboardType="phone-pad"
          />
          {data.phone && !validatePhone(data.phone) && (
            <Text style={styles.errorText}>Please enter a valid phone number</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={[
              styles.input,
              data.email && !validateEmail(data.email) && styles.inputError,
            ]}
            value={data.email}
            onChangeText={(text) => onUpdate({ email: text })}
            placeholder="restaurant@example.com"
            placeholderTextColor={Colors.mediumGray}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {data.email && !validateEmail(data.email) && (
            <Text style={styles.errorText}>Please enter a valid email address</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Website (Optional)</Text>
          <TextInput
            style={styles.input}
            value={data.website}
            onChangeText={(text) => onUpdate({ website: text })}
            placeholder="https://www.restaurant.com"
            placeholderTextColor={Colors.mediumGray}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Icon name="info" size={20} color={Colors.primary} />
        <Text style={styles.infoText}>
          All fields marked with * are required. This information will be used
          for your restaurant profile and customer communications.
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
  section: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
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
  inputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  selectText: {
    fontSize: 16,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  marginLeft: {
    marginLeft: 12,
  },
  cuisineScroll: {
    marginHorizontal: -4,
  },
  cuisineOption: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    minWidth: 80,
  },
  cuisineOptionActive: {
    backgroundColor: Colors.primary,
  },
  cuisineIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  cuisineLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  cuisineLabelActive: {
    color: Colors.white,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${Colors.primary}10`,
    padding: 16,
    margin: 20,
    marginTop: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default RestaurantDetailsStep;