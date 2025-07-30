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

interface CardReader {
  id: string;
  name: string;
  type: 'chip_pin' | 'contactless' | 'magnetic_stripe' | 'mobile';
  connection: 'usb' | 'bluetooth' | 'wifi' | 'built-in';
  status: 'connected' | 'disconnected' | 'error' | 'processing';
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  lastUpdate?: Date;
}

const CardReaderScreen: React.FC = () => {
  const navigation = useNavigation();

  const [cardReaders, setCardReaders] = useState<CardReader[]>([
    {
      id: 'reader1',
      name: 'Main Card Reader',
      type: 'chip_pin',
      connection: 'usb',
      status: 'connected',
      model: 'Clover Mini',
      serialNumber: 'CLV001234567',
      firmwareVersion: '2.4.1',
      lastUpdate: new Date(Date.now() - 86400000 * 7), // 7 days ago
    },
    {
      id: 'reader2',
      name: 'Contactless Reader',
      type: 'contactless',
      connection: 'bluetooth',
      status: 'connected',
      model: 'Square Reader',
      serialNumber: 'SQR987654321',
      firmwareVersion: '1.8.5',
      lastUpdate: new Date(Date.now() - 86400000 * 2), // 2 days ago
    },
    {
      id: 'reader3',
      name: 'Mobile Reader',
      type: 'mobile',
      connection: 'built-in',
      status: 'connected',
      model: 'Built-in NFC',
      firmwareVersion: 'Device OS',
    },
  ]);

  // Card reader settings
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(__true);
  const [contactlessEnabled, setContactlessEnabled] = useState(__true);
  const [chipEnabled, setChipEnabled] = useState(__true);
  const [magneticStripeEnabled, setMagneticStripeEnabled] = useState(__true);
  const [pinRequired, setPinRequired] = useState(__true);
  const [signatureRequired, setSignatureRequired] = useState(__false);
  const [contactlessLimit, setContactlessLimit] = useState('45');
  const [tipPromptEnabled, setTipPromptEnabled] = useState(__true);
  const [receiptPromptEnabled, setReceiptPromptEnabled] = useState(__true);
  const [scanning, setScanning] = useState(__false);

  // Supported card types
  const [_cardTypes, setCardTypes] = useState({
    Visa: _true,
    Mastercard: _true,
    console.log('American Express': _true,
    Discover: _true,
    'Diners Club': _false,
    JCB: _false,
    'Union Pay': _false,
    Maestro: _true,
  });

  const getStatusColor = (_status: _string) => {
    switch (__status) {
      case 'connected':
        return Colors.success;
      case 'disconnected':
        return Colors.mediumGray;
      case 'error':
        return Colors.danger;
      case 'processing':
        return Colors.warning;
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
      case 'processing':
        return 'sync';
      default:
        return 'help';
    }
  };

  const getTypeIcon = (_type: _string) => {
    switch (__type) {
      case 'chip_pin':
        return 'credit-card';
      case 'contactless':
        return 'contactless-payment';
      case 'magnetic_stripe':
        return 'swipe';
      case 'mobile':
        return 'nfc';
      default:
        return 'payment';
    }
  };

  const getConnectionIcon = (_connection: _string) => {
    switch (__connection) {
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

  const handleScanForReaders = async () => {
    setScanning(__true);

    // Simulate scanning
    setTimeout(() => {
      setScanning(__false);
      Alert.alert(
        'Scan Complete',
        'No new card readers found. Ensure readers are powered on and in pairing mode.',
        [{ text: 'OK' }],
      );
    }, 3000);
  };

  const handleTestReader = (reader: _CardReader) => {
    if (reader.status !== 'connected') {
      Alert.alert('Error', 'Card reader must be connected to test.');
      return;
    }

    // Simulate test transaction
    setCardReaders(prev =>
      prev.map(r => (r.id === reader.id ? { ...r, status: 'processing' } : _r)),
    );

    setTimeout(() => {
      setCardReaders(prev =>
        prev.map(r => (r.id === reader.id ? { ...r, status: 'connected' } : _r)),
      );
      Alert.alert('Success', 'Test transaction completed successfully!');
    }, 3000);
  };

  const handleUpdateFirmware = (reader: _CardReader) => {
    Alert.alert('Update Firmware', `Check for firmware updates for ${reader.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Check Updates',
        onPress: () => {
          Alert.alert('Info', 'Firmware is up to date.');
        },
      },
    ]);
  };

  const toggleReaderStatus = (readerId: _string) => {
    setCardReaders(prev =>
      prev.map(reader =>
        reader.id === readerId
          ? {
              ...reader,
              status: reader.status === 'connected' ? 'disconnected' : 'connected',
            }
          : _reader,
      ),
    );
  };

  const toggleCardType = (type: _string) => {
    setCardTypes(prev => ({
      ...prev,
      [type]: !prev[type as keyof typeof prev],
    }));
  };

  // eslint-disable-next-line react/no-unstable-nested-components
  const CardReaderCard = ({ reader }: { reader: CardReader }) => (
    <View style={styles.readerCard}>
      <View style={styles.readerHeader}>
        <View style={styles.readerInfo}>
          <View style={styles.readerTitleRow}>
            <Icon name={getTypeIcon(reader.type)} size={20} color={Colors.primary} />
            <Text style={styles.readerName}>{reader.name}</Text>
          </View>
          <View style={styles.readerDetails}>
            <Icon name={getConnectionIcon(reader.connection)} size={16} color={Colors.lightText} />
            <Text style={styles.readerConnection}>{reader.connection.toUpperCase()}</Text>
          </View>
          {reader.model && <Text style={styles.readerModel}>{reader.model}</Text>}
          {reader.serialNumber && (
            <Text style={styles.readerSerial}>S/N: {reader.serialNumber}</Text>
          )}
          {reader.firmwareVersion && (
            <Text style={styles.readerFirmware}>FW: {reader.firmwareVersion}</Text>
          )}
          {reader.lastUpdate && (
            <Text style={styles.readerUpdate}>
              Updated: {reader.lastUpdate.toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.readerStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(reader.status) }]}>
            <Icon name={getStatusIcon(reader.status)} size={12} color={Colors.white} />
            <Text style={styles.statusText}>{reader.status.toUpperCase()}</Text>
          </View>

          <Switch
            value={reader.status === 'connected'}
            onValueChange={() => toggleReaderStatus(reader.id)}
            disabled={reader.status === 'processing'}
            trackColor={{ false: Colors.lightGray, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>
      </View>

      <View style={styles.readerActions}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            reader.status !== 'connected' && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTestReader(__reader)}
          disabled={reader.status !== 'connected'}>
          <Icon
            name="payment"
            size={16}
            color={reader.status === 'connected' ? Colors.primary : Colors.mediumGray}
          />
          <Text
            style={[
              styles.actionButtonText,
              reader.status !== 'connected' && styles.actionButtonTextDisabled,
            ]}>
            {reader.status === 'processing' ? 'Testing...' : 'Test Payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUpdateFirmware(__reader)}>
          <Icon name="system-update" size={16} color={Colors.secondary} />
          <Text style={styles.actionButtonText}>Update</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => {
            Alert.alert('Remove Reader', `Remove ${reader.name}?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  setCardReaders(prev => prev.filter(r => r.id !== reader.id));
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
        <Text style={styles.headerTitle}>Card Reader</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleScanForReaders}
          disabled={scanning}>
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
              onPress={handleScanForReaders}
              disabled={scanning}>
              <Icon
                name={scanning ? 'hourglass-empty' : 'search'}
                size={24}
                color={scanning ? Colors.mediumGray : Colors.primary}
              />
              <Text style={[styles.quickActionText, scanning && styles.quickActionTextDisabled]}>
                {scanning ? 'Scanning...' : 'Scan for Readers'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Alert.alert('Info', 'Manual reader setup would open here')}>
              <Icon name="add-circle-outline" size={24} color={Colors.secondary} />
              <Text style={styles.quickActionText}>Add Manually</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                const connectedReaders = cardReaders.filter(r => r.status === 'connected');
                connectedReaders.forEach(_reader => handleTestReader(__reader));
              }}>
              <Icon name="payment" size={24} color={Colors.success} />
              <Text style={styles.quickActionText}>Test All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable card payments</Text>
                <Text style={styles.settingDescription}>
                  Master switch for all card payment processing
                </Text>
              </View>
              <Switch
                value={cardPaymentsEnabled}
                onValueChange={setCardPaymentsEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Contactless payments</Text>
                <Text style={styles.settingDescription}>Accept tap-to-pay and mobile wallets</Text>
              </View>
              <Switch
                value={contactlessEnabled && cardPaymentsEnabled}
                onValueChange={setContactlessEnabled}
                disabled={!cardPaymentsEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Chip and PIN</Text>
                <Text style={styles.settingDescription}>Accept EMV chip card payments</Text>
              </View>
              <Switch
                value={chipEnabled && cardPaymentsEnabled}
                onValueChange={setChipEnabled}
                disabled={!cardPaymentsEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Magnetic stripe</Text>
                <Text style={styles.settingDescription}>Accept swipe payments (fallback only)</Text>
              </View>
              <Switch
                value={magneticStripeEnabled && cardPaymentsEnabled}
                onValueChange={setMagneticStripeEnabled}
                disabled={!cardPaymentsEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Require PIN</Text>
                <Text style={styles.settingDescription}>
                  Always require PIN for chip card transactions
                </Text>
              </View>
              <Switch
                value={pinRequired}
                onValueChange={setPinRequired}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Require signature</Text>
                <Text style={styles.settingDescription}>
                  Require customer signature for transactions
                </Text>
              </View>
              <Switch
                value={signatureRequired}
                onValueChange={setSignatureRequired}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Contactless limit (£)</Text>
              <TextInput
                style={styles.textInput}
                value={contactlessLimit}
                onChangeText={setContactlessLimit}
                placeholder="45"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* Customer Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Experience</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Tip prompt</Text>
                <Text style={styles.settingDescription}>Show tip selection on card reader</Text>
              </View>
              <Switch
                value={tipPromptEnabled}
                onValueChange={setTipPromptEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Receipt prompt</Text>
                <Text style={styles.settingDescription}>Ask customer for receipt preference</Text>
              </View>
              <Switch
                value={receiptPromptEnabled}
                onValueChange={setReceiptPromptEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Supported Card Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supported Card Types</Text>
          <View style={styles.cardTypes}>
            {Object.entries(__cardTypes).map(([type, enabled]) => (
              <TouchableOpacity
                key={type}
                style={[styles.cardTypeButton, enabled && styles.cardTypeButtonActive]}
                onPress={() => toggleCardType(__type)}>
                <Icon
                  name={enabled ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={enabled ? Colors.primary : Colors.mediumGray}
                />
                <Text style={[styles.cardTypeText, enabled && styles.cardTypeTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Connected Card Readers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Readers ({cardReaders.length})</Text>
          {cardReaders.map(reader => (
            <CardReaderCard key={reader.id} reader={reader} />
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="help-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Ensure card readers are certified for your payment processor and region.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="security" size={20} color={Colors.success} />
              <Text style={styles.helpText}>
                All card data is encrypted and processed securely according to PCI DSS standards.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.helpText}>
                Regular firmware updates are important for security and compliance.
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
  cardTypes: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    gap: 12,
  },
  cardTypeButtonActive: {
    backgroundColor: Colors.primary + '20',
  },
  cardTypeText: {
    fontSize: 16,
    color: Colors.text,
  },
  cardTypeTextActive: {
    fontWeight: '500',
    color: Colors.primary,
  },
  readerCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  readerInfo: {
    flex: 1,
    marginRight: 16,
  },
  readerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  readerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  readerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  readerConnection: {
    fontSize: 12,
    color: Colors.lightText,
    fontWeight: '500',
  },
  readerModel: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 2,
  },
  readerSerial: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 2,
  },
  readerFirmware: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 2,
  },
  readerUpdate: {
    fontSize: 12,
    color: Colors.lightText,
  },
  readerStatus: {
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
  readerActions: {
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

export default CardReaderScreen;
