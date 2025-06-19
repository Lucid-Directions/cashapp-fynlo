import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RestaurantOnboardingData } from './RestaurantOnboardingScreen';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
  danger: '#E74C3C',
};

interface BusinessHoursStepProps {
  data: RestaurantOnboardingData;
  onUpdate: (updates: Partial<RestaurantOnboardingData>) => void;
}

const daysOfWeek = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const BusinessHoursStep: React.FC<BusinessHoursStepProps> = ({ data, onUpdate }) => {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTimeType, setSelectedTimeType] = useState<'open' | 'close'>('open');
  const [tempTime, setTempTime] = useState(new Date());

  const handleToggleDay = (day: string) => {
    const updatedHours = {
      ...data.businessHours,
      [day]: {
        ...data.businessHours[day],
        isOpen: !data.businessHours[day].isOpen,
      },
    };
    onUpdate({ businessHours: updatedHours });
  };

  const handleTimePress = (day: string, type: 'open' | 'close') => {
    setSelectedDay(day);
    setSelectedTimeType(type);
    
    const timeString = data.businessHours[day][type === 'open' ? 'openTime' : 'closeTime'];
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    setTempTime(date);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedDate && selectedDay) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      const updatedHours = {
        ...data.businessHours,
        [selectedDay]: {
          ...data.businessHours[selectedDay],
          [selectedTimeType === 'open' ? 'openTime' : 'closeTime']: timeString,
        },
      };
      onUpdate({ businessHours: updatedHours });
    }
  };

  const handleCopyHours = () => {
    const mondayHours = data.businessHours.monday;
    const weekdays = ['tuesday', 'wednesday', 'thursday', 'friday'];
    
    const updatedHours = { ...data.businessHours };
    weekdays.forEach(day => {
      updatedHours[day] = { ...mondayHours };
    });
    
    onUpdate({ businessHours: updatedHours });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Set Business Hours</Text>
        <Text style={styles.subtitle}>
          Configure when your restaurant is open for business
        </Text>
      </View>

      <TouchableOpacity style={styles.copyButton} onPress={handleCopyHours}>
        <Icon name="content-copy" size={20} color={Colors.primary} />
        <Text style={styles.copyButtonText}>
          Copy Monday hours to weekdays
        </Text>
      </TouchableOpacity>

      <View style={styles.hoursContainer}>
        {daysOfWeek.map((day) => {
          const dayData = data.businessHours[day];
          return (
            <View key={day} style={styles.dayRow}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </Text>
                <Switch
                  value={dayData.isOpen}
                  onValueChange={() => handleToggleDay(day)}
                  trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
              
              {dayData.isOpen ? (
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => handleTimePress(day, 'open')}
                  >
                    <Text style={styles.timeLabel}>Opens</Text>
                    <Text style={styles.timeValue}>
                      {formatTime(dayData.openTime)}
                    </Text>
                  </TouchableOpacity>
                  
                  <Icon name="arrow-forward" size={20} color={Colors.mediumGray} />
                  
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => handleTimePress(day, 'close')}
                  >
                    <Text style={styles.timeLabel}>Closes</Text>
                    <Text style={styles.timeValue}>
                      {formatTime(dayData.closeTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.closedText}>Closed</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <Icon name="schedule" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Set accurate business hours to help customers know when you're open.
            You can update these hours anytime from your restaurant settings.
          </Text>
        </View>
        
        <View style={styles.infoBox}>
          <Icon name="event" size={20} color={Colors.secondary} />
          <Text style={styles.infoText}>
            Special hours for holidays and events can be configured separately
            after your restaurant is created.
          </Text>
        </View>
      </View>

      {/* Time Picker Modal for iOS */}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  Select {selectedTimeType === 'open' ? 'Opening' : 'Closing'} Time
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleTimeChange}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker for Android */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </ScrollView>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.lightText,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  copyButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  hoursContainer: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dayRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayRow2: {
    borderBottomWidth: 0,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeButton: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  closedText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 12,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.danger,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalDone: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default BusinessHoursStep;