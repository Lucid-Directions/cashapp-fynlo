import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Image,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';
import useUIStore from '../../store/useUIStore';
import { MenuItem, OrderItem } from '../../types';
import LazyLoadingWrapper from '../../components/performance/LazyLoadingWrapper';
import { MenuItemSkeleton } from '../../components/performance/SkeletonLoader';
import { usePerformanceMonitor, performanceUtils } from '../../hooks/usePerformanceMonitor';
import { OptimizedGrid } from '../../components/performance/OptimizedFlatList';
import CartIcon from '../../components/cart/CartIcon';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;

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
  cardShadow: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Enhanced menu items with images and modifiers
interface Modifier {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface EnhancedMenuItem extends MenuItem {
  image?: string;
  modifiers?: Modifier[];
  spicyLevel?: number;
  dietary?: string[];
  prepTime?: number;
}

// Sample modifiers for tacos
const tacoModifiers: Modifier[] = [
  { id: 'extra-meat', name: 'Extra Meat', price: 1.50, category: 'Protein' },
  { id: 'extra-cheese', name: 'Extra Cheese', price: 0.75, category: 'Toppings' },
  { id: 'extra-guac', name: 'Extra Guacamole', price: 1.00, category: 'Toppings' },
  { id: 'no-onions', name: 'No Onions', price: 0.00, category: 'Preferences' },
  { id: 'no-cilantro', name: 'No Coriander', price: 0.00, category: 'Preferences' },
  { id: 'mild', name: 'Mild Salsa', price: 0.00, category: 'Spice' },
  { id: 'hot', name: 'Extra Hot', price: 0.00, category: 'Spice' },
];

// Enhanced menu items with additional data
const enhancedMenuItems: EnhancedMenuItem[] = [
  // SNACKS
  { 
    id: 1, 
    name: 'Nachos', 
    price: 5.00, 
    category: 'Snacks', 
    emoji: '🧀', 
    available: true, 
    description: 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander',
    image: 'nachos.jpg',
    modifiers: [
      { id: 'extra-cheese', name: 'Extra Cheese', price: 0.75, category: 'Toppings' },
      { id: 'extra-guac', name: 'Extra Guacamole', price: 1.00, category: 'Toppings' },
      { id: 'add-chicken', name: 'Add Chicken', price: 2.50, category: 'Protein' },
      { id: 'add-beef', name: 'Add Beef', price: 3.00, category: 'Protein' },
    ],
    dietary: ['vegetarian', 'gluten-free'],
    prepTime: 8,
  },
  { 
    id: 2, 
    name: 'Quesadillas', 
    price: 5.50, 
    category: 'Snacks', 
    emoji: '🫓', 
    available: true, 
    description: 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander',
    image: 'quesadilla.jpg',
    modifiers: [
      { id: 'extra-cheese', name: 'Extra Cheese', price: 0.75, category: 'Toppings' },
      { id: 'add-veggies', name: 'Add Grilled Veggies', price: 1.50, category: 'Toppings' },
    ],
    dietary: ['vegetarian'],
    prepTime: 10,
  },
  // TACOS
  { 
    id: 6, 
    name: 'Carnitas', 
    price: 3.50, 
    category: 'Tacos', 
    emoji: '🌮', 
    available: true, 
    description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander',
    image: 'carnitas.jpg',
    modifiers: tacoModifiers,
    spicyLevel: 2,
    prepTime: 5,
  },
  { 
    id: 7, 
    name: 'Cochinita', 
    price: 3.50, 
    category: 'Tacos', 
    emoji: '🌮', 
    available: true, 
    description: 'Marinated pulled pork served with pickle red onion',
    image: 'cochinita.jpg',
    modifiers: tacoModifiers,
    spicyLevel: 3,
    prepTime: 5,
  },
  // Add more items as needed...
];

// Categories with icons
const categoriesWithIcons = [
  { name: 'All', icon: 'restaurant-menu', color: Colors.primary },
  { name: 'Snacks', icon: 'tapas', color: Colors.warning },
  { name: 'Tacos', icon: 'local-pizza', color: Colors.primary },
  { name: 'Special Tacos', icon: 'star', color: Colors.secondary },
  { name: 'Burritos', icon: 'wrap-text', color: Colors.danger },
  { name: 'Sides', icon: 'fastfood', color: Colors.warning },
  { name: 'Drinks', icon: 'local-drink', color: Colors.secondary },
];

const EnhancedPOSScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EnhancedMenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor({
    componentName: 'EnhancedPOSScreen',
    enableMemoryTracking: true,
    logToConsole: __DEV__,
  });

  // Zustand stores
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    cartTotal,
    cartItemCount,
  } = useAppStore();
  
  const {
    selectedCategory,
    setSelectedCategory,
  } = useUIStore();

  // Debounced search query for performance
  const debouncedSearchQuery = useMemo(
    () => performanceUtils.debounce((query: string) => query, 300),
    []
  );

  // Memoized filtered items for performance
  const filteredItems = useMemo(() => {
    return enhancedMenuItems.filter(item => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [enhancedMenuItems, selectedCategory, searchQuery]);

  // Animate modifier modal
  useEffect(() => {
    if (showModifierModal) {
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    } else {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showModifierModal, animatedValue]);

  const handleItemPress = (item: EnhancedMenuItem) => {
    if (!item.available) return;
    
    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedItem(item);
      setQuantity(1);
      setSelectedModifiers([]);
      setSpecialInstructions('');
      setShowModifierModal(true);
    } else {
      // Add directly to cart if no modifiers
      addItemToCart(item, 1, [], '');
    }
  };

  const addItemToCart = (
    item: EnhancedMenuItem, 
    qty: number, 
    modifiers: Modifier[], 
    instructions: string
  ) => {
    const modifierPrice = modifiers.reduce((sum, mod) => sum + mod.price, 0);
    const orderItem: OrderItem = {
      id: item.id,
      name: item.name,
      price: item.price + modifierPrice,
      quantity: qty,
      emoji: item.emoji,
      modifications: modifiers.map(m => m.name),
      notes: instructions,
    };
    
    for (let i = 0; i < qty; i++) {
      addToCart(orderItem);
    }
    
    setShowModifierModal(false);
  };

  const toggleModifier = (modifier: Modifier) => {
    setSelectedModifiers(prev => {
      const exists = prev.find(m => m.id === modifier.id);
      if (exists) {
        return prev.filter(m => m.id !== modifier.id);
      } else {
        return [...prev, modifier];
      }
    });
  };

  const getTotalPrice = () => {
    if (!selectedItem) return 0;
    const modifierPrice = selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
    return (selectedItem.price + modifierPrice) * quantity;
  };

  const handleBarcodeScanned = (barcode: string) => {
    setShowBarcodeScanner(false);
    
    // Mock barcode scanning - in real implementation, you'd match against actual barcodes
    const mockBarcodes: { [key: string]: number } = {
      '123456789': 1, // Nachos
      '987654321': 2, // Quesadillas
      '456789123': 3, // Soft Tacos
      '789123456': 4, // Hard Tacos
      '321654987': 5, // Chips & Salsa
    };
    
    const itemId = mockBarcodes[barcode];
    if (itemId) {
      const item = enhancedMenuItems.find(item => item.id === itemId);
      if (item && item.available) {
        handleItemPress(item);
        Alert.alert('Success', `Found "${item.name}" by barcode!`);
      } else {
        Alert.alert('Error', 'Item not available or not found');
      }
    } else {
      Alert.alert('Not Found', `No item found for barcode: ${barcode}`);
    }
  };

  const renderSpicyLevel = (level?: number) => {
    if (!level) return null;
    return (
      <View style={styles.spicyIndicator}>
        {[...Array(5)].map((_, i) => (
          <Icon 
            key={i} 
            name="local-fire-department" 
            size={14} 
            color={i < level ? Colors.danger : Colors.lightGray} 
          />
        ))}
      </View>
    );
  };

  const renderDietaryIcons = (dietary?: string[]) => {
    if (!dietary || dietary.length === 0) return null;
    return (
      <View style={styles.dietaryContainer}>
        {dietary.includes('vegetarian') && (
          <View style={[styles.dietaryBadge, { backgroundColor: Colors.success }]}>
            <Text style={styles.dietaryText}>V</Text>
          </View>
        )}
        {dietary.includes('vegan') && (
          <View style={[styles.dietaryBadge, { backgroundColor: Colors.primary }]}>
            <Text style={styles.dietaryText}>VG</Text>
          </View>
        )}
        {dietary.includes('gluten-free') && (
          <View style={[styles.dietaryBadge, { backgroundColor: Colors.warning }]}>
            <Text style={styles.dietaryText}>GF</Text>
          </View>
        )}
      </View>
    );
  };

  const MenuItemCard = memo(({ item }: { item: EnhancedMenuItem }) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    
    const handlePress = useCallback(() => {
      handleItemPress(item);
    }, [item]);
    
    return (
      <LazyLoadingWrapper
        delay={50}
        placeholder={<MenuItemSkeleton />}
        condition={performanceMetrics.isReady}
      >
        <TouchableOpacity
          style={[
            styles.menuCard,
            !item.available && styles.menuCardDisabled,
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={!item.available}
        >
        {/* Item Image */}
        <View style={styles.menuItemImageContainer}>
          {item.image ? (
            <Image 
              source={{ uri: item.image }} 
              style={styles.menuItemImage}
              defaultSource={require('../../assets/placeholder-food.png')}
            />
          ) : (
            <View style={styles.menuItemEmojiContainer}>
              <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
            </View>
          )}
          {!item.available && (
            <View style={styles.unavailableOverlay}>
              <Text style={styles.unavailableText}>SOLD OUT</Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.menuItemContent}>
          <View style={styles.menuItemHeader}>
            <Text style={styles.menuItemName} numberOfLines={1}>
              {item.name}
            </Text>
            {renderDietaryIcons(item.dietary)}
          </View>
          
          <Text style={styles.menuItemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          
          <View style={styles.menuItemFooter}>
            <View style={styles.menuItemMeta}>
              <Text style={styles.menuItemPrice}>
                £{item.price.toFixed(2)}
              </Text>
              {item.prepTime && (
                <View style={styles.prepTimeContainer}>
                  <Icon name="schedule" size={12} color={Colors.lightText} />
                  <Text style={styles.prepTimeText}>{item.prepTime}min</Text>
                </View>
              )}
            </View>
            {renderSpicyLevel(item.spicyLevel)}
          </View>
        </View>

        {/* Quick Add Button */}
        {existingItem ? (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{existingItem.quantity}</Text>
          </View>
        ) : (
          item.available && (
            <TouchableOpacity 
              style={styles.quickAddButton}
              onPress={(e) => {
                e.stopPropagation();
                handleItemPress(item);
              }}
            >
              <Icon name="add" size={24} color={Colors.white} />
            </TouchableOpacity>
          )
        )}
      </TouchableOpacity>
      </LazyLoadingWrapper>
    );
  });

  const renderModifierModal = () => {
    if (!selectedItem) return null;

    const modifiersByCategory = selectedItem.modifiers?.reduce((acc, mod) => {
      if (!acc[mod.category]) {
        acc[mod.category] = [];
      }
      acc[mod.category].push(mod);
      return acc;
    }, {} as Record<string, Modifier[]>) || {};

    return (
      <Modal
        visible={showModifierModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowModifierModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowModifierModal(false)}
        >
          <Animated.View 
            style={[
              styles.modifierModalContent,
              {
                opacity: animatedValue,
                transform: [{
                  scale: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                  <Text style={styles.modalSubtitle}>Customize your order</Text>
                </View>
                <TouchableOpacity onPress={() => setShowModifierModal(false)}>
                  <Icon name="close" size={24} color={Colors.darkGray} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Quantity Selector */}
                <View style={styles.quantitySection}>
                  <Text style={styles.sectionTitle}>Quantity</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Icon name="remove" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(quantity + 1)}
                    >
                      <Icon name="add" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modifiers */}
                {Object.entries(modifiersByCategory).map(([category, modifiers]) => (
                  <View key={category} style={styles.modifierSection}>
                    <Text style={styles.sectionTitle}>{category}</Text>
                    {modifiers.map(modifier => (
                      <TouchableOpacity
                        key={modifier.id}
                        style={styles.modifierItem}
                        onPress={() => toggleModifier(modifier)}
                      >
                        <View style={styles.modifierInfo}>
                          <Text style={styles.modifierName}>{modifier.name}</Text>
                          {modifier.price > 0 && (
                            <Text style={styles.modifierPrice}>+£{modifier.price.toFixed(2)}</Text>
                          )}
                        </View>
                        <View style={[
                          styles.modifierCheckbox,
                          selectedModifiers.find(m => m.id === modifier.id) && styles.modifierCheckboxChecked
                        ]}>
                          {selectedModifiers.find(m => m.id === modifier.id) && (
                            <Icon name="check" size={16} color={Colors.white} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {/* Special Instructions */}
                <View style={styles.instructionsSection}>
                  <Text style={styles.sectionTitle}>Special Instructions</Text>
                  <TextInput
                    style={styles.instructionsInput}
                    placeholder="Add any special requests..."
                    value={specialInstructions}
                    onChangeText={setSpecialInstructions}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <View style={styles.totalContainer}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalPrice}>£{getTotalPrice().toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addToCartButton}
                  onPress={() => {
                    if (selectedItem) {
                      addItemToCart(selectedItem, quantity, selectedModifiers, specialInstructions);
                    }
                  }}
                >
                  <Text style={styles.addToCartButtonText}>
                    Add {quantity} to Cart
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuButton}>
            <Icon name="menu" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>
              Fynl<Text style={styles.logoOrange}>o</Text>
            </Text>
          </View>
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={Colors.lightText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.lightText}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="clear" size={20} color={Colors.lightText} />
              </TouchableOpacity>
            )}
            
          </View>
        </View>

        <CartIcon
          count={cartItemCount()}
          onPress={() => setShowCartModal(true)}
          testID="shopping-cart-button"
        />
      </View>

      {/* Categories */}
      <ScrollView 
        horizontal 
        style={styles.categoriesContainer}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContent}
      >
        {categoriesWithIcons.map((category) => (
          <TouchableOpacity
            key={category.name}
            style={[
              styles.categoryButton,
              selectedCategory === category.name && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory(category.name)}
          >
            <Icon 
              name={category.icon} 
              size={20} 
              color={selectedCategory === category.name ? Colors.white : category.color} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === category.name && styles.categoryTextActive,
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Menu Items */}
      <OptimizedGrid
        data={filteredItems}
        renderItem={(item) => <MenuItemCard item={item} />}
        keyExtractor={(item) => item.id.toString()}
        numColumns={isTablet ? 3 : 2}
        itemHeight={220} // Approximate height for better performance
        spacing={12}
      />

      {/* Modifiers Modal */}
      {renderModifierModal()}

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <View style={styles.barcodeModalOverlay}>
          <View style={styles.barcodeModalContainer}>
            <View style={styles.barcodeHeader}>
              <Text style={styles.barcodeTitle}>Barcode Scanner</Text>
              <TouchableOpacity 
                onPress={() => setShowBarcodeScanner(false)}
                style={styles.barcodeCloseButton}
              >
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.barcodeScanArea}>
              <View style={styles.barcodeScanFrame}>
                <Icon name="qr-code-scanner" size={100} color={Colors.primary} />
                <Text style={styles.barcodeScanText}>Point camera at barcode</Text>
                <Text style={styles.barcodeScanSubtext}>
                  Position the barcode within the frame to scan
                </Text>
              </View>
            </View>

            <View style={styles.barcodeTestSection}>
              <Text style={styles.testSectionTitle}>Test with sample barcodes:</Text>
              <View style={styles.testBarcodesContainer}>
                {[
                  { code: '123456789', item: 'Nachos' },
                  { code: '987654321', item: 'Quesadillas' },
                  { code: '456789123', item: 'Soft Tacos' },
                  { code: '789123456', item: 'Hard Tacos' },
                ].map(({ code, item }) => (
                  <TouchableOpacity
                    key={code}
                    style={styles.testBarcodeButton}
                    onPress={() => handleBarcodeScanned(code)}
                  >
                    <Icon name="qr-code" size={20} color={Colors.secondary} />
                    <View style={styles.testBarcodeInfo}>
                      <Text style={styles.testBarcodeCode}>{code}</Text>
                      <Text style={styles.testBarcodeItem}>{item}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.barcodeActions}>
              <TouchableOpacity
                style={styles.manualEntryButton}
                onPress={() => {
                  setShowBarcodeScanner(false);
                  Alert.prompt(
                    'Manual Entry',
                    'Enter barcode manually:',
                    (text) => {
                      if (text) handleBarcodeScanned(text);
                    },
                    'plain-text',
                    '',
                    'numeric'
                  );
                }}
              >
                <Icon name="keyboard" size={20} color={Colors.secondary} />
                <Text style={styles.manualEntryText}>Manual Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  logoContainer: {
    marginRight: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  logoOrange: {
    color: '#FF6B35',
  },
  headerCenter: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
    marginLeft: 8,
  },
  categoriesContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    maxHeight: 60,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 6,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  menuGrid: {
    padding: 16,
  },
  menuCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    margin: 8,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  menuCardDisabled: {
    opacity: 0.6,
  },
  menuItemImageContainer: {
    height: 120,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  menuItemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  menuItemEmojiContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemEmoji: {
    fontSize: 48,
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  menuItemContent: {
    padding: 12,
  },
  menuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  dietaryContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dietaryBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dietaryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  menuItemDescription: {
    fontSize: 12,
    color: Colors.lightText,
    lineHeight: 16,
    marginBottom: 8,
  },
  menuItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  prepTimeText: {
    fontSize: 12,
    color: Colors.lightText,
  },
  spicyIndicator: {
    flexDirection: 'row',
    gap: 2,
  },
  quickAddButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  quantityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  quantityBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
  },
  // Modifier Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modifierModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  modalBody: {
    maxHeight: 400,
  },
  quantitySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  modifierSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modifierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  modifierInfo: {
    flex: 1,
  },
  modifierName: {
    fontSize: 16,
    color: Colors.text,
  },
  modifierPrice: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 2,
  },
  modifierCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modifierCheckboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  instructionsSection: {
    padding: 20,
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  addToCartButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  
  barcodeModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeModalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingTop: 20,
    maxHeight: '80%',
  },
  barcodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  barcodeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  barcodeCloseButton: {
    padding: 4,
  },
  barcodeScanArea: {
    alignItems: 'center',
    padding: 40,
  },
  barcodeScanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  barcodeScanText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  barcodeScanSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    textAlign: 'center',
  },
  barcodeTestSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  testSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  testBarcodesContainer: {
    gap: 8,
  },
  testBarcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  testBarcodeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  testBarcodeCode: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  testBarcodeItem: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  barcodeActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  manualEntryText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondary,
    marginLeft: 8,
  },
});

export default EnhancedPOSScreen;