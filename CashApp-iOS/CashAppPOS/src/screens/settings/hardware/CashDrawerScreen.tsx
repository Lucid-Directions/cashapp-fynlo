import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
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

interface CashDrawer {
  id: string;
  name: string;
  connection: 'printer' | 'usb' | 'network';
  status: 'connected' | 'disconnected' | 'error';
  printerName?: string;
  model?: string;
  location: string;
}

const CashDrawerScreen: React.FC = () => {
  const navigation = useNavigation();

  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([
    {
      id: 'drawer1',
      name: 'Main Cash Drawer',
      connection: 'printer',
      status: 'connected',
      printerName: 'Receipt Printer - Counter',
      model: 'APG Vasario 1616',
      location: 'Front Counter',
    },
    {
      id: 'drawer2',
      name: 'Mobile Cash Drawer',
      connection: 'usb',
      status: 'disconnected',
      model: 'Star mPOP',
      location: 'Mobile Station',
    },
  ]);

  // Cash drawer settings
  const [autoOpen, setAutoOpen] = useState(true);
  const [openOnPayment, setOpenOnPayment] = useState(true);
  const [openOnRefund, setOpenOnRefund] = useState(false);
  const [manualOpenPin, setManualOpenPin] = useState('1234');
  const [alertOnOpen, setAlertOnOpen] = useState(true);
  const [kickerPulseWidth, setKickerPulseWidth] = useState('50');
  const [autoCloseDelay, setAutoCloseDelay] = useState('30');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return Colors.success;
      case 'disconnected':
        return Colors.mediumGray;
      case 'error':
        return Colors.danger;
      default:
        return Colors.warning;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return 'check-circle';
      case 'disconnected':
        return 'radio-button-unchecked';
      case 'error':
        return 'error';
      default:
        return 'help';
    }
  };

  const getConnectionIcon = (connection: string) => {
    switch (connection) {
      case 'printer':
        return 'print';
      case 'usb':
        return 'usb';
      case 'network':
        return 'lan';
      default:
        return 'device-unknown';
    }
  };

  const handleTestDrawer = (drawer: CashDrawer) => {
    if (drawer.status !== 'connected') {
      Alert.alert('Error', 'Cash drawer must be connected to test.');
      return;
    }

    Alert.alert('Test Cash Drawer', `Open ${drawer.name} for testing?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Drawer',
        onPress: () => {
          Alert.alert('Success', 'Cash drawer opened successfully!');
        },
      },
    ]);
  };

  const handleManualOpen = () => {
    Alert.alert('Manual Open', 'Enter manager PIN to manually open cash drawer:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open',
        onPress: () => {
          // In real app, would verify PIN
          Alert.alert('Success', 'Cash drawer opened manually');
        },
      },
    ]);
  };

  const handleEmergencyOpen = () => {
    Alert.alert(
      'Emergency Open',
      'This will open all connected cash drawers immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Emergency Open',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'All cash drawers opened in emergency mode');
          },
        },
      ]
    );
  };

  const toggleDrawerStatus = (drawerId: string) => {
    setCashDrawers((prev) =>
      prev.map((drawer) =>
        drawer.id === drawerId
          ? {
              ...drawer,
              status: drawer.status === 'connected' ? 'disconnected' : 'connected',
            }
          : drawer
      )
    );
  };

  const CashDrawerCard = ({ drawer }: { drawer: CashDrawer }) => (
    <View style={styles.drawerCard}>
      <View style={styles.drawerHeader}>
        <View style={styles.drawerInfo}>
          <Text style={styles.drawerName}>{drawer.name}</Text>
          <View style={styles.drawerDetails}>
            <Icon name={getConnectionIcon(drawer.connection)} size={16} color={Colors.lightText} />
            <Text style={styles.drawerConnection}>
              {drawer.connection === 'printer'
                ? `Via ${drawer.printerName}`
                : drawer.connection.toUpperCase()}
            </Text>
          </View>
          {drawer.model && <Text style={styles.drawerModel}>{drawer.model}</Text>}
          <Text style={styles.drawerLocation}>📍 {drawer.location}</Text>
        </View>

        <View style={styles.drawerStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(drawer.status) }]}>
            <Icon name={getStatusIcon(drawer.status)} size={12} color={Colors.white} />
            <Text style={styles.statusText}>{drawer.status.toUpperCase()}</Text>
          </View>

          <Switch
            value={drawer.status === 'connected'}
            onValueChange={() => toggleDrawerStatus(drawer.id)}
            trackColor={{ false: Colors.lightGray, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>
      </View>

      <View style={styles.drawerActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            drawer.status !== 'connected' && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTestDrawer(drawer)}
          disabled={drawer.status !== 'connected'}
        >
          <Icon
            name="input"
            size={16}
            color={drawer.status === 'connected' ? Colors.primary : Colors.mediumGray}
          />
          <Text
            style={[
              styles.actionButtonText,
              drawer.status !== 'connected' && styles.actionButtonTextDisabled,
            ]}
          >
            Test Open
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Info', 'Drawer configuration would open here')}
        >
          <Icon name="settings" size={16} color={Colors.secondary} />
          <Text style={styles.actionButtonText}>Configure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => {
            Alert.alert('Remove Drawer', `Remove ${drawer.name}?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  setCashDrawers((prev) => prev.filter((d) => d.id !== drawer.id));
                },
              },
            ]);
          }}
        >
          <Icon name="delete" size={16} color={Colors.danger} />
          <Text style={[styles.actionButtonText, styles.removeButtonText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Drawer</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => Alert.alert('Info', 'Add cash drawer functionality coming soon')}
        >
          <Icon name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Emergency Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Controls</Text>
          <View style={styles.emergencyControls}>
            <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyOpen}>
              <Icon name="warning" size={24} color={Colors.danger} />
              <Text style={styles.emergencyButtonText}>Emergency Open</Text>
              <Text style={styles.emergencyButtonSubtext}>Opens all drawers</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.manualButton} onPress={handleManualOpen}>
              <Icon name="input" size={24} color={Colors.warning} />
              <Text style={styles.manualButtonText}>Manual Open</Text>
              <Text style={styles.manualButtonSubtext}>Requires PIN</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash Drawer Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drawer Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-open on payment</Text>
                <Text style={styles.settingDescription}>
                  Automatically open drawer when payment is completed
                </Text>
              </View>
              <Switch
                value={autoOpen && openOnPayment}
                onValueChange={setOpenOnPayment}
                disabled={!autoOpen}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Open on refunds</Text>
                <Text style={styles.settingDescription}>
                  Open drawer when processing cash refunds
                </Text>
              </View>
              <Switch
                value={autoOpen && openOnRefund}
                onValueChange={setOpenOnRefund}
                disabled={!autoOpen}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Alert on manual open</Text>
                <Text style={styles.settingDescription}>
                  Play sound when drawer is opened manually
                </Text>
              </View>
              <Switch
                value={alertOnOpen}
                onValueChange={setAlertOnOpen}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable auto-open</Text>
                <Text style={styles.settingDescription}>
                  Master switch for all automatic drawer opening
                </Text>
              </View>
              <Switch
                value={autoOpen}
                onValueChange={setAutoOpen}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Advanced Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Manual Open PIN</Text>
              <TextInput
                style={styles.textInput}
                value={manualOpenPin}
                onChangeText={setManualOpenPin}
                placeholder="Enter PIN"
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Kicker Pulse Width (ms)</Text>
              <TextInput
                style={styles.textInput}
                value={kickerPulseWidth}
                onChangeText={setKickerPulseWidth}
                placeholder="50"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Auto-close Delay (seconds)</Text>
              <TextInput
                style={styles.textInput}
                value={autoCloseDelay}
                onChangeText={setAutoCloseDelay}
                placeholder="30"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        </View>

        {/* Connected Cash Drawers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cash Drawers ({cashDrawers.length})</Text>
          {cashDrawers.map((drawer) => (
            <CashDrawerCard key={drawer.id} drawer={drawer} />
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="help-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                If drawer won't open, check that it's properly connected to the printer or USB port.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.helpText}>
                Ensure the kicker cable is securely connected between the printer and cash drawer.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Most cash drawers work through the receipt printer's kicker port.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emergencyControls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  emergencyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.danger + '20',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.danger,
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
    marginTop: 8,
  },
  emergencyButtonSubtext: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  manualButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.warning + '20',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  manualButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
    marginTop: 8,
  },
  manualButtonSubtext: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 4,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  inputRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  drawerCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  drawerInfo: {
    flex: 1,
    marginRight: 16,
  },
  drawerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  drawerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  drawerConnection: {
    fontSize: 12,
    color: Colors.lightText,
    fontWeight: '500',
  },
  drawerModel: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  drawerLocation: {
    fontSize: 12,
    color: Colors.lightText,
  },
  drawerStatus: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  drawerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  actionButtonTextDisabled: {
    color: Colors.mediumGray,
  },
  removeButton: {
    borderColor: Colors.danger,
  },
  removeButtonText: {
    color: Colors.danger,
  },
  helpCard: {
    paddingHorizontal: 16,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
});

export default CashDrawerScreen;
