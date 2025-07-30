import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useRestaurantDisplayName } from '../../hooks/useRestaurantConfig';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  color: string;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const restaurantDisplayName = useRestaurantDisplayName();
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);

  // Mock KPI data
  const kpiData: KPICardProps[] = [
    {
      title: "Today's Revenue",
      value: '£1,247.50',
      change: '+12.5%',
      changeType: 'positive',
      icon: 'attach-money',
      color: theme.colors.success,
    },
    {
      title: 'Orders Today',
      value: '23',
      change: '+8.2%',
      changeType: 'positive',
      icon: 'receipt',
      color: theme.colors.secondary,
    },
    {
      title: 'Avg Order Value',
      value: '£54.24',
      change: '-2.1%',
      changeType: 'negative',
      icon: 'trending-up',
      color: theme.colors.warning,
    },
    {
      title: 'Customer Satisfaction',
      value: '4.8',
      change: '+0.2',
      changeType: 'positive',
      icon: 'star',
      color: theme.colors.primary,
    },
  ];

  // Mock goals data
  const goalsData = [
    { label: 'Daily Sales Target', current: 1247.5, target: 1500.0, percentage: 83.2 },
    { label: 'Monthly Revenue', current: 28650.0, target: 35000.0, percentage: 81.9 },
    { label: 'Customer Retention', current: 94.5, target: 95.0, percentage: 99.5 },
  ];

  // Mock alerts data
  const alertsData: AlertItem[] = [
    {
      id: '1',
      type: 'warning',
      title: 'Low Stock Alert',
      message: 'Ground Coffee - House Blend is running low (5 kg remaining)',
      time: '15 min ago',
    },
    {
      id: '2',
      type: 'info',
      title: 'Peak Hour Approaching',
      message: 'Lunch rush expected in 30 minutes',
      time: '30 min ago',
    },
    {
      id: '3',
      type: 'success',
      title: 'Daily Target Achieved',
      message: 'Yesterday exceeded sales target by 15%',
      time: '2 hours ago',
    },
  ];

  // eslint-disable-next-line react/no-unstable-nested-components
  const KPICard: React.FC<KPICardProps> = ({ title, _value, change, _changeType, icon, color }) => (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <View style={[styles.kpiIcon, { backgroundColor: color }]}>
          <Icon name={icon} size={24} color={theme.colors.white} />
        </View>
        <View style={styles.kpiContent}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <Text style={styles.kpiValue}>{value}</Text>
        </View>
      </View>
      <View style={styles.kpiChange}>
        <Icon
          name={
            changeType === 'positive'
              ? 'trending-up'
              : changeType === 'negative'
              ? 'trending-down'
              : 'trending-flat'
          }
          size={16}
          color={
            changeType === 'positive'
              ? theme.colors.success
              : changeType === 'negative'
              ? theme.colors.danger
              : theme.colors.lightText
          }
        />
        <Text
          style={[
            styles.kpiChangeText,
            {
              color:
                changeType === 'positive'
                  ? theme.colors.success
                  : changeType === 'negative'
                  ? theme.colors.danger
                  : theme.colors.lightText,
            },
          ]}>
          {change}
        </Text>
        <Text style={styles.kpiChangeLabel}>vs yesterday</Text>
      </View>
    </View>
  );
// eslint-disable-next-line react/no-unstable-nested-components

  const GoalCard = ({
    label,
    current,
    target,
    percentage,
  }: {
    label: string;
    current: number;
    target: number;
    percentage: number;
  }) => (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalPercentage}>{percentage.toFixed(1)}%</Text>
      </View>
      <View style={styles.goalProgress}>
        <View style={styles.goalProgressTrack}>
          <View style={[styles.goalProgressFill, { width: `${Math.min(__percentage, 100)}%` }]} />
        </View>
      </View>
      <View style={styles.goalValues}>
        <Text style={styles.goalCurrent}>
          {label.includes('Revenue') || label.includes('Sales')
            ? `£${current.toLocaleString()}`
            : current}
        </Text>
        <Text style={styles.goalTarget}>
          of{' '}
          {label.includes('Revenue') || label.includes('Sales')
            ? `£${target.toLocaleString()}`
            : target}
        </Text>
      </View>
    </View>
  // eslint-disable-next-line react/no-unstable-nested-components
  );

  const AlertCard = ({ alert }: { alert: AlertItem }) => (
    <View style={styles.alertCard}>
      <View
        style={[
          styles.alertIcon,
          {
            backgroundColor:
              alert.type === 'warning'
                ? theme.colors.warning
                : alert.type === 'success'
                ? theme.colors.success
                : theme.colors.secondary,
          },
        ]}>
        <Icon
          name={
            alert.type === 'warning'
              ? 'warning'
              : alert.type === 'success'
              ? 'check-circle'
              : 'info'
          }
          size={20}
          color={theme.colors.white}
        />
      </View>
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertTime}>{alert.time}</Text>
        </View>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{restaurantDisplayName} Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            {kpiData.map((__kpi, _index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </View>
        </View>

        {/* Goals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals & Targets</Text>
          <View style={styles.goalsContainer}>
            {goalsData.map((__goal, _index) => (
              <GoalCard key={index} {...goal} />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Reports' as never)}>
              <Icon name="bar-chart" size={24} color={theme.colors.secondary} />
              <Text style={styles.actionText}>View Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Inventory' as never)}>
              <Icon name="inventory" size={24} color={theme.colors.warning} />
              <Text style={styles.actionText}>Check Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Employees' as never)}>
              <Icon name="people" size={24} color={theme.colors.success} />
              <Text style={styles.actionText}>Manage Staff</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Settings' as never)}>
              <Icon name="settings" size={24} color={theme.colors.darkGray} />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerts & Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          <View style={styles.alertsContainer}>
            {alertsData.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        </View>

        {/* Backend Status */}
        <View style={styles.section}>
          <View style={styles.backendNotice}>
            <Icon name="info" size={24} color={theme.colors.secondary} />
            <View style={styles.backendNoticeContent}>
              <Text style={styles.backendNoticeTitle}>Development Mode</Text>
              <Text style={styles.backendNoticeText}>
                This dashboard shows mock data for testing. Real-time data will be available once
                the backend is connected.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const __createStyles = (theme: _unknown) =>
  StyleSheet.create({
      shadowOpacity: 0.1,
      shadowRadius: 2
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
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }
  });

export default DashboardScreen;
