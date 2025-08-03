/**
 * Modal component for splitting bills
 * Allows users to divide orders among multiple people/groups
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { EnhancedOrderItem, SplitMethod } from '../../types/cart';
import { useSplitBill } from '../../hooks/useSplitBill';
import SplitBillGroupCard from './SplitBillGroupCard';
import { formatPrice } from '../../utils/priceValidation';

interface SplitBillModalProps {
  visible: boolean;
  cartItems: EnhancedOrderItem[];
  cartTotal: number;
  onClose: () => void;
  onConfirm: (splitGroups: any[]) => void;
  useEnhancedCart?: boolean;
}

export default function SplitBillModal({
  visible,
  cartItems,
  cartTotal,
  onClose,
  onConfirm,
  useEnhancedCart = true
}: SplitBillModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  
  const [numberOfGroups, setNumberOfGroups] = useState(2);
  const [showGroupSetup, setShowGroupSetup] = useState(true);
  const [selectedItemForSplit, setSelectedItemForSplit] = useState<EnhancedOrderItem | null>(null);
  
  const {
    groups,
    splitMethod,
    validation,
    groupTotals,
    isProcessing,
    initializeSplit,
    setSplitMethod,
    updateGroupName,
    updateGroupColor,
    assignItemToGroup,
    splitItemAcrossGroups,
    removeItemFromGroup,
    setGroupCustomAmount,
    setGroupTipPercent,
    toggleGroupServiceCharge,
    toggleGroupTax,
    applySplitMethod,
    resetSplit,
    getUnassignedItems,
    getGroupByItem,
    canProcessPayments,
    exportSplitBill
  } = useSplitBill({ cartItems, cartTotal, useEnhancedCart });
  
  // Initialize split when modal opens
  useEffect(() => {
    if (visible && groups.length === 0) {
      initializeSplit(numberOfGroups);
      setShowGroupSetup(false);
    }
  }, [visible]);
  
  const handleClose = () => {
    resetSplit();
    setShowGroupSetup(true);
    onClose();
  };
  
  const handleConfirm = () => {
    if (!canProcessPayments()) {
      Alert.alert(
        'Split Not Complete',
        validation.errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    
    onConfirm(groups);
    handleClose();
  };
  
  const handleSplitMethodChange = (method: SplitMethod) => {
    setSplitMethod(method);
    setTimeout(() => applySplitMethod(), 100);
  };
  
  const handleItemPress = (item: EnhancedOrderItem) => {
    if (splitMethod === 'item' || splitMethod === 'custom') {
      setSelectedItemForSplit(item);
    }
  };
  
  const handleAssignToGroup = (groupId: string) => {
    if (selectedItemForSplit) {
      assignItemToGroup(selectedItemForSplit, groupId);
      setSelectedItemForSplit(null);
    }
  };
  
  const handleSplitAcrossGroups = () => {
    if (selectedItemForSplit) {
      const groupIds = groups.map(g => g.id);
      splitItemAcrossGroups(selectedItemForSplit, groupIds);
      setSelectedItemForSplit(null);
    }
  };
  
  const renderGroupSetup = () => (
    <View style={styles.setupContainer}>
      <Text style={styles.setupTitle}>How many ways to split?</Text>
      
      <View style={styles.groupCountSelector}>
        <TouchableOpacity
          style={styles.countButton}
          onPress={() => setNumberOfGroups(Math.max(2, numberOfGroups - 1))}
        >
          <Icon name="remove" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.countDisplay}>
          <Text style={styles.countText}>{numberOfGroups}</Text>
          <Text style={styles.countLabel}>Groups</Text>
        </View>
        
        <TouchableOpacity
          style={styles.countButton}
          onPress={() => setNumberOfGroups(Math.min(10, numberOfGroups + 1))}
        >
          <Icon name="add" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={styles.startButton}
        onPress={() => {
          initializeSplit(numberOfGroups);
          setShowGroupSetup(false);
        }}
      >
        <Text style={styles.startButtonText}>Start Splitting</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderSplitMethods = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.methodSelector}
      contentContainerStyle={styles.methodSelectorContent}
    >
      <TouchableOpacity
        style={[styles.methodButton, splitMethod === 'even' && styles.methodButtonActive]}
        onPress={() => handleSplitMethodChange('even')}
      >
        <Icon name="view-module" size={20} color={
          splitMethod === 'even' ? theme.colors.white : theme.colors.text
        } />
        <Text style={[
          styles.methodButtonText,
          splitMethod === 'even' && styles.methodButtonTextActive
        ]}>Split Evenly</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.methodButton, splitMethod === 'equal' && styles.methodButtonActive]}
        onPress={() => handleSplitMethodChange('equal')}
      >
        <Icon name="attach-money" size={20} color={
          splitMethod === 'equal' ? theme.colors.white : theme.colors.text
        } />
        <Text style={[
          styles.methodButtonText,
          splitMethod === 'equal' && styles.methodButtonTextActive
        ]}>Equal Amount</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.methodButton, splitMethod === 'item' && styles.methodButtonActive]}
        onPress={() => handleSplitMethodChange('item')}
      >
        <Icon name="restaurant" size={20} color={
          splitMethod === 'item' ? theme.colors.white : theme.colors.text
        } />
        <Text style={[
          styles.methodButtonText,
          splitMethod === 'item' && styles.methodButtonTextActive
        ]}>By Item</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.methodButton, splitMethod === 'custom' && styles.methodButtonActive]}
        onPress={() => handleSplitMethodChange('custom')}
      >
        <Icon name="tune" size={20} color={
          splitMethod === 'custom' ? theme.colors.white : theme.colors.text
        } />
        <Text style={[
          styles.methodButtonText,
          splitMethod === 'custom' && styles.methodButtonTextActive
        ]}>Custom</Text>
      </TouchableOpacity>
    </ScrollView>
  );
  
  const renderUnassignedItems = () => {
    const unassignedItems = getUnassignedItems();
    
    if (unassignedItems.length === 0 || splitMethod === 'equal') {
      return null;
    }
    
    return (
      <View style={styles.unassignedSection}>
        <Text style={styles.unassignedTitle}>Unassigned Items</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {unassignedItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.unassignedItem,
                selectedItemForSplit?.id === item.id && styles.unassignedItemSelected
              ]}
              onPress={() => handleItemPress(item)}
            >
              <Text style={styles.unassignedItemEmoji}>{item.emoji}</Text>
              <Text style={styles.unassignedItemName}>{item.name}</Text>
              <Text style={styles.unassignedItemQuantity}>x{item.quantity}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };
  
  const renderItemAssignment = () => {
    if (!selectedItemForSplit) return null;
    
    return (
      <View style={styles.assignmentOverlay}>
        <View style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>
            Assign "{selectedItemForSplit.name}"
          </Text>
          
          <ScrollView style={styles.assignmentGroups}>
            {groups.map(group => {
              const groupTotal = groupTotals.find(gt => gt.groupId === group.id);
              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.assignmentGroup}
                  onPress={() => handleAssignToGroup(group.id)}
                >
                  <View 
                    style={[styles.assignmentGroupColor, { backgroundColor: group.color }]} 
                  />
                  <Text style={styles.assignmentGroupName}>{group.name}</Text>
                  <Text style={styles.assignmentGroupTotal}>
                    {formatPrice(groupTotal?.total || 0, '£')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          <View style={styles.assignmentActions}>
            <TouchableOpacity
              style={styles.assignmentButton}
              onPress={handleSplitAcrossGroups}
            >
              <Text style={styles.assignmentButtonText}>Split Across All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.assignmentButton, styles.assignmentButtonCancel]}
              onPress={() => setSelectedItemForSplit(null)}
            >
              <Text style={styles.assignmentButtonCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Split Bill</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Icon name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          {showGroupSetup ? (
            renderGroupSetup()
          ) : (
            <>
              {/* Split Methods */}
              {renderSplitMethods()}
              
              {/* Main Content */}
              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
              >
                {/* Unassigned Items */}
                {renderUnassignedItems()}
                
                {/* Groups */}
                <View style={styles.groupsContainer}>
                  {groups.map((group, index) => {
                    const groupTotal = groupTotals.find(gt => gt.groupId === group.id);
                    return (
                      <SplitBillGroupCard
                        key={group.id}
                        group={group}
                        groupTotal={groupTotal}
                        index={index}
                        splitMethod={splitMethod}
                        onUpdateName={(name) => updateGroupName(group.id, name)}
                        onUpdateColor={(color) => updateGroupColor(group.id, color)}
                        onRemoveItem={(itemId) => removeItemFromGroup(itemId, group.id)}
                        onSetCustomAmount={(amount) => setGroupCustomAmount(group.id, amount)}
                        onSetTipPercent={(percent) => setGroupTipPercent(group.id, percent)}
                        onToggleServiceCharge={() => toggleGroupServiceCharge(group.id)}
                        onToggleTax={() => toggleGroupTax(group.id)}
                      />
                    );
                  })}
                </View>
              </ScrollView>
              
              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.totalSummary}>
                  <Text style={styles.totalLabel}>Total Split:</Text>
                  <Text style={styles.totalAmount}>
                    {formatPrice(
                      groupTotals.reduce((sum, gt) => sum + gt.total, 0),
                      '£'
                    )}
                  </Text>
                  {!validation.isFullySplit && (
                    <Text style={styles.remainingAmount}>
                      ({formatPrice(validation.remainingAmount, '£')} remaining)
                    </Text>
                  )}
                </View>
                
                <View style={styles.footerButtons}>
                  <TouchableOpacity
                    style={styles.exportButton}
                    onPress={() => {
                      const exportText = exportSplitBill();
                      Alert.alert('Split Bill Summary', exportText);
                    }}
                  >
                    <Icon name="share" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      !canProcessPayments() && styles.confirmButtonDisabled
                    ]}
                    onPress={handleConfirm}
                    disabled={!canProcessPayments()}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isProcessing ? 'Processing...' : 'Confirm Split'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
      
      {/* Item Assignment Overlay */}
      {renderItemAssignment()}
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 5,
  },
  
  // Setup Screen
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 40,
  },
  groupCountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 60,
  },
  countButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countDisplay: {
    marginHorizontal: 40,
    alignItems: 'center',
  },
  countText: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  countLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.white,
  },
  
  // Method Selector
  methodSelector: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  methodSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  methodButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  methodButtonTextActive: {
    color: theme.colors.white,
  },
  
  // Main Content
  scrollView: {
    flex: 1,
  },
  
  // Unassigned Items
  unassignedSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  unassignedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  unassignedItem: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 80,
  },
  unassignedItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  unassignedItemEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  unassignedItemName: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text,
    textAlign: 'center',
  },
  unassignedItemQuantity: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  
  // Groups
  groupsContainer: {
    padding: 16,
    gap: 16,
  },
  
  // Assignment Overlay
  assignmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentCard: {
    backgroundColor: theme.colors.background,
    width: '80%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  assignmentGroups: {
    maxHeight: 200,
  },
  assignmentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    marginBottom: 8,
  },
  assignmentGroupColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  assignmentGroupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  assignmentGroupTotal: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  assignmentActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  assignmentButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  assignmentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  assignmentButtonCancel: {
    backgroundColor: theme.colors.surface,
  },
  assignmentButtonCancelText: {
    color: theme.colors.text,
  },
  
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  totalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: 8,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  remainingAmount: {
    fontSize: 14,
    color: theme.colors.error,
    marginLeft: 8,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
});