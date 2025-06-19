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
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Fynlo POS Color Scheme
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

const UserManagementScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'owners' | 'staff' | 'access'>('owners');
  const [searchQuery, setSearchQuery] = useState('');

  const handleUserAction = (action: string, user?: any) => {
    Alert.alert('User Management', `${action} functionality will be implemented in Phase 4`);
  };

  const restaurantOwners = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john@fynlopos.com',
      restaurant: 'Fynlo Coffee Shop',
      role: 'Restaurant Owner',
      status: 'active',
      lastLogin: '2 hours ago',
    },
    {
      id: 2,
      name: 'Emma Wilson',
      email: 'emma@pizza.fynlopos.com',
      restaurant: 'Fynlo Pizza Palace',
      role: 'Restaurant Owner',
      status: 'active',
      lastLogin: '1 day ago',
    },
    {
      id: 3,
      name: 'David Brown',
      email: 'david@burgers.fynlopos.com',
      restaurant: 'Fynlo Burger Bar',
      role: 'Restaurant Owner',
      status: 'inactive',
      lastLogin: '1 week ago',
    },
  ];

  const staffMembers = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah@fynlopos.com',
      restaurant: 'Fynlo Coffee Shop',
      role: 'Manager',
      status: 'active',
      lastLogin: '30 min ago',
    },
    {
      id: 2,
      name: 'Mike Davis',
      email: 'mike@fynlopos.com',
      restaurant: 'Fynlo Coffee Shop',
      role: 'Employee',
      status: 'active',
      lastLogin: '2 hours ago',
    },
    {
      id: 3,
      name: 'Lisa Chen',
      email: 'lisa@pizza.fynlopos.com',
      restaurant: 'Fynlo Pizza Palace',
      role: 'Manager',
      status: 'active',
      lastLogin: '4 hours ago',
    },
  ];

  const accessLogs = [
    {
      id: 1,
      user: 'john@fynlopos.com',
      action: 'Login',
      location: 'London, UK',
      timestamp: '2024-06-17 14:30:25',
      status: 'success',
    },
    {
      id: 2,
      user: 'sarah@fynlopos.com',
      action: 'Failed Login',
      location: 'Manchester, UK',
      timestamp: '2024-06-17 13:45:12',
      status: 'failed',
    },
    {
      id: 3,
      user: 'mike@fynlopos.com',
      action: 'Password Reset',
      location: 'Birmingham, UK',
      timestamp: '2024-06-17 12:15:33',
      status: 'success',
    },
  ];

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'restaurant owner': return Colors.primary;
      case 'manager': return Colors.secondary;
      case 'employee': return Colors.warning;
      default: return Colors.mediumGray;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return Colors.success;
      case 'inactive': return Colors.mediumGray;
      case 'suspended': return Colors.danger;
      default: return Colors.mediumGray;
    }
  };

  const getAccessStatusColor = (status: string) => {
    switch (status) {
      case 'success': return Colors.success;
      case 'failed': return Colors.danger;
      case 'warning': return Colors.warning;
      default: return Colors.mediumGray;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
        <Text style={styles.headerSubtitle}>Platform-wide user control</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSelector}>
        {[
          { key: 'owners', label: 'Restaurant Owners' },
          { key: 'staff', label: 'Staff' },
          { key: 'access', label: 'Access Logs' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              selectedTab === tab.key && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text style={[
              styles.tabButtonText,
              selectedTab === tab.key && styles.tabButtonTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      {(selectedTab === 'owners' || selectedTab === 'staff') && (
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={Colors.mediumGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedTab === 'owners' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Restaurant Owners</Text>
              <TouchableOpacity onPress={() => handleUserAction('Add Owner')}>
                <Icon name="person-add" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            
            {restaurantOwners.map((owner) => (
              <View key={owner.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{owner.name}</Text>
                    <Text style={styles.userEmail}>{owner.email}</Text>
                    <Text style={styles.userRestaurant}>{owner.restaurant}</Text>
                  </View>
                  <View style={styles.userStatus}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(owner.role) }]}>
                      <Text style={styles.roleText}>{owner.role}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(owner.status) }]}>
                      <Text style={styles.statusText}>{owner.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.userDetails}>
                  <Text style={styles.lastLogin}>Last login: {owner.lastLogin}</Text>
                </View>
                
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('View Details', owner)}
                  >
                    <Icon name="visibility" size={16} color={Colors.secondary} />
                    <Text style={styles.actionButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Edit User', owner)}
                  >
                    <Icon name="edit" size={16} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Suspend User', owner)}
                  >
                    <Icon name="block" size={16} color={Colors.danger} />
                    <Text style={styles.actionButtonText}>Suspend</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'staff' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Staff Members</Text>
            
            {staffMembers.map((staff) => (
              <View key={staff.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{staff.name}</Text>
                    <Text style={styles.userEmail}>{staff.email}</Text>
                    <Text style={styles.userRestaurant}>{staff.restaurant}</Text>
                  </View>
                  <View style={styles.userStatus}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(staff.role) }]}>
                      <Text style={styles.roleText}>{staff.role}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(staff.status) }]}>
                      <Text style={styles.statusText}>{staff.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.userDetails}>
                  <Text style={styles.lastLogin}>Last login: {staff.lastLogin}</Text>
                </View>
                
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('View Performance', staff)}
                  >
                    <Icon name="assessment" size={16} color={Colors.secondary} />
                    <Text style={styles.actionButtonText}>Performance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Manage Permissions', staff)}
                  >
                    <Icon name="security" size={16} color={Colors.warning} />
                    <Text style={styles.actionButtonText}>Permissions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'access' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Access Logs</Text>
            
            {accessLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logInfo}>
                    <Text style={styles.logUser}>{log.user}</Text>
                    <Text style={styles.logAction}>{log.action}</Text>
                  </View>
                  <View style={[styles.logStatusBadge, { backgroundColor: getAccessStatusColor(log.status) }]}>
                    <Text style={styles.logStatusText}>{log.status.toUpperCase()}</Text>
                  </View>
                </View>
                
                <View style={styles.logDetails}>
                  <View style={styles.logDetailRow}>
                    <Icon name="location-on" size={14} color={Colors.mediumGray} />
                    <Text style={styles.logDetailText}>{log.location}</Text>
                  </View>
                  <View style={styles.logDetailRow}>
                    <Icon name="access-time" size={14} color={Colors.mediumGray} />
                    <Text style={styles.logDetailText}>{log.timestamp}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleUserAction('Export Logs')}
            >
              <Icon name="download" size={20} color={Colors.white} />
              <Text style={styles.exportButtonText}>Export Access Logs</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* User Management Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management Tools</Text>
          <View style={styles.toolsGrid}>
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Bulk Operations')}
            >
              <Icon name="checklist" size={32} color={Colors.primary} />
              <Text style={styles.toolText}>Bulk Operations</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Security Settings')}
            >
              <Icon name="security" size={32} color={Colors.secondary} />
              <Text style={styles.toolText}>Security Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Compliance Reports')}
            >
              <Icon name="verified-user" size={32} color={Colors.warning} />
              <Text style={styles.toolText}>Compliance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Audit Trail')}
            >
              <Icon name="history" size={32} color={Colors.danger} />
              <Text style={styles.toolText}>Audit Trail</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  tabButtonTextActive: {
    color: Colors.white,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  userCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 2,
  },
  userRestaurant: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  userStatus: {
    alignItems: 'flex-end',
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  userDetails: {
    marginBottom: 12,
  },
  lastLogin: {
    fontSize: 12,
    color: Colors.lightText,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  logCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logInfo: {
    flex: 1,
  },
  logUser: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  logAction: {
    fontSize: 12,
    color: Colors.lightText,
  },
  logStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  logStatusText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  logDetails: {
    gap: 4,
  },
  logDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logDetailText: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  exportButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default UserManagementScreen;