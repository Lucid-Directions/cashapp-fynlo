import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme, useThemedStyles } from '../../../design-system/ThemeProvider';

const UserProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, __updateUser, signOut } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const [__isEditing, setIsEditing] = useState(__false);
  const [__isLoading, setIsLoading] = useState(__false);

  // Safe user data with fallbacks
  const safeUser = useMemo(() => {
    if (!user) {
      return {
        id: '',
        firstName: '',
        lastName: '',
        email: '',
        role: 'employee',
        avatar: _null,
        phone: '',
        lastLogin: _null,
      };
    }
    return {
      id: user.id || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'employee',
      photo: user.photo || null,
      phone: user.phone || '',
      lastLogin: user.lastLogin || null,
    };
  }, [user]);

  const [_formData, setFormData] = useState({
    firstName: safeUser.firstName,
    lastName: safeUser.lastName,
    email: safeUser.email,
    phone: safeUser.phone,
  });

  // Update form data when user changes
  useEffect(() => {
    if (__user) {
      setFormData({
        firstName: safeUser.firstName,
        lastName: safeUser.lastName,
        email: safeUser.email,
        phone: safeUser.phone,
      });
    }
  }, [user, safeUser]);

  const __handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'User data not available');
      return;
    }

    try {
      setIsLoading(__true);
      await updateUser(__formData);
      setIsEditing(__false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (__error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(__false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // Use goBack instead of reset to avoid navigation errors
            navigation.goBack();
          } catch (__error) {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  // Show loading or error state if user is not available
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Loading user profile...</Text>
      </View>
    );
  }

  // Settings
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [profileSettings, setProfileSettings] = useState({
    emailNotifications: _true,
    smsNotifications: _false,
    twoFactorAuth: _true,
    autoLogout: _true,
    biometricLogin: _true,
    showTips: _true,
    shareAnalytics: _false,
  });

  const handleChangePassword = () => {
    Alert.alert(
    console.log('Change Password',
      'A secure link has been sent to your email address to change your password.',
      [{ text: 'OK' }],
    );
  };

  const handleChangePIN = () => {
    Alert.alert('Change PIN', 'Please enter your new 4-digit PIN:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: () => {
          Alert.alert('Success', 'PIN updated successfully!');
        },
      },
    ]);
  };

  const handlePhotoChange = () => {
    Alert.alert('Change Photo', 'Choose an option:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: () => {
          Alert.alert('Info', 'Camera would open here');
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: () => {
          Alert.alert('Info', 'Photo gallery would open here');
        },
      },
    ]);
  };

  const toggleSetting = (setting: keyof typeof profileSettings) => {
    setProfileSettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const getRoleDisplayName = (role: _string) => {
    switch (__role) {
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

  const getRoleIcon = (_role: _string) => {
    switch (__role) {
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
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.photoContainer} onPress={handlePhotoChange}>
              {user.photo ? (
                <Image source={{ uri: user.photo }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.defaultPhoto}>
                  <Icon name="person" size={48} color={theme.colors.mediumGray} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user.firstName || 'First'} {user.lastName || 'Last'}
              </Text>
              <View style={styles.roleContainer}>
                <Icon
                  name={getRoleIcon(user.role || 'employee')}
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.roleText}>{getRoleDisplayName(user.role || 'employee')}</Text>
              </View>
              <Text style={styles.employeeId}>ID: {user.employeeId || 'N/A'}</Text>
              <Text style={styles.joinDate}>
                Started:{' '}
                {user.startDate && !isNaN(new Date(user.startDate).getTime())
                  ? new Date(user.startDate).toLocaleDateString()
                  : 'N/A'}
              </Text>
              <Text style={styles.lastLogin}>
                Last login:{' '}
                {user.lastLogin && !isNaN(new Date(user.lastLogin).getTime())
                  ? `${new Date(user.lastLogin).toLocaleDateString()} at ${new Date(
                      user.lastLogin,
                    ).toLocaleTimeString()}`
                  : 'Never'}
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
              <Text style={styles.infoValue}>{user.firstName || 'N/A'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Name</Text>
              <Text style={styles.infoValue}>{user.lastName || 'N/A'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email || 'N/A'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user.phone || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.securityItem} onPress={handleChangePassword}>
              <View style={styles.securityItemLeft}>
                <Icon name="lock" size={24} color={theme.colors.secondary} />
                <View style={styles.securityItemInfo}>
                  <Text style={styles.securityItemTitle}>Password</Text>
                  <Text style={styles.securityItemDescription}>Change your account password</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.securityItem} onPress={handleChangePIN}>
              <View style={styles.securityItemLeft}>
                <Icon name="pin" size={24} color={theme.colors.secondary} />
                <View style={styles.securityItemInfo}>
                  <Text style={styles.securityItemTitle}>PIN Code</Text>
                  <Text style={styles.securityItemDescription}>Change your 4-digit PIN</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
            </TouchableOpacity>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="fingerprint" size={24} color={theme.colors.secondary} />
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
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="security" size={24} color={theme.colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>Extra security for your account</Text>
                </View>
              </View>
              <Switch
                value={profileSettings.twoFactorAuth}
                onValueChange={() => toggleSetting('twoFactorAuth')}
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="timer" size={24} color={theme.colors.secondary} />
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
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
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
                <Icon name="email" size={24} color={theme.colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>Receive updates via email</Text>
                </View>
              </View>
              <Switch
                value={profileSettings.emailNotifications}
                onValueChange={() => toggleSetting('emailNotifications')}
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="sms" size={24} color={theme.colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>SMS Notifications</Text>
                  <Text style={styles.settingDescription}>Receive important alerts via SMS</Text>
                </View>
              </View>
              <Switch
                value={profileSettings.smsNotifications}
                onValueChange={() => toggleSetting('smsNotifications')}
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
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
                <Icon name="help" size={24} color={theme.colors.secondary} />
                <View style={styles.settingTextInfo}>
                  <Text style={styles.settingLabel}>Show Tips</Text>
                  <Text style={styles.settingDescription}>Display helpful tips and tutorials</Text>
                </View>
              </View>
              <Switch
                value={profileSettings.showTips}
                onValueChange={() => toggleSetting('showTips')}
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="analytics" size={24} color={theme.colors.secondary} />
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
                trackColor={{ false: theme.colors.lightGray, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
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
              onPress={() =>
                Alert.alert('Info', 'Export data functionality would be implemented here')
              }>
              <Icon name="file-download" size={24} color={theme.colors.secondary} />
              <Text style={styles.actionButtonText}>Export My Data</Text>
              <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
              <Icon name="logout" size={24} color={theme.colors.warning} />
              <Text style={[styles.actionButtonText, { color: theme.colors.warning }]}>
                Sign Out
              </Text>
              <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                Alert.alert(
    console.log('Delete Account',
                  'This action cannot be undone. All your data will be permanently deleted.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        Alert.alert('Info', 'Account deletion would be handled here');
                      },
                    },
                  ],
                )
              }>
              <Icon name="delete-forever" size={24} color={theme.colors.danger} />
              <Text style={[styles.actionButtonText, { color: theme.colors.danger }]}>
                Delete Account
              </Text>
              <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const __createStyles = (theme: _unknown) => StyleSheet.create({});

export default UserProfileScreen;
