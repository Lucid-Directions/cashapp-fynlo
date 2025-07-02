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
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors'; // Assuming Colors.ts exists in constants
import { ocrService, ProcessedReceipt } from '../../services/OCRService';
import { inventoryMatchingService, MatchingResult } from '../../services/InventoryMatchingService';
import useInventoryStore from '../../store/useInventoryStore';

interface ReceiptItem {
  id: string; // Client-side ID for list management
  name: string;
  quantity: string; // Editable as string
  price: string;    // Editable as string
  sku?: string | null; // Store SKU match from API
  originalName?: string; // Store original parsed name from API
  matchingResult?: MatchingResult; // Store matching details
  matchConfidence?: number; // Confidence score for UI display
}

interface ReceiptScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (items: ReceiptItem[]) => void;
}

const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({ visible, onClose, onSubmit }) => {
  const [step, setStep] = useState<'capture' | 'spinning' | 'review' | 'submitting'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ReceiptItem[]>([]);
  const [processedReceipt, setProcessedReceipt] = useState<ProcessedReceipt | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  
  const { getItemBySku, inventoryItems } = useInventoryStore();

  // Check camera permissions
  const requestCameraPermission = async (): Promise<boolean> => {
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
    return true; // iOS handles permissions automatically
  };

  const handleCaptureImage = async () => {
    try {
      // Check permissions first
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Camera permission is required to scan receipts.');
        return;
      }

      setStep('spinning');
      
      // Capture image using OCRService
      const imageBase64 = await ocrService.captureReceiptImage();
      
      if (!imageBase64) {
        setStep('capture');
        return; // User cancelled
      }

      setCapturedImage(imageBase64);
      
      // Process the receipt using OCRService
      const processedReceipt = await ocrService.processReceiptImage(imageBase64);
      setProcessedReceipt(processedReceipt);

      // Convert to client receipt items with enhanced inventory matching
      const inventoryItemsArray = Object.values(inventoryItems);
      const clientReceiptItems: ReceiptItem[] = processedReceipt.items.map((item, index) => {
        // First try API-provided SKU match
        let inventoryMatch = item.sku_match ? getItemBySku(item.sku_match) : null;
        let matchingResult: MatchingResult | undefined;

        // If no API match, use our intelligent matching service
        if (!inventoryMatch) {
          matchingResult = inventoryMatchingService.getBestMatch(item.name, inventoryItemsArray);
          if (matchingResult) {
            inventoryMatch = matchingResult.inventoryItem;
          }
        }
        
        return {
          id: `ocr-${index}-${Date.now()}`,
          name: inventoryMatch?.name || item.name,
          quantity: item.quantity.toString(),
          price: item.price.toFixed(2),
          sku: inventoryMatch?.sku || item.sku_match,
          originalName: item.raw_text_name || item.name,
          matchingResult,
          matchConfidence: matchingResult?.confidence || (item.sku_match ? 0.9 : 0),
        };
      });

      setParsedItems(clientReceiptItems);
      setStep('review');
    } catch (error) {
      console.error('Error capturing/processing receipt:', error);
      Alert.alert(
        'Processing Error', 
        error instanceof Error ? error.message : 'Could not process the receipt. Please try again.'
      );
      setStep('capture');
    }
  };

  const handleSelectFromGallery = async () => {
    try {
      setStep('spinning');
      
      // Select image from gallery using OCRService
      const imageBase64 = await ocrService.selectReceiptImage();
      
      if (!imageBase64) {
        setStep('capture');
        return; // User cancelled
      }

      setCapturedImage(imageBase64);
      
      // Process the receipt using OCRService
      const processedReceipt = await ocrService.processReceiptImage(imageBase64);
      setProcessedReceipt(processedReceipt);

      // Convert to client receipt items with enhanced inventory matching
      const inventoryItemsArray = Object.values(inventoryItems);
      const clientReceiptItems: ReceiptItem[] = processedReceipt.items.map((item, index) => {
        // First try API-provided SKU match
        let inventoryMatch = item.sku_match ? getItemBySku(item.sku_match) : null;
        let matchingResult: MatchingResult | undefined;

        // If no API match, use our intelligent matching service
        if (!inventoryMatch) {
          matchingResult = inventoryMatchingService.getBestMatch(item.name, inventoryItemsArray);
          if (matchingResult) {
            inventoryMatch = matchingResult.inventoryItem;
          }
        }
        
        return {
          id: `gallery-${index}-${Date.now()}`,
          name: inventoryMatch?.name || item.name,
          quantity: item.quantity.toString(),
          price: item.price.toFixed(2),
          sku: inventoryMatch?.sku || item.sku_match,
          originalName: item.raw_text_name || item.name,
          matchingResult,
          matchConfidence: matchingResult?.confidence || (item.sku_match ? 0.9 : 0),
        };
      });

      setParsedItems(clientReceiptItems);
      setStep('review');
    } catch (error) {
      console.error('Error selecting/processing receipt:', error);
      Alert.alert(
        'Processing Error', 
        error instanceof Error ? error.message : 'Could not process the receipt. Please try again.'
      );
      setStep('capture');
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
      <Text style={styles.subtitle}>Choose how to add your receipt</Text>
      
      <View style={styles.cameraPreviewPlaceholder}>
        <Icon name="receipt" size={80} color={Colors.lightGray} />
        <Text style={styles.placeholderText}>Receipt Processing</Text>
        <Text style={styles.helperText}>Take a photo or select from gallery</Text>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.captureButton} onPress={handleCaptureImage}>
          <Icon name="camera-alt" size={24} color={Colors.white} />
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.galleryButton} onPress={handleSelectFromGallery}>
          <Icon name="photo-library" size={24} color={Colors.primary} />
          <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
      
      {processedReceipt && (
        <View style={styles.ocrInfo}>
          <Text style={styles.ocrInfoText}>
            Confidence: {Math.round((processedReceipt.confidence || 0) * 100)}%
          </Text>
          {processedReceipt.vendor && (
            <Text style={styles.ocrInfoText}>Vendor: {processedReceipt.vendor}</Text>
          )}
        </View>
      )}
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
      {processedReceipt && (
        <View style={styles.receiptSummary}>
          <Text style={styles.summaryText}>
            Detected {parsedItems.length} items • Confidence: {Math.round(processedReceipt.confidence * 100)}%
          </Text>
          {processedReceipt.totalAmount && (
            <Text style={styles.summaryText}>
              Total: ${processedReceipt.totalAmount.toFixed(2)}
            </Text>
          )}
        </View>
      )}
      
      <ScrollView style={styles.itemList}>
        {parsedItems.map((item, index) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemHeader}>
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
            
            {/* Enhanced inventory matching indicator */}
            <View style={styles.itemFooter}>
              <View style={styles.matchingInfo}>
                {item.sku ? (
                  <View style={[
                    styles.matchedIndicator,
                    item.matchConfidence && item.matchConfidence < 0.8 && styles.lowConfidenceMatch
                  ]}>
                    <Icon 
                      name={item.matchConfidence && item.matchConfidence >= 0.8 ? "check-circle" : "help-outline"} 
                      size={16} 
                      color={item.matchConfidence && item.matchConfidence >= 0.8 ? Colors.success : Colors.warning} 
                    />
                    <Text style={[
                      styles.matchedText,
                      item.matchConfidence && item.matchConfidence < 0.8 && styles.lowConfidenceText
                    ]}>
                      {item.sku} • {item.matchConfidence ? `${Math.round(item.matchConfidence * 100)}%` : 'API Match'}
                    </Text>
                    {item.matchingResult && (
                      <Text style={styles.matchTypeText}>
                        ({item.matchingResult.matchType})
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.unmatchedIndicator}>
                    <Icon name="warning" size={16} color={Colors.danger} />
                    <Text style={styles.unmatchedText}>No inventory match</Text>
                  </View>
                )}
              </View>
              
              {item.originalName && item.originalName !== item.name && (
                <Text style={styles.originalText}>Original: "{item.originalName}"</Text>
              )}
              
              {/* Show validation warnings if any */}
              {item.matchingResult && (
                (() => {
                  const validation = inventoryMatchingService.validateMatch(
                    item.originalName || item.name,
                    item.matchingResult,
                    parseFloat(item.quantity),
                    parseFloat(item.price)
                  );
                  
                  return validation.warnings.length > 0 && (
                    <View style={styles.warningsContainer}>
                      {validation.warnings.map((warning, idx) => (
                        <Text key={idx} style={styles.warningText}>⚠️ {warning}</Text>
                      ))}
                    </View>
                  );
                })()
              )}
            </View>
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.darkGray,
    marginBottom: 20,
    textAlign: 'center',
  },
  cameraPreviewPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 20,
  },
  placeholderText: {
    color: Colors.darkGray,
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: Colors.darkGray,
    marginTop: 5,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  captureButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  galleryButton: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.success,
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
  galleryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ocrInfo: {
    backgroundColor: Colors.lightGray,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  ocrInfoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  receiptSummary: {
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },
  summaryText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
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
    maxHeight: 300,
    marginBottom: 10,
  },
  itemRow: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    backgroundColor: Colors.white,
  },
  nameInput: {
    flex: 0.5,
  },
  quantityInput: {
    flex: 0.2,
    textAlign: 'center',
  },
  priceInput: {
    flex: 0.3,
    textAlign: 'right',
  },
  deleteButton: {
    padding: 5,
    marginLeft: 10,
  },
  itemFooter: {
    marginTop: 8,
  },
  matchingInfo: {
    marginBottom: 6,
  },
  matchedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexWrap: 'wrap',
  },
  lowConfidenceMatch: {
    backgroundColor: Colors.warning + '20',
  },
  unmatchedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  lowConfidenceText: {
    color: Colors.warning,
  },
  matchTypeText: {
    fontSize: 10,
    color: Colors.darkGray,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  unmatchedText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    marginLeft: 4,
  },
  originalText: {
    fontSize: 12,
    color: Colors.darkGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
  warningsContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  warningText: {
    fontSize: 11,
    color: Colors.warning,
    marginBottom: 2,
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
