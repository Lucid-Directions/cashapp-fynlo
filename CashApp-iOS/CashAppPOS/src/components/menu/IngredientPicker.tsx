/**
 * IngredientPicker - Intelligent ingredient selection and recipe management component
 * Allows users to create recipes by selecting inventory items with quantities and units
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors';
import { InventoryItem, Recipe, RecipeIngredient } from '../../types';
import { inventoryMatchingService } from '../../services/InventoryMatchingService';
import { costCalculationService } from '../../services/CostCalculationService';
import useInventoryStore from '../../store/useInventoryStore';

interface IngredientPickerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  initialRecipe?: Recipe;
  menuItemId: string;
  menuItemName: string;
}

interface SelectedIngredient {
  ingredient_sku: string;
  ingredient_name: string;
  qty_g: number;
  ingredient_unit: string;
  cost_per_gram: number;
  total_cost: number;
  availability: 'available' | 'low_stock' | 'out_of_stock';
}

const IngredientPicker: React.FC<IngredientPickerProps> = ({
  visible,
  onClose,
  onSave,
  initialRecipe,
  menuItemId,
  menuItemName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingIngredient, setAddingIngredient] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { inventoryItems, getFilteredItems } = useInventoryStore();

  useEffect(() => {
    if (visible && initialRecipe) {
      loadInitialRecipe();
    } else if (visible) {
      setSelectedIngredients([]);
    }
  }, [visible, initialRecipe]);

  const loadInitialRecipe = () => {
    if (!initialRecipe) return;

    const ingredients: SelectedIngredient[] = initialRecipe.ingredients.map(ingredient => {
      const inventoryItem = inventoryItems[ingredient.ingredient_sku];
      return {
        ingredient_sku: ingredient.ingredient_sku,
        ingredient_name: ingredient.ingredient_name || inventoryItem?.name || 'Unknown',
        qty_g: ingredient.qty_g,
        ingredient_unit: ingredient.ingredient_unit || inventoryItem?.unit || 'g',
        cost_per_gram: inventoryItem?.cost_per_unit ? inventoryItem.cost_per_unit / 1000 : 0,
        total_cost: inventoryItem?.cost_per_unit ? (ingredient.qty_g / 1000) * inventoryItem.cost_per_unit : 0,
        availability: getIngredientAvailability(inventoryItem),
      };
    });

    setSelectedIngredients(ingredients);
  };

  const getIngredientAvailability = (item?: InventoryItem): 'available' | 'low_stock' | 'out_of_stock' => {
    if (!item) return 'out_of_stock';
    if (item.qty_g <= 0) return 'out_of_stock';
    if (item.par_level_g && (item.qty_g / item.par_level_g) <= 0.1) return 'low_stock';
    return 'available';
  };

  const getFilteredInventoryItems = (): InventoryItem[] => {
    const allItems = Object.values(inventoryItems);
    
    if (!searchQuery.trim()) {
      return allItems.slice(0, 20); // Show first 20 items when no search
    }

    // Use intelligent matching service for better results
    const matches = inventoryMatchingService.findMatches(
      searchQuery,
      allItems,
      { 
        minConfidence: 0.3, 
        maxResults: 10,
        enableFuzzyMatching: true,
        enablePartialMatching: true 
      }
    );

    return matches.map(match => match.inventoryItem);
  };

  const handleAddIngredient = (item: InventoryItem) => {
    // Check if already added
    if (selectedIngredients.find(ing => ing.ingredient_sku === item.sku)) {
      Alert.alert('Already Added', 'This ingredient is already in the recipe');
      return;
    }

    setAddingIngredient(item.sku);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const confirmAddIngredient = (item: InventoryItem, quantity: number, unit: string) => {
    const newIngredient: SelectedIngredient = {
      ingredient_sku: item.sku,
      ingredient_name: item.name,
      qty_g: unit === 'kg' ? quantity * 1000 : quantity,
      ingredient_unit: unit,
      cost_per_gram: item.cost_per_unit ? item.cost_per_unit / 1000 : 0,
      total_cost: item.cost_per_unit ? ((unit === 'kg' ? quantity * 1000 : quantity) / 1000) * item.cost_per_unit : 0,
      availability: getIngredientAvailability(item),
    };

    setSelectedIngredients(prev => [...prev, newIngredient]);
    setAddingIngredient(null);
  };

  const handleUpdateIngredient = (sku: string, quantity: number, unit: string) => {
    setSelectedIngredients(prev => prev.map(ingredient => {
      if (ingredient.ingredient_sku === sku) {
        const qtyInGrams = unit === 'kg' ? quantity * 1000 : quantity;
        return {
          ...ingredient,
          qty_g: qtyInGrams,
          ingredient_unit: unit,
          total_cost: ingredient.cost_per_gram * qtyInGrams,
        };
      }
      return ingredient;
    }));
  };

  const handleRemoveIngredient = (sku: string) => {
    setSelectedIngredients(prev => prev.filter(ing => ing.ingredient_sku !== sku));
  };

  const calculateRecipeCost = (): number => {
    return selectedIngredients.reduce((total, ingredient) => total + ingredient.total_cost, 0);
  };

  const handleSave = () => {
    if (selectedIngredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add at least one ingredient to the recipe');
      return;
    }

    const recipe: Recipe = {
      item_id: menuItemId,
      item_name: menuItemName,
      ingredients: selectedIngredients.map(ingredient => ({
        ingredient_sku: ingredient.ingredient_sku,
        ingredient_name: ingredient.ingredient_name,
        qty_g: ingredient.qty_g,
        ingredient_unit: ingredient.ingredient_unit,
      })),
    };

    onSave(recipe);
    onClose();
  };

  const renderIngredientSuggestions = () => {
    const filteredItems = getFilteredInventoryItems();

    if (!showSuggestions || filteredItems.length === 0) return null;

    return (
      <View style={styles.suggestionsContainer}>
        <ScrollView style={styles.suggestionsList} nestedScrollEnabled>
          {filteredItems.map((item) => (
            <TouchableOpacity
              key={item.sku}
              style={styles.suggestionItem}
              onPress={() => handleAddIngredient(item)}
            >
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionDetails}>
                  {item.category} • SKU: {item.sku}
                </Text>
                <Text style={styles.suggestionStock}>
                  Stock: {item.qty_g}g • £{item.cost_per_unit?.toFixed(3)}/unit
                </Text>
              </View>
              <View style={[
                styles.availabilityBadge,
                { backgroundColor: getAvailabilityColor(getIngredientAvailability(item)) + '20' }
              ]}>
                <Text style={[
                  styles.availabilityText,
                  { color: getAvailabilityColor(getIngredientAvailability(item)) }
                ]}>
                  {getAvailabilityLabel(getIngredientAvailability(item))}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAddIngredientModal = () => {
    if (!addingIngredient) return null;

    const item = inventoryItems[addingIngredient];
    if (!item) return null;

    const [quantity, setQuantity] = useState('100');
    const [unit, setUnit] = useState('g');

    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addIngredientModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ingredient</Text>
              <TouchableOpacity onPress={() => setAddingIngredient(null)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.ingredientName}>{item.name}</Text>
              <Text style={styles.ingredientDetails}>
                Available: {item.qty_g}g • £{item.cost_per_unit?.toFixed(3)}/unit
              </Text>

              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Quantity:</Text>
                <View style={styles.quantityRow}>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  <View style={styles.unitSelector}>
                    <TouchableOpacity
                      style={[styles.unitButton, unit === 'g' && styles.unitButtonActive]}
                      onPress={() => setUnit('g')}
                    >
                      <Text style={[styles.unitButtonText, unit === 'g' && styles.unitButtonTextActive]}>g</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, unit === 'kg' && styles.unitButtonActive]}
                      onPress={() => setUnit('kg')}
                    >
                      <Text style={[styles.unitButtonText, unit === 'kg' && styles.unitButtonTextActive]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitButton, unit === 'units' && styles.unitButtonActive]}
                      onPress={() => setUnit('units')}
                    >
                      <Text style={[styles.unitButtonText, unit === 'units' && styles.unitButtonTextActive]}>units</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.costPreview}>
                <Text style={styles.costLabel}>Estimated Cost:</Text>
                <Text style={styles.costValue}>
                  £{(parseFloat(quantity) * (item.cost_per_unit || 0) / (unit === 'kg' ? 1 : 1000)).toFixed(3)}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setAddingIngredient(null)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => confirmAddIngredient(item, parseFloat(quantity), unit)}
                >
                  <Text style={styles.addButtonText}>Add Ingredient</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSelectedIngredients = () => (
    <View style={styles.selectedIngredientsContainer}>
      <Text style={styles.sectionTitle}>Recipe Ingredients ({selectedIngredients.length})</Text>
      
      {selectedIngredients.map((ingredient) => (
        <View key={ingredient.ingredient_sku} style={styles.ingredientCard}>
          <View style={styles.ingredientHeader}>
            <View style={styles.ingredientInfo}>
              <Text style={styles.ingredientCardName}>{ingredient.ingredient_name}</Text>
              <Text style={styles.ingredientCardDetails}>
                SKU: {ingredient.ingredient_sku}
              </Text>
            </View>
            <View style={styles.ingredientActions}>
              <View style={[
                styles.availabilityBadge,
                { backgroundColor: getAvailabilityColor(ingredient.availability) + '20' }
              ]}>
                <Text style={[
                  styles.availabilityText,
                  { color: getAvailabilityColor(ingredient.availability) }
                ]}>
                  {getAvailabilityLabel(ingredient.availability)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveIngredient(ingredient.ingredient_sku)}
                style={styles.removeButton}
              >
                <Icon name="delete" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quantityEditor}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityRow}>
              <TextInput
                style={styles.quantityInput}
                value={ingredient.ingredient_unit === 'kg' 
                  ? (ingredient.qty_g / 1000).toString() 
                  : ingredient.qty_g.toString()}
                onChangeText={(text) => handleUpdateIngredient(
                  ingredient.ingredient_sku, 
                  parseFloat(text) || 0, 
                  ingredient.ingredient_unit
                )}
                keyboardType="decimal-pad"
              />
              <Text style={styles.unitText}>{ingredient.ingredient_unit}</Text>
            </View>
          </View>

          <View style={styles.costInfo}>
            <Text style={styles.costLabel}>Cost: £{ingredient.total_cost.toFixed(3)}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const getAvailabilityColor = (availability: string): string => {
    switch (availability) {
      case 'available': return Colors.success;
      case 'low_stock': return Colors.warning;
      case 'out_of_stock': return Colors.danger;
      default: return Colors.darkGray;
    }
  };

  const getAvailabilityLabel = (availability: string): string => {
    switch (availability) {
      case 'available': return 'Available';
      case 'low_stock': return 'Low Stock';
      case 'out_of_stock': return 'Out of Stock';
      default: return 'Unknown';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Recipe Builder</Text>
            <Text style={styles.subtitle}>{menuItemName}</Text>
          </View>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Icon name="check" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Search Section */}
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Add Ingredients</Text>
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color={Colors.darkGray} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for ingredients..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
            </View>
            {renderIngredientSuggestions()}
          </View>

          {/* Selected Ingredients */}
          {selectedIngredients.length > 0 && renderSelectedIngredients()}

          {/* Recipe Summary */}
          {selectedIngredients.length > 0 && (
            <View style={styles.recipeSummary}>
              <Text style={styles.sectionTitle}>Recipe Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Ingredients:</Text>
                  <Text style={styles.summaryValue}>{selectedIngredients.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Estimated Cost:</Text>
                  <Text style={styles.summaryValue}>£{calculateRecipeCost().toFixed(3)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Availability:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedIngredients.filter(i => i.availability === 'available').length}/
                    {selectedIngredients.length} Available
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {renderAddIngredientModal()}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 2,
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 200,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  suggestionDetails: {
    fontSize: 12,
    color: Colors.darkGray,
    marginBottom: 2,
  },
  suggestionStock: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  selectedIngredientsContainer: {
    marginBottom: 24,
  },
  ingredientCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  ingredientCardDetails: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  ingredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    padding: 4,
  },
  quantityEditor: {
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: Colors.white,
    minWidth: 80,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 14,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  costInfo: {
    alignItems: 'flex-end',
  },
  costLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  recipeSummary: {
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIngredientModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalContent: {
    padding: 20,
  },
  ingredientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  ingredientDetails: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 20,
  },
  quantityContainer: {
    marginBottom: 16,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  unitButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitButtonText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: Colors.white,
  },
  costPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    marginBottom: 20,
  },
  costValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default IngredientPicker;