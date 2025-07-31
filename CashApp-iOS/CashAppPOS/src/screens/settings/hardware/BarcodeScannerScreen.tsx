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

import { useNavigation } from '@react-navigation/native';
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

interface BarcodeScanner {
  id: string;
  name: string;
  type: 'handheld' | 'fixed' | 'camera';
  connection: 'usb' | 'bluetooth' | 'wifi' | 'built-in';
  status: 'connected' | 'disconnected' | 'error';
  model?: string;
  serialNumber?: string;
  batteryLevel?: number;
}

const BarcodeScannerScreen: React.FC = () => {
  const navigation = useNavigation();

  const [scanners, setScanners] = useState<BarcodeScanner[]>([
    {
      id: 'scanner1',
      name: 'Handheld Scanner',
      type: 'handheld',
      connection: 'bluetooth',
      status: 'connected',
      model: 'Zebra CS4070',
      serialNumber: 'ZB4070001234',
      batteryLevel: 85,
    },
    {
      id: 'scanner2',
      name: 'Fixed Mount Scanner',
      type: 'fixed',
      connection: 'usb',
      status: 'connected',
      model: 'Honeywell MS7580',
      serialNumber: 'HW7580005678',
    },
    {
      id: 'scanner3',
      name: 'Camera Scanner',
      type: 'camera',
      connection: 'built-in',
      status: 'connected',
      model: 'Built-in Camera',
    },
  ]);

  // Scanner settings
  const [scanningEnabled, setScanningEnabled] = useState(true);
  const [autoEnterEnabled, setAutoEnterEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [duplicateTimeout, setDuplicateTimeout] = useState('3');
  const [scanPrefix, setScanPrefix] = useState('');
  const [scanSuffix, setScanSuffix] = useState('');
  const [scanning, setScanning] = useState(false);

  // Supported barcode types
  const [barcodeTypes, setBarcodeTypes] = useState({
    'UPC-A': true,
    'UPC-E': true,
    'EAN-13': true,
    'EAN-8': true,
    'Code-128': true,
    'Code-39': true,
    'Code-93': false,
    Codabar: false,
    ITF: false,
    'QR Code': true,
    'Data Matrix': true,
    PDF417: false,
  });

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'handheld':
        return 'scanner';
      case 'fixed':
        return 'qr-code-scanner';
      case 'camera':
        return 'camera-alt';
      default:
        return 'qr-code';
    }
  };

  const getConnectionIcon = (connection: string) => {
    switch (connection) {
      case 'bluetooth':
        return 'bluetooth';
      case 'usb':
        return 'usb';
      case 'wifi':
        return 'wifi';
      case 'built-in':
        return 'phone-android';
      default:
        return 'device-unknown';
    }
  };

  const handleScanForDevices = async () => {
    setScanning(true);

    // Simulate scanning
    setTimeout(() => {
      setScanning(false);
      Alert.alert('Scan Complete', 'Found 1 new scanner. Would you like to add it?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Scanner',
          onPress: () => {
            const newScanner: BarcodeScanner = {
              id: 'scanner4',
              name: 'New Bluetooth Scanner',
              type: 'handheld',
              connection: 'bluetooth',
              status: 'disconnected',
              model: 'Generic BT Scanner',
              serialNumber: 'BT001122334',
            };
            setScanners((prev) => [...prev, newScanner]);
          },
        },
      ]);
    }, 2500);
  };

  const handleTestScanner = (scanner: BarcodeScanner) => {
    if (scanner.status !== 'connected') {
      Alert.alert('Error', 'Scanner must be connected to test.');
      return;
    }

    Alert.alert('Test Scanner', `Testing ${scanner.name}. Please scan a barcode.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Simulate Scan',
        onPress: () => {
          Alert.alert('Success', 'Test scan successful!\nBarcode: 1234567890123');
        },
      },
    ]);
  };

  const toggleScannerStatus = (scannerId: string) => {
    setScanners((prev) =>
      prev.map((scanner) =>
        scanner.id === scannerId
          ? {
              ...scanner,
              status: scanner.status === 'connected' ? 'disconnected' : 'connected',
            }
          : scanner
      )
    );
  };

  const toggleBarcodeType = (type: string) => {
    setBarcodeTypes((prev) => ({
      ...prev,
      [type]: !prev[type as keyof typeof prev],
    }));
  };

  const ScannerCard = ({ scanner }: { scanner: BarcodeScanner }) => (
    <View style={styles.scannerCard}>
      <View style={styles.scannerHeader}>
        <View style={styles.scannerInfo}>
          <View style={styles.scannerTitleRow}>
            <Icon name={getTypeIcon(scanner.type)} size={20} color={Colors.primary} />
            <Text style={styles.scannerName}>{scanner.name}</Text>
          </View>
          <View style={styles.scannerDetails}>
            <Icon name={getConnectionIcon(scanner.connection)} size={16} color={Colors.lightText} />
            <Text style={styles.scannerConnection}>{scanner.connection.toUpperCase()}</Text>
            {scanner.batteryLevel && (
              <>
                <Icon name="battery-std" size={16} color={Colors.lightText} />
                <Text style={styles.batteryLevel}>{scanner.batteryLevel}%</Text>
              </>
            )}
          </View>
          {scanner.model && <Text style={styles.scannerModel}>{scanner.model}</Text>}
          {scanner.serialNumber && (
            <Text style={styles.scannerSerial}>S/N: {scanner.serialNumber}</Text>
          )}
        </View>

        <View style={styles.scannerStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(scanner.status) }]}>
            <Icon name={getStatusIcon(scanner.status)} size={12} color={Colors.white} />
            <Text style={styles.statusText}>{scanner.status.toUpperCase()}</Text>
          </View>

          <Switch
            value={scanner.status === 'connected'}
            onValueChange={() => toggleScannerStatus(scanner.id)}
            trackColor={{ false: Colors.lightGray, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>
      </View>

      <View style={styles.scannerActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            scanner.status !== 'connected' && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTestScanner(scanner)}
          disabled={scanner.status !== 'connected'}
        >
          <Icon
            name="qr-code-scanner"
            size={16}
            color={scanner.status === 'connected' ? Colors.primary : Colors.mediumGray}
          />
          <Text
            style={[
              styles.actionButtonText,
              scanner.status !== 'connected' && styles.actionButtonTextDisabled,
            ]}
          >
            Test Scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Info', 'Scanner configuration would open here')}
        >
          <Icon name="settings" size={16} color={Colors.secondary} />
          <Text style={styles.actionButtonText}>Configure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => {
            Alert.alert('Remove Scanner', `Remove ${scanner.name}?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  setScanners((prev) => prev.filter((s) => s.id !== scanner.id));
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
        <Text style={styles.headerTitle}>Barcode Scanner</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleScanForDevices}
          disabled={scanning}
        >
          <Icon name={scanning ? 'hourglass-empty' : 'search'} size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, scanning && styles.quickActionButtonDisabled]}
              onPress={handleScanForDevices}
              disabled={scanning}
            >
              <Icon
                name={scanning ? 'hourglass-empty' : 'search'}
                size={24}
                color={scanning ? Colors.mediumGray : Colors.primary}
              />
              <Text style={[styles.quickActionText, scanning && styles.quickActionTextDisabled]}>
                {scanning ? 'Scanning...' : 'Scan for Devices'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Alert.alert('Info', 'Manual scanner setup would open here')}
            >
              <Icon name="add-circle-outline" size={24} color={Colors.secondary} />
              <Text style={styles.quickActionText}>Add Manually</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                const connectedScanners = scanners.filter((s) => s.status === 'connected');
                if (connectedScanners.length === 0) {
                  Alert.alert('No Scanners', 'No connected scanners available for testing.');
                } else {
                  Alert.alert(
                    'Test All',
                    `Testing ${connectedScanners.length} connected scanner(s)`
                  );
                }
              }}
            >
              <Icon name="qr-code-scanner" size={24} color={Colors.success} />
              <Text style={styles.quickActionText}>Test All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scanner Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scanner Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable scanning</Text>
                <Text style={styles.settingDescription}>
                  Master switch for all barcode scanning
                </Text>
              </View>
              <Switch
                value={scanningEnabled}
                onValueChange={setScanningEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-enter after scan</Text>
                <Text style={styles.settingDescription}>Automatically confirm barcode entry</Text>
              </View>
              <Switch
                value={autoEnterEnabled && scanningEnabled}
                onValueChange={setAutoEnterEnabled}
                disabled={!scanningEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sound feedback</Text>
                <Text style={styles.settingDescription}>Play sound when barcode is scanned</Text>
              </View>
              <Switch
                value={soundEnabled && scanningEnabled}
                onValueChange={setSoundEnabled}
                disabled={!scanningEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Vibration feedback</Text>
                <Text style={styles.settingDescription}>
                  Vibrate device when barcode is scanned
                </Text>
              </View>
              <Switch
                value={vibrationEnabled && scanningEnabled}
                onValueChange={setVibrationEnabled}
                disabled={!scanningEnabled}
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
              <Text style={styles.inputLabel}>Duplicate scan timeout (seconds)</Text>
              <TextInput
                style={styles.textInput}
                value={duplicateTimeout}
                onChangeText={setDuplicateTimeout}
                placeholder="3"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Scan prefix</Text>
              <TextInput
                style={styles.textInput}
                value={scanPrefix}
                onChangeText={setScanPrefix}
                placeholder="Optional prefix"
                maxLength={10}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Scan suffix</Text>
              <TextInput
                style={styles.textInput}
                value={scanSuffix}
                onChangeText={setScanSuffix}
                placeholder="Optional suffix"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* Supported Barcode Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supported Barcode Types</Text>
          <View style={styles.barcodeTypes}>
            {Object.entries(barcodeTypes).map(([type, enabled]) => (
              <TouchableOpacity
                key={type}
                style={[styles.barcodeTypeButton, enabled && styles.barcodeTypeButtonActive]}
                onPress={() => toggleBarcodeType(type)}
              >
                <Icon
                  name={enabled ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={enabled ? Colors.primary : Colors.mediumGray}
                />
                <Text style={[styles.barcodeTypeText, enabled && styles.barcodeTypeTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Connected Scanners */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Barcode Scanners ({scanners.length})</Text>
          {scanners.map((scanner) => (
            <ScannerCard key={scanner.id} scanner={scanner} />
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="help-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                For Bluetooth scanners, ensure Bluetooth is enabled and the scanner is in pairing
                mode.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.helpText}>
                USB scanners require OTG (On-The-Go) support on your device.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Camera scanning works best in good lighting conditions with clear barcodes.
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
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  quickActionTextDisabled: {
    color: Colors.mediumGray,
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
  barcodeTypes: {
    paddingHorizontal: 16,
    gap: 12,
  },
  barcodeTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    gap: 12,
  },
  barcodeTypeButtonActive: {
    backgroundColor: Colors.primary + '20',
  },
  barcodeTypeText: {
    fontSize: 16,
    color: Colors.text,
  },
  barcodeTypeTextActive: {
    fontWeight: '500',
    color: Colors.primary,
  },
  scannerCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scannerInfo: {
    flex: 1,
    marginRight: 16,
  },
  scannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scannerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  scannerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  scannerConnection: {
    fontSize: 12,
    color: Colors.lightText,
    fontWeight: '500',
  },
  batteryLevel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  scannerModel: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  scannerSerial: {
    fontSize: 12,
    color: Colors.lightText,
  },
  scannerStatus: {
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
  scannerActions: {
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

export default BarcodeScannerScreen;
