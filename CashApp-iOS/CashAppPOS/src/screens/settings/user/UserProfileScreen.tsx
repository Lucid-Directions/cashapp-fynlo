import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';

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

const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, updateUser, signOut } = useAuth();
  
  if (!user) {
    // This shouldn't happen if authentication is working correctly
    return null;
  }

  // Settings
  const [profileSettings, setProfileSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    twoFactorAuth: true,
    autoLogout: true,
    biometricLogin: true,
    showTips: true,
    shareAnalytics: false,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editableProfile, setEditableProfile] = useState(user);

  const handleSaveProfile = async () => {
    if (!editableProfile.firstName?.trim() || !editableProfile.lastName?.trim()) {
      Alert.alert('Error', 'First name and last name are required.');
      return;
    }

    if (!editableProfile.email?.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    try {
      await updateUser(editableProfile);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditableProfile(user);
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A secure link has been sent to your email address to change your password.',
      [{ text: 'OK' }]
    );
  };

  const handleChangePIN = () => {
    Alert.alert(
      'Change PIN',
      'Please enter your new 4-digit PIN:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => {
          Alert.alert('Success', 'PIN updated successfully!');
        }}
      ]
    );
  };

  const handlePhotoChange = () => {
    Alert.alert(
      'Change Photo',
      'Choose an option:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => {
          Alert.alert('Info', 'Camera would open here');
        }},
        { text: 'Choose from Gallery', onPress: () => {
          Alert.alert('Info', 'Photo gallery would open here');
        }}
      ]
    );
  };

  const toggleSetting = (setting: keyof typeof profileSettings) => {
    setProfileSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Business Owner';
      case 'manager':
        return 'Manager';
      case 'employee':
        return 'Employee';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return 'business';
      case 'manager':
        return 'supervisor-account';
      case 'employee':
        return 'person';
      default:
        return 'person';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={isEditing ? handleSaveProfile : () => setIsEditing(true)}
        >
          <Icon name={isEditing ? "check" : "edit"} size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.photoContainer}
              onPress={isEditing ? handlePhotoChange : undefined}
            >
              {user.photo ? (
                <Image source={{ uri: user.photo }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.defaultPhoto}>
                  <Icon name="person" size={48} color={Colors.mediumGray} />
                </View>
              )}
              {isEditing && (
                <View style={styles.photoEditOverlay}>
                  <Icon name="camera-alt" size={20} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.firstName || 'First'} {user.lastName || 'Last'}
              </Text>
              <View style={styles.roleContainer}>
                <Icon name={getRoleIcon(user.role || 'employee')} size={20} color={Colors.primary} />
                <Text style={styles.roleText}>{getRoleDisplayName(user.role || 'employee')}</Text>
              </View>
              <Text style={styles.employeeId}>ID: {user.employeeId || 'N/A'}</Text>
              <Text style={styles.joinDate}>
                Started: {user.startDate ? user.startDate.toLocaleDateString() : 'N/A'}
              </Text>
              <Text style={styles.lastLogin}>
                Last login: {user.lastLogin ? `${user.lastLogin.toLocaleDateString()} at ${user.lastLogin.toLocaleTimeString()}` : 'Never'}
              </Text>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>First Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editableProfile.firstName || ''}
                  onChangeText={(text) => setEditableProfile(prev => ({ ...prev, firstName: text }))}
                  placeholder="Enter first name"
                />
              ) : (
                <Text style={styles.infoValue}>{user.firstName || 'N/A'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editableProfile.lastName || ''}
                  onChangeText={(text) => setEditableProfile(prev => ({ ...prev, lastName: text }))}
                  placeholder="Enter last name"
                />
              ) : (
                <Text style={styles.infoValue}>{user.lastName || 'N/A'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editableProfile.email || ''}
                  onChangeText={(text) => setEditableProfile(prev => ({ ...prev, email: text }))}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{user.email || 'N/A'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editableProfile.phone || ''}
                  onChangeText={(text) => setEditableProfile(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{user.phone || 'N/A'}</Text>
              )}
            </View>
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Icon name="cancel" size={20} color={Colors.mediumGray} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                <Icon name="check" size={20} color={Colors.white} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.securityItem} onPress={handleChangePassword}>
              <View style={styles.securityItemLeft}>
                <Icon name="lock" size={24} color={Colors.secondary} />
                <View style={styles.securityItemInfo}>
                  <Text style={styles.securityItemTitle}>Password</Text>
                  <Text style={styles.securityItemDescription}>
                    Change your account password
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.securityItem} onPress={handleChangePIN}>
              <View style={styles.securityItemLeft}>
                <Icon name="pin" size={24} color={Colors.secondary} />
                <View style={styles.securityItemInfo}>
                  <Text style={styles.securityItemTitle}>PIN Code</Text>
                  <Text style={styles.securityItemDescription}>
                    Change your 4-digit PIN
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="fingerprint" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Biometric Login</Text>
                  <Text style={styles.settingDescription}>
                    Use fingerprint or Face ID to log in
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.biometricLogin}
                onValueChange={() => toggleSetting('biometricLogin')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="security" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>
                    Extra security for your account
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.twoFactorAuth}
                onValueChange={() => toggleSetting('twoFactorAuth')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="timer" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Auto Logout</Text>
                  <Text style={styles.settingDescription}>
                    Automatically log out after inactivity
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.autoLogout}
                onValueChange={() => toggleSetting('autoLogout')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="email" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive updates via email
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.emailNotifications}
                onValueChange={() => toggleSetting('emailNotifications')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="sms" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>SMS Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive important alerts via SMS
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.smsNotifications}
                onValueChange={() => toggleSetting('smsNotifications')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Privacy & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="help" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Show Tips</Text>
                  <Text style={styles.settingDescription}>
                    Display helpful tips and tutorials
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.showTips}
                onValueChange={() => toggleSetting('showTips')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="analytics" size={24} color={Colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Share Analytics</Text>
                  <Text style={styles.settingDescription}>
                    Help improve the app with usage data
                  </Text>
                </View>
              </View>
              <Switch
                value={profileSettings.shareAnalytics}
                onValueChange={() => toggleSetting('shareAnalytics')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Export data functionality would be implemented here')}
            >
              <Icon name="file-download" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Export My Data</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: signOut }
                ]
              )}
            >
              <Icon name="logout" size={24} color={Colors.warning} />
              <Text style={[styles.actionButtonText, { color: Colors.warning }]}>Sign Out</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert(
                'Delete Account',
                'This action cannot be undone. All your data will be permanently deleted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => {
                    Alert.alert('Info', 'Account deletion would be handled here');
                  }}
                ]
              )}
            >
              <Icon name="delete-forever" size={24} color={Colors.danger} />
              <Text style={[styles.actionButtonText, { color: Colors.danger }]}>Delete Account</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  employeeId: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 2,
  },
  lastLogin: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.darkGray,
    flex: 2,
    textAlign: 'right',
  },
  textInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
    textAlign: 'right',
  },
  editActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.mediumGray,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  securityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  securityItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  securityItemDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  actionCard: {
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
});

export default UserProfileScreen;