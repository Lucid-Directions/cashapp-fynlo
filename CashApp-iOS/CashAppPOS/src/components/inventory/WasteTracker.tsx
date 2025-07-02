/**
 * WasteTracker - Component for managing inventory waste percentages and cost analysis
 * Provides real-time waste tracking, cost calculations, and trend analysis
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors';
import { InventoryItem, CostAnalysis, ItemCostAnalysis } from '../../types';
import useInventoryStore from '../../store/useInventoryStore';

interface WasteTrackerProps {
  visible: boolean;
  onClose: () => void;
  selectedItem?: InventoryItem;
}

interface WasteEntry {
  sku: string;
  name: string;
  currentWaste: number;
  newWaste: string;
  costImpact: number;
  monthlyWasteCost: number;
}

const WasteTracker: React.FC<WasteTrackerProps> = ({ visible, onClose, selectedItem }) => {
  const [wasteEntries, setWasteEntries] = useState<WasteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCostAnalysis, setShowCostAnalysis] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const { 
    inventoryItems, 
    updateWastePercentage, 
    loadCostAnalysis, 
    costAnalysis,
    isLoadingInventory 
  } = useInventoryStore();

  useEffect(() => {
    if (visible) {
      loadWasteData();
      loadCostAnalysis();
    }
  }, [visible]);

  const loadWasteData = () => {
    const items = Object.values(inventoryItems);
    const entries: WasteEntry[] = items.map(item => ({
      sku: item.sku,
      name: item.name,
      currentWaste: item.waste_pct || 0,
      newWaste: (item.waste_pct || 0).toString(),
      costImpact: calculateWasteCostImpact(item),
      monthlyWasteCost: calculateMonthlyWasteCost(item),
    }));

    // Sort by waste cost impact (highest first)
    entries.sort((a, b) => b.costImpact - a.costImpact);
    setWasteEntries(entries);
  };

  const calculateWasteCostImpact = (item: InventoryItem): number => {
    if (!item.cost_per_unit || !item.qty_g) return 0;
    const wastePercent = (item.waste_pct || 0) / 100;
    return item.qty_g * item.cost_per_unit * wastePercent;
  };

  const calculateMonthlyWasteCost = (item: InventoryItem): number => {
    if (!item.cost_per_unit || !item.par_level_g) return 0;
    const wastePercent = (item.waste_pct || 0) / 100;
    // Assume 4 turnovers per month for estimation
    return item.par_level_g * item.cost_per_unit * wastePercent * 4;
  };

  const handleWasteChange = (sku: string, newValue: string) => {
    setWasteEntries(prev => prev.map(entry => 
      entry.sku === sku 
        ? { 
            ...entry, 
            newWaste: newValue,
            costImpact: calculateNewCostImpact(entry, parseFloat(newValue) || 0)
          }
        : entry
    ));
  };

  const calculateNewCostImpact = (entry: WasteEntry, newWastePercent: number): number => {
    const item = inventoryItems[entry.sku];
    if (!item?.cost_per_unit || !item.qty_g) return 0;
    return item.qty_g * item.cost_per_unit * (newWastePercent / 100);
  };

  const handleSaveWaste = async (sku: string) => {
    const entry = wasteEntries.find(e => e.sku === sku);
    if (!entry) return;

    const newWasteValue = parseFloat(entry.newWaste);
    if (isNaN(newWasteValue) || newWasteValue < 0 || newWasteValue > 100) {
      Alert.alert('Invalid Value', 'Waste percentage must be between 0 and 100');
      return;
    }

    try {
      setIsLoading(true);
      await updateWastePercentage(sku, newWasteValue);
      
      // Update local state
      setWasteEntries(prev => prev.map(e => 
        e.sku === sku 
          ? { ...e, currentWaste: newWasteValue, newWaste: newWasteValue.toString() }
          : e
      ));
      
      setEditingItem(null);
      Alert.alert('Success', 'Waste percentage updated successfully');
      
      // Reload cost analysis
      await loadCostAnalysis();
    } catch (error) {
      Alert.alert('Error', 'Failed to update waste percentage');
      console.error('Waste update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = (sku: string) => {
    const entry = wasteEntries.find(e => e.sku === sku);
    if (entry) {
      setWasteEntries(prev => prev.map(e => 
        e.sku === sku 
          ? { ...e, newWaste: e.currentWaste.toString() }
          : e
      ));
    }
    setEditingItem(null);
  };

  const getWasteColor = (wastePercent: number): string => {
    if (wastePercent <= 2) return Colors.success;
    if (wastePercent <= 5) return Colors.warning;
    return Colors.danger;
  };

  const getWasteLevel = (wastePercent: number): string => {
    if (wastePercent <= 2) return 'Low';
    if (wastePercent <= 5) return 'Moderate';
    if (wastePercent <= 10) return 'High';
    return 'Critical';
  };

  const renderWasteEntry = (entry: WasteEntry) => {
    const isEditing = editingItem === entry.sku;
    const wasteColor = getWasteColor(entry.currentWaste);
    const wasteLevel = getWasteLevel(entry.currentWaste);
    const hasChanges = entry.newWaste !== entry.currentWaste.toString();

    return (
      <View key={entry.sku} style={styles.wasteEntryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{entry.name}</Text>
            <Text style={styles.itemSku}>SKU: {entry.sku}</Text>
          </View>
          <View style={[styles.wasteBadge, { backgroundColor: wasteColor + '20' }]}>
            <Text style={[styles.wasteLevel, { color: wasteColor }]}>{wasteLevel}</Text>
          </View>
        </View>

        <View style={styles.entryContent}>
          <View style={styles.wasteInputContainer}>
            <Text style={styles.label}>Waste Percentage:</Text>
            <View style={styles.wasteInputRow}>
              {isEditing ? (
                <TextInput
                  style={[styles.wasteInput, hasChanges && styles.changedInput]}
                  value={entry.newWaste}
                  onChangeText={(value) => handleWasteChange(entry.sku, value)}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  autoFocus
                />
              ) : (
                <TouchableOpacity 
                  style={styles.wasteDisplay}
                  onPress={() => setEditingItem(entry.sku)}
                >
                  <Text style={[styles.wasteText, { color: wasteColor }]}>
                    {entry.currentWaste.toFixed(1)}%
                  </Text>
                  <Icon name="edit" size={16} color={Colors.darkGray} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.costInfo}>
            <View style={styles.costItem}>
              <Text style={styles.costLabel}>Current Waste Cost:</Text>
              <Text style={styles.costValue}>${entry.costImpact.toFixed(2)}</Text>
            </View>
            <View style={styles.costItem}>
              <Text style={styles.costLabel}>Monthly Est.:</Text>
              <Text style={styles.costValue}>${entry.monthlyWasteCost.toFixed(2)}</Text>
            </View>
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => handleCancelEdit(entry.sku)}
              >
                <Icon name="close" size={20} color={Colors.danger} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, !hasChanges && styles.disabledButton]}
                onPress={() => handleSaveWaste(entry.sku)}
                disabled={!hasChanges || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Icon name="check" size={20} color={Colors.white} />
                )}
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderCostAnalysis = () => {
    if (!costAnalysis) return null;

    return (
      <View style={styles.analysisContainer}>
        <Text style={styles.analysisTitle}>Cost Analysis Summary</Text>
        
        <View style={styles.analysisGrid}>
          <View style={styles.analysisCard}>
            <Text style={styles.analysisLabel}>Total Inventory Value</Text>
            <Text style={styles.analysisValue}>
              ${costAnalysis.total_inventory_value.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.analysisCard}>
            <Text style={styles.analysisLabel}>Total Waste Cost</Text>
            <Text style={[styles.analysisValue, { color: Colors.danger }]}>
              ${costAnalysis.total_waste_cost.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.analysisCard}>
            <Text style={styles.analysisLabel}>Waste Percentage</Text>
            <Text style={[
              styles.analysisValue, 
              { color: getWasteColor(costAnalysis.waste_percentage) }
            ]}>
              {costAnalysis.waste_percentage.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.analysisCard}>
            <Text style={styles.analysisLabel}>Monthly COGS</Text>
            <Text style={styles.analysisValue}>
              ${costAnalysis.monthly_cogs.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Waste & Cost Tracker</Text>
          <TouchableOpacity 
            onPress={() => setShowCostAnalysis(!showCostAnalysis)}
            style={styles.analysisToggle}
          >
            <Icon 
              name={showCostAnalysis ? "expand-less" : "expand-more"} 
              size={24} 
              color={Colors.primary} 
            />
          </TouchableOpacity>
        </View>

        {showCostAnalysis && renderCostAnalysis()}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoadingInventory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading inventory data...</Text>
            </View>
          ) : (
            wasteEntries.map(renderWasteEntry)
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  analysisToggle: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.darkGray,
  },
  wasteEntryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  wasteBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  wasteLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  entryContent: {
    gap: 16,
  },
  wasteInputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  wasteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wasteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: Colors.white,
    minWidth: 80,
  },
  changedInput: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  wasteDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  wasteText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  costInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  costItem: {
    flex: 1,
  },
  costLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 6,
  },
  cancelButtonText: {
    color: Colors.danger,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    gap: 6,
  },
  disabledButton: {
    backgroundColor: Colors.lightGray,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  analysisContainer: {
    padding: 16,
    backgroundColor: Colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  analysisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analysisCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  analysisLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 6,
  },
  analysisValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
});

export default WasteTracker;