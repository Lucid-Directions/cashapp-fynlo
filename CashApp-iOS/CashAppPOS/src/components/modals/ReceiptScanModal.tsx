import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors'; // Assuming Colors.ts exists in constants
// import { scanReceipt, ScannedItemAPIResponse } from '../../services/InventoryApiService'; // Temporarily disabled
// import { launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker'; // Temporarily disabled

// Temporary interfaces to prevent crashes
interface ScannedItemAPIResponse {
  name: string;
  quantity: number;
  price: number;
  sku_match?: string | null;
  raw_text_name?: string | null;
}

interface ReceiptItem {
  id: string; // Client-side ID for list management
  name: string;
  quantity: string; // Editable as string
  price: string;    // Editable as string
  sku?: string | null; // Store SKU match from API
  originalName?: string; // Store original parsed name from API
}

interface ReceiptScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (items: ReceiptItem[]) => void;
}

const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({ visible, onClose, onSubmit }) => {
  const [step, setStep] = useState<'capture' | 'spinning' | 'review' | 'submitting'>('capture');
  const [capturedImage, setCapturedImage] = useState<any>(null); // Placeholder for image data
  const [parsedItems, setParsedItems] = useState<ReceiptItem[]>([]);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to camera to scan receipts',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS permissions are handled automatically
  };

  const handleCaptureImage = async () => {
    // For now, show an alert that camera scanning is temporarily disabled
    // This prevents crashes while the feature is being properly integrated
    Alert.alert(
      'Camera Scanning', 
      'Receipt scanning via camera is currently being integrated. For now, you can manually add items using the + button.',
      [
        {
          text: 'Add Sample Items',
          onPress: () => {
            // Add some sample items for testing
            setParsedItems([
              { id: '1', name: 'Tomatoes', quantity: '2', price: '3.50', sku: null },
              { id: '2', name: 'Bread', quantity: '1', price: '2.20', sku: null },
            ]);
            setStep('review');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
    
    // TODO: Implement proper camera integration when react-native-image-picker is configured
    /*
    try {
      // Request camera permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Camera permission is required to scan receipts');
        return;
      }

      const options = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
      };

      launchCamera(options, (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorMessage) {
          console.log('Camera cancelled or error:', response.errorMessage);
          return;
        }

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setCapturedImage({ uri: asset.uri });
          setStep('spinning');

          // Process the captured image
          processReceiptImage(asset.base64 || '');
        }
      });
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', 'Unable to access camera. Please try again.');
    }
    */
  };

  const processReceiptImage = async (base64Image: string) => {
    // Temporarily disabled API call to prevent crashes
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock response for testing
      const mockApiResponse: ScannedItemAPIResponse[] = [
        { name: 'Scanned Item 1', quantity: 2, price: 5.99, sku_match: null, raw_text_name: 'Item 1' },
        { name: 'Scanned Item 2', quantity: 1, price: 12.50, sku_match: 'SKU123', raw_text_name: 'Item 2' },
      ];

      const clientReceiptItems: ReceiptItem[] = mockApiResponse.map((item, index) => ({
        id: `api-${index}-${Date.now()}`, // Generate a unique ID for local list management
        name: item.name,
        quantity: item.quantity.toString(),
        price: item.price.toFixed(2),
        sku: item.sku_match,
        originalName: item.raw_text_name || item.name,
      }));

      setParsedItems(clientReceiptItems);
      setStep('review');
    } catch (error) {
      console.error('Error scanning receipt via API:', error);
      Alert.alert('Error Processing Receipt', 'Could not process the receipt. Please try again.');
      setStep('capture'); // Go back to capture step on error
    }
    
    // TODO: Implement real API call when backend is properly connected
    /*
    try {
      const apiResponseItems = await scanReceipt(base64Image);

      const clientReceiptItems: ReceiptItem[] = apiResponseItems.map((item, index) => ({
        id: `api-${index}-${Date.now()}`, // Generate a unique ID for local list management
        name: item.name,
        quantity: item.quantity.toString(),
        price: item.price.toFixed(2),
        sku: item.sku_match,
        originalName: item.raw_text_name || item.name,
      }));

      setParsedItems(clientReceiptItems);
      setStep('review');
    } catch (error) {
      console.error('Error scanning receipt via API:', error);
      Alert.alert('Error Processing Receipt', error.message || 'Could not process the receipt. Please try again.');
      setStep('capture'); // Go back to capture step on error
    }
    */
  };

  const handleItemChange = (id: string, field: 'name' | 'quantity' | 'price', value: string) => {
    setParsedItems(prevItems =>
      prevItems.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    setParsedItems(prevItems => [
      ...prevItems,
      { id: Date.now().toString(), name: '', quantity: '1', price: '0.00' },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setParsedItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    // Basic validation
    for (const item of parsedItems) {
      if (!item.name.trim() || !item.quantity.trim() || !item.price.trim()) {
        Alert.alert('Validation Error', 'All fields for each item must be filled.');
        return;
      }
      if (isNaN(parseFloat(item.quantity)) || isNaN(parseFloat(item.price))) {
        Alert.alert('Validation Error', 'Quantity and Price must be valid numbers.');
        return;
      }
      if (parseFloat(item.quantity) <= 0 || parseFloat(item.price) < 0) {
        Alert.alert('Validation Error', 'Quantity must be positive and Price cannot be negative.');
        return;
      }
    }

    setStep('submitting');
    try {
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      onSubmit(parsedItems);
      Alert.alert('Success', 'Receipt items submitted successfully!');
      onClose(); // Close modal on successful submission
    } catch (error) {
      Alert.alert('Error', 'Failed to submit items. Please try again.');
      console.error('Submission error:', error);
    } finally {
      // Reset state if modal is kept open, or handled by onClose re-initializing.
      // For now, onClose will reset it when InventoryScreen re-renders modal.
      // If modal state was internal, would reset here: setStep('capture'); setCapturedImage(null);
    }
  };

  const renderCaptureStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.modalTitle}>Scan Receipt</Text>
      <View style={styles.cameraPreviewPlaceholder}>
        <Icon name="camera-alt" size={80} color={Colors.lightGray} />
        <Text style={styles.placeholderText}>Camera Preview Area</Text>
      </View>
      <TouchableOpacity style={styles.captureButton} onPress={handleCaptureImage}>
        <Icon name="camera" size={24} color={Colors.white} />
        <Text style={styles.buttonText}>Capture Receipt</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSpinningStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Processing Receipt...</Text>
      <Text style={styles.loadingSubtitle}>Extracting items, please wait.</Text>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.modalTitle}>Review Items</Text>
      <ScrollView style={styles.itemList}>
        {parsedItems.map((item, index) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInputs}>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="Item Name"
                value={item.name}
                onChangeText={text => handleItemChange(item.id, 'name', text)}
              />
              <TextInput
                style={[styles.input, styles.quantityInput]}
                placeholder="Qty"
                value={item.quantity}
                onChangeText={text => handleItemChange(item.id, 'quantity', text)}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="Price"
                value={item.price}
                onChangeText={text => handleItemChange(item.id, 'price', text)}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity onPress={() => handleRemoveItem(item.id)} style={styles.deleteButton}>
              <Icon name="delete" size={24} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
        <Icon name="add-circle-outline" size={22} color={Colors.primary} />
        <Text style={styles.addItemButtonText}>Add Item</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Confirm and Import Items</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSubmittingStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Submitting Items...</Text>
    </View>
  );


  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          {step === 'capture' && renderCaptureStep()}
          {step === 'spinning' && renderSpinningStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'submitting' && renderSubmittingStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  stepContainer: {
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  cameraPreviewPlaceholder: {
    width: '100%',
    height: 200, // Adjust as needed
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 20,
  },
  placeholderText: {
    color: Colors.darkGray,
    marginTop: 10,
  },
  captureButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: Colors.success, // Or primary
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
    width: '100%',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 15,
    marginBottom: 5,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 20,
  },
  itemList: {
    width: '100%',
    maxHeight: 350, // Adjust based on screen
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: Colors.white, // Ensure input background is white
  },
  nameInput: {
    flex: 0.5, // Takes 50% of space in itemInputs
  },
  quantityInput: {
    flex: 0.2, // Takes 20%
    textAlign: 'center',
  },
  priceInput: {
    flex: 0.3, // Takes 30%
    textAlign: 'right',
  },
  deleteButton: {
    padding: 5,
    marginLeft: 10,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  addItemButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ReceiptScanModal;
