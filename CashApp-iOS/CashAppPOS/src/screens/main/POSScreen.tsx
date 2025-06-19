import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';
import useUIStore from '../../store/useUIStore';
import { MenuItem, OrderItem } from '../../types';
import DatabaseService from '../../services/DatabaseService';

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',        // Clover Green header
  secondary: '#ffffff',      // White for contrast
  accent: '#0066CC',         // Clover Blue accent
  success: '#00A651',        // Clover Green for success
  warning: '#FF6B35',        // Orange for warnings
  background: '#F5F5F5',     // Light gray background
  cardBg: '#ffffff',         // White cards
  darkBg: '#2C3E50',         // Dark background
  white: '#FFFFFF',
  lightGray: '#E5E5E5',      // Light gray borders
  mediumGray: '#999999',     // Medium gray text
  darkGray: '#666666',       // Dark gray secondary text
  text: '#333333',           // Dark text
  lightText: '#666666',      // Gray secondary text
  border: '#DDDDDD',         // Light border color
  hover: '#F0F0F0',          // Hover state background
};

// Authentic Mexican Restaurant Menu Items
const menuItems: MenuItem[] = [
  // SNACKS
  { id: 1, name: 'Nachos', price: 5.00, category: 'Snacks', emoji: '🧀', available: true, description: 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander' },
  { id: 2, name: 'Quesadillas', price: 5.50, category: 'Snacks', emoji: '🫓', available: true, description: 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander' },
  { id: 3, name: 'Chorizo Quesadilla', price: 5.50, category: 'Snacks', emoji: '🌶️', available: true, description: 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander' },
  { id: 4, name: 'Chicken Quesadilla', price: 5.50, category: 'Snacks', emoji: '🐔', available: true, description: 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander' },
  { id: 5, name: 'Tostada', price: 6.50, category: 'Snacks', emoji: '🥙', available: true, description: 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta' },

  // TACOS
  { id: 6, name: 'Carnitas', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander' },
  { id: 7, name: 'Cochinita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Marinated pulled pork served with pickle red onion' },
  { id: 8, name: 'Barbacoa de Res', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Juicy pulled beef topped with onion, guacamole & coriander' },
  { id: 9, name: 'Chorizo', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole' },
  { id: 10, name: 'Rellena', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion' },
  { id: 11, name: 'Chicken Fajita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander' },
  { id: 12, name: 'Haggis', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion' },
  { id: 13, name: 'Pescado', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa' },
  { id: 14, name: 'Dorados', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta' },
  { id: 15, name: 'Dorados Papa', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta' },
  { id: 16, name: 'Nopal', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta' },
  { id: 17, name: 'Frijol', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Black beans with fried plantain served with tomato salsa, feta & coriander' },
  { id: 18, name: 'Verde', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta' },
  { id: 19, name: 'Fajita', price: 3.50, category: 'Tacos', emoji: '🌮', available: true, description: 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander' },

  // SPECIAL TACOS
  { id: 20, name: 'Carne Asada', price: 4.50, category: 'Special Tacos', emoji: '⭐', available: true, description: 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander' },
  { id: 21, name: 'Camaron', price: 4.50, category: 'Special Tacos', emoji: '🦐', available: true, description: 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole' },
  { id: 22, name: 'Pulpos', price: 4.50, category: 'Special Tacos', emoji: '🐙', available: true, description: 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander' },

  // BURRITOS
  { id: 23, name: 'Regular Burrito', price: 8.00, category: 'Burritos', emoji: '🌯', available: true, description: 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.' },
  { id: 24, name: 'Special Burrito', price: 10.00, category: 'Burritos', emoji: '🌯', available: true, description: 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.' },
  { id: 25, name: 'Add Mozzarella', price: 1.00, category: 'Burritos', emoji: '🧀', available: true, description: 'Add extra cheese to any burrito' },

  // SIDES & SALSAS
  { id: 26, name: 'Skinny Fries', price: 3.50, category: 'Sides', emoji: '🍟', available: true, description: 'Thin cut fries' },
  { id: 27, name: 'Pico de Gallo', price: 0.00, category: 'Sides', emoji: '🍅', available: true, description: 'Diced tomato, onion and chilli - FREE!' },
  { id: 28, name: 'Green Chili', price: 0.00, category: 'Sides', emoji: '🌶️', available: true, description: 'Homemade green chili salsa - HOT! - FREE!' },
  { id: 29, name: 'Pineapple Habanero', price: 0.00, category: 'Sides', emoji: '🍍', available: true, description: 'Pineapple sauce with habanero chili - HOT! - FREE!' },
  { id: 30, name: 'Scotch Bonnet', price: 0.00, category: 'Sides', emoji: '🔥', available: true, description: 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE!' },

  // DRINKS
  { id: 31, name: 'Pink Paloma', price: 3.75, category: 'Drinks', emoji: '🍹', available: true, description: 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine' },
  { id: 32, name: 'Coco-Nought', price: 3.75, category: 'Drinks', emoji: '🥥', available: true, description: 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!' },
  { id: 33, name: 'Corona', price: 3.80, category: 'Drinks', emoji: '🍺', available: true, description: 'Mexican beer' },
  { id: 34, name: 'Modelo', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml' },
  { id: 35, name: 'Pacifico', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml' },
  { id: 36, name: 'Dos Equis', price: 4.00, category: 'Drinks', emoji: '🍺', available: true, description: '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml' },
];

const categories = ['All', 'Snacks', 'Tacos', 'Special Tacos', 'Burritos', 'Sides', 'Drinks'];

type POSScreenNavigationProp = DrawerNavigationProp<DrawerParamList>;

const POSScreen: React.FC = () => {
  const navigation = useNavigation<POSScreenNavigationProp>();
  const [customerName, setCustomerName] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  
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
    showPaymentModal,
    setShowPaymentModal,
  } = useUIStore();

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const handleAddToCart = (item: MenuItem) => {
    const orderItem: OrderItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      emoji: item.emoji,
    };
    addToCart(orderItem);
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      updateCartItem(id, { quantity });
    }
  };

  const processPayment = () => {
    Alert.alert(
      'Order Confirmed',
      `Order for ${customerName || 'Customer'} has been processed successfully!\nThank you for your business!`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearCart();
            setCustomerName('');
            setShowPaymentModal(false);
            setShowCartModal(false);
          }
        }
      ]
    );
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    
    return (
      <View style={[
        styles.menuCard,
        !item.available && styles.menuCardDisabled,
      ]}>
        <TouchableOpacity
          style={styles.menuCardContent}
          onPress={() => item.available && handleAddToCart(item)}
          activeOpacity={0.7}
          disabled={!item.available}
        >
          <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
          <Text style={styles.menuItemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.menuItemPrice}>
            £{item.price.toFixed(2)}
          </Text>
        </TouchableOpacity>
        
        {/* Quick Quantity Controls */}
        {existingItem && (
          <View style={styles.menuItemQuantityControls}>
            <TouchableOpacity
              style={styles.menuQuantityButton}
              onPress={() => handleUpdateQuantity(item.id, existingItem.quantity - 1)}
            >
              <Icon name="remove" size={16} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.menuQuantityText}>{existingItem.quantity}</Text>
            <TouchableOpacity
              style={styles.menuQuantityButton}
              onPress={() => handleUpdateQuantity(item.id, existingItem.quantity + 1)}
            >
              <Icon name="add" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const CartItem = ({ item }: { item: OrderItem }) => {
    const menuItem = menuItems.find(mi => mi.id === item.id);
    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemInfo}>
          <View style={styles.cartItemHeader}>
            <Text style={styles.cartItemEmoji}>{item.emoji}</Text>
            <View style={styles.cartItemDetails}>
              <Text style={styles.cartItemName}>{item.name}</Text>
              <Text style={styles.cartItemPrice}>£{item.price.toFixed(2)} each</Text>
            </View>
          </View>
          {menuItem?.description && (
            <Text style={styles.cartItemDescription} numberOfLines={2}>
              {menuItem.description}
            </Text>
          )}
        </View>
        <View style={styles.cartItemActions}>
          <View style={styles.cartItemQuantity}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Icon name="remove" size={16} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
            >
              <Icon name="add" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.cartItemTotal}>
            £{(item.price * item.quantity).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Fynlo Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/fynlo-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        </View>
        
        <View style={styles.headerCenter}>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Icon name="search" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => setShowCartModal(true)}
          >
            <Icon name="shopping-cart" size={24} color={Colors.white} />
            {cartItemCount() > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Full Width Menu */}
        <View style={styles.fullWidthPanel}>
          {/* Quick Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{cartItemCount()}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>£{cartTotal().toFixed(2)}</Text>
              <Text style={styles.statLabel}>Subtotal</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>#{Math.floor(Math.random() * 1000).toString().padStart(3, '0')}</Text>
              <Text style={styles.statLabel}>Order</Text>
            </View>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryTab,
                  selectedCategory === category && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive,
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Menu Grid */}
          <FlatList
            data={filteredItems}
            renderItem={({ item }) => <MenuItemCard item={item} />}
            keyExtractor={(item) => item.id.toString()}
            numColumns={isTablet ? 4 : 3}
            columnWrapperStyle={styles.menuRow}
            contentContainerStyle={styles.menuGrid}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>

      {/* Cart Modal */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartModalHeader}>
              <View style={styles.cartTitleSection}>
                <Text style={styles.cartTitle}>Current Order</Text>
                <Text style={styles.cartSubtitle}>
                  Order #{Math.floor(Math.random() * 1000).toString().padStart(3, '0')} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
              <View style={styles.cartModalButtons}>
                {cart.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearCart}
                  >
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowCartModal(false)}
                >
                  <Icon name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Icon name="shopping-cart" size={64} color={Colors.lightGray} />
                <Text style={styles.emptyCartText}>Cart is empty</Text>
                <Text style={styles.emptyCartSubtext}>Add items to get started</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.cartList}>
                  {cart.map((item) => (
                    <CartItem key={item.id} item={item} />
                  ))}
                </ScrollView>
                
                <View style={styles.cartFooter}>
                  <View style={styles.cartSummary}>
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>Order Summary</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Items ({cartItemCount()})</Text>
                        <Text style={styles.summaryValue}>£{cartTotal().toFixed(2)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>Taxes & Fees</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>VAT (20%)</Text>
                        <Text style={styles.summaryValue}>£{(cartTotal() * 0.2).toFixed(2)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Service Fee</Text>
                        <Text style={styles.summaryValue}>£0.00</Text>
                      </View>
                    </View>
                    
                    <View style={[styles.summaryRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalAmount}>£{(cartTotal() * 1.2).toFixed(2)}</Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.chargeButton}
                    onPress={() => {
                      setShowCartModal(false);
                      setShowPaymentModal(true);
                    }}
                  >
                    <Text style={styles.chargeButtonText}>
                      Charge £{(cartTotal() * 1.2).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TextInput
                style={styles.input}
                placeholder="Customer name (optional)"
                value={customerName}
                onChangeText={setCustomerName}
                placeholderTextColor={Colors.darkGray}
              />
              
              {/* Order Summary */}
              <View style={styles.orderSummary}>
                <Text style={styles.orderSummaryTitle}>Order Summary</Text>
                {cart.map((item) => {
                  const menuItem = menuItems.find(mi => mi.id === item.id);
                  return (
                    <View key={item.id} style={styles.orderSummaryItem}>
                      <View style={styles.orderSummaryItemHeader}>
                        <Text style={styles.orderSummaryEmoji}>{item.emoji}</Text>
                        <Text style={styles.orderSummaryItemName}>{item.name}</Text>
                        <Text style={styles.orderSummaryQuantity}>x{item.quantity}</Text>
                        <Text style={styles.orderSummaryPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>
                      </View>
                      {menuItem?.description && (
                        <Text style={styles.orderSummaryDescription} numberOfLines={1}>
                          {menuItem.description}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              
              <View style={styles.paymentMethodsSection}>
                <Text style={styles.paymentMethodsTitle}>Payment Method</Text>
                <View style={styles.paymentMethods}>
                  <TouchableOpacity style={[styles.paymentMethod, styles.paymentMethodSelected]}>
                    <Icon name="credit-card" size={24} color={Colors.accent} />
                    <Text style={styles.paymentMethodText}>Card</Text>
                    <Text style={styles.paymentMethodSubtext}>Tap, chip & PIN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentMethod}>
                    <Icon name="attach-money" size={24} color={Colors.success} />
                    <Text style={styles.paymentMethodText}>Cash</Text>
                    <Text style={styles.paymentMethodSubtext}>Exact change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentMethod}>
                    <Icon name="phone-iphone" size={24} color={Colors.accent} />
                    <Text style={styles.paymentMethodText}>Mobile</Text>
                    <Text style={styles.paymentMethodSubtext}>Apple Pay, Google Pay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paymentMethod}>
                    <Icon name="card-giftcard" size={24} color={Colors.warning} />
                    <Text style={styles.paymentMethodText}>Gift Card</Text>
                    <Text style={styles.paymentMethodSubtext}>Store credit</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.modalTotal}>
                <Text style={styles.modalTotalLabel}>Total to Pay</Text>
                <Text style={styles.modalTotalAmount}>
                  £{(cartTotal() * 1.2).toFixed(2)}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={processPayment}
              >
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  logoOrange: {
    color: '#FF6B35',
  },
  posSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  cloverLogo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
    marginRight: 12,
  },
  headerButton: {
    marginLeft: 20,
    padding: 4,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginLeft: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 125,
    height: 125,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  logoOrange: {
    color: Colors.warning,
  },
  cartButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.warning,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  fullWidthPanel: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 2,
  },
  fullPanel: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  categoryTabs: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryTabsContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  categoryTab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 25,
    backgroundColor: Colors.background,
    minHeight: 40,
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: Colors.accent,
  },
  categoryTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  categoryTabTextActive: {
    color: Colors.white,
  },
  menuGrid: {
    padding: 16,
    paddingBottom: 120,
  },
  menuRow: {
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  menuCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
    margin: 6,
    flex: 1,
    minHeight: 140,
    width: (screenWidth - 80) / 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  menuCardDisabled: {
    opacity: 0.6,
  },
  menuCardContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  menuItemEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
    minHeight: 32,
    flexWrap: 'wrap',
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 166, 81, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  menuItemQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: Colors.accent,
    borderRadius: 15,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  menuQuantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuQuantityText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartTitleSection: {
    flex: 1,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  cartSubtitle: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyCartText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
    textAlign: 'center',
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartItemInfo: {
    flex: 1,
    marginBottom: 12,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartItemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  cartItemDescription: {
    fontSize: 12,
    color: Colors.lightText,
    lineHeight: 16,
    marginLeft: 36,
  },
  cartItemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginHorizontal: 12,
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
    padding: 20,
  },
  cartSummary: {
    marginBottom: 20,
  },
  summarySection: {
    marginBottom: 16,
  },
  summarySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
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
    color: Colors.text,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  chargeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  chargeButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartModalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentModal: {
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
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
  },
  orderSummary: {
    marginBottom: 20,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
  },
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  orderSummaryItem: {
    marginBottom: 12,
  },
  orderSummaryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderSummaryEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  orderSummaryItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  orderSummaryQuantity: {
    fontSize: 14,
    color: Colors.darkGray,
    marginRight: 12,
  },
  orderSummaryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  orderSummaryDescription: {
    fontSize: 12,
    color: Colors.lightText,
    marginLeft: 24,
    fontStyle: 'italic',
  },
  paymentMethodsSection: {
    marginBottom: 30,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  paymentMethod: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    width: '48%',
    marginBottom: 12,
  },
  paymentMethodSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(76, 110, 245, 0.05)',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
  },
  paymentMethodSubtext: {
    fontSize: 11,
    color: Colors.darkGray,
    marginTop: 2,
    textAlign: 'center',
  },
  modalTotal: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTotalLabel: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  modalTotalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  confirmButton: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default POSScreen;