import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateEmployees, EmployeeData } from '../../utils/mockDataGenerator';
import { useTheme } from '../../design-system/ThemeProvider';

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;
const isSmallDevice = screenWidth < 380;

// Responsive font sizes
const getFontSize = (base: number) => {
  if (isTablet) return base * 1.2;
  if (isSmallDevice) return base * 0.9;
  return base;
};

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent' | 'break';
  duration: number; // in hours
  notes?: string;
  laborCost?: number;
  breakTime?: number; // in minutes
}

interface WeekSchedule {
  weekStart: Date;
  shifts: Shift[];
  totalHours: number;
  totalCost: number;
  coverage: {
    [timeSlot: string]: number; // number of staff scheduled
  };
}

const EnhancedEmployeeScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  // Days of the week
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDaysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Time slots for the day (24-hour format)
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  useEffect(() => {
    loadEmployees();
    generateSchedule();
  }, [currentWeek]);

  const loadEmployees = () => {
    const employeeData = generateEmployees();
    setEmployees(employeeData);
  };

  const generateSchedule = () => {
    const startOfWeek = getStartOfWeek(currentWeek);
    const shifts: Shift[] = [];
    let totalHours = 0;
    let totalCost = 0;

    // Generate shifts for each employee
    employees.forEach((employee) => {
      // Generate 3-5 shifts per employee per week
      const shiftsCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < shiftsCount; i++) {
        const dayOffset = Math.floor(Math.random() * 7);
        const shiftDate = new Date(startOfWeek);
        shiftDate.setDate(shiftDate.getDate() + dayOffset);
        
        const startHour = Math.floor(Math.random() * 16) + 6; // 6 AM to 10 PM
        const duration = Math.floor(Math.random() * 6) + 4; // 4-9 hours
        const endHour = Math.min(startHour + duration, 23);
        
        const shift: Shift = {
          id: `${employee.id}-${shiftDate.toISOString().split('T')[0]}-${startHour}`,
          employeeId: employee.id.toString(),
          employeeName: employee.name,
          date: shiftDate.toISOString().split('T')[0],
          startTime: `${startHour.toString().padStart(2, '0')}:00`,
          endTime: `${endHour.toString().padStart(2, '0')}:00`,
          role: employee.role,
          status: Math.random() > 0.1 ? 'scheduled' : 'confirmed',
          duration: endHour - startHour,
          laborCost: (endHour - startHour) * employee.hourlyRate,
          breakTime: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
        };
        
        shifts.push(shift);
        totalHours += shift.duration;
        totalCost += shift.laborCost || 0;
      }
    });

    // Calculate coverage
    const coverage: { [timeSlot: string]: number } = {};
    timeSlots.forEach(slot => {
      coverage[slot] = shifts.filter(shift => {
        const slotHour = parseInt(slot.split(':')[0]);
        const startHour = parseInt(shift.startTime.split(':')[0]);
        const endHour = parseInt(shift.endTime.split(':')[0]);
        return slotHour >= startHour && slotHour < endHour;
      }).length;
    });

    setSchedule({
      weekStart: startOfWeek,
      shifts,
      totalHours,
      totalCost,
      coverage,
    });
  };

  const getStartOfWeek = (date: Date): Date => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getWeekRange = (): string => {
    if (!schedule) return '';
    const start = schedule.weekStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const getShiftsForDay = (dayIndex: number): Shift[] => {
    if (!schedule) return [];
    const targetDate = new Date(schedule.weekStart);
    targetDate.setDate(targetDate.getDate() + dayIndex);
    const dateString = targetDate.toISOString().split('T')[0];
    
    return schedule.shifts
      .filter(shift => shift.date === dateString)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return theme.colors.success;
      case 'scheduled': return theme.colors.warning;
      case 'completed': return theme.colors.primary;
      case 'absent': return theme.colors.error;
      case 'break': return theme.colors.info;
      default: return theme.colors.textSecondary;
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'Manager': return theme.colors.primary;
      case 'Cashier': return theme.colors.secondary;
      case 'Server': return theme.colors.warning;
      case 'Cook': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const handleShiftPress = (shift: Shift) => {
    setSelectedShift(shift);
    setShowShiftModal(true);
  };

  const handleWeekNavigation = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    generateSchedule();
    setRefreshing(false);
  };

  const renderShiftCard = (shift: Shift) => (
    <TouchableOpacity
      key={shift.id}
      style={[
        styles.shiftCard,
        { borderLeftColor: getStatusColor(shift.status) }
      ]}
      onPress={() => handleShiftPress(shift)}
    >
      <View style={styles.shiftHeader}>
        <Text style={[styles.shiftTime, { color: theme.colors.text }]}>
          {shift.startTime} - {shift.endTime}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(shift.status) + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusColor(shift.status) }
          ]}>
            {shift.status}
          </Text>
        </View>
      </View>
      <Text style={[styles.employeeName, { color: theme.colors.text }]}>
        {shift.employeeName}
      </Text>
      <View style={styles.shiftDetails}>
        <View style={[
          styles.roleBadge,
          { backgroundColor: getRoleColor(shift.role) + '20' }
        ]}>
          <Text style={[
            styles.roleText,
            { color: getRoleColor(shift.role) }
          ]}>
            {shift.role}
          </Text>
        </View>
        <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
          {shift.duration}h
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderWeekView = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.weekScrollView}
    >
      {daysOfWeek.map((day, index) => {
        const dayShifts = getShiftsForDay(index);
        const dayDate = new Date(schedule?.weekStart || new Date());
        dayDate.setDate(dayDate.getDate() + index);
        
        return (
          <View key={day} style={styles.dayColumn}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, { color: theme.colors.text }]}>
                {day}
              </Text>
              <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>
                {formatDate(dayDate)}
              </Text>
            </View>
            <ScrollView style={styles.shiftsContainer}>
              {dayShifts.length > 0 ? (
                dayShifts.map(renderShiftCard)
              ) : (
                <View style={styles.noShiftsContainer}>
                  <Text style={[styles.noShiftsText, { color: theme.colors.textSecondary }]}>
                    No shifts
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderWeekStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: theme.colors.background }]}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.primary }]}>
          {schedule?.totalHours || 0}h
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Total Hours
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.success }]}>
          £{schedule?.totalCost.toFixed(0) || '0'}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Labor Cost
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.warning }]}>
          {schedule?.shifts.length || 0}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Total Shifts
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.info }]}>
          {employees.length}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Staff
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Employee Schedule
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {getWeekRange()}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="date-range" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Week Navigation */}
      <View style={[styles.weekNavigation, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.weekNavButton}
          onPress={() => handleWeekNavigation('prev')}
        >
          <Icon name="chevron-left" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.weekNavButton}
          onPress={() => handleWeekNavigation('next')}
        >
          <Icon name="chevron-right" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {renderWeekStats()}

      {/* Schedule Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderWeekView()}
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={currentWeek}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setCurrentWeek(selectedDate);
            }
          }}
        />
      )}

      {/* Shift Detail Modal */}
      <Modal
        visible={showShiftModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShiftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Shift Details
              </Text>
              <TouchableOpacity onPress={() => setShowShiftModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedShift && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.shiftDetailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Employee Information
                  </Text>
                  <Text style={[styles.shiftDetailText, { color: theme.colors.text }]}>
                    {selectedShift.employeeName}
                  </Text>
                  <View style={[
                    styles.roleBadge,
                    { backgroundColor: getRoleColor(selectedShift.role) + '20' }
                  ]}>
                    <Text style={[
                      styles.roleText,
                      { color: getRoleColor(selectedShift.role) }
                    ]}>
                      {selectedShift.role}
                    </Text>
                  </View>
                </View>

                <View style={styles.shiftDetailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Schedule
                  </Text>
                  <Text style={[styles.shiftDetailText, { color: theme.colors.text }]}>
                    {new Date(selectedShift.date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                  <Text style={[styles.shiftDetailText, { color: theme.colors.text }]}>
                    {selectedShift.startTime} - {selectedShift.endTime} ({selectedShift.duration} hours)
                  </Text>
                </View>

                <View style={styles.shiftDetailSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Status & Cost
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(selectedShift.status) + '20' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(selectedShift.status) }
                    ]}>
                      {selectedShift.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.shiftDetailText, { color: theme.colors.text }]}>
                    Labor Cost: £{selectedShift.laborCost?.toFixed(2) || '0.00'}
                  </Text>
                  {selectedShift.breakTime && (
                    <Text style={[styles.shiftDetailText, { color: theme.colors.text }]}>
                      Break Time: {selectedShift.breakTime} minutes
                    </Text>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      Alert.alert('Edit Shift', 'Shift editing functionality would be implemented here');
                    }}
                  >
                    <Icon name="edit" size={20} color={theme.colors.surface} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.surface }]}>
                      Edit Shift
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                    onPress={() => {
                      Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive' }
                      ]);
                    }}
                  >
                    <Icon name="delete" size={20} color={theme.colors.surface} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.surface }]}>
                      Delete
                    </Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: getFontSize(14),
    marginTop: 2,
  },
  calendarButton: {
    padding: 8,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  weekNavButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: getFontSize(12),
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  weekScrollView: {
    flex: 1,
  },
  dayColumn: {
    width: screenWidth * 0.4,
    marginRight: 12,
    paddingVertical: 16,
  },
  dayHeader: {
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  dayName: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
  },
  dayDate: {
    fontSize: getFontSize(12),
    marginTop: 2,
  },
  shiftsContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shiftTime: {
    fontSize: getFontSize(14),
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: getFontSize(10),
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  employeeName: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shiftDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: getFontSize(12),
    fontWeight: '600',
  },
  durationText: {
    fontSize: getFontSize(12),
    fontWeight: '500',
  },
  noShiftsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noShiftsText: {
    fontSize: getFontSize(14),
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
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
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  shiftDetailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    marginBottom: 8,
  },
  shiftDetailText: {
    fontSize: getFontSize(14),
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: getFontSize(14),
    fontWeight: '600',
  },
});

export default EnhancedEmployeeScheduleScreen;