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

const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#27AE60',
  warning: '#F39C12',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

const ReportsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>£1,247.50</Text>
                <Text style={styles.statLabel}>Total Sales</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>23</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Items Today</Text>
          <View style={styles.card}>
            <Text style={styles.itemText}>🌮 Carnitas Tacos - 15 sold</Text>
            <Text style={styles.itemText}>🧀 Nachos - 12 sold</Text>
            <Text style={styles.itemText}>🫓 Quesadillas - 10 sold</Text>
            <Text style={styles.itemText}>🌯 Burritos - 8 sold</Text>
          </View>
        </View>

        {/* Staff Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Performance</Text>
          <View style={styles.card}>
            <Text style={styles.itemText}>Maria Rodriguez - £485.20</Text>
            <Text style={styles.itemText}>Carlos Martinez - £432.60</Text>
            <Text style={styles.itemText}>Sofia Hernandez - £329.70</Text>
          </View>
        </View>

        {/* Reports Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Reports</Text>
          
          <TouchableOpacity style={styles.reportItem}>
            <Icon name="trending-up" size={24} color={Colors.success} />
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>Sales Report</Text>
              <Text style={styles.reportDesc}>Daily, weekly, monthly sales</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportItem}>
            <Icon name="inventory" size={24} color={Colors.warning} />
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>Inventory Report</Text>
              <Text style={styles.reportDesc}>Stock levels and costs</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportItem}>
            <Icon name="people" size={24} color={Colors.secondary} />
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>Staff Report</Text>
              <Text style={styles.reportDesc}>Employee performance</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportItem}>
            <Icon name="account-balance" size={24} color={Colors.primary} />
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>Financial Report</Text>
              <Text style={styles.reportDesc}>Profit, loss, and expenses</Text>
            </View>
            <Icon name="chevron-right" size={24} color={Colors.lightText} />
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Mock data for development. Backend integration pending.
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.success,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 4,
  },
  itemText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  reportItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reportInfo: {
    flex: 1,
    marginLeft: 16,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  reportDesc: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  notice: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  noticeText: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
  },
});

export default ReportsScreen;