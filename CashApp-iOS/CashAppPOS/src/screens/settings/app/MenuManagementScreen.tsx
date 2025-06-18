import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  featured: boolean;
  image?: string;
  allergens: string[];
  nutritionInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  modifiers: Modifier[];
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  required: boolean;
  options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  default: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
  items: MenuItem[];
}

const MenuManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const [categories, setCategories] = useState<Category[]>([
    {
      id: 'drinks',
      name: 'Beverages',
      description: 'Hot and cold drinks',
      order: 1,
      visible: true,
      items: [
        {
          id: 'coffee1',
          name: 'Americano',
          description: 'Classic black coffee',
          price: 2.50,
          category: 'drinks',
          available: true,
          featured: false,
          allergens: [],
          modifiers: [
            {
              id: 'size',
              name: 'Size',
              price: 0,
              required: true,
              options: [
                { id: 'small', name: 'Small', price: 0, default: true },
                { id: 'medium', name: 'Medium', price: 0.50, default: false },
                { id: 'large', name: 'Large', price: 1.00, default: false },
              ]
            }
          ]
        },
        {
          id: 'coffee2',
          name: 'Cappuccino',
          description: 'Espresso with steamed milk foam',
          price: 3.25,
          category: 'drinks',
          available: true,
          featured: true,
          allergens: ['dairy'],
          modifiers: []
        }
      ]
    },
    {
      id: 'food',
      name: 'Food',
      description: 'Fresh sandwiches and pastries',
      order: 2,
      visible: true,
      items: [
        {
          id: 'sandwich1',
          name: 'Ham & Cheese Sandwich',
          description: 'Fresh ham with mature cheddar',
          price: 4.95,
          category: 'food',
          available: true,
          featured: false,
          allergens: ['gluten', 'dairy'],
          modifiers: []
        }
      ]
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>('drinks');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Menu settings
  const [menuSettings, setMenuSettings] = useState({
    showDescriptions: true,
    showPrices: true,
    showAllergens: true,
    showNutrition: false,
    allowCustomItems: true,
    enableModifiers: true,
    showUnavailableItems: false,
    autoSort: true,
  });

  const handleAddCategory = () => {
    setEditingCategory({
      id: '',
      name: '',
      description: '',
      order: categories.length + 1,
      visible: true,
      items: []
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
    if (!editingCategory?.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }

    if (editingCategory.id) {
      // Update existing category
      setCategories(prev => prev.map(cat => 
        cat.id === editingCategory.id ? editingCategory : cat
      ));
    } else {
      // Add new category
      const newCategory = {
        ...editingCategory,
        id: Date.now().toString()
      };
      setCategories(prev => [...prev, newCategory]);
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    Alert.alert(
      'Delete Category',
      `Delete "${category?.name}" and all ${category?.items.length} items in it?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setCategories(prev => prev.filter(c => c.id !== categoryId));
          if (selectedCategory === categoryId) {
            setSelectedCategory(categories[0]?.id || '');
          }
        }}
      ]
    );
  };

  const handleAddItem = () => {
    setEditingItem({
      id: '',
      name: '',
      description: '',
      price: 0,
      category: selectedCategory,
      available: true,
      featured: false,
      allergens: [],
      modifiers: []
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    if (!editingItem?.name.trim()) {
      Alert.alert('Error', 'Item name is required.');
      return;
    }

    if (editingItem.price < 0) {
      Alert.alert('Error', 'Price must be a positive number.');
      return;
    }

    if (editingItem.id) {
      // Update existing item
      setCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(item => 
          item.id === editingItem.id ? editingItem : item
        )
      })));
    } else {
      // Add new item
      const newItem = {
        ...editingItem,
        id: Date.now().toString()
      };
      setCategories(prev => prev.map(cat => 
        cat.id === selectedCategory 
          ? { ...cat, items: [...cat.items, newItem] }
          : cat
      ));
    }

    setShowItemModal(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    const item = categories
      .flatMap(c => c.items)
      .find(i => i.id === itemId);
    
    Alert.alert(
      'Delete Item',
      `Delete "${item?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setCategories(prev => prev.map(cat => ({
            ...cat,
            items: cat.items.filter(item => item.id !== itemId)
          })));
        }}
      ]
    );
  };

  const toggleItemAvailability = (itemId: string) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map(item => 
        item.id === itemId 
          ? { ...item, available: !item.available }
          : item
      )
    })));
  };

  const toggleItemFeatured = (itemId: string) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map(item => 
        item.id === itemId 
          ? { ...item, featured: !item.featured }
          : item
      )
    })));
  };

  const toggleCategoryVisibility = (categoryId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, visible: !cat.visible }
        : cat
    ));
  };

  const toggleMenuSetting = (setting: keyof typeof menuSettings) => {
    setMenuSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleImportMenu = () => {
    Alert.alert(
      'Import Menu',
      'Import menu from file or another source?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'From File', onPress: () => {
          Alert.alert('Info', 'File picker would open here');
        }},
        { text: 'From Template', onPress: () => {
          Alert.alert('Info', 'Template selector would open here');
        }}
      ]
    );
  };

  const handleExportMenu = () => {
    Alert.alert(
      'Export Menu',
      'Export current menu configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          Alert.alert('Success', 'Menu exported successfully!');
        }}
      ]
    );
  };

  const getSelectedCategoryItems = () => {
    const category = categories.find(c => c.id === selectedCategory);
    if (!category) return [];
    
    let items = category.items;
    
    if (searchTerm) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (!menuSettings.showUnavailableItems) {
      items = items.filter(item => item.available);
    }
    
    return items;
  };

  const getTotalItemCount = () => {
    return categories.reduce((total, cat) => total + cat.items.length, 0);
  };

  const getAvailableItemCount = () => {
    return categories.reduce((total, cat) => 
      total + cat.items.filter(item => item.available).length, 0
    );
  };

  const CategoryTab = ({ category }: { category: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === category.id && styles.selectedCategoryTab,
        !category.visible && styles.hiddenCategoryTab
      ]}
      onPress={() => setSelectedCategory(category.id)}
      onLongPress={() => handleEditCategory(category)}
    >
      <Text style={[
        styles.categoryTabText,
        selectedCategory === category.id && styles.selectedCategoryTabText,
        !category.visible && styles.hiddenCategoryText
      ]}>
        {category.name}
      </Text>
      <Text style={styles.categoryItemCount}>
        {category.items.length}
      </Text>
      {!category.visible && (
        <Icon name="visibility-off" size={16} color={Colors.mediumGray} />
      )}
    </TouchableOpacity>
  );

  const ItemCard = ({ item }: { item: MenuItem }) => (
    <View style={[styles.itemCard, !item.available && styles.unavailableItem]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, !item.available && styles.unavailableText]}>
            {item.name}
          </Text>
          {item.featured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={12} color={Colors.white} />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>
        <Text style={[styles.itemPrice, !item.available && styles.unavailableText]}>
          £{item.price.toFixed(2)}
        </Text>
      </View>
      
      {item.description && (
        <Text style={[styles.itemDescription, !item.available && styles.unavailableText]}>
          {item.description}
        </Text>
      )}
      
      {item.allergens.length > 0 && (
        <View style={styles.allergenContainer}>
          <Icon name="warning" size={16} color={Colors.warning} />
          <Text style={styles.allergenText}>
            Contains: {item.allergens.join(', ')}
          </Text>
        </View>
      )}
      
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.itemActionButton, styles.editButton]}
          onPress={() => handleEditItem(item)}
        >
          <Icon name="edit" size={16} color={Colors.secondary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.itemActionButton, styles.featuredButton]}
          onPress={() => toggleItemFeatured(item.id)}
        >
          <Icon 
            name={item.featured ? "star" : "star-border"} 
            size={16} 
            color={item.featured ? Colors.warning : Colors.mediumGray} 
          />
          <Text style={styles.featuredButtonText}>
            {item.featured ? 'Featured' : 'Feature'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.itemActionButton, styles.availabilityButton]}
          onPress={() => toggleItemAvailability(item.id)}
        >
          <Icon 
            name={item.available ? "visibility" : "visibility-off"} 
            size={16} 
            color={item.available ? Colors.success : Colors.mediumGray} 
          />
          <Text style={styles.availabilityButtonText}>
            {item.available ? 'Available' : 'Hidden'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.itemActionButton, styles.deleteButton]}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Icon name="delete" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
          <Icon name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{getTotalItemCount()}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{getAvailableItemCount()}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.mediumGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Icon name="clear" size={20} color={Colors.mediumGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categorySection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
        >
          {categories.map(category => (
            <CategoryTab key={category.id} category={category} />
          ))}
          <TouchableOpacity style={styles.addCategoryTab} onPress={handleAddCategory}>
            <Icon name="add" size={20} color={Colors.primary} />
            <Text style={styles.addCategoryText}>Add Category</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Items List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsSection}>
          {getSelectedCategoryItems().map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
          
          {getSelectedCategoryItems().length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="restaurant-menu" size={64} color={Colors.lightGray} />
              <Text style={styles.emptyStateTitle}>No Items Found</Text>
              <Text style={styles.emptyStateText}>
                {searchTerm 
                  ? 'No items match your search criteria'
                  : 'Add items to this category to get started'
                }
              </Text>
              <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
                <Icon name="add" size={20} color={Colors.white} />
                <Text style={styles.addItemButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Menu Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Display Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Show descriptions</Text>
              <Switch
                value={menuSettings.showDescriptions}
                onValueChange={() => toggleMenuSetting('showDescriptions')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Show prices</Text>
              <Switch
                value={menuSettings.showPrices}
                onValueChange={() => toggleMenuSetting('showPrices')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Show allergen information</Text>
              <Switch
                value={menuSettings.showAllergens}
                onValueChange={() => toggleMenuSetting('showAllergens')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable modifiers</Text>
              <Switch
                value={menuSettings.enableModifiers}
                onValueChange={() => toggleMenuSetting('enableModifiers')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Show unavailable items</Text>
              <Switch
                value={menuSettings.showUnavailableItems}
                onValueChange={() => toggleMenuSetting('showUnavailableItems')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.actionButton} onPress={handleImportMenu}>
              <Icon name="file-upload" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Import Menu</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleExportMenu}>
              <Icon name="file-download" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Export Menu</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Menu templates would be available here')}
            >
              <Icon name="library-books" size={24} color={Colors.success} />
              <Text style={styles.actionButtonText}>Browse Templates</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Item Edit Modal */}
      <Modal
        visible={showItemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem?.id ? 'Edit Item' : 'Add New Item'}
              </Text>
              <TouchableOpacity onPress={() => setShowItemModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.textInput}
                value={editingItem?.name || ''}
                onChangeText={(text) => setEditingItem(prev => prev ? { ...prev, name: text } : null)}
                placeholder="Enter item name"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editingItem?.description || ''}
                onChangeText={(text) => setEditingItem(prev => prev ? { ...prev, description: text } : null)}
                placeholder="Enter item description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Price (£) *</Text>
              <TextInput
                style={styles.textInput}
                value={editingItem?.price?.toString() || ''}
                onChangeText={(text) => setEditingItem(prev => prev ? { ...prev, price: parseFloat(text) || 0 } : null)}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setEditingItem(prev => prev ? { ...prev, available: !prev.available } : null)}
                >
                  <Icon 
                    name={editingItem?.available ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.checkboxLabel}>Available</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setEditingItem(prev => prev ? { ...prev, featured: !prev.featured } : null)}
                >
                  <Icon 
                    name={editingItem?.featured ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.checkboxLabel}>Featured</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowItemModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveItem}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Edit Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory?.id ? 'Edit Category' : 'Add New Category'}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Category Name *</Text>
              <TextInput
                style={styles.textInput}
                value={editingCategory?.name || ''}
                onChangeText={(text) => setEditingCategory(prev => prev ? { ...prev, name: text } : null)}
                placeholder="Enter category name"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                value={editingCategory?.description || ''}
                onChangeText={(text) => setEditingCategory(prev => prev ? { ...prev, description: text } : null)}
                placeholder="Enter category description"
              />

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setEditingCategory(prev => prev ? { ...prev, visible: !prev.visible } : null)}
                >
                  <Icon 
                    name={editingCategory?.visible ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.checkboxLabel}>Visible in menu</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveCategory}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  addButton: {
    padding: 8,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  categorySection: {
    backgroundColor: Colors.white,
    paddingBottom: 8,
  },
  categoryTabs: {
    paddingHorizontal: 16,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedCategoryTab: {
    backgroundColor: Colors.primary,
  },
  hiddenCategoryTab: {
    opacity: 0.6,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedCategoryTabText: {
    color: Colors.white,
  },
  hiddenCategoryText: {
    color: Colors.mediumGray,
  },
  categoryItemCount: {
    fontSize: 12,
    color: Colors.lightText,
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  addCategoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addCategoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  itemsSection: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  itemCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unavailableItem: {
    opacity: 0.6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  unavailableText: {
    color: Colors.mediumGray,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  featuredText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.white,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
    lineHeight: 20,
  },
  allergenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  allergenText: {
    fontSize: 12,
    color: Colors.warning,
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  editButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.secondary,
  },
  featuredButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  featuredButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.warning,
  },
  availabilityButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  availabilityButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
  },
  deleteButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  actionCard: {
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
});

export default MenuManagementScreen;