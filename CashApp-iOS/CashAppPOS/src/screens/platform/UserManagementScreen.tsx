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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { RealUserManagementService, UserDisplayData, AccessLog } from '../../services/RealUserManagementService';
import CreateUserModal from '../../components/modals/CreateUserModal';
import EditUserModal from '../../components/modals/EditUserModal';
import { SimpleTextInput } from '../../components/inputs';

const UserManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [selectedTab, setSelectedTab] = useState<'owners' | 'staff' | 'access'>('owners');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserDisplayData[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDisplayData | null>(null);

  const userManagementService = RealUserManagementService.getInstance();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      loadUsers();
    }
  }, [searchQuery, selectedTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadUsers(), loadAccessLogs()]);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const allUsers = await userManagementService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadAccessLogs = async () => {
    try {
      const logs = await userManagementService.getAccessLogs(20);
      setAccessLogs(logs);
    } catch (error) {
      console.error('Failed to load access logs:', error);
    }
  };

  const searchUsers = async () => {
    try {
      const results = await userManagementService.searchUsers(searchQuery);
      setUsers(results);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUserAction = async (action: string, user?: UserDisplayData) => {
    switch (action) {
      case 'Add Owner':
      case 'Add User':
        setCreateModalVisible(true);
        break;
      case 'View Details':
      case 'Edit User':
        if (user) {
          setSelectedUser(user);
          setEditModalVisible(true);
        }
        break;
      case 'Suspend User':
        if (user) {
          Alert.alert(
            'Suspend User',
            `Are you sure you want to suspend ${user.name}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Suspend',
                style: 'destructive',
                onPress: () => suspendUser(user.id),
              },
            ]
          );
        }
        break;
      case 'View Performance':
        Alert.alert('Performance', 'Performance analytics will be available soon');
        break;
      case 'Manage Permissions':
        if (user) {
          setSelectedUser(user);
          setEditModalVisible(true);
        }
        break;
      case 'Export Logs':
        await exportAccessLogs();
        break;
      case 'Bulk Operations':
        Alert.alert('Bulk Operations', 'Bulk operations feature coming soon');
        break;
      case 'Security Settings':
        Alert.alert('Security Settings', 'Security settings management coming soon');
        break;
      case 'Compliance Reports':
        Alert.alert('Compliance', 'Compliance reporting feature coming soon');
        break;
      case 'Audit Trail':
        Alert.alert('Audit Trail', 'Detailed audit trail feature coming soon');
        break;
      default:
        Alert.alert('User Management', `${action} functionality available`);
    }
  };

  const suspendUser = async (userId: string) => {
    try {
      await userManagementService.suspendUser(userId, 'Suspended via admin panel');
      Alert.alert('Success', 'User suspended successfully');
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'Failed to suspend user');
    }
  };

  const exportAccessLogs = async () => {
    try {
      Alert.alert('Exporting', 'Generating access logs export...');
      const result = await userManagementService.exportAccessLogs('csv');
      Alert.alert('Export Complete', `File exported: ${result.filename}`);
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export access logs');
    }
  };

  const getFilteredUsers = () => {
    let filteredUsers = users;
    
    if (selectedTab === 'owners') {
      filteredUsers = users.filter(user => user.role === 'Restaurant Owner');
    } else if (selectedTab === 'staff') {
      filteredUsers = users.filter(user => 
        user.role !== 'Restaurant Owner' && user.role !== 'Platform Admin'
      );
    }
    
    return filteredUsers;
  };

  const formatLastLogin = (lastLogin?: Date) => {
    if (!lastLogin) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastLogin.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return lastLogin.toLocaleDateString();
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString();
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'restaurant owner': return theme.colors.primary;
      case 'manager': return theme.colors.secondary;
      case 'employee': return theme.colors.warning;
      default: return theme.colors.mediumGray;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'inactive': return theme.colors.mediumGray;
      case 'suspended': return theme.colors.danger;
      default: return theme.colors.mediumGray;
    }
  };

  const getAccessStatusColor = (status: string) => {
    switch (status) {
      case 'success': return theme.colors.success;
      case 'failed': return theme.colors.danger;
      case 'warning': return theme.colors.warning;
      default: return theme.colors.mediumGray;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
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
            <Icon name="search" size={20} color={theme.colors.mediumGray} />
            <SimpleTextInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search users..."
              containerStyle={{ flex: 1, marginLeft: 8 }} // Extracted flex & marginLeft
              // fontSize & color from styles.searchInput should be handled by SimpleTextInput's theme
              clearButtonMode="while-editing" // Valid TextInput prop
              returnKeyType="search" // Valid TextInput prop
            />
          </View>
        </View>
      )}

      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {selectedTab === 'owners' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Restaurant Owners</Text>
              <TouchableOpacity onPress={() => handleUserAction('Add Owner')}>
                <Icon name="person-add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            {getFilteredUsers().map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userRestaurant}>{user.restaurantName || 'No restaurant assigned'}</Text>
                  </View>
                  <View style={styles.userStatus}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                      <Text style={styles.roleText}>{user.role}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(user.status) }]}>
                      <Text style={styles.statusText}>{user.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.userDetails}>
                  <Text style={styles.lastLogin}>Last login: {formatLastLogin(user.lastLogin)}</Text>
                  {user.isLocked && (
                    <Text style={styles.lockedText}>🔒 Account locked</Text>
                  )}
                </View>
                
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('View Details', user)}
                  >
                    <Icon name="visibility" size={16} color={theme.colors.secondary} />
                    <Text style={styles.actionButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Edit User', user)}
                  >
                    <Icon name="edit" size={16} color={theme.colors.primary} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Suspend User', user)}
                  >
                    <Icon name="block" size={16} color={theme.colors.danger} />
                    <Text style={styles.actionButtonText}>Suspend</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'staff' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Staff Members</Text>
              <TouchableOpacity onPress={() => handleUserAction('Add User')}>
                <Icon name="person-add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            {getFilteredUsers().map((staff) => (
              <View key={staff.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{staff.name}</Text>
                    <Text style={styles.userEmail}>{staff.email}</Text>
                    <Text style={styles.userRestaurant}>{staff.restaurantName || 'No restaurant assigned'}</Text>
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
                  <Text style={styles.lastLogin}>Last login: {formatLastLogin(staff.lastLogin)}</Text>
                  {staff.isLocked && (
                    <Text style={styles.lockedText}>🔒 Account locked</Text>
                  )}
                </View>
                
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('View Performance', staff)}
                  >
                    <Icon name="assessment" size={16} color={theme.colors.secondary} />
                    <Text style={styles.actionButtonText}>Performance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUserAction('Manage Permissions', staff)}
                  >
                    <Icon name="security" size={16} color={theme.colors.warning} />
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
                    <Text style={styles.logUser}>{log.userEmail}</Text>
                    <Text style={styles.logAction}>{log.action}</Text>
                  </View>
                  <View style={[styles.logStatusBadge, { backgroundColor: getAccessStatusColor(log.status) }]}>
                    <Text style={styles.logStatusText}>{log.status.toUpperCase()}</Text>
                  </View>
                </View>
                
                <View style={styles.logDetails}>
                  <View style={styles.logDetailRow}>
                    <Icon name="location-on" size={14} color={theme.colors.mediumGray} />
                    <Text style={styles.logDetailText}>{log.location}</Text>
                  </View>
                  <View style={styles.logDetailRow}>
                    <Icon name="access-time" size={14} color={theme.colors.mediumGray} />
                    <Text style={styles.logDetailText}>{formatTimestamp(log.timestamp)}</Text>
                  </View>
                  <View style={styles.logDetailRow}>
                    <Icon name="computer" size={14} color={theme.colors.mediumGray} />
                    <Text style={styles.logDetailText}>{log.ipAddress}</Text>
                  </View>
                  {log.details && (
                    <View style={styles.logDetailRow}>
                      <Icon name="info" size={14} color={theme.colors.warning} />
                      <Text style={[styles.logDetailText, { color: theme.colors.warning }]}>{log.details}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleUserAction('Export Logs')}
            >
              <Icon name="download" size={20} color={theme.colors.white} />
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
              <Icon name="checklist" size={32} color={theme.colors.primary} />
              <Text style={styles.toolText}>Bulk Operations</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Security Settings')}
            >
              <Icon name="security" size={32} color={theme.colors.secondary} />
              <Text style={styles.toolText}>Security Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Compliance Reports')}
            >
              <Icon name="verified-user" size={32} color={theme.colors.warning} />
              <Text style={styles.toolText}>Compliance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => handleUserAction('Audit Trail')}
            >
              <Icon name="history" size={32} color={theme.colors.danger} />
              <Text style={styles.toolText}>Audit Trail</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <CreateUserModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onUserCreated={() => {
          loadUsers();
          setCreateModalVisible(false);
        }}
      />

      <EditUserModal
        visible={editModalVisible}
        user={selectedUser}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
        }}
        onUserUpdated={() => {
          loadUsers();
          setEditModalVisible(false);
          setSelectedUser(null);
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginTop: 2,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.lightGray,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  tabButtonTextActive: {
    color: theme.colors.white,
  },
  searchSection: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text,
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
    color: theme.colors.text,
    marginBottom: 16,
  },
  userCard: {
    backgroundColor: theme.colors.white,
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
    color: theme.colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.lightText,
    marginBottom: 2,
  },
  userRestaurant: {
    fontSize: 12,
    color: theme.colors.mediumGray,
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
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  userDetails: {
    marginBottom: 12,
  },
  lastLogin: {
    fontSize: 12,
    color: theme.colors.lightText,
  },
  lockedText: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: '500',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.background,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text,
  },
  logCard: {
    backgroundColor: theme.colors.white,
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
    color: theme.colors.text,
    marginBottom: 2,
  },
  logAction: {
    fontSize: 12,
    color: theme.colors.lightText,
  },
  logStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  logStatusText: {
    color: theme.colors.white,
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
    color: theme.colors.mediumGray,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  exportButtonText: {
    color: theme.colors.white,
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
    backgroundColor: theme.colors.white,
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
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default UserManagementScreen;