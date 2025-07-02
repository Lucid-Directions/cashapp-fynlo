/**
 * RecipeManager - Comprehensive recipe management with cost analysis and inventory integration
 * Provides full recipe CRUD operations, cost calculations, and profitability analysis
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors';
import { Recipe, MenuItem, MenuItemCost } from '../../types';
import { costCalculationService } from '../../services/CostCalculationService';
import { menuInventoryService } from '../../services/MenuInventoryService';
import * as InventoryApiService from '../../services/InventoryApiService';
import useInventoryStore from '../../store/useInventoryStore';
import IngredientPicker from './IngredientPicker';

interface RecipeManagerProps {
  visible: boolean;
  onClose: () => void;
}

interface RecipeWithCost extends Recipe {
  costAnalysis?: MenuItemCost;
  availability?: {
    isAvailable: boolean;
    stockStatus: 'available' | 'limited' | 'unavailable';
    estimatedPortions: number;
  };
}

const RecipeManager: React.FC<RecipeManagerProps> = ({ visible, onClose }) => {
  const [recipes, setRecipes] = useState<RecipeWithCost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithCost | null>(null);
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'profitability' | 'availability'>('name');

  const { inventoryItems } = useInventoryStore();

  useEffect(() => {
    if (visible) {
      loadRecipes();
    }
  }, [visible]);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      // Load recipes from API
      const recipesData = await InventoryApiService.fetchRecipes();
      
      // Enhance recipes with cost analysis and availability
      const enhancedRecipes = await Promise.all(
        recipesData.map(async (recipe) => {
          const availability = menuInventoryService.checkMenuItemAvailability(
            [{ id: recipe.item_id, name: recipe.item_name || 'Unknown Item' }],
            [recipe],
            inventoryItems
          )[0];

          // Mock sale price for cost analysis (in real app, this would come from menu items)
          const mockSalePrice = 12.99; // This should be fetched from menu service
          const costAnalysis = costCalculationService.calculateMenuItemCost(
            recipe,
            inventoryItems,
            mockSalePrice
          );

          return {
            ...recipe,
            costAnalysis,
            availability: {
              isAvailable: availability.isAvailable,
              stockStatus: availability.stockStatus,
              estimatedPortions: availability.estimatedPortionsAvailable,
            },
          };
        })
      );

      setRecipes(enhancedRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
      Alert.alert('Error', 'Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecipe = () => {
    setEditingRecipe(null);
    setShowIngredientPicker(true);
  };

  const handleEditRecipe = (recipe: RecipeWithCost) => {
    setEditingRecipe(recipe);
    setShowIngredientPicker(true);
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      setIsLoading(true);
      
      if (editingRecipe) {
        // Update existing recipe
        await InventoryApiService.updateRecipe(recipe.item_id, recipe);
        Alert.alert('Success', 'Recipe updated successfully');
      } else {
        // Create new recipe
        await InventoryApiService.createRecipe(recipe);
        Alert.alert('Success', 'Recipe created successfully');
      }

      await loadRecipes(); // Reload to get updated data
      setShowIngredientPicker(false);
      setEditingRecipe(null);
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'Failed to save recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecipe = (recipe: RecipeWithCost) => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete the recipe for "${recipe.item_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await InventoryApiService.deleteRecipe(recipe.item_id);
              await loadRecipes();
              Alert.alert('Success', 'Recipe deleted successfully');
            } catch (error) {
              console.error('Error deleting recipe:', error);
              Alert.alert('Error', 'Failed to delete recipe');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const getFilteredAndSortedRecipes = (): RecipeWithCost[] => {
    let filtered = recipes;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = recipes.filter(recipe =>
        recipe.item_name?.toLowerCase().includes(query) ||
        recipe.ingredients.some(ing => ing.ingredient_name?.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.item_name || '').localeCompare(b.item_name || '');
        case 'cost':
          return (a.costAnalysis?.costBreakdown.totalCost || 0) - (b.costAnalysis?.costBreakdown.totalCost || 0);
        case 'profitability':
          return (b.costAnalysis?.costBreakdown.marginPercent || 0) - (a.costAnalysis?.costBreakdown.marginPercent || 0);
        case 'availability':
          return (b.availability?.estimatedPortions || 0) - (a.availability?.estimatedPortions || 0);
        default:
          return 0;
      }
    });
  };

  const getAvailabilityColor = (stockStatus: string): string => {
    switch (stockStatus) {
      case 'available': return Colors.success;
      case 'limited': return Colors.warning;
      case 'unavailable': return Colors.danger;
      default: return Colors.darkGray;
    }
  };

  const getProfitabilityColor = (profitability?: string): string => {
    switch (profitability) {
      case 'high': return Colors.success;
      case 'medium': return Colors.warning;
      case 'low': return Colors.danger;
      case 'loss': return Colors.danger;
      default: return Colors.darkGray;
    }
  };

  const renderRecipeCard = (recipe: RecipeWithCost) => (
    <TouchableOpacity
      key={recipe.item_id}
      style={styles.recipeCard}
      onPress={() => setSelectedRecipe(recipe)}
    >
      <View style={styles.recipeHeader}>
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName}>{recipe.item_name || 'Unnamed Recipe'}</Text>
          <Text style={styles.recipeDetails}>
            {recipe.ingredients.length} ingredients
          </Text>
        </View>
        <View style={styles.recipeBadges}>
          <View style={[
            styles.availabilityBadge,
            { backgroundColor: getAvailabilityColor(recipe.availability?.stockStatus || 'unavailable') + '20' }
          ]}>
            <Text style={[
              styles.badgeText,
              { color: getAvailabilityColor(recipe.availability?.stockStatus || 'unavailable') }
            ]}>
              {recipe.availability?.stockStatus || 'Unknown'}
            </Text>
          </View>
          {recipe.costAnalysis && (
            <View style={[
              styles.profitabilityBadge,
              { backgroundColor: getProfitabilityColor(recipe.costAnalysis.profitability) + '20' }
            ]}>
              <Text style={[
                styles.badgeText,
                { color: getProfitabilityColor(recipe.costAnalysis.profitability) }
              ]}>
                {recipe.costAnalysis.profitability}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.recipeMetrics}>
        <View style={styles.metric}>
          <Icon name="restaurant" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>
            {recipe.availability?.estimatedPortions || 0} portions
          </Text>
        </View>
        <View style={styles.metric}>
          <Icon name="attach-money" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>
            £{recipe.costAnalysis?.costBreakdown.totalCost.toFixed(2) || '0.00'} cost
          </Text>
        </View>
        <View style={styles.metric}>
          <Icon name="trending-up" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>
            {recipe.costAnalysis?.costBreakdown.marginPercent.toFixed(1) || '0'}% margin
          </Text>
        </View>
      </View>

      <View style={styles.recipeActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleEditRecipe(recipe);
          }}
        >
          <Icon name="edit" size={16} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteRecipe(recipe);
          }}
        >
          <Icon name="delete" size={16} color={Colors.danger} />
          <Text style={[styles.actionButtonText, { color: Colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderRecipeDetail = () => {
    if (!selectedRecipe) return null;

    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>{selectedRecipe.item_name}</Text>
            <TouchableOpacity onPress={() => handleEditRecipe(selectedRecipe)}>
              <Icon name="edit" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
            {/* Cost Analysis */}
            {selectedRecipe.costAnalysis && (
              <View style={styles.costAnalysisSection}>
                <Text style={styles.sectionTitle}>Cost Analysis</Text>
                <View style={styles.costGrid}>
                  <View style={styles.costCard}>
                    <Text style={styles.costLabel}>Ingredient Cost</Text>
                    <Text style={styles.costValue}>
                      £{selectedRecipe.costAnalysis.costBreakdown.ingredientCost.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.costCard}>
                    <Text style={styles.costLabel}>Waste Cost</Text>
                    <Text style={styles.costValue}>
                      £{selectedRecipe.costAnalysis.costBreakdown.wasteCost.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.costCard}>
                    <Text style={styles.costLabel}>Total Cost</Text>
                    <Text style={styles.costValue}>
                      £{selectedRecipe.costAnalysis.costBreakdown.totalCost.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.costCard}>
                    <Text style={styles.costLabel}>Profit Margin</Text>
                    <Text style={[
                      styles.costValue,
                      { color: getProfitabilityColor(selectedRecipe.costAnalysis.profitability) }
                    ]}>
                      {selectedRecipe.costAnalysis.costBreakdown.marginPercent.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Ingredients List */}
            <View style={styles.ingredientsSection}>
              <Text style={styles.sectionTitle}>Ingredients ({selectedRecipe.ingredients.length})</Text>
              {selectedRecipe.ingredients.map((ingredient, index) => {
                const inventoryItem = inventoryItems[ingredient.ingredient_sku];
                return (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>
                        {ingredient.ingredient_name || inventoryItem?.name || 'Unknown'}
                      </Text>
                      <Text style={styles.ingredientDetails}>
                        {ingredient.qty_g}g • SKU: {ingredient.ingredient_sku}
                      </Text>
                      {inventoryItem && (
                        <Text style={styles.ingredientStock}>
                          Stock: {inventoryItem.qty_g}g • 
                          Cost: £{((ingredient.qty_g / 1000) * (inventoryItem.cost_per_unit || 0)).toFixed(3)}
                        </Text>
                      )}
                    </View>
                    <View style={[
                      styles.ingredientStatus,
                      { 
                        backgroundColor: inventoryItem && inventoryItem.qty_g >= ingredient.qty_g 
                          ? Colors.success + '20' 
                          : Colors.danger + '20' 
                      }
                    ]}>
                      <Icon 
                        name={inventoryItem && inventoryItem.qty_g >= ingredient.qty_g ? "check" : "warning"} 
                        size={16} 
                        color={inventoryItem && inventoryItem.qty_g >= ingredient.qty_g ? Colors.success : Colors.danger} 
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Suggestions */}
            {selectedRecipe.costAnalysis?.suggestions && selectedRecipe.costAnalysis.suggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionTitle}>Optimization Suggestions</Text>
                {selectedRecipe.costAnalysis.suggestions.map((suggestion, index) => (
                  <View key={index} style={styles.suggestionItem}>
                    <Icon name="lightbulb-outline" size={16} color={Colors.warning} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Recipe Manager</Text>
          <TouchableOpacity onPress={handleCreateRecipe} style={styles.addButton}>
            <Icon name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search and Sort */}
        <View style={styles.controlsSection}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={Colors.darkGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortContainer}>
            {[
              { key: 'name', label: 'Name', icon: 'sort-by-alpha' },
              { key: 'cost', label: 'Cost', icon: 'attach-money' },
              { key: 'profitability', label: 'Profit', icon: 'trending-up' },
              { key: 'availability', label: 'Stock', icon: 'inventory' },
            ].map((sort) => (
              <TouchableOpacity
                key={sort.key}
                style={[styles.sortButton, sortBy === sort.key && styles.sortButtonActive]}
                onPress={() => setSortBy(sort.key as any)}
              >
                <Icon 
                  name={sort.icon} 
                  size={16} 
                  color={sortBy === sort.key ? Colors.white : Colors.darkGray} 
                />
                <Text style={[
                  styles.sortButtonText,
                  sortBy === sort.key && styles.sortButtonTextActive
                ]}>
                  {sort.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recipes List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading recipes...</Text>
            </View>
          ) : getFilteredAndSortedRecipes().length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="restaurant-menu" size={64} color={Colors.lightGray} />
              <Text style={styles.emptyStateText}>No recipes found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try adjusting your search' : 'Create your first recipe to get started'}
              </Text>
            </View>
          ) : (
            getFilteredAndSortedRecipes().map(renderRecipeCard)
          )}
        </ScrollView>

        {/* Ingredient Picker Modal */}
        <IngredientPicker
          visible={showIngredientPicker}
          onClose={() => {
            setShowIngredientPicker(false);
            setEditingRecipe(null);
          }}
          onSave={handleSaveRecipe}
          initialRecipe={editingRecipe || undefined}
          menuItemId={editingRecipe?.item_id || `new_${Date.now()}`}
          menuItemName={editingRecipe?.item_name || 'New Recipe'}
        />

        {/* Recipe Detail Modal */}
        {selectedRecipe && renderRecipeDetail()}
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
  addButton: {
    padding: 8,
  },
  controlsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  sortContainer: {
    flexDirection: 'row',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    marginRight: 8,
    gap: 6,
  },
  sortButtonActive: {
    backgroundColor: Colors.primary,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  sortButtonTextActive: {
    color: Colors.white,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkGray,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  recipeCard: {
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
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  recipeDetails: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  recipeBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profitabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  recipeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  detailContent: {
    flex: 1,
    padding: 16,
  },
  costAnalysisSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  costCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  costValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  ingredientsSection: {
    marginBottom: 24,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  ingredientDetails: {
    fontSize: 12,
    color: Colors.darkGray,
    marginBottom: 2,
  },
  ingredientStock: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  ingredientStatus: {
    padding: 8,
    borderRadius: 20,
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warning + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
});

export default RecipeManager;