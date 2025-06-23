import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';
import ErrorBoundary from '../../components/ErrorBoundary';
import Colors from '../../constants/Colors';

const ProfileScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const { user, session } = useAppStore();

  const InfoCard = ({ 
    title, 
    value, 
    icon 
  }: { 
    title: string; 
    value: string; 
    icon: string;
  }) => (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={24} color={Colors.secondary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.navigate('POS' as never)}
        >
          <Icon name="home" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Icon name="person" size={48} color={Colors.white} />
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase() || 'STAFF'}</Text>
        </View>

        {/* User Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoContainer}>
            <InfoCard
              title="Email"
              value={user?.email || 'No email set'}
              icon="email"
            />
            <InfoCard
              title="User ID"
              value={user?.id?.toString() || 'N/A'}
              icon="badge"
            />
            <InfoCard
              title="Role"
              value={user?.role || 'Staff'}
              icon="work"
            />
            <InfoCard
              title="Status"
              value={user?.isActive ? 'Active' : 'Inactive'}
              icon="circle"
            />
          </View>
        </View>

        {/* Current Session */}
        {session && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Session</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Icon name="access-time" size={24} color={Colors.success} />
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
                  <Text style={styles.sessionValue}>
                    £{(session.totalSales || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Edit profile will be available soon')}
          >
            <Icon name="edit" size={24} color={Colors.secondary} />
            <Text style={styles.actionButtonText}>Edit Profile</Text>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Change password will be available soon')}
          >
            <Icon name="lock" size={24} color={Colors.secondary} />
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  profileLogo: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  userRole: {
    fontSize: 14,
    color: Colors.lightText,
    fontWeight: '600',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  infoContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  infoIcon: {
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  sessionCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 10,
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionItem: {
    alignItems: 'center',
  },
  sessionLabel: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 15,
    flex: 1,
  },
});

const ProfileScreen: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProfileScreenContent />
    </ErrorBoundary>
  );
};

export default ProfileScreen;