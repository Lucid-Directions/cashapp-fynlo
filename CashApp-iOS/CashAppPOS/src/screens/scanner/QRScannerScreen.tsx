import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Colors from '../../constants/Colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type QRScannerRouteProp = RouteProp<
  {
    QRScanner: {
      onScanned: (data: string) => void;
      title?: string;
      subtitle?: string;
    };
  },
  'QRScanner'
>;

interface ScanResult {
  data: string;
  type: string;
  timestamp: Date;
}

const QRScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<QRScannerRouteProp>();

  const {
    onScanned,
    title = 'QR Scanner',
    subtitle = 'Point camera at QR code',
  } = route.params || {};

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scannedData, setScannedData] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestCameraPermission();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const requestCameraPermission = async () => {
    try {
      setIsLoading(true);

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Camera Permission Required',
          message:
            'Fynlo POS needs camera access to scan QR codes for payments and inventory management.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        });

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
          setPermissionDenied(false);
        } else {
          setHasPermission(false);
          setPermissionDenied(true);
        }
      } else {
        // For iOS, we'll simulate permission request
        // In real implementation, this would use react-native-permissions
        setTimeout(() => {
          setHasPermission(true);
          setPermissionDenied(false);
        }, 1000);
      }
    } catch (error) {
      setHasPermission(false);
      setPermissionDenied(true);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateQRScan = () => {
    if (!isScanning) {
      return;
    }

    // Simulate different types of QR codes
    const mockQRCodes = [
      'PAYMENT:£25.50:TXN123456',
      'PRODUCT:SKU789:Nachos Supreme',
      'TABLE:T08:Outdoor Seating',
      'MENU:ITEM001:Chicken Quesadilla',
      'CUSTOMER:CUST456:John Doe',
      'https://fynlo.com/payment/abc123',
      'INVENTORY:INV789:Ground Coffee - House Blend',
    ];

    const randomCode = mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)];

    const result: ScanResult = {
      data: randomCode,
      type: 'QR_CODE',
      timestamp: new Date(),
    };

    setScannedData(result);
    setIsScanning(false);

    // Provide haptic feedback simulation

    // Auto-confirm after 2 seconds or let user manually confirm
    scanTimeoutRef.current = setTimeout(() => {
      handleConfirmScan(result);
    }, 2000);
  };

  const handleConfirmScan = (result: ScanResult) => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    if (onScanned) {
      onScanned(result.data);
    }
    navigation.goBack();
  };

  const handleRetryScanning = () => {
    setScannedData(null);
    setIsScanning(true);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Camera Permission Required',
      'Please enable camera permission in your device settings to use the QR scanner.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const getQRCodeTypeDisplay = (data: string) => {
    if (data.startsWith('PAYMENT:')) {
      return 'Payment QR Code';
    }
    if (data.startsWith('PRODUCT:')) {
      return 'Product Code';
    }
    if (data.startsWith('TABLE:')) {
      return 'Table Code';
    }
    if (data.startsWith('MENU:')) {
      return 'Menu Item';
    }
    if (data.startsWith('CUSTOMER:')) {
      return 'Customer Code';
    }
    if (data.startsWith('INVENTORY:')) {
      return 'Inventory Item';
    }
    if (data.startsWith('http')) {
      return 'Website Link';
    }
    return 'QR Code';
  };

  const formatScannedData = (data: string) => {
    if (data.length > 50) {
      return data.substring(0, 47) + '...';
    }
    return data;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false || permissionDenied) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Camera Permission</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.permissionContainer}>
          <Icon name="camera-alt" size={80} color={Colors.lightGray} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            Fynlo POS needs camera access to scan QR codes for:
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Icon name="payment" size={20} color={Colors.primary} />
              <Text style={styles.featureText}>Payment processing</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="inventory" size={20} color={Colors.primary} />
              <Text style={styles.featureText}>Inventory management</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="qr-code" size={20} color={Colors.primary} />
              <Text style={styles.featureText}>Quick product lookup</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="table-restaurant" size={20} color={Colors.primary} />
              <Text style={styles.featureText}>Table identification</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Icon name="camera-alt" size={20} color={Colors.white} />
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
            <Text style={styles.settingsButtonText}>Open App Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.flashButton} onPress={() => setFlashEnabled(!flashEnabled)}>
          <Icon
            name={flashEnabled ? 'flash-on' : 'flash-off'}
            size={24}
            color={flashEnabled ? Colors.warning : Colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* Camera View Simulation */}
      <View style={styles.cameraContainer}>
        {/* Scanning Frame */}
        <View style={styles.scanFrame}>
          <View style={styles.scanFrameCorner} />
          <View style={[styles.scanFrameCorner, styles.topRight]} />
          <View style={[styles.scanFrameCorner, styles.bottomLeft]} />
          <View style={[styles.scanFrameCorner, styles.bottomRight]} />

          {isScanning && <View style={styles.scanLine} />}
        </View>

        {/* Scanning Instructions */}
        {isScanning ? (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>Position QR code within the frame</Text>
            <Text style={styles.instructionsSubtext}>
              Camera will automatically detect and scan
            </Text>
          </View>
        ) : scannedData ? (
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <Icon name="check-circle" size={48} color={Colors.success} />
              <Text style={styles.resultTitle}>QR Code Detected!</Text>
              <Text style={styles.resultType}>{getQRCodeTypeDisplay(scannedData.data)}</Text>
              <Text style={styles.resultData}>{formatScannedData(scannedData.data)}</Text>

              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetryScanning}>
                  <Icon name="refresh" size={20} color={Colors.secondary} />
                  <Text style={styles.retryButtonText}>Scan Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleConfirmScan(scannedData)}>
                  <Icon name="check" size={20} color={Colors.white} />
                  <Text style={styles.confirmButtonText}>Use This Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {isScanning && (
          <TouchableOpacity style={styles.manualScanButton} onPress={simulateQRScan}>
            <Icon name="qr-code-scanner" size={24} color={Colors.white} />
            <Text style={styles.manualScanText}>Simulate Scan</Text>
          </TouchableOpacity>
        )}

        <View style={styles.helpContainer}>
          <Icon name="info-outline" size={16} color={Colors.lightText} />
          <Text style={styles.helpText}>Ensure good lighting and hold device steady</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  flashButton: {
    padding: 8,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scanFrameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.primary,
    borderWidth: 3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    top: 'auto',
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    opacity: 0.8,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: -80,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionsSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  resultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  resultType: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 12,
  },
  resultData: {
    fontSize: 14,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
    marginLeft: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
  },
  bottomControls: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  manualScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
  },
  manualScanText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  featureList: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
    marginLeft: 8,
  },
  settingsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
  },
});

export default QRScannerScreen;
