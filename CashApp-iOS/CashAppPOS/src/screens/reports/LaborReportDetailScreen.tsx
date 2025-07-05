import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design-system/ThemeProvider';

const Colors = {
  primary: '#00A651',
  white: '#FFFFFF',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  lightGray: '#ECF0F1',
  darkGray: '#7F8C8D',
};

const LaborReportDetailScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handleExportReport = () => {
    Alert.alert('Export Schedule Report', 'Export functionality coming soon');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule & Labor Report</Text>
        <TouchableOpacity style={styles.headerAction} onPress={handleExportReport}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
            <Icon name="schedule" size={32} color={Colors.primary} />
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>248h</Text>
            <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Scheduled Hours</Text>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
            <Icon name="access-time" size={32} color={Colors.success} />
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>232h</Text>
            <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Actual Hours</Text>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
            <Icon name="trending-up" size={32} color={Colors.warning} />
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>94%</Text>
            <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Efficiency</Text>
          </View>
        </View>

        {/* Coming Soon Section */}
        <View style={[styles.comingSoonCard, { backgroundColor: theme.colors.white }]}>
          <Icon name="construction" size={64} color={Colors.warning} />
          <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]}>
            Schedule & Labor Report
          </Text>
          <Text style={[styles.comingSoonText, { color: Colors.darkGray }]}>
            This comprehensive labor analysis feature is currently in development and will include:
          </Text>
          
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Schedule vs actual hours comparison
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Overtime tracking and alerts
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Labor cost optimization recommendations
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                Schedule conflict detection
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.notifyButton}
            onPress={() => Alert.alert('Notification', 'You will be notified when this feature is ready!')}
          >
            <Icon name="notifications" size={20} color={Colors.white} style={styles.notifyIcon} />
            <Text style={styles.notifyButtonText}>Notify Me When Ready</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
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
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerAction: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  comingSoonCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureList: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  notifyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifyIcon: {
    marginRight: 8,
  },
  notifyButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LaborReportDetailScreen;