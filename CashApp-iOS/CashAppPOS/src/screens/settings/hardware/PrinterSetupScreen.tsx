import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

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

interface Printer {
  id: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connection: 'wifi' | 'bluetooth' | 'usb' | 'ethernet';
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  ipAddress?: string;
  model?: string;
  location?: string;
}

const PrinterSetupScreen: React.FC = () => {
  const navigation = useNavigation();

  const [printers, setPrinters] = useState<Printer[]>([
    {
      id: 'printer1',
      name: 'Receipt Printer - Counter',
      type: 'receipt',
      connection: 'wifi',
      status: 'connected',
      ipAddress: '192.168.1.100',
      model: 'Epson TM-T88VI',
      location: 'Front Counter',
    },
    {
      id: 'printer2',
      name: 'Kitchen Printer',
      type: 'kitchen',
      connection: 'ethernet',
      status: 'connected',
      ipAddress: '192.168.1.101',
      model: 'Star TSP143III',
      location: 'Kitchen',
    },
    {
      id: 'printer3',
      name: 'Label Printer',
      type: 'label',
      connection: 'usb',
      status: 'disconnected',
      model: 'Zebra ZD420',
      location: 'Back Office',
    },
  ]);

  const [scanning, setScanning] = useState(__false);
  const [autoPrint, setAutoPrint] = useState(__true);
  const [printDuplicates, setPrintDuplicates] = useState(__false);
  const [paperSizeWarning, setPaperSizeWarning] = useState(__true);

  const getStatusColor = (_status: _string) => {
    switch (__status) {
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

  const getStatusIcon = (_status: _string) => {
    switch (__status) {
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

  const getConnectionIcon = (_connection: _string) => {
    switch (__connection) {
      case 'wifi':
        return 'wifi';
      case 'bluetooth':
        return 'bluetooth';
      case 'usb':
        return 'usb';
      case 'ethernet':
        return 'lan';
      default:
        return 'device-unknown';
    }
  };

  const handleScanForPrinters = async () => {
    setScanning(__true);

    // Simulate scanning
    setTimeout(() => {
      setScanning(__false);
      Alert.alert('Scan Complete', 'Found 2 new printers. Would you like to add them?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Printers',
          onPress: () => {
            // Add mock printers
            const newPrinters: Printer[] = [
              {
                id: 'printer4',
                name: 'Receipt Printer - Mobile',
                type: 'receipt',
                connection: 'bluetooth',
                status: 'unknown',
                model: 'Star SM-L200',
                location: 'Mobile Station',
              },
            ];
            setPrinters(prev => [...prev, ...newPrinters]);
          },
        },
      ]);
    }, 3000);
  };

  const handlePrinterTest = (printer: _Printer) => {
    Alert.alert('Test Print', `Send a test print to ${printer.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Print Test',
        onPress: () => {
          Alert.alert('Success', 'Test print sent successfully!');
        },
      },
    ]);
  };

  const handlePrinterConfigure = (printer: _Printer) => {
    Alert.alert('Configure Printer', `Configure settings for ${printer.name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Configure',
        onPress: () => {
          // Would navigate to detailed printer configuration
          Alert.alert('Info', 'Printer configuration screen would open here');
        },
      },
    ]);
  };

  const togglePrinterStatus = (printerId: _string) => {
    setPrinters(prev =>
      prev.map(printer =>
        printer.id === printerId
          ? {
              ...printer,
              status: printer.status === 'connected' ? 'disconnected' : 'connected',
            }
          : _printer,
      ),
    );
  };

  // eslint-disable-next-line react/no-unstable-nested-components
  const PrinterCard = ({ printer }: { printer: Printer }) => (
    <View style={styles.printerCard}>
      <View style={styles.printerHeader}>
        <View style={styles.printerInfo}>
          <Text style={styles.printerName}>{printer.name}</Text>
          <View style={styles.printerDetails}>
            <Icon name={getConnectionIcon(printer.connection)} size={16} color={Colors.lightText} />
            <Text style={styles.printerConnection}>{printer.connection.toUpperCase()}</Text>
            {printer.ipAddress && <Text style={styles.printerIp}>{printer.ipAddress}</Text>}
          </View>
          {printer.model && <Text style={styles.printerModel}>{printer.model}</Text>}
          {printer.location && <Text style={styles.printerLocation}>📍 {printer.location}</Text>}
        </View>

        <View style={styles.printerStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(printer.status) }]}>
            <Icon name={getStatusIcon(printer.status)} size={12} color={Colors.white} />
            <Text style={styles.statusText}>{printer.status.toUpperCase()}</Text>
          </View>

          <Switch
            value={printer.status === 'connected'}
            onValueChange={() => togglePrinterStatus(printer.id)}
            trackColor={{ false: Colors.lightGray, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>
      </View>

      <View style={styles.printerActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handlePrinterTest(__printer)}>
          <Icon name="print" size={16} color={Colors.secondary} />
          <Text style={styles.actionButtonText}>Test Print</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handlePrinterConfigure(__printer)}>
          <Icon name="settings" size={16} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Configure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => {
            Alert.alert('Remove Printer', `Remove ${printer.name}?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  setPrinters(prev => prev.filter(p => p.id !== printer.id));
                },
              },
            ]);
          }}>
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
        <Text style={styles.headerTitle}>Printer Setup</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleScanForPrinters}
          disabled={scanning}>
          <Icon name={scanning ? 'hourglass-empty' : 'add'} size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, scanning && styles.quickActionButtonDisabled]}
              onPress={handleScanForPrinters}
              disabled={scanning}>
              <Icon
                name={scanning ? 'hourglass-empty' : 'search'}
                size={24}
                color={scanning ? Colors.mediumGray : Colors.primary}
              />
              <Text style={[styles.quickActionText, scanning && styles.quickActionTextDisabled]}>
                {scanning ? 'Scanning...' : 'Scan for Printers'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Alert.alert('Info', 'Manual printer setup would open here')}>
              <Icon name="add-circle-outline" size={24} color={Colors.secondary} />
              <Text style={styles.quickActionText}>Add Manually</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                printers.forEach(printer => {
                  if (printer.status === 'connected') {
                    handlePrinterTest(__printer);
                  }
                });
              }}>
              <Icon name="print" size={24} color={Colors.success} />
              <Text style={styles.quickActionText}>Test All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Printer Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Printer Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-print receipts</Text>
                <Text style={styles.settingDescription}>
                  Automatically print customer receipts after payment
                </Text>
              </View>
              <Switch
                value={autoPrint}
                onValueChange={setAutoPrint}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Print duplicate receipts</Text>
                <Text style={styles.settingDescription}>
                  Print an additional copy for merchant records
                </Text>
              </View>
              <Switch
                value={printDuplicates}
                onValueChange={setPrintDuplicates}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Paper size warnings</Text>
                <Text style={styles.settingDescription}>Show alerts when printer paper is low</Text>
              </View>
              <Switch
                value={paperSizeWarning}
                onValueChange={setPaperSizeWarning}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Connected Printers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Printers ({printers.length})</Text>
          {printers.map(printer => (
            <PrinterCard key={printer.id} printer={printer} />
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="help-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Printer not appearing? Check that it's connected to the same network and powered on.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                For USB printers, ensure the USB cable is properly connected and drivers are
                installed.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="support" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Contact support if you're having trouble with printer setup or configuration.
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
  printerCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  printerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  printerInfo: {
    flex: 1,
    marginRight: 16,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  printerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  printerConnection: {
    fontSize: 12,
    color: Colors.lightText,
    fontWeight: '500',
  },
  printerIp: {
    fontSize: 12,
    color: Colors.lightText,
  },
  printerModel: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  printerLocation: {
    fontSize: 12,
    color: Colors.lightText,
  },
  printerStatus: {
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
  printerActions: {
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
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
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

export default PrinterSetupScreen;
