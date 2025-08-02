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

import { useNavigation, DrawerActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DatabaseService from '../../services/DatabaseService';
import useAppStore from '../../store/useAppStore';
import useUIStore from '../../store/useUIStore';

import type { MenuItem, OrderItem, DrawerParamList } from '../../types';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { logger } from '../../utils/logger';
// import Logo from '../../components/Logo';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Modern POS Color Scheme (matching screenshots)
const Colors = {
  primary: '#1a1f36', // Dark navy background
  secondary: '#ffffff', // White for contrast
  accent: '#4c6ef5', // Bright blue accent
  success: '#37d67a', // Green for success
  warning: '#f47068', // Red/coral for warnings
  background: '#f0f3f7', // Light gray background
  cardBg: '#ffffff', // White cards
  darkBg: '#0f1419', // Very dark background
  white: '#FFFFFF',
  lightGray: '#e1e8ed', // Light gray borders
  mediumGray: '#8899a6', // Medium gray text
  darkGray: '#657786', // Dark gray secondary text
  text: '#14171a', // Almost black text
  lightText: '#657786', // Gray secondary text
  border: '#e1e8ed', // Light border color
  hover: '#f7f9fa', // Hover state background
};

// Authentic Mexican Restaurant Menu Items
const menuItems: MenuItem[] = [
  // SNACKS
  {
    id: 1,
    name: 'Nachos',
    price: 5.0,
    category: 'Snacks',
    emoji: '🧀',
    available: true,
    description:
      'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander',
  },
  {
    id: 2,
    name: 'Quesadillas',
    price: 5.5,
    category: 'Snacks',
    emoji: '🫓',
    available: true,
    description:
      'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander',
  },
  {
    id: 3,
    name: 'Chorizo Quesadilla',
    price: 5.5,
    category: 'Snacks',
    emoji: '🌶️',
    available: true,
    description:
      'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander',
  },
  {
    id: 4,
    name: 'Chicken Quesadilla',
    price: 5.5,
    category: 'Snacks',
    emoji: '🐔',
    available: true,
    description:
      'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander',
  },
  {
    id: 5,
    name: 'Tostada',
    price: 6.5,
    category: 'Snacks',
    emoji: '🥙',
    available: true,
    description:
      'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta',
  },

  // TACOS
  {
    id: 6,
    name: 'Carnitas',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander',
  },
  {
    id: 7,
    name: 'Cochinita',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Marinated pulled pork served with pickle red onion',
  },
  {
    id: 8,
    name: 'Barbacoa de Res',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Juicy pulled beef topped with onion, guacamole & coriander',
  },
  {
    id: 9,
    name: 'Chorizo',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole',
  },
  {
    id: 10,
    name: 'Rellena',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description:
      'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion',
  },
  {
    id: 11,
    name: 'Chicken Fajita',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander',
  },
  {
    id: 12,
    name: 'Haggis',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion',
  },
  {
    id: 13,
    name: 'Pescado',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description:
      'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa',
  },
  {
    id: 14,
    name: 'Dorados',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta',
  },
  {
    id: 15,
    name: 'Dorados Papa',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta',
  },
  {
    id: 16,
    name: 'Nopal',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta',
  },
  {
    id: 17,
    name: 'Frijol',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Black beans with fried plantain served with tomato salsa, feta & coriander',
  },
  {
    id: 18,
    name: 'Verde',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description:
      'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta',
  },
  {
    id: 19,
    name: 'Fajita',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander',
  },

  // SPECIAL TACOS
  {
    id: 20,
    name: 'Carne Asada',
    price: 4.5,
    category: 'Special Tacos',
    emoji: '⭐',
    available: true,
    description:
      'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander',
  },
  {
    id: 21,
    name: 'Camaron',
    price: 4.5,
    category: 'Special Tacos',
    emoji: '🦐',
    available: true,
    description:
      'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole',
  },
  {
    id: 22,
    name: 'Pulpos',
    price: 4.5,
    category: 'Special Tacos',
    emoji: '🐙',
    available: true,
    description:
      'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander',
  },

  // BURRITOS
  {
    id: 23,
    name: 'Regular Burrito',
    price: 8.0,
    category: 'Burritos',
    emoji: '🌯',
    available: true,
    description:
      'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.',
  },
  {
    id: 24,
    name: 'Special Burrito',
    price: 10.0,
    category: 'Burritos',
    emoji: '🌯',
    available: true,
    description:
      'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.',
  },
  {
    id: 25,
    name: 'Add Mozzarella',
    price: 1.0,
    category: 'Burritos',
    emoji: '🧀',
    available: true,
    description: 'Add extra cheese to any burrito',
  },

  // SIDES & SALSAS
  {
    id: 26,
    name: 'Skinny Fries',
    price: 3.5,
    category: 'Sides',
    emoji: '🍟',
    available: true,
    description: 'Thin cut fries',
  },
  {
    id: 27,
    name: 'Pico de Gallo',
    price: 0.0,
    category: 'Sides',
    emoji: '🍅',
    available: true,
    description: 'Diced tomato, onion and chilli - FREE!',
  },
  {
    id: 28,
    name: 'Green Chili',
    price: 0.0,
    category: 'Sides',
    emoji: '🌶️',
    available: true,
    description: 'Homemade green chili salsa - HOT! - FREE!',
  },
  {
    id: 29,
    name: 'Pineapple Habanero',
    price: 0.0,
    category: 'Sides',
    emoji: '🍍',
    available: true,
    description: 'Pineapple sauce with habanero chili - HOT! - FREE!',
  },
  {
    id: 30,
    name: 'Scotch Bonnet',
    price: 0.0,
    category: 'Sides',
    emoji: '🔥',
    available: true,
    description: 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE!',
  },

  // DRINKS
  {
    id: 31,
    name: 'Pink Paloma',
    price: 3.75,
    category: 'Drinks',
    emoji: '🍹',
    available: true,
    description:
      'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine',
  },
  {
    id: 32,
    name: 'Coco-Nought',
    price: 3.75,
    category: 'Drinks',
    emoji: '🥥',
    available: true,
    description:
      'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!',
  },
  {
    id: 33,
    name: 'Corona',
    price: 3.8,
    category: 'Drinks',
    emoji: '🍺',
    available: true,
    description: 'Mexican beer',
  },
  {
    id: 34,
    name: 'Modelo',
    price: 4.0,
    category: 'Drinks',
    emoji: '🍺',
    available: true,
    description: 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml',
  },
  {
    id: 35,
    name: 'Pacifico',
    price: 4.0,
    category: 'Drinks',
    emoji: '🍺',
    available: true,
    description: 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml',
  },
  {
    id: 36,
    name: 'Dos Equis',
    price: 4.0,
    category: 'Drinks',
    emoji: '🍺',
    available: true,
    description: '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml',
  },
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
    user,
    session,
  } = useAppStore();

  const { selectedCategory, setSelectedCategory, showPaymentModal, setShowPaymentModal } =
    useUIStore();

  const filteredItems =
    selectedCategory === 'All'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

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
      `Order for ${
        customerName || 'Customer'
      } has been processed successfully!\nThank you for your business!`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearCart();
            setCustomerName('');
            setShowPaymentModal(false);
            setShowCartModal(false);
          },
        },
      ]
    );
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={[styles.menuCard, !item.available && styles.menuCardDisabled]}
      onPress={() => item.available && handleAddToCart(item)}
      activeOpacity={0.7}
      disabled={!item.available}
    >
      <View style={styles.menuItemImage}>
        <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.menuItemPrice}>
          {item.price === 0 ? 'FREE' : `£${item.price.toFixed(2)}`}
        </Text>
        {!item.available && <Text style={styles.unavailableText}>Unavailable</Text>}
      </View>
    </TouchableOpacity>
  );

  const CartItem = ({ item }: { item: OrderItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemLeft}>
        <Text style={styles.cartItemEmoji}>{item.emoji}</Text>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cartItemPrice}>£{item.price.toFixed(2)} each</Text>
        </View>
      </View>
      <View style={styles.cartItemRight}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
        >
          <Icon name="remove" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
        >
          <Icon name="add" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Icon name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Fynlo POS System</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              Alert.alert(
                'Table Selection',
                'Select order type: Dine In, Takeout, Pickup, or Delivery',
                [
                  { text: 'Dine In', onPress: () => logger.info('Dine In selected') },
                  { text: 'Takeout', onPress: () => logger.info('Takeout selected') },
                  { text: 'Pickup', onPress: () => logger.info('Pickup selected') },
                  { text: 'Delivery', onPress: () => logger.info('Delivery selected') },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Icon name="restaurant" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="notifications" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.cartButton]}
            onPress={() => setShowCartModal(true)}
          >
            <Icon name="shopping-cart" size={20} color={Colors.white} />
            {cartItemCount() > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="person" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Session Info */}
      {session && (
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionText}>
            Session: {session.id || 'Active'} • User: {user?.name || 'Demo User'}
          </Text>
        </View>
      )}

      <View style={styles.mainContent}>
        {/* Left Side - Menu */}
        <View style={styles.leftPanel}>
          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Menu Items Grid */}
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

        {/* Right Side - Cart */}
        <View style={styles.rightPanel}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Current Order</Text>
            {cart.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={clearCart}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Icon name="shopping-cart" size={48} color={Colors.lightGray} />
              <Text style={styles.emptyCartText}>Cart is empty</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.cartList}>
                {cart.map((item) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </ScrollView>

              <View style={styles.cartFooter}>
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>£{cartTotal().toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.checkoutButton}
                  onPress={() => setShowPaymentModal(true)}
                >
                  <Text style={styles.checkoutButtonText}>Charge £{cartTotal().toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
            <View style={styles.modalHeader}>
              <Text style={styles.cartTitle}>Current Order</Text>
              <View style={styles.modalHeaderButtons}>
                {cart.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearCart}>
                    <Icon name="clear" size={20} color={Colors.accent} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCartModal(false)}
                >
                  <Icon name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Icon name="shopping-cart" size={60} color={Colors.lightText} />
                <Text style={styles.emptyCartSubtext}>Add items to start your order</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.cartList}>
                  {cart.map((item) => (
                    <CartItem key={item.id} item={item} />
                  ))}
                </ScrollView>

                <View style={styles.cartFooter}>
                  <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>£{cartTotal().toFixed(2)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.checkoutButton}
                    onPress={() => {
                      setShowCartModal(false);
                      setShowPaymentModal(true);
                    }}
                  >
                    <Icon name="payment" size={20} color={Colors.white} />
                    <Text style={styles.checkoutButtonText}>Process Payment</Text>
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
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.paymentTitle}>Process Payment</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentSection}>
              <Text style={styles.paymentLabel}>Customer Name (Optional)</Text>
              <TextInput
                style={styles.paymentInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor={Colors.lightText}
              />
            </View>

            <View style={styles.paymentSummary}>
              <Text style={styles.paymentSummaryTitle}>Order Summary</Text>
              {cart.map((item) => (
                <View key={item.id} style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>
                    {item.name} x{item.quantity}
                  </Text>
                  <Text style={styles.summaryItemPrice}>
                    £{(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalText}>Total: £{cartTotal().toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.paymentButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={processPayment}>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  cartButton: {
    position: 'relative',
  },
  sessionInfo: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sessionText: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  fullPanel: {
    flex: 1,
    padding: 15,
  },
  categoryScroll: {
    marginBottom: 15,
  },
  categoryScrollContent: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: Colors.cream,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 30,
    marginRight: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: Colors.terracotta,
  },
  categoryButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.gold,
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  categoryButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: Colors.white,
  },
  menuGrid: {
    paddingBottom: 20,
  },
  menuRow: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  menuCard: {
    backgroundColor: Colors.cream,
    borderRadius: 16,
    padding: 18,
    width: isTablet ? '31%' : '48%',
    marginBottom: 15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: Colors.terracotta,
    borderTopWidth: 3,
    borderTopColor: Colors.secondary,
  },
  menuCardDisabled: {
    opacity: 0.5,
  },
  menuItemImage: {
    alignItems: 'center',
    marginBottom: 10,
  },
  menuItemEmoji: {
    fontSize: 40,
  },
  menuItemInfo: {
    alignItems: 'center',
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 5,
  },
  menuItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  unavailableText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 4,
  },
  cartModal: {
    backgroundColor: Colors.cream,
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 520,
    maxHeight: '80%',
    borderWidth: 3,
    borderColor: Colors.terracotta,
    borderTopWidth: 6,
    borderTopColor: Colors.primary,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  cartTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 8,
  },
  closeButton: {
    padding: 4,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartSubtext: {
    fontSize: 16,
    color: Colors.lightText,
    marginTop: 10,
  },
  cartList: {
    flex: 1,
    padding: 20,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  cartItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartItemEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  cartItemPrice: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  cartItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: Colors.lightGray,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 15,
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  cartFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  checkoutButton: {
    backgroundColor: Colors.success,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  checkoutButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModal: {
    backgroundColor: Colors.cream,
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 520,
    maxHeight: '80%',
    borderWidth: 3,
    borderColor: Colors.terracotta,
    borderTopWidth: 6,
    borderTopColor: Colors.primary,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  paymentSection: {
    marginBottom: 30,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  paymentInput: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
  },
  paymentSummary: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  paymentSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryItemText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 15,
    marginTop: 15,
  },
  summaryTotalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
  },
  paymentButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: Colors.lightGray,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.success,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    flex: 1,
    marginLeft: 10,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cartBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 8,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoContainer: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  logoText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default POSScreen;
