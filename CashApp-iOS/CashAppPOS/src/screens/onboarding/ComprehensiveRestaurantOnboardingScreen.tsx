import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design-system/ThemeProvider';
import FastInput from '../../components/ui/FastInput';
import { useRestaurantConfig } from '../../hooks/useRestaurantConfig';

interface RestaurantFormData {
  // Basic Information
  restaurantName: string;
  displayName: string;
  businessType: string;
  description: string;
  
  // Contact Information
  phone: string;
  email: string;
  website: string;
  
  // Location Information
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  
  // Business Hours
  operatingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  
  // Owner Information
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'manager' | 'employee' | 'chef' | 'waiter';
  hourlyRate: string;
  startDate: string;
  accessLevel: 'full' | 'pos_only' | 'reports_only';
}

const ComprehensiveRestaurantOnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { updateConfig, completeSetupStep } = useRestaurantConfig();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<RestaurantFormData>({
    restaurantName: '',
    displayName: '',
    businessType: 'Restaurant',
    description: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United Kingdom',
    operatingHours: {
      monday: { open: '09:00', close: '22:00', closed: false },
      tuesday: { open: '09:00', close: '22:00', closed: false },
      wednesday: { open: '09:00', close: '22:00', closed: false },
      thursday: { open: '09:00', close: '22:00', closed: false },
      friday: { open: '09:00', close: '22:00', closed: false },
      saturday: { open: '09:00', close: '22:00', closed: false },
      sunday: { open: '09:00', close: '22:00', closed: false },
    },
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    name: '',
    email: '',
    phone: '',
    role: 'employee',
    hourlyRate: '',
    startDate: new Date().toISOString().split('T')[0],
    accessLevel: 'pos_only',
  });

  const totalSteps = 8;
  const businessTypes = [
    'Restaurant', 'Fast Food', 'Cafe', 'Bar & Pub', 'Food Truck',
    'Bakery', 'Pizzeria', 'Bistro', 'Fine Dining', 'Other'
  ];

  const employeeRoles = [
    { value: 'manager', label: 'Manager', icon: 'supervisor-account' },
    { value: 'employee', label: 'General Staff', icon: 'person' },
    { value: 'chef', label: 'Chef/Kitchen', icon: 'restaurant' },
    { value: 'waiter', label: 'Server/Waiter', icon: 'room-service' },
  ];

  const accessLevels = [
    { value: 'full', label: 'Full Access', description: 'All features including settings' },
    { value: 'pos_only', label: 'POS Only', description: 'Sales and orders only' },
    { value: 'reports_only', label: 'Reports Only', description: 'View reports and analytics' },
  ];

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const updateField = (field: keyof RestaurantFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate display name from restaurant name if not manually set
      if (field === 'restaurantName' && !prev.displayName) {
        updated.displayName = value;
      }
      
      return updated;
    });
  };

  const addEmployee = () => {
    if (!newEmployee.name || !newEmployee.email) {
      Alert.alert('Missing Information', 'Please enter at least name and email for the employee.');
      return;
    }

    const employee: Employee = {
      id: Date.now().toString(),
      name: newEmployee.name!,
      email: newEmployee.email!,
      phone: newEmployee.phone || '',
      role: newEmployee.role as Employee['role'],
      hourlyRate: newEmployee.hourlyRate || '0',
      startDate: newEmployee.startDate!,
      accessLevel: newEmployee.accessLevel as Employee['accessLevel'],
    };

    setEmployees(prev => [...prev, employee]);
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      role: 'employee',
      hourlyRate: '',
      startDate: new Date().toISOString().split('T')[0],
      accessLevel: 'pos_only',
    });
  };

  const removeEmployee = (id: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== id));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Basic Info
        return !!(formData.restaurantName && formData.displayName && formData.businessType);
      case 2: // Contact
        return !!(formData.phone && formData.email);
      case 3: // Location
        return !!(formData.street && formData.city && formData.zipCode);
      case 4: // Owner Info
        return !!(formData.ownerName && formData.ownerEmail);
      case 5: // Business Hours
        return true; // Optional
      case 6: // Employees
        return true; // Optional
      case 7: // Menu Setup
        return true; // Optional but recommended
      case 8: // Review
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      Alert.alert('Missing Information', 'Please fill in all required fields before continuing.');
      return;
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = async () => {
    try {
      setLoading(true);
      
      // Save restaurant information
      await updateConfig({
        restaurantName: formData.restaurantName,
        displayName: formData.displayName,
        businessType: formData.businessType,
        description: formData.description,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },
        operatingHours: formData.operatingHours,
        owner: {
          name: formData.ownerName,
          email: formData.ownerEmail,
          phone: formData.ownerPhone,
        },
        employees: employees,
      });

      await completeSetupStep('restaurantOnboarding');
      
      Alert.alert(
        'Onboarding Complete! 🎉',
        `Welcome to Finlow, ${formData.restaurantName}! Your restaurant is now fully set up and ready to start taking orders.`,
        [
          {
            text: 'Start Using POS',
            onPress: () => navigation.navigate('MainPOS' as never),
          },
          {
            text: 'Configure Menu',
            onPress: () => navigation.navigate('SettingsMenuManagement' as never),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepIndicatorContent}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1;
          return (
            <View key={step} style={styles.stepIndicatorItem}>
              <View style={[
                styles.stepCircle,
                currentStep >= step && styles.stepCircleActive,
                currentStep > step && styles.stepCircleCompleted,
              ]}>
                {currentStep > step ? (
                  <Icon name="check" size={16} color={theme.colors.white} />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    currentStep >= step && styles.stepNumberActive,
                  ]}>
                    {step}
                  </Text>
                )}
              </View>
              {step < totalSteps && (
                <View style={[
                  styles.stepLine,
                  currentStep > step && styles.stepLineCompleted,
                ]} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Restaurant Information</Text>
      <Text style={styles.stepDescription}>
        Let's start with basic information about your restaurant
      </Text>

      <FastInput
        label="Restaurant Name *"
        inputType="text"
        value={formData.restaurantName}
        onChangeText={(value) => updateField('restaurantName', value)}
        placeholder="e.g., Maria's Mexican Kitchen"
      />

      <FastInput
        label="Display Name *"
        inputType="text"
        value={formData.displayName}
        onChangeText={(value) => updateField('displayName', value)}
        placeholder="e.g., Maria's Kitchen"
        containerStyle={styles.inputHint}
      />
      <Text style={styles.hintText}>This is what appears in your POS headers</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Type *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.businessTypeScroll}>
          {businessTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.businessTypeButton,
                formData.businessType === type && styles.businessTypeButtonActive,
              ]}
              onPress={() => updateField('businessType', type)}
            >
              <Text style={[
                styles.businessTypeText,
                formData.businessType === type && styles.businessTypeTextActive,
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FastInput
        label="Description (Optional)"
        inputType="text"
        value={formData.description}
        onChangeText={(value) => updateField('description', value)}
        placeholder="Brief description of your restaurant's specialty"
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Contact Information</Text>
      <Text style={styles.stepDescription}>
        How can customers and Finlow support reach you?
      </Text>

      <FastInput
        label="Phone Number *"
        inputType="phone"
        value={formData.phone}
        onChangeText={(value) => updateField('phone', value)}
        placeholder="+44 20 1234 5678"
      />

      <FastInput
        label="Email Address *"
        inputType="email"
        value={formData.email}
        onChangeText={(value) => updateField('email', value)}
        placeholder="owner@mariaskitchen.co.uk"
      />

      <FastInput
        label="Website (Optional)"
        inputType="text"
        value={formData.website}
        onChangeText={(value) => updateField('website', value)}
        placeholder="https://mariaskitchen.co.uk"
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Restaurant Location</Text>
      <Text style={styles.stepDescription}>
        Your restaurant's physical address for deliveries and customers
      </Text>

      <FastInput
        label="Street Address *"
        inputType="text"
        value={formData.street}
        onChangeText={(value) => updateField('street', value)}
        placeholder="123 High Street"
      />

      <View style={styles.inputRow}>
        <View style={{ flex: 2 }}>
          <FastInput
            label="City *"
            inputType="text"
            value={formData.city}
            onChangeText={(value) => updateField('city', value)}
            placeholder="London"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <FastInput
            label="Postcode *"
            inputType="text"
            value={formData.zipCode}
            onChangeText={(value) => updateField('zipCode', value)}
            placeholder="SW1A 1AA"
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <FastInput
            label="County/State"
            inputType="text"
            value={formData.state}
            onChangeText={(value) => updateField('state', value)}
            placeholder="Greater London"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <FastInput
            label="Country"
            inputType="text"
            value={formData.country}
            onChangeText={(value) => updateField('country', value)}
            placeholder="United Kingdom"
            editable={false}
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Owner Information</Text>
      <Text style={styles.stepDescription}>
        Primary owner/manager contact details
      </Text>

      <FastInput
        label="Owner/Manager Name *"
        inputType="text"
        value={formData.ownerName}
        onChangeText={(value) => updateField('ownerName', value)}
        placeholder="Maria Rodriguez"
      />

      <FastInput
        label="Owner Email *"
        inputType="email"
        value={formData.ownerEmail}
        onChangeText={(value) => updateField('ownerEmail', value)}
        placeholder="maria@mariaskitchen.co.uk"
      />

      <FastInput
        label="Owner Phone"
        inputType="phone"
        value={formData.ownerPhone}
        onChangeText={(value) => updateField('ownerPhone', value)}
        placeholder="+44 7123 456789"
      />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Business Hours</Text>
      <Text style={styles.stepDescription}>
        Set your restaurant's operating hours
      </Text>

      {dayNames.map((day, index) => (
        <View key={day} style={styles.businessHourRow}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayLabel}>{dayLabels[index]}</Text>
            <Switch
              value={!formData.operatingHours[day].closed}
              onValueChange={(value) => {
                updateField('operatingHours', {
                  ...formData.operatingHours,
                  [day]: { ...formData.operatingHours[day], closed: !value }
                });
              }}
              trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
            />
          </View>
          
          {!formData.operatingHours[day].closed && (
            <View style={styles.timeInputs}>
              <View style={styles.timeInput}>
                <FastInput
                  label="Open"
                  inputType="text"
                  value={formData.operatingHours[day].open}
                  onChangeText={(value) => {
                    updateField('operatingHours', {
                      ...formData.operatingHours,
                      [day]: { ...formData.operatingHours[day], open: value }
                    });
                  }}
                  placeholder="09:00"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <Text style={styles.timeSeparator}>to</Text>
              <View style={styles.timeInput}>
                <FastInput
                  label="Close"
                  inputType="text"
                  value={formData.operatingHours[day].close}
                  onChangeText={(value) => {
                    updateField('operatingHours', {
                      ...formData.operatingHours,
                      [day]: { ...formData.operatingHours[day], close: value }
                    });
                  }}
                  placeholder="22:00"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Employee Management</Text>
      <Text style={styles.stepDescription}>
        Add your team members and set their access levels
      </Text>

      {/* Add New Employee */}
      <View style={styles.addEmployeeSection}>
        <Text style={styles.sectionTitle}>Add New Employee</Text>
        
        <View style={styles.inputRow}>
          <View style={{ flex: 2 }}>
            <FastInput
              label="Full Name"
              inputType="text"
              value={newEmployee.name || ''}
              onChangeText={(value) => setNewEmployee(prev => ({ ...prev, name: value }))}
              placeholder="John Smith"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {employeeRoles.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleButton,
                      newEmployee.role === role.value && styles.roleButtonActive,
                    ]}
                    onPress={() => setNewEmployee(prev => ({ ...prev, role: role.value as Employee['role'] }))}
                  >
                    <Icon name={role.icon} size={16} color={newEmployee.role === role.value ? theme.colors.white : theme.colors.text} />
                    <Text style={[
                      styles.roleText,
                      newEmployee.role === role.value && styles.roleTextActive,
                    ]}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={{ flex: 2 }}>
            <FastInput
              label="Email"
              inputType="email"
              value={newEmployee.email || ''}
              onChangeText={(value) => setNewEmployee(prev => ({ ...prev, email: value }))}
              placeholder="john@mariaskitchen.co.uk"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <FastInput
              label="Hourly Rate (£)"
              inputType="currency"
              value={newEmployee.hourlyRate || ''}
              onChangeText={(value) => setNewEmployee(prev => ({ ...prev, hourlyRate: value }))}
              placeholder="12.50"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Access Level</Text>
          <View style={styles.accessLevelContainer}>
            {accessLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.accessLevelButton,
                  newEmployee.accessLevel === level.value && styles.accessLevelButtonActive,
                ]}
                onPress={() => setNewEmployee(prev => ({ ...prev, accessLevel: level.value as Employee['accessLevel'] }))}
              >
                <Text style={[
                  styles.accessLevelTitle,
                  newEmployee.accessLevel === level.value && styles.accessLevelTitleActive,
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.accessLevelDescription,
                  newEmployee.accessLevel === level.value && styles.accessLevelDescriptionActive,
                ]}>
                  {level.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.addEmployeeButton} onPress={addEmployee}>
          <Icon name="add" size={20} color={theme.colors.white} />
          <Text style={styles.addEmployeeButtonText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      {/* Employee List */}
      {employees.length > 0 && (
        <View style={styles.employeeListSection}>
          <Text style={styles.sectionTitle}>Team Members ({employees.length})</Text>
          {employees.map((employee) => (
            <View key={employee.id} style={styles.employeeCard}>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeeRole}>{employeeRoles.find(r => r.value === employee.role)?.label}</Text>
                <Text style={styles.employeeDetails}>{employee.email} • £{employee.hourlyRate}/hr</Text>
              </View>
              <TouchableOpacity
                style={styles.removeEmployeeButton}
                onPress={() => removeEmployee(employee.id)}
              >
                <Icon name="delete" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMenuSetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Menu Setup</Text>
      <Text style={styles.stepDescription}>
        Set up your restaurant menu. You can add categories and items now or do it later.
      </Text>

      <View style={styles.menuSetupContainer}>
        <Icon name="restaurant-menu" size={64} color={theme.colors.primary} />
        <Text style={styles.menuSetupText}>
          Your menu is essential for taking orders. You can:
        </Text>
        
        <View style={styles.menuOptions}>
          <View style={styles.menuOption}>
            <Icon name="check-circle" size={24} color={theme.colors.success} />
            <Text style={styles.menuOptionText}>
              Add menu categories (e.g., Appetizers, Main Courses, Drinks)
            </Text>
          </View>
          
          <View style={styles.menuOption}>
            <Icon name="check-circle" size={24} color={theme.colors.success} />
            <Text style={styles.menuOptionText}>
              Add items with prices and descriptions
            </Text>
          </View>
          
          <View style={styles.menuOption}>
            <Icon name="check-circle" size={24} color={theme.colors.success} />
            <Text style={styles.menuOptionText}>
              Set item availability and featured items
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.setupMenuButton}
          onPress={() => {
            // Navigate to menu management screen
            navigation.navigate('MenuManagement' as never);
          }}
        >
          <Icon name="restaurant-menu" size={20} color={theme.colors.white} />
          <Text style={styles.setupMenuButtonText}>Set Up Menu Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            Alert.alert(
              'Skip Menu Setup?',
              'You can always add your menu later from the Settings menu.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Skip', onPress: () => nextStep() }
              ]
            );
          }}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep7 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Complete</Text>
      <Text style={styles.stepDescription}>
        Review your restaurant setup before completing onboarding
      </Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Restaurant Information</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Name:</Text>
          <Text style={styles.reviewValue}>{formData.restaurantName}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Type:</Text>
          <Text style={styles.reviewValue}>{formData.businessType}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Contact:</Text>
          <Text style={styles.reviewValue}>{formData.phone} • {formData.email}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Address:</Text>
          <Text style={styles.reviewValue}>{formData.street}, {formData.city} {formData.zipCode}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Team</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Owner:</Text>
          <Text style={styles.reviewValue}>{formData.ownerName}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Employees:</Text>
          <Text style={styles.reviewValue}>{employees.length} team members added</Text>
        </View>
      </View>

      <View style={styles.completionMessage}>
        <Icon name="check-circle" size={48} color={theme.colors.success} />
        <Text style={styles.completionTitle}>Ready to Launch!</Text>
        <Text style={styles.completionDescription}>
          Your restaurant is fully configured and ready to start taking orders with Finlow POS.
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderMenuSetup();
      case 8: return renderStep7();
      default: return renderStep1();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      height: 70,
    },
    backButton: {
      padding: 8,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.white,
    },
    headerSubtitle: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: 2,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    stepIndicator: {
      backgroundColor: theme.colors.white,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingVertical: 16,
    },
    stepIndicatorContent: {
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    stepIndicatorItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.lightGray,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    stepCircleActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    stepCircleCompleted: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    stepNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    stepNumberActive: {
      color: theme.colors.white,
    },
    stepLine: {
      width: 30,
      height: 2,
      backgroundColor: theme.colors.border,
      marginHorizontal: 8,
    },
    stepLineCompleted: {
      backgroundColor: theme.colors.success,
    },
    scrollContainer: {
      flex: 1,
    },
    stepContent: {
      padding: 24,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    stepDescription: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 32,
      lineHeight: 22,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputRow: {
      flexDirection: 'row',
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputHint: {
      marginBottom: 4,
    },
    hintText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      fontStyle: 'italic',
    },
    businessTypeScroll: {
      marginTop: 8,
    },
    businessTypeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    businessTypeButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    businessTypeText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    businessTypeTextActive: {
      color: theme.colors.white,
    },
    businessHourRow: {
      marginBottom: 16,
      padding: 16,
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dayInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    dayLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    timeInputs: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeInput: {
      flex: 1,
    },
    timeSeparator: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginHorizontal: 12,
      marginTop: 24,
    },
    addEmployeeSection: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    roleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    roleButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    roleText: {
      fontSize: 12,
      color: theme.colors.text,
      marginLeft: 4,
    },
    roleTextActive: {
      color: theme.colors.white,
    },
    accessLevelContainer: {
      gap: 12,
    },
    accessLevelButton: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    accessLevelButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    accessLevelTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    accessLevelTitleActive: {
      color: theme.colors.white,
    },
    accessLevelDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    accessLevelDescriptionActive: {
      color: theme.colors.white,
    },
    addEmployeeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 16,
    },
    addEmployeeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.white,
      marginLeft: 8,
    },
    employeeListSection: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    employeeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      marginBottom: 12,
    },
    employeeInfo: {
      flex: 1,
    },
    employeeName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    employeeRole: {
      fontSize: 14,
      color: theme.colors.primary,
      marginTop: 2,
    },
    employeeDetails: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    removeEmployeeButton: {
      padding: 8,
    },
    reviewSection: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    reviewSectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    reviewItem: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    reviewLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      width: 80,
    },
    reviewValue: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
    },
    completionMessage: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    completionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    completionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    navigationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: theme.colors.white,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    prevButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
    },
    prevButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginLeft: 8,
    },
    navigationSpacer: {
      flex: 1,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    nextButtonDisabled: {
      backgroundColor: theme.colors.textSecondary,
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.white,
      marginRight: 8,
    },
    menuSetupContainer: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    menuSetupText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    menuOptions: {
      width: '100%',
      marginBottom: 32,
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    menuOptionText: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    setupMenuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      marginBottom: 16,
    },
    setupMenuButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.white,
      marginLeft: 8,
    },
    skipButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    skipButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textDecorationLine: 'underline',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Restaurant Setup</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of {totalSteps}</Text>
        </View>
        
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderStepIndicator()}

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationBar}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.prevButton}
              onPress={prevStep}
            >
              <Icon name="arrow-back" size={20} color={theme.colors.text} />
              <Text style={styles.prevButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.navigationSpacer} />
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              !validateStep(currentStep) && styles.nextButtonDisabled,
            ]}
            onPress={nextStep}
            disabled={loading || !validateStep(currentStep)}
          >
            <Text style={styles.nextButtonText}>
              {loading ? 'Saving...' : currentStep === totalSteps ? 'Complete Setup' : 'Next'}
            </Text>
            {!loading && (
              <Icon 
                name={currentStep === totalSteps ? "check" : "arrow-forward"} 
                size={20} 
                color={theme.colors.white} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ComprehensiveRestaurantOnboardingScreen;