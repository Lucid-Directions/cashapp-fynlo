import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { Icon } from 'react-native-elements'; // Or your preferred icon library

// For user/auth state if needed
// import { Recipe, RecipeIngredient } from '../../types'; // Assuming these types exist or will be created
import { fetchRecipes, deleteRecipe } from '../../services/ApiService'; // Assuming ApiService will be updated

// Placeholder types, replace with actual types from '../../types'
interface RecipeIngredient {
  ingredient_sku: string;
  qty_g: number;
  ingredient_name?: string;
}
interface Recipe {
  item_id: string; // Should be UUID, but using string for now
  item_name?: string;
  ingredients: RecipeIngredient[];
}
// End placeholder types

const RecipesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // const { user } = useAppStore(); // If needed for auth checks or restaurant ID

  const loadRecipes = useCallback(async () => {
    setIsLoading(true);
    try {
      // const restaurantId = user?.restaurant_id; // Get restaurant ID if needed by API
      // if (!restaurantId) {
      //   Alert.alert("Error", "Restaurant information not found.");
      //   setIsLoading(false);
      //   return;
      // }
      // const fetchedRecipes = await fetchRecipes(restaurantId);
      const fetchedRecipes: Recipe[] = await fetchRecipes(); // Using simplified fetch for now
      setRecipes(fetchedRecipes);
    } catch (error) {
      console.error('Failed to load recipes:', error);
      Alert.alert('Error', 'Failed to load recipes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRecipes();
    setIsRefreshing(false);
  }, [loadRecipes]);

  const handleAddRecipe = () => {
    // @ts-ignore
    navigation.navigate('RecipeFormScreen'); // Navigate to form for new recipe
  };

  const handleEditRecipe = (recipe: Recipe) => {
    // @ts-ignore
    navigation.navigate('RecipeFormScreen', { recipe }); // Navigate to form with existing recipe data
  };

  const handleDeleteRecipe = (itemId: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            await deleteRecipe(itemId);
            Alert.alert('Success', 'Recipe deleted successfully.');
            loadRecipes(); // Refresh list
          } catch (error) {
            console.error('Failed to delete recipe:', error);
            Alert.alert('Error', 'Failed to delete recipe.');
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const renderRecipeItem = ({ item }: { item: Recipe }) => (
    <View style={styles.recipeItem}>
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName}>{item.item_name || item.item_id}</Text>
        <Text style={styles.recipeIngredients}>{item.ingredients.length} ingredient(s)</Text>
        {/* Optionally list some ingredients: */}
        {/* <Text>{item.ingredients.slice(0, 2).map(ing => `${ing.ingredient_name || ing.ingredient_sku} (${ing.qty_g}g)`).join(', ')}</Text> */}
      </View>
      <View style={styles.recipeActions}>
        <TouchableOpacity onPress={() => handleEditRecipe(item)} style={styles.actionButton}>
          {/* <Icon name="edit" type="material" size={24} color="#007AFF" /> */}
          <Text style={{ color: '#007AFF' }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteRecipe(item.item_id)}
          style={styles.actionButton}>
          {/* <Icon name="delete" type="material" size={24} color="#FF3B30" /> */}
          <Text style={{ color: '#FF3B30' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && !isRefreshing && recipes.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text>Loading Recipes...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Recipes</Text>
        <TouchableOpacity onPress={handleAddRecipe} style={styles.addButton}>
          {/* <Icon name="add" type="material" size={28} color="#007AFF" /> */}
          <Text style={styles.addButtonText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {recipes.length === 0 && !isLoading ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No recipes found.</Text>
          <Text style={styles.emptySubText}>Tap 'Add New' to create your first recipe.</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipeItem}
          keyExtractor={item => item.item_id.toString()}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 8,
    // backgroundColor: '#007AFF',
    // borderRadius: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContentContainer: {
    paddingVertical: 8,
  },
  recipeItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipeIngredients: {
    fontSize: 14,
    color: '#555',
  },
  recipeActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#777',
  },
});

export default RecipesScreen;
