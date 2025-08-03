/**
 * Modal component for modifying cart items
 * Allows users to customize items with size, temperature, additions, etc.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { EnhancedOrderItem, CartItemModification } from '../../types/cart';
import { useItemModifications } from '../../hooks/useItemModifications';

interface ItemModificationModalProps {
  visible: boolean;
  item: EnhancedOrderItem | null;
  onClose: () => void;
  onSave: () => void;
  useEnhancedCart?: boolean;
}

export default function ItemModificationModal({
  visible,
  item,
  onClose,
  onSave,
  useEnhancedCart = true
}: ItemModificationModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  
  const {
    modifications,
    modificationPrice,
    totalPrice,
    isValid,
    errors,
    hasChanges,
    toggleModification,
    updateModificationQuantity,
    setSpecialInstructions,
    resetModifications,
    applyModifications,
    getModificationSummary,
    getPriceImpactSummary
  } = useItemModifications({ item, useEnhancedCart });
  
  // Reset when modal opens with new item
  useEffect(() => {
    if (visible && item) {
      resetModifications();
    }
  }, [visible, item?.id]);
  
  const handleSave = () => {
    if (isValid) {
      applyModifications();
      onSave();
      onClose();
    }
  };
  
  const handleClose = () => {
    resetModifications();
    onClose();
  };
  
  if (!item) {
    return null;
  }
  
  // Group modifications by category
  const modificationsByCategory = modifications.reduce((acc, mod) => {
    if (!acc[mod.category]) {
      acc[mod.category] = [];
    }
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, CartItemModification[]>);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.itemName}>
                {item.emoji && <Text>{item.emoji} </Text>}
                {item.name}
              </Text>
              <Text style={styles.basePrice}>
                Base price: ${item.originalPrice.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Modification Categories */}
            {Object.entries(modificationsByCategory).map(([category, mods]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                
                {mods.map((mod) => (
                  <TouchableOpacity
                    key={mod.id}
                    style={[
                      styles.modificationItem,
                      mod.selected && styles.modificationItemSelected
                    ]}
                    onPress={() => toggleModification(mod.id)}
                  >
                    <View style={styles.modificationInfo}>
                      <Text style={[
                        styles.modificationName,
                        mod.selected && styles.modificationNameSelected
                      ]}>
                        {mod.name}
                      </Text>
                      {mod.price !== 0 && (
                        <Text style={[
                          styles.modificationPrice,
                          mod.selected && styles.modificationPriceSelected
                        ]}>
                          {mod.price > 0 ? '+' : ''}${Math.abs(mod.price).toFixed(2)}
                        </Text>
                      )}
                    </View>
                    
                    {/* Quantity selector for items that support it */}
                    {mod.selected && mod.quantity !== undefined && (
                      <View style={styles.quantitySelector}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateModificationQuantity(mod.id, (mod.quantity || 1) - 1)}
                        >
                          <Icon name="remove" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{mod.quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateModificationQuantity(mod.id, (mod.quantity || 1) + 1)}
                        >
                          <Icon name="add" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {/* Selection indicator */}
                    <View style={styles.selectionIndicator}>
                      <Icon 
                        name={mod.selected ? 'check-circle' : 'radio-button-unchecked'} 
                        size={24} 
                        color={mod.selected ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            
            {/* Special Instructions */}
            <View style={styles.categorySection}>
              <Text style={styles.categoryTitle}>Special Instructions</Text>
              <TextInput
                style={styles.instructionsInput}
                placeholder="Add any special requests..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
                value={item.specialInstructions || ''}
                onChangeText={setSpecialInstructions}
              />
            </View>
            
            {/* Error Messages */}
            {errors.length > 0 && (
              <View style={styles.errorContainer}>
                {errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
          
          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.pricingSummary}>
              <Text style={styles.pricingLabel}>Modifications:</Text>
              <Text style={styles.pricingValue}>{getPriceImpactSummary()}</Text>
            </View>
            <View style={styles.pricingSummary}>
              <Text style={styles.totalLabel}>Total Price:</Text>
              <Text style={styles.totalValue}>
                ${totalPrice.toFixed(2)} 
                <Text style={styles.quantityNote}> ({item.quantity}x)</Text>
              </Text>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.saveButton,
                  (!isValid || !hasChanges) && styles.saveButtonDisabled
                ]} 
                onPress={handleSave}
                disabled={!isValid || !hasChanges}
              >
                <Text style={styles.saveButtonText}>
                  {hasChanges ? 'Save Changes' : 'No Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  basePrice: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    maxHeight: 400,
  },
  categorySection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  modificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modificationItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  modificationInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
  },
  modificationName: {
    fontSize: 15,
    color: theme.colors.text,
    flex: 1,
  },
  modificationNameSelected: {
    fontWeight: '500',
    color: theme.colors.primary,
  },
  modificationPrice: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 10,
  },
  modificationPriceSelected: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    paddingHorizontal: 5,
    marginRight: 10,
  },
  quantityButton: {
    padding: 5,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginHorizontal: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  selectionIndicator: {
    marginLeft: 10,
  },
  instructionsInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  errorContainer: {
    backgroundColor: theme.colors.errorLight,
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  pricingSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  pricingValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  quantityNote: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});