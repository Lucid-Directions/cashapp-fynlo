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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors'; // Assuming Colors.ts exists in constants
import { scanReceipt, ScannedItemAPIResponse } from '../../services/InventoryApiService'; // Added

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

  const handleCaptureImage = async () => {
    // Simulate image capture - in a real app, this would use react-native-image-picker or similar
    const mockBase64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAf/Z"; // Tiny valid JPEG
    setCapturedImage({ uri: 'simulated_receipt_image.jpg' }); // Keep UI placeholder
    setStep('spinning');

    try {
      // Use a standard base64 string for testing.
      // The backend mock is sensitive to "milk" in the string.
      const testBase64 = "milk_receipt_image_base64_data_string"; // Contains "milk"
      // const testBase64 = "other_receipt_image_base64_data_string"; // Does not contain "milk"

      const apiResponseItems = await scanReceipt(testBase64);

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
