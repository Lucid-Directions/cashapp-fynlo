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
}

type ViewMode = 'week' | 'day' | 'list' | 'month';

const ROLE_COLORS = {
  Manager: '#00A651',
  Cashier: '#0066CC', 
  Server: '#F39C12',
  Kitchen: '#E74C3C',
  Cleaner: '#9B59B6',
  default: '#95A5A6'
};

const STATUS_COLORS = {
  scheduled: '#F39C12',
  confirmed: '#0066CC',
  completed: '#27AE60',
  absent: '#E74C3C',
  break: '#9B59B6',
};

const EnhancedEmployeeScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced Modal States
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTimeType, setSelectedTimeType] = useState<'start' | 'end'>('start');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  
  // Enhanced Form State
  const [newShift, setNewShift] = useState({
    employeeId: '',
    date: '',
    startTime: new Date(),
    endTime: new Date(),
    role: 'Cashier',
    notes: '',
    breakTime: 30, // default 30 min break
  });

  // Quick Actions State
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  useEffect(() => {
    loadEmployees();
    loadWeekSchedule();
  }, [currentWeek]);

  const loadEmployees = () => {
    const employeeData = generateEmployees();
    setEmployees(employeeData);
  };

  const loadWeekSchedule = () => {
    const weekStart = getWeekStart(currentWeek);
    const shifts = generateEnhancedMockShifts(weekStart);
    setWeekSchedule({ weekStart, shifts });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    loadWeekSchedule();
    setRefreshing(false);
  };

  const getWeekStart = (date: Date): Date => {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const generateEnhancedMockShifts = (weekStart: Date): Shift[] => {
    const shifts: Shift[] = [];
    const employeeIds = employees.map(emp => emp.id);
    
    // Generate more realistic shifts with breaks, costs, and better coverage
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + day);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (day < 6) { // Monday to Saturday - Full service
        // Morning Manager Shift
        shifts.push({
          id: `manager-${day}-morning`,
          employeeId: employeeIds[0] || 'emp1',
          employeeName: employees[0]?.name || 'Maria Rodriguez',
          date: dateStr,
          startTime: '07:00',
          endTime: '15:00',
          role: 'Manager',
          status: day < 2 ? 'completed' : 'confirmed',
          duration: 8,
          laborCost: 8 * (employees[0]?.hourlyRate || 15),
          breakTime: 30,
          notes: 'Opening supervisor'
        });

        // Morning Cashier
        shifts.push({
          id: `cashier-${day}-morning`,
          employeeId: employeeIds[1] || 'emp2',
          employeeName: employees[1]?.name || 'Carlos Martinez',
          date: dateStr,
          startTime: '08:00',
          endTime: '16:00',
          role: 'Cashier',
          status: day < 2 ? 'completed' : 'scheduled',
          duration: 8,
          laborCost: 8 * (employees[1]?.hourlyRate || 12),
          breakTime: 45,
        });

        // Lunch Rush Server
        shifts.push({
          id: `server-${day}-lunch`,
          employeeId: employeeIds[2] || 'emp3',
          employeeName: employees[2]?.name || 'Sofia Hernandez',
          date: dateStr,
          startTime: '11:00',
          endTime: '15:00',
          role: 'Server',
          status: day < 2 ? 'completed' : 'confirmed',
          duration: 4,
          laborCost: 4 * (employees[2]?.hourlyRate || 10),
          breakTime: 15,
          notes: 'Lunch rush coverage'
        });

        // Evening Manager
        shifts.push({
          id: `manager-${day}-evening`,
          employeeId: employeeIds[3] || 'emp4',
          employeeName: employees[3]?.name || 'Ahmed Hassan',
          date: dateStr,
          startTime: '15:00',
          endTime: '23:00',
          role: 'Manager',
          status: day < 2 ? 'completed' : 'scheduled',
          duration: 8,
          laborCost: 8 * (employees[3]?.hourlyRate || 15),
          breakTime: 30,
          notes: 'Closing supervisor'
        });

        // Evening Server Team
        shifts.push({
          id: `server-${day}-evening-1`,
          employeeId: employeeIds[4] || 'emp5',
          employeeName: employees[4]?.name || 'Lucy Chen',
          date: dateStr,
          startTime: '16:00',
          endTime: '22:00',
          role: 'Server',
          status: day < 2 ? 'completed' : 'confirmed',
          duration: 6,
          laborCost: 6 * (employees[4]?.hourlyRate || 10),
          breakTime: 30,
        });

        // Kitchen Staff
        shifts.push({
          id: `kitchen-${day}-1`,
          employeeId: employeeIds[5] || 'emp6',
          employeeName: employees[5]?.name || 'Roberto Silva',
          date: dateStr,
          startTime: '10:00',
          endTime: '22:00',
          role: 'Kitchen',
          status: day < 2 ? 'completed' : 'scheduled',
          duration: 12,
          laborCost: 12 * (employees[5]?.hourlyRate || 13),
          breakTime: 60,
          notes: 'Full kitchen coverage'
        });

      } else { // Sunday - Reduced hours
        shifts.push({
          id: `sunday-manager-${day}`,
          employeeId: employeeIds[0] || 'emp1',
          employeeName: employees[0]?.name || 'Maria Rodriguez',
          date: dateStr,
          startTime: '10:00',
          endTime: '18:00',
          role: 'Manager',
          status: 'scheduled',
          duration: 8,
          laborCost: 8 * (employees[0]?.hourlyRate || 15),
          breakTime: 30,
          notes: 'Sunday operations'
        });

        shifts.push({
          id: `sunday-server-${day}`,
          employeeId: employeeIds[2] || 'emp3',
          employeeName: employees[2]?.name || 'Sofia Hernandez',
          date: dateStr,
          startTime: '11:00',
          endTime: '17:00',
          role: 'Server',
          status: 'scheduled',
          duration: 6,
          laborCost: 6 * (employees[2]?.hourlyRate || 10),
          breakTime: 30,
        });
      }
    }
    
    return shifts;
  };

  const getWeekDays = (): string[] => {
    if (!weekSchedule) return [];
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekSchedule.weekStart);
      day.setDate(weekSchedule.weekStart.getDate() + i);
      days.push(day.toISOString().split('T')[0]);
    }
    return days;
  };

  const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.getDate().toString();
  };

  const getShiftsForDay = (dateStr: string): Shift[] => {
    if (!weekSchedule) return [];
    return weekSchedule.shifts
      .filter(shift => shift.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const formatWeekRange = (): string => {
    if (!weekSchedule) return '';
    
    const weekEnd = new Date(weekSchedule.weekStart);
    weekEnd.setDate(weekSchedule.weekStart.getDate() + 6);
    
    const start = weekSchedule.weekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    const end = weekEnd.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${start} - ${end}`;
  };

  const calculateWeekSummary = () => {
    if (!weekSchedule) return { totalHours: 0, totalCost: 0, coverage: 0 };
    
    const totalHours = weekSchedule.shifts.reduce((sum, shift) => sum + shift.duration, 0);
    const totalCost = weekSchedule.shifts.reduce((sum, shift) => sum + (shift.laborCost || 0), 0);
    
    // Calculate coverage percentage (simplified)
    const expectedHours = 7 * 14; // 14 hours per day for 7 days
    const coverage = Math.min((totalHours / expectedHours) * 100, 100);
    
    return { totalHours, totalCost, coverage };
  };

  const handleAddShift = (date: string) => {
    setSelectedDate(date);
    setNewShift({ 
      ...newShift, 
      date,
      startTime: new Date(new Date().setHours(9, 0, 0, 0)),
      endTime: new Date(new Date().setHours(17, 0, 0, 0))
    });
    setShowAddShiftModal(true);
  };

  const handleShiftPress = (shift: Shift) => {
    setSelectedShift(shift);
    setShowQuickActions(true);
  };

  const handleTimePress = (type: 'start' | 'end') => {
    setSelectedTimeType(type);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      if (selectedTimeType === 'start') {
        setNewShift({ ...newShift, startTime: selectedDate });
      } else {
        setNewShift({ ...newShift, endTime: selectedDate });
      }
    }
  };

  const saveShift = () => {
    if (!newShift.employeeId || !newShift.date) {
      Alert.alert('Error', 'Please select an employee and ensure date is set');
      return;
    }

    const employee = employees.find(emp => emp.id === newShift.employeeId);
    if (!employee) return;

    // Calculate duration
    const duration = (newShift.endTime.getTime() - newShift.startTime.getTime()) / (1000 * 60 * 60);
    const laborCost = duration * employee.hourlyRate;

    const shift: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: newShift.date,
      startTime: newShift.startTime.toTimeString().slice(0, 5),
      endTime: newShift.endTime.toTimeString().slice(0, 5),
      role: newShift.role,
      status: 'scheduled',
      duration,
      laborCost,
      breakTime: newShift.breakTime,
      notes: newShift.notes,
    };

    if (weekSchedule) {
      setWeekSchedule({
        ...weekSchedule,
        shifts: [...weekSchedule.shifts, shift]
      });
    }

    setShowAddShiftModal(false);
    resetForm();
    Alert.alert('Success', 'Shift added successfully');
  };

  const resetForm = () => {
    setNewShift({
      employeeId: '',
      date: '',
      startTime: new Date(new Date().setHours(9, 0, 0, 0)),
      endTime: new Date(new Date().setHours(17, 0, 0, 0)),
      role: 'Cashier',
      notes: '',
      breakTime: 30,
    });
    setSelectedEmployee(null);
  };

  const getRoleColor = (role: string) => {
    return ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS.default;
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#95A5A6';
  };

  const renderViewModeSelector = () => (
    <View style={styles.viewModeSelector}>
      {(['week', 'day', 'list'] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[
            styles.viewModeButton,
            viewMode === mode && styles.viewModeButtonActive
          ]}
          onPress={() => setViewMode(mode)}
        >
          <Icon 
            name={mode === 'week' ? 'view-week' : mode === 'day' ? 'today' : 'list'} 
            size={20} 
            color={viewMode === mode ? theme.colors.white : theme.colors.primary} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === mode && styles.viewModeTextActive
          ]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWeekSummary = () => {
    const summary = calculateWeekSummary();
    
    return (
      <View style={styles.weekSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.totalHours}h</Text>
          <Text style={styles.summaryLabel}>Total Hours</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>£{summary.totalCost.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Labor Cost</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[
            styles.summaryValue,
            { color: summary.coverage >= 80 ? '#27AE60' : summary.coverage >= 60 ? '#F39C12' : '#E74C3C' }
          ]}>
            {summary.coverage.toFixed(0)}%
          </Text>
          <Text style={styles.summaryLabel}>Coverage</Text>
        </View>
      </View>
    );
  };

  const renderDayView = () => {
    const selectedDay = selectedDate || new Date().toISOString().split('T')[0];
    const dayShifts = getShiftsForDay(selectedDay);
    const dayName = new Date(selectedDay).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Create hourly timeline
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <ScrollView style={styles.dayViewContainer}>
        <View style={styles.dayViewHeader}>
          <Text style={styles.dayViewTitle}>{dayName}</Text>
          <TouchableOpacity 
            style={styles.addShiftFab}
            onPress={() => handleAddShift(selectedDay)}
          >
            <Icon name="add" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.timelineContainer}>
          {hours.map(hour => {
            const hourShifts = dayShifts.filter(shift => {
              const startHour = parseInt(shift.startTime.split(':')[0]);
              const endHour = parseInt(shift.endTime.split(':')[0]);
              return hour >= startHour && hour < endHour;
            });

            return (
              <View key={hour} style={styles.timelineHour}>
                <View style={styles.timelineLabel}>
                  <Text style={styles.timelineLabelText}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                </View>
                <View style={styles.timelineContent}>
                  {hourShifts.map(shift => (
                    <TouchableOpacity
                      key={shift.id}
                      style={[
                        styles.timelineShift,
                        { backgroundColor: getRoleColor(shift.role) + '20' },
                        { borderLeftColor: getRoleColor(shift.role) }
                      ]}
                      onPress={() => handleShiftPress(shift)}
                    >
                      <Text style={styles.timelineShiftEmployee}>
                        {shift.employeeName}
                      </Text>
                      <Text style={styles.timelineShiftDetails}>
                        {shift.startTime} - {shift.endTime} • {shift.role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderListView = () => {
    const weekDays = getWeekDays();
    
    return (
      <ScrollView style={styles.listViewContainer}>
        {weekDays.map(date => {
          const dayShifts = getShiftsForDay(date);
          const dayName = getDayName(date);
          const dayNumber = getDayNumber(date);
          const isToday = date === new Date().toISOString().split('T')[0];

          if (dayShifts.length === 0) return null;

          return (
            <View key={date} style={styles.listDaySection}>
              <View style={[styles.listDayHeader, isToday && styles.listTodayHeader]}>
                <Text style={[styles.listDayName, isToday && styles.listTodayText]}>
                  {dayName}, {dayNumber}
                </Text>
                <Text style={[styles.listDayCount, isToday && styles.listTodayText]}>
                  {dayShifts.length} shifts
                </Text>
              </View>

              {dayShifts.map(shift => (
                <TouchableOpacity
                  key={shift.id}
                  style={styles.listShiftCard}
                  onPress={() => handleShiftPress(shift)}
                >
                  <View style={styles.listShiftLeft}>
                    <Text style={styles.listShiftTime}>
                      {shift.startTime} - {shift.endTime}
                    </Text>
                    <Text style={styles.listShiftDuration}>
                      {shift.duration}h
                    </Text>
                  </View>

                  <View style={styles.listShiftCenter}>
                    <Text style={styles.listShiftEmployee}>
                      {shift.employeeName}
                    </Text>
                    <Text style={[styles.listShiftRole, { color: getRoleColor(shift.role) }]}>
                      {shift.role}
                    </Text>
                  </View>

                  <View style={styles.listShiftRight}>
                    <View style={[
                      styles.listShiftStatus,
                      { backgroundColor: getStatusColor(shift.status) }
                    ]}>
                      <Text style={styles.listShiftStatusText}>
                        {shift.status}
                      </Text>
                    </View>
                    {shift.laborCost && (
                      <Text style={styles.listShiftCost}>
                        £{shift.laborCost.toFixed(0)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderEnhancedWeekView = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.weekViewContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {getWeekDays().map((date, index) => {
        const dayShifts = getShiftsForDay(date);
        const isToday = date === new Date().toISOString().split('T')[0];
        const totalDayHours = dayShifts.reduce((sum, shift) => sum + shift.duration, 0);
        
        return (
          <View key={date} style={styles.enhancedDayColumn}>
            <View style={[styles.enhancedDayHeader, isToday && styles.todayHeader]}>
              <Text style={[styles.dayName, isToday && styles.todayText]}>
                {getDayName(date)}
              </Text>
              <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                {getDayNumber(date)}
              </Text>
              <Text style={[styles.dayHours, isToday && styles.todayText]}>
                {totalDayHours}h
              </Text>
            </View>
            
            <ScrollView style={styles.enhancedDayContent} showsVerticalScrollIndicator={false}>
              {dayShifts.length === 0 ? (
                <TouchableOpacity 
                  style={styles.enhancedEmptyDay}
                  onPress={() => handleAddShift(date)}
                >
                  <Icon name="add-circle-outline" size={32} color={theme.colors.secondary} />
                  <Text style={styles.emptyDayText}>Add Shift</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {dayShifts.map((shift) => (
                    <TouchableOpacity 
                      key={shift.id} 
                      style={[
                        styles.enhancedShiftCard,
                        { borderLeftColor: getRoleColor(shift.role) }
                      ]}
                      onPress={() => handleShiftPress(shift)}
                    >
                      <View style={styles.shiftCardHeader}>
                        <Text style={styles.shiftEmployeeName} numberOfLines={1}>
                          {shift.employeeName}
                        </Text>
                        <View style={[
                          styles.shiftStatusBadge,
                          { backgroundColor: getStatusColor(shift.status) }
                        ]}>
                          <Text style={styles.shiftStatusText}>
                            {shift.status.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.shiftTime}>
                        {shift.startTime} - {shift.endTime}
                      </Text>
                      
                      <View style={styles.shiftCardFooter}>
                        <Text style={[styles.shiftRole, { color: getRoleColor(shift.role) }]}>
                          {shift.role}
                        </Text>
                        <Text style={styles.shiftDuration}>
                          {shift.duration}h
                        </Text>
                      </View>
                      
                      {shift.laborCost && (
                        <Text style={styles.shiftCost}>
                          £{shift.laborCost.toFixed(0)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.addMoreShiftButton}
                    onPress={() => handleAddShift(date)}
                  >
                    <Icon name="add" size={16} color={theme.colors.primary} />
                    <Text style={styles.addMoreText}>Add Shift</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderAddShiftModal = () => (
    <Modal
      visible={showAddShiftModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAddShiftModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            onPress={() => setShowAddShiftModal(false)}
            style={styles.modalCloseButton}
          >
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add New Shift</Text>
          <TouchableOpacity 
            onPress={saveShift}
            style={styles.modalSaveButton}
          >
            <Text style={styles.modalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Employee Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Employee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {employees.map((employee) => (
                <TouchableOpacity 
                  key={employee.id}
                  style={[
                    styles.employeeSelectionCard,
                    newShift.employeeId === employee.id && styles.selectedEmployeeCard
                  ]}
                  onPress={() => {
                    setNewShift({ ...newShift, employeeId: employee.id });
                    setSelectedEmployee(employee);
                  }}
                >
                  <Text style={[
                    styles.employeeCardName,
                    newShift.employeeId === employee.id && styles.selectedEmployeeText
                  ]}>
                    {employee.name}
                  </Text>
                  <Text style={[
                    styles.employeeCardRole,
                    newShift.employeeId === employee.id && styles.selectedEmployeeText
                  ]}>
                    {employee.role} • £{employee.hourlyRate}/hr
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Date Display */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Date</Text>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateDisplayText}>
                {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'No date selected'}
              </Text>
            </View>
          </View>

          {/* Time Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Shift Times</Text>
            <View style={styles.timeSelectionRow}>
              <TouchableOpacity 
                style={styles.timeSelector}
                onPress={() => handleTimePress('start')}
              >
                <Text style={styles.timeSelectorLabel}>Start Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {newShift.startTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.timeSelector}
                onPress={() => handleTimePress('end')}
              >
                <Text style={styles.timeSelectorLabel}>End Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {newShift.endTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Duration and Cost Display */}
            {selectedEmployee && (
              <View style={styles.shiftCalculations}>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Duration</Text>
                  <Text style={styles.calculationValue}>
                    {((newShift.endTime.getTime() - newShift.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)}h
                  </Text>
                </View>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Labor Cost</Text>
                  <Text style={styles.calculationValue}>
                    £{(((newShift.endTime.getTime() - newShift.startTime.getTime()) / (1000 * 60 * 60)) * selectedEmployee.hourlyRate).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Role Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.roleSelection}>
              {Object.keys(ROLE_COLORS).filter(role => role !== 'default').map((role) => (
                <TouchableOpacity 
                  key={role}
                  style={[
                    styles.roleButton,
                    { borderColor: getRoleColor(role) },
                    newShift.role === role && { backgroundColor: getRoleColor(role) }
                  ]}
                  onPress={() => setNewShift({ ...newShift, role })}
                >
                  <Text style={[
                    styles.roleButtonText,
                    { color: newShift.role === role ? theme.colors.white : getRoleColor(role) }
                  ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={selectedTimeType === 'start' ? newShift.startTime : newShift.endTime}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={handleTimeChange}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      
      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.white }]}>
            Employee Schedule
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.white }]}>
            {formatWeekRange()}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Icon name="more-vert" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      {renderViewModeSelector()}

      {/* Week Navigation */}
      <View style={[styles.weekNavigation, { backgroundColor: theme.colors.white }]}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateWeek('prev')}
        >
          <Icon name="chevron-left" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.weekInfo}>
          {renderWeekSummary()}
        </View>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateWeek('next')}
        >
          <Icon name="chevron-right" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content Views */}
      {viewMode === 'week' && renderEnhancedWeekView()}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'list' && renderListView()}

      {/* Add Shift Modal */}
      {renderAddShiftModal()}
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
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: getFontSize(14),
    opacity: 0.9,
    marginTop: 2,
  },
  headerAction: {
    padding: 8,
  },
  
  // View Mode Selector
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  viewModeButtonActive: {
    backgroundColor: '#00A651',
    borderColor: '#00A651',
  },
  viewModeText: {
    marginLeft: 6,
    fontSize: getFontSize(14),
    fontWeight: '500',
    color: '#00A651',
  },
  viewModeTextActive: {
    color: '#ffffff',
  },

  // Week Navigation & Summary
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  navButton: {
    padding: 8,
  },
  weekInfo: {
    flex: 1,
  },
  weekSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryLabel: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    marginTop: 2,
  },

  // Enhanced Week View
  weekViewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  enhancedDayColumn: {
    width: screenWidth * 0.4,
    marginRight: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  enhancedDayHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  todayHeader: {
    backgroundColor: '#00A651',
  },
  dayName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#2c3e50',
  },
  dayNumber: {
    fontSize: getFontSize(24),
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 4,
  },
  dayHours: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    marginTop: 2,
  },
  todayText: {
    color: '#ffffff',
  },
  enhancedDayContent: {
    padding: 8,
    maxHeight: 400,
  },
  enhancedEmptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyDayText: {
    fontSize: getFontSize(14),
    color: '#7f8c8d',
    marginTop: 8,
  },

  // Enhanced Shift Cards
  enhancedShiftCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  shiftEmployeeName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  shiftStatusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftStatusText: {
    fontSize: getFontSize(10),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  shiftTime: {
    fontSize: getFontSize(13),
    color: '#5d6d7e',
    marginBottom: 6,
  },
  shiftCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftRole: {
    fontSize: getFontSize(12),
    fontWeight: '500',
  },
  shiftDuration: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
  },
  shiftCost: {
    fontSize: getFontSize(11),
    color: '#27ae60',
    marginTop: 4,
    textAlign: 'right',
  },
  addMoreShiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#00A651',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addMoreText: {
    fontSize: getFontSize(12),
    color: '#00A651',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#00A651',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Form Sections
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  
  // Employee Selection
  employeeSelectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 2,
    borderColor: '#e1e8ed',
  },
  selectedEmployeeCard: {
    borderColor: '#00A651',
    backgroundColor: '#00A651',
  },
  employeeCardName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  employeeCardRole: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 4,
  },
  selectedEmployeeText: {
    color: '#ffffff',
  },

  // Date Display
  dateDisplay: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  dateDisplayText: {
    fontSize: getFontSize(16),
    color: '#2c3e50',
    textAlign: 'center',
  },

  // Time Selection
  timeSelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeSelector: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    alignItems: 'center',
  },
  timeSelectorLabel: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    marginBottom: 4,
  },
  timeSelectorValue: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: '#2c3e50',
  },

  // Calculations
  shiftCalculations: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  calculationItem: {
    alignItems: 'center',
  },
  calculationLabel: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
  },
  calculationValue: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    color: '#27ae60',
    marginTop: 4,
  },

  // Role Selection
  roleSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  roleButtonText: {
    fontSize: getFontSize(14),
    fontWeight: '500',
  },

  // Day View Styles
  dayViewContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  dayViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  dayViewTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  addShiftFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00A651',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  timelineContainer: {
    padding: 16,
  },
  timelineHour: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  timelineLabel: {
    width: 60,
    justifyContent: 'center',
    paddingRight: 16,
  },
  timelineLabelText: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    fontWeight: '500',
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 8,
  },
  timelineShift: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineShiftEmployee: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#2c3e50',
  },
  timelineShiftDetails: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    marginTop: 2,
  },

  // List View Styles
  listViewContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  listDaySection: {
    marginBottom: 24,
  },
  listDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00A651',
  },
  listTodayHeader: {
    backgroundColor: '#00A651',
    borderLeftColor: '#ffffff',
  },
  listDayName: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  listTodayText: {
    color: '#ffffff',
  },
  listDayCount: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
  },
  listShiftCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listShiftLeft: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 80,
  },
  listShiftTime: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  listShiftDuration: {
    fontSize: getFontSize(12),
    color: '#7f8c8d',
    marginTop: 2,
  },
  listShiftCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  listShiftEmployee: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#2c3e50',
  },
  listShiftRole: {
    fontSize: getFontSize(14),
    fontWeight: '500',
    marginTop: 2,
  },
  listShiftRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  listShiftStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listShiftStatusText: {
    fontSize: getFontSize(12),
    fontWeight: '500',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  listShiftCost: {
    fontSize: getFontSize(12),
    color: '#27ae60',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default EnhancedEmployeeScheduleScreen;