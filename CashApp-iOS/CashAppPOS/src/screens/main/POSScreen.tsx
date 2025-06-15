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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';
import useUIStore from '../../store/useUIStore';
import { MenuItem, OrderItem } from '../../types';
import DatabaseService from '../../services/DatabaseService';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Colors
const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  accent: '#E74C3C',
  success: '#27AE60',
  warning: '#F39C12',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  darkGray: '#7F8C8D',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

// Sample menu items (will be replaced with API data)
const menuItems: MenuItem[] = [
  { id: 1, name: 'Classic Burger', price: 12.99, category: 'Main', emoji: '🍔', available: true },
  { id: 2, name: 'Caesar Salad', price: 9.99, category: 'Salads', emoji: '🥗', available: true },
  { id: 3, name: 'Margherita Pizza', price: 15.99, category: 'Main', emoji: '🍕', available: true },
  { id: 4, name: 'Chicken Wings', price: 11.99, category: 'Appetizers', emoji: '🍗', available: true },
  { id: 5, name: 'Fish & Chips', price: 14.99, category: 'Main', emoji: '🐟', available: true },
  { id: 6, name: 'Chocolate Cake', price: 6.99, category: 'Desserts', emoji: '🍰', available: true },
  { id: 7, name: 'Coca Cola', price: 2.99, category: 'Drinks', emoji: '🥤', available: true },
  { id: 8, name: 'French Fries', price: 4.99, category: 'Sides', emoji: '🍟', available: true },
];

const categories = ['All', 'Main', 'Appetizers', 'Salads', 'Sides', 'Desserts', 'Drinks'];

const POSScreen: React.FC = () => {
  const navigation = useNavigation();
  const [customerName, setCustomerName] = useState('');
  
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
      `Order for ${customerName || 'Customer'} has been processed successfully!`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearCart();
            setCustomerName('');
            setShowPaymentModal(false);
          }
        }
      ]
    );
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={[
        styles.menuCard,
        !item.available && styles.menuCardDisabled,
      ]}
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
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
        {!item.available && (
          <Text style={styles.unavailableText}>Unavailable</Text>
        )}
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
          <Text style={styles.cartItemPrice}>${item.price.toFixed(2)}</Text>
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
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Icon name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Fynlo POS</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="notifications" size={20} color={Colors.white} />
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
            Session: {session.name} • User: {user?.name}
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
                  selectedCategory === category && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive
                ]}>
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
            numColumns={isTablet ? 3 : 2}
            columnWrapperStyle={!isTablet ? styles.menuRow : undefined}
            contentContainerStyle={styles.menuGrid}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Right Side - Cart */}
        <View style={styles.rightPanel}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Current Order</Text>
            {cart.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearCart}
              >
                <Icon name="clear" size={20} color={Colors.accent} />
              </TouchableOpacity>
            )}
          </View>
          
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Icon name="shopping-cart" size={60} color={Colors.lightText} />
              <Text style={styles.emptyCartSubtext}>Add items to start an order</Text>
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
                  <Text style={styles.totalAmount}>${cartTotal().toFixed(2)}</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.checkoutButton}
                  onPress={() => setShowPaymentModal(true)}
                >
                  <Icon name="payment" size={20} color={Colors.white} />
                  <Text style={styles.checkoutButtonText}>Process Payment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

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
                    ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalText}>
                  Total: ${cartTotal().toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.paymentButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
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
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
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
  leftPanel: {
    flex: isTablet ? 2 : 1.5,
    padding: 15,
  },
  categoryScroll: {
    marginBottom: 15,
  },
  categoryScrollContent: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryButtonActive: {
    backgroundColor: Colors.secondary,
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
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    width: isTablet ? '31%' : '48%',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  rightPanel: {
    flex: 1,
    backgroundColor: Colors.white,
    margin: 15,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  clearButton: {
    padding: 8,
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
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
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
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
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
});

export default POSScreen;