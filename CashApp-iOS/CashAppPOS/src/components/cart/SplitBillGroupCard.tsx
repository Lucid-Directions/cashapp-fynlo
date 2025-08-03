/**
 * Component for displaying a split bill group
 * Shows group details, assigned items, and totals
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { SplitBillGroup, SplitMethod } from '../../types/cart';
import { GroupTotal } from '../../services/SplitBillService';
import { formatPrice } from '../../utils/priceValidation';

interface SplitBillGroupCardProps {
  group: SplitBillGroup;
  groupTotal?: GroupTotal;
  index: number;
  splitMethod: SplitMethod;
  onUpdateName: (name: string) => void;
  onUpdateColor: (color: string) => void;
  onRemoveItem: (itemId: string) => void;
  onSetCustomAmount: (amount: number) => void;
  onSetTipPercent: (percent: number) => void;
  onToggleServiceCharge: () => void;
  onToggleTax: () => void;
}

const AVAILABLE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B4D9', '#82E0AA'
];

const TIP_PERCENTAGES = [0, 10, 15, 18, 20, 25];

export default function SplitBillGroupCard({
  group,
  groupTotal,
  index,
  splitMethod,
  onUpdateName,
  onUpdateColor,
  onRemoveItem,
  onSetCustomAmount,
  onSetTipPercent,
  onToggleServiceCharge,
  onToggleTax
}: SplitBillGroupCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(group.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingCustomAmount, setIsEditingCustomAmount] = useState(false);
  const [tempCustomAmount, setTempCustomAmount] = useState(group.customAmount.toString());
  
  const handleNameSubmit = () => {
    onUpdateName(tempName.trim() || `Person ${index + 1}`);
    setIsEditingName(false);
  };
  
  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(tempCustomAmount) || 0;
    onSetCustomAmount(Math.max(0, amount));
    setIsEditingCustomAmount(false);
  };
  
  const renderItems = () => {
    if (group.items.length === 0) {
      return (
        <Text style={styles.emptyText}>No items assigned</Text>
      );
    }
    
    return (
      <View style={styles.itemsList}>
        {group.items.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQuantity}>
                {item.splitQuantity < item.originalQuantity 
                  ? `${item.splitQuantity} of ${item.originalQuantity}`
                  : `x${item.splitQuantity}`
                }
              </Text>
            </View>
            <Text style={styles.itemPrice}>
              {formatPrice(item.price * item.splitQuantity, '£')}
            </Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemoveItem(item.originalItemId)}
            >
              <Icon name="close" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };
  
  const renderColorPicker = () => {
    if (!showColorPicker) return null;
    
    return (
      <View style={styles.colorPicker}>
        {AVAILABLE_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[styles.colorOption, { backgroundColor: color }]}
            onPress={() => {
              onUpdateColor(color);
              setShowColorPicker(false);
            }}
          >
            {color === group.color && (
              <Icon name="check" size={16} color="#FFF" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderTipSelector = () => (
    <View style={styles.tipSelector}>
      <Text style={styles.optionLabel}>Tip:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tipOptions}>
          {TIP_PERCENTAGES.map(percent => (
            <TouchableOpacity
              key={percent}
              style={[
                styles.tipButton,
                group.tipPercent === percent && styles.tipButtonActive
              ]}
              onPress={() => onSetTipPercent(percent)}
            >
              <Text style={[
                styles.tipButtonText,
                group.tipPercent === percent && styles.tipButtonTextActive
              ]}>
                {percent}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
  
  return (
    <View style={[styles.container, { borderLeftColor: group.color }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.colorIndicator, { backgroundColor: group.color }]}
          onPress={() => setShowColorPicker(!showColorPicker)}
        >
          <Icon name="palette" size={14} color="#FFF" />
        </TouchableOpacity>
        
        {isEditingName ? (
          <TextInput
            style={styles.nameInput}
            value={tempName}
            onChangeText={setTempName}
            onSubmitEditing={handleNameSubmit}
            onBlur={handleNameSubmit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => setIsEditingName(true)}>
            <Text style={styles.groupName}>{group.name}</Text>
          </TouchableOpacity>
        )}
        
        {groupTotal && (
          <Text style={styles.headerTotal}>
            {formatPrice(groupTotal.total, '£')}
          </Text>
        )}
      </View>
      
      {/* Color Picker */}
      {renderColorPicker()}
      
      {/* Content based on split method */}
      {splitMethod === 'equal' || group.customAmount > 0 ? (
        <View style={styles.customAmountSection}>
          <Text style={styles.customAmountLabel}>Custom Amount:</Text>
          {isEditingCustomAmount ? (
            <TextInput
              style={styles.customAmountInput}
              value={tempCustomAmount}
              onChangeText={setTempCustomAmount}
              onSubmitEditing={handleCustomAmountSubmit}
              onBlur={handleCustomAmountSubmit}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditingCustomAmount(true)}>
              <Text style={styles.customAmountValue}>
                {formatPrice(group.customAmount, '£')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        renderItems()
      )}
      
      {/* Options */}
      <View style={styles.options}>
        <View style={styles.toggleOptions}>
          <TouchableOpacity 
            style={styles.toggleOption}
            onPress={onToggleServiceCharge}
          >
            <View style={[
              styles.checkbox,
              group.includeServiceCharge && styles.checkboxChecked
            ]}>
              {group.includeServiceCharge && (
                <Icon name="check" size={14} color={theme.colors.white} />
              )}
            </View>
            <Text style={styles.toggleLabel}>Service Charge</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toggleOption}
            onPress={onToggleTax}
          >
            <View style={[
              styles.checkbox,
              group.includeTax && styles.checkboxChecked
            ]}>
              {group.includeTax && (
                <Icon name="check" size={14} color={theme.colors.white} />
              )}
            </View>
            <Text style={styles.toggleLabel}>Tax</Text>
          </TouchableOpacity>
        </View>
        
        {renderTipSelector()}
      </View>
      
      {/* Totals Breakdown */}
      {groupTotal && (
        <View style={styles.totalsBreakdown}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Subtotal:</Text>
            <Text style={styles.totalRowValue}>
              {formatPrice(groupTotal.subtotal, '£')}
            </Text>
          </View>
          
          {groupTotal.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Tax:</Text>
              <Text style={styles.totalRowValue}>
                {formatPrice(groupTotal.tax, '£')}
              </Text>
            </View>
          )}
          
          {groupTotal.serviceCharge > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Service:</Text>
              <Text style={styles.totalRowValue}>
                {formatPrice(groupTotal.serviceCharge, '£')}
              </Text>
            </View>
          )}
          
          {groupTotal.tip > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Tip:</Text>
              <Text style={styles.totalRowValue}>
                {formatPrice(groupTotal.tip, '£')}
              </Text>
            </View>
          )}
          
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalRowLabelFinal}>Total:</Text>
            <Text style={styles.totalRowValueFinal}>
              {formatPrice(groupTotal.total, '£')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: 0,
    marginRight: 12,
  },
  headerTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  
  // Color Picker
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    gap: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Custom Amount
  customAmountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  customAmountLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: 12,
  },
  customAmountValue: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  customAmountInput: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: 0,
    minWidth: 100,
  },
  
  // Items List
  itemsList: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    marginBottom: 6,
  },
  itemEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  itemQuantity: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  
  // Options
  options: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  toggleOptions: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  optionLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  
  // Tip Selector
  tipSelector: {
    marginTop: 8,
  },
  tipOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  tipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tipButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  tipButtonTextActive: {
    color: theme.colors.white,
  },
  
  // Totals Breakdown
  totalsBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalRowLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  totalRowValue: {
    fontSize: 14,
    color: theme.colors.text,
  },
  totalRowFinal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalRowLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalRowValueFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});