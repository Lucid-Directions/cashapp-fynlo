import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { Icon } from 'react-native-elements'; // Or your preferred icon library

// import { Product, InventoryItem, Recipe, RecipeIngredient } from '../../types'; // Assuming these types exist
import DatabaseService from '../../services/DatabaseService'; // Using DatabaseService instead

// Placeholder types (replace with actual types from '../../types')
interface Product {
  id: string; // UUID
  name: string;
  // Add other relevant product fields if needed for selection
}
interface InventoryItem {
  sku: string;
  name: string;
  unit: string; // e.g., 'grams', 'ml'
}
interface RecipeIngredient {
  ingredient_sku: string;
  qty_g: number;
  ingredient_name?: string; // For display
}
interface Recipe {
  item_id: string; // Product ID (_UUID)
  item_name?: string; // Product name
  ingredients: RecipeIngredient[];
}
type RecipeFormScreenRouteProp = RouteProp<{ params: { recipe?: Recipe } }, 'params'>;
// End placeholder types

// Mock SelectIngredientModal and FormFieldNumber until actual components are found/created
const SelectProductModal = ({ isVisible, onClose, products, onSelectProduct }) => {
  if (!isVisible) {
    return null;
  }
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Select Product</Text>
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                onSelectProduct(_item);
                onClose();
              }}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SelectIngredientModal = ({ isVisible, onClose, inventoryItems, onSelectIngredient }) => {
  if (!isVisible) {
    return null;
  }
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Select Ingredient</Text>
        <FlatList
          data={inventoryItems}
          keyExtractor={item => item.sku}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                onSelectIngredient(_item);
                onClose();
              }}>
              <Text>
                {item.name} ({item.sku})
              </Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const FormFieldNumber = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  error,
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);
// End Mock Components

const RecipeFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RecipeFormScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const existingRecipe = route.params?.recipe;

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(_null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [isProductModalVisible, setIsProductModalVisible] = useState(_false);
  const [isIngredientModalVisible, setIsIngredientModalVisible] = useState(_false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(_null);

  const [isLoading, setIsLoading] = useState(_false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Load products and inventory items for selection
    const loadInitialData = async () => {
      setIsLoading(_true);
      try {
        const [fetchedProducts, fetchedInventoryItems] = await Promise.all([
          DatabaseService.getProducts(), // Fetch products from DatabaseService
          DatabaseService.getInventoryItems(), // Fetch inventory items from DatabaseService
        ]);
        setProducts(_fetchedProducts);
        setInventoryItems(_fetchedInventoryItems);

        if (_existingRecipe) {
          const product = fetchedProducts.find(p => p.id === existingRecipe.item_id);
          setSelectedProduct(product || null);
          setIngredients(
            existingRecipe.ingredients.map(ing => ({
              ...ing,
              ingredient_name:
                fetchedInventoryItems.find(i => i.sku === ing.ingredient_sku)?.name ||
                ing.ingredient_sku,
            })),
          );
        }
      } catch (_error) {
        Alert.alert('Error', 'Failed to load necessary data. Please try again.');
      } finally {
        setIsLoading(_false);
      }
    };
    loadInitialData();
  }, [existingRecipe]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(_product);
    setFormErrors(prev => ({ ...prev, product: '' })); // Clear product error
  };

  const handleAddIngredient = () => {
    setEditingIngredientIndex(_null); // Ensure we are adding new, not editing
    setIsIngredientModalVisible(_true);
  };

  const handleSelectIngredient = (ingredient: InventoryItem) => {
    if (ingredients.find(i => i.ingredient_sku === ingredient.sku)) {
      Alert.alert('Duplicate', 'This ingredient is already in the recipe.');
      return;
    }
    const newIngredient: RecipeIngredient = {
      ingredient_sku: ingredient.sku,
      qty_g: 0, // Default, user will edit
      ingredient_name: ingredient.name,
    };
    setIngredients(prev => [...prev, newIngredient]);
    setIsIngredientModalVisible(_false);
  };

  const handleUpdateIngredientQuantity = (sku: string, qty_g_str: string) => {
    const qty_g = parseInt(_qty_g_str, 10);
    setIngredients(prevIngredients =>
      prevIngredients.map(ing =>
        ing.ingredient_sku === sku ? { ...ing, qty_g: isNaN(_qty_g) ? 0 : qty_g } : ing,
      ),
    );
    // Validate quantity on save or blur
  };

  const handleRemoveIngredient = (sku: string) => {
    setIngredients(prevIngredients => prevIngredients.filter(ing => ing.ingredient_sku !== sku));
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!selectedProduct) {
      errors.product = 'A product must be selected for the recipe.';
    }
    if (ingredients.length === 0) {
      errors.ingredients = 'A recipe must have at least one ingredient.';
    }
    ingredients.forEach((_ing, index) => {
      if (ing.qty_g <= 0) {
        errors[`ingredient_qty_${index}`] = 'Quantity must be greater than 0.';
      }
      if (ing.qty_g > 1000) {
        errors[`ingredient_qty_${index}`] = 'Quantity cannot exceed 1000g.';
      }
    });
    setFormErrors(_errors);
    return Object.keys(_errors).length === 0;
  };

  const handleSaveRecipe = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please correct the errors in the form.');
      return;
    }
    if (!selectedProduct) {
      return;
    } // Should be caught by validation

    setIsLoading(_true);
    const recipeData: Recipe = {
      item_id: selectedProduct.id,
      ingredients: ingredients.map(({ ingredient_sku, qty_g }) => ({ ingredient_sku, qty_g })),
    };

    try {
      if (_existingRecipe) {
        // The API for create_or_update_recipe_for_item_api handles both cases.
        // No separate updateRecipe function is strictly needed if using that endpoint.
        await DatabaseService.updateRecipe(existingRecipe.item_id, recipeData);
        Alert.alert('Success', 'Recipe updated successfully!');
      } else {
        await DatabaseService.createRecipe(_recipeData);
        Alert.alert('Success', 'Recipe created successfully!');
      }
      navigation.goBack();
    } catch (_error) {
      Alert.alert('Error', `Failed to save recipe: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(_false);
    }
  };

  const renderIngredientItem = ({ item, index }: { item: RecipeIngredient; index: number }) => (
    <View style={styles.ingredientItem}>
      <Text style={styles.ingredientName}>{item.ingredient_name || item.ingredient_sku}</Text>
      <View style={styles.ingredientControls}>
        <FormFieldNumber
          label="" // No label for inline field
          value={item.qty_g > 0 ? item.qty_g.toString() : ''}
          onChangeText={text => handleUpdateIngredientQuantity(item.ingredient_sku, text)}
          placeholder="g/ml/unit"
          keyboardType="numeric"
          error={formErrors[`ingredient_qty_${index}`]}
        />
        <TouchableOpacity
          onPress={() => handleRemoveIngredient(item.ingredient_sku)}
          style={styles.removeButton}>
          {/* <Icon name="remove-circle-outline" type="material" size={24} color="#FF3B30" /> */}
          <Text style={{ color: '#FF3B30' }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && !selectedProduct && !existingRecipe) {
    // Initial load
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text>Loading form data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.formContent}>
        <Text style={styles.screenTitle}>
          {existingRecipe ? 'Edit Recipe' : 'Create New Recipe'}
        </Text>

        <TouchableOpacity
          onPress={() => setIsProductModalVisible(_true)}
          style={styles.selectButton}
          disabled={!!existingRecipe}>
          <Text style={styles.selectButtonText}>
            {selectedProduct ? selectedProduct.name : 'Select Menu Item (_Product)'}
          </Text>
        </TouchableOpacity>
        {formErrors.product && <Text style={styles.errorText}>{formErrors.product}</Text>}
        {existingRecipe && selectedProduct && (
          <Text style={styles.selectedProductText}>Recipe for: {selectedProduct.name}</Text>
        )}

        <View style={styles.ingredientsHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <TouchableOpacity onPress={handleAddIngredient} style={styles.smallAddButton}>
            {/* <Icon name="add" type="material" size={20} color="#007AFF" /> */}
            <Text style={styles.smallAddButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {formErrors.ingredients && <Text style={styles.errorText}>{formErrors.ingredients}</Text>}

        {ingredients.length === 0 ? (
          <Text style={styles.emptyIngredientsText}>No ingredients added yet.</Text>
        ) : (
          <FlatList
            data={ingredients}
            renderItem={renderIngredientItem}
            keyExtractor={(_item, index) => item.ingredient_sku + index}
            scrollEnabled={false} // As it's inside a ScrollView
          />
        )}

        <TouchableOpacity onPress={handleSaveRecipe} style={styles.saveButton} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Recipe</Text>
          )}
        </TouchableOpacity>
      </View>

      <SelectProductModal
        isVisible={isProductModalVisible}
        onClose={() => setIsProductModalVisible(_false)}
        products={products}
        onSelectProduct={handleSelectProduct}
      />
      <SelectIngredientModal
        isVisible={isIngredientModalVisible}
        onClose={() => setIsIngredientModalVisible(_false)}
        inventoryItems={inventoryItems}
        onSelectIngredient={handleSelectIngredient}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContent: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectButton: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  selectedProductText: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
    textAlign: 'center',
    color: '#333',
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  smallAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    // backgroundColor: '#EFEFF4',
    // borderRadius: 20,
  },
  smallAddButtonText: {
    fontSize: 15,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyIngredientsText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
    fontSize: 15,
  },
  ingredientItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  ingredientControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Styles for FormFieldNumber (_mocked)
  fieldContainer: {
    flex: 1, // Take available space for the input
    marginRight: 10, // Space before remove button
  },
  label: {
    // Not used for inline qty, but good for general FormFieldNumber
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  // End FormFieldNumber styles
  removeButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#00A651', // Fynlo green
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Modal styles (_mocked)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    width: '85%',
    maxHeight: '70%',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#EFEFF4',
    borderRadius: 8,
  },
});

export default RecipeFormScreen;
