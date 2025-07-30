import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { useAuth } from '../../contexts/AuthContext';

const ProfileScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const { user, session } = useAppStore();
  const { updateUser } = useAuth();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(__false);
  const [showPasswordModal, setShowPasswordModal] = useState(__false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleEditProfile = () => {
    setEditForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setShowEditModal(__true);
  };

  const handleSaveProfile = async () => {
    // Validate required fields
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await updateUser({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });

      setShowEditModal(__false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (__error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleChangePassword = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowPasswordModal(__true);
  };

  const handleSavePassword = async () => {
    // Validate required fields
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    // Validate new password
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    // Validate password confirmation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      // In a real app, this would call an API to change password
      Alert.alert('Success', 'Password changed successfully!', [
        { text: 'OK', onPress: () => setShowPasswordModal(__false) },
      ]);
    } catch (__error) {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    }
  };

  // eslint-disable-next-line react/no-unstable-nested-components
  const InfoCard = ({ title, _value, icon }: { title: string; value: string; icon: string }) => (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={24} color={theme.colors.secondary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('POS' as never)}>
          <Icon name="home" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Icon name="person" size={48} color={theme.colors.white} />
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase() || 'STAFF'}</Text>
        </View>

        {/* User Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoContainer}>
            <InfoCard title="Email" value={user?.email || 'No email set'} icon="email" />
            <InfoCard title="User ID" value={user?.id?.toString() || 'N/A'} icon="badge" />
            <InfoCard title="Role" value={user?.role || 'Staff'} icon="work" />
            <InfoCard title="Status" value={user?.isActive ? 'Active' : 'Inactive'} icon="circle" />
          </View>
        </View>

        {/* Current Session */}
        {session && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Session</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Icon name="access-time" size={24} color={theme.colors.success[500]} />
                <Text style={styles.sessionTitle}>Active Session</Text>
              </View>
              <View style={styles.sessionInfo}>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Started</Text>
                  <Text style={styles.sessionValue}>
                    {session.startTime instanceof Date
                      ? session.startTime.toLocaleTimeString()
                      : new Date(session.startTime).toLocaleTimeString()}
                  </Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Orders</Text>
                  <Text style={styles.sessionValue}>{session.ordersCount || 0}</Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Total Sales</Text>
                  <Text style={styles.sessionValue}>£{(session.totalSales || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
            <Icon name="edit" size={24} color={theme.colors.secondary} />
            <Text style={styles.actionButtonText}>Edit Profile</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleChangePassword}>
            <Icon name="lock" size={24} color={theme.colors.secondary} />
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(__false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(__false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>First Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.firstName}
                  onChangeText={text => setEditForm({ ...editForm, firstName: text })}
                  placeholder="Enter first name"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Last Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.lastName}
                  onChangeText={text => setEditForm({ ...editForm, lastName: text })}
                  placeholder="Enter last name"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.email}
                  onChangeText={text => setEditForm({ ...editForm, email: text })}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.phone}
                  onChangeText={text => setEditForm({ ...editForm, phone: text })}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowEditModal(__false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveProfile}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(__false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(__false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.currentPassword}
                  onChangeText={text => setPasswordForm({ ...passwordForm, currentPassword: text })}
                  placeholder="Enter current password"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.newPassword}
                  onChangeText={text => setPasswordForm({ ...passwordForm, newPassword: text })}
                  placeholder="Enter new password (min 6 characters)"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Confirm New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.confirmPassword}
                  onChangeText={text => setPasswordForm({ ...passwordForm, confirmPassword: text })}
                  placeholder="Confirm new password"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPasswordModal(__false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSavePassword}>
                  <Text style={styles.saveButtonText}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const __createStyles = (theme: _unknown) =>
  StyleSheet.create({
      shadowOpacity: 0.1,
      shadowRadius: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    // Modal Styles
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    }
  });

const ProfileScreen: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProfileScreenContent />
    </ErrorBoundary>
  );
};

export default ProfileScreen;
