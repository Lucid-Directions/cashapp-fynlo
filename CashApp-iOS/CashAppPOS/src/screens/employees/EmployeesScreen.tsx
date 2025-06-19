import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateEmployees, EmployeeData } from '../../utils/mockDataGenerator';

// Fynlo POS Color Scheme
const Colors = {
  primary: '#00A651',      // Fynlo Green
  secondary: '#0066CC',    // Fynlo Blue
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

const EmployeesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchQuery, selectedRole]);

  const loadEmployees = () => {
    const employeeData = generateEmployees();
    setEmployees(employeeData);
  };

  const filterEmployees = () => {
    let filtered = employees;

    // Apply role filter
    if (selectedRole !== 'all') {
      filtered = filtered.filter(employee => employee.role === selectedRole);
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(employee =>
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEmployees(filtered);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager': return Colors.primary;
      case 'Cashier': return Colors.secondary;
      case 'Server': return Colors.warning;
      case 'Cook': return Colors.danger;
      default: return Colors.darkGray;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return Colors.success;
    if (score >= 80) return Colors.warning;
    return Colors.danger;
  };

  const formatHireDate = (date: Date) => {
    const months = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return 'New hire';
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''}`;
  };

  const handleEmployeePress = (employee: EmployeeData) => {
    setSelectedEmployee(employee);
  };

  const renderEmployee = ({ item }: { item: EmployeeData }) => (
    <TouchableOpacity 
      style={styles.employeeCard}
      onPress={() => handleEmployeePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.employeeHeader}>
        <View style={styles.employeeAvatar}>
          <Icon name="account-circle" size={50} color={Colors.primary} />
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(item.role)}20` }]}>
            <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
              {item.role}
            </Text>
          </View>
          <Text style={styles.employeeEmail}>{item.email}</Text>
        </View>
        <View style={styles.employeeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>£{item.totalSales.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
        </View>
      </View>

      <View style={styles.employeeMetrics}>
        <View style={styles.metricItem}>
          <Icon name="schedule" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>{formatHireDate(item.hireDate)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Icon name="attach-money" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>£{item.hourlyRate.toFixed(2)}/hr</Text>
        </View>
        <View style={styles.metricItem}>
          <Icon name="star" size={16} color={getPerformanceColor(item.performanceScore)} />
          <Text style={[styles.metricText, { color: getPerformanceColor(item.performanceScore) }]}>
            {item.performanceScore.toFixed(1)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.actualHours >= e.scheduledHours * 0.9).length,
    managers: employees.filter(e => e.role === 'Manager').length,
    avgPerformance: employees.reduce((sum, e) => sum + e.performanceScore, 0) / employees.length,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Employees</Text>
          <Text style={styles.headerSubtitle}>{filteredEmployees.length} staff members</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Icon name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Staff</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.secondary }]}>{stats.managers}</Text>
          <Text style={styles.statLabel}>Managers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>
            {stats.avgPerformance.toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.darkGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.darkGray}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.roleFilters}
        >
          {['all', 'Manager', 'Cashier', 'Server', 'Cook'].map(role => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleFilter,
                selectedRole === role && styles.roleFilterActive
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[
                styles.roleFilterText,
                selectedRole === role && styles.roleFilterTextActive
              ]}>
                {role === 'all' ? 'All Roles' : role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Employees List */}
      <FlatList
        data={filteredEmployees}
        renderItem={renderEmployee}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.employeesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="people" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No employees found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first employee'}
            </Text>
          </View>
        }
      />

      {/* Employee Detail Modal */}
      <Modal
        visible={!!selectedEmployee}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedEmployee(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.employeeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee Details</Text>
              <TouchableOpacity onPress={() => setSelectedEmployee(null)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedEmployee && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.employeeProfile}>
                  <View style={styles.profileAvatar}>
                    <Icon name="account-circle" size={80} color={Colors.primary} />
                  </View>
                  <Text style={styles.profileName}>{selectedEmployee.name}</Text>
                  <View style={[styles.profileRole, { backgroundColor: `${getRoleColor(selectedEmployee.role)}20` }]}>
                    <Text style={[styles.profileRoleText, { color: getRoleColor(selectedEmployee.role) }]}>
                      {selectedEmployee.role}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  <View style={styles.detailRow}>
                    <Icon name="email" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>{selectedEmployee.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="phone" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>{selectedEmployee.phone}</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Employment Details</Text>
                  <View style={styles.detailRow}>
                    <Icon name="calendar-today" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>
                      Hired {selectedEmployee.hireDate.toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="attach-money" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>£{selectedEmployee.hourlyRate.toFixed(2)} per hour</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Performance Metrics</Text>
                  <View style={styles.performanceGrid}>
                    <View style={styles.performanceCard}>
                      <Text style={styles.performanceValue}>£{selectedEmployee.totalSales.toFixed(0)}</Text>
                      <Text style={styles.performanceLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text style={styles.performanceValue}>£{selectedEmployee.averageSalesPerDay.toFixed(0)}</Text>
                      <Text style={styles.performanceLabel}>Daily Avg</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text style={[styles.performanceValue, { color: getPerformanceColor(selectedEmployee.performanceScore) }]}>
                        {selectedEmployee.performanceScore.toFixed(1)}%
                      </Text>
                      <Text style={styles.performanceLabel}>Performance</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text style={[styles.performanceValue, { color: getPerformanceColor(selectedEmployee.punctualityScore) }]}>
                        {selectedEmployee.punctualityScore.toFixed(1)}%
                      </Text>
                      <Text style={styles.performanceLabel}>Punctuality</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                    <Icon name="edit" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.scheduleButton]}>
                    <Icon name="schedule" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Schedule</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
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
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  roleFilters: {
    paddingHorizontal: 16,
  },
  roleFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  roleFilterActive: {
    backgroundColor: Colors.primary,
  },
  roleFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  roleFilterTextActive: {
    color: Colors.white,
  },
  employeesList: {
    padding: 16,
  },
  employeeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeAvatar: {
    marginRight: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  employeeEmail: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  employeeStats: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
  },
  employeeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 12,
    color: Colors.darkGray,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    padding: 20,
  },
  employeeProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  profileRole: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profileRoleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  performanceLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: Colors.secondary,
  },
  scheduleButton: {
    backgroundColor: Colors.warning,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default EmployeesScreen;