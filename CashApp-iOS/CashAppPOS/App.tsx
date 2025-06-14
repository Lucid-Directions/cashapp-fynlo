/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
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
} from 'react-native';

// Modern Color Palette - Clean and Professional
const Colors = {
  primary: '#2C3E50',      // Dark Blue-Gray
  secondary: '#3498DB',    // Bright Blue
  accent: '#E74C3C',       // Red for important actions
  success: '#27AE60',      // Green for success
  warning: '#F39C12',      // Orange for warnings
  background: '#F8F9FA',   // Light Gray Background
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  darkGray: '#7F8C8D',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

// Sample menu items (will connect to backend later)
const menuItems = [
  { id: 1, name: 'Classic Burger', price: 12.99, category: 'Main', image: '🍔' },
  { id: 2, name: 'Caesar Salad', price: 9.99, category: 'Salads', image: '🥗' },
  { id: 3, name: 'Margherita Pizza', price: 15.99, category: 'Main', image: '🍕' },
  { id: 4, name: 'Chicken Wings', price: 11.99, category: 'Appetizers', image: '🍗' },
  { id: 5, name: 'Fish & Chips', price: 14.99, category: 'Main', image: '🐟' },
  { id: 6, name: 'Chocolate Cake', price: 6.99, category: 'Desserts', image: '🍰' },
  { id: 7, name: 'Coca Cola', price: 2.99, category: 'Drinks', image: '🥤' },
  { id: 8, name: 'French Fries', price: 4.99, category: 'Sides', image: '🍟' },
];

const categories = ['All', 'Main', 'Appetizers', 'Salads', 'Sides', 'Desserts', 'Drinks'];

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

function App(): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const filteredItems = selectedCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (item: any) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      setCart(cart.map(item => 
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const processPayment = () => {
    Alert.alert(
      'Order Confirmed',
      `Order for ${customerName || 'Customer'} has been processed successfully!`,
      [
        {
          text: 'OK',
          onPress: () => {
            setCart([]);
            setCustomerName('');
            setShowPayment(false);
          }
        }
      ]
    );
  };

  const MenuItemCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.menuCard}
      onPress={() => addToCart(item)}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemImage}>
        <Text style={styles.menuItemEmoji}>{item.image}</Text>
      </View>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const CartItem = ({ item }: { item: OrderItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemLeft}>
        <Text style={styles.cartItemEmoji}>{item.image}</Text>
        <View>
          <Text style={styles.cartItemName}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>${item.price.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.cartItemRight}>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity - 1)}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity + 1)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CashApp POS</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Left Side - Menu */}
        <View style={styles.leftPanel}>
          {/* Category Filter */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
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
            numColumns={2}
            columnWrapperStyle={styles.menuRow}
            contentContainerStyle={styles.menuGrid}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Right Side - Cart */}
        <View style={styles.rightPanel}>
          <Text style={styles.cartTitle}>Current Order</Text>
          
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>🛒</Text>
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
                  <Text style={styles.totalAmount}>${getTotalAmount().toFixed(2)}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.checkoutButton}
                  onPress={() => setShowPayment(true)}
                >
                  <Text style={styles.checkoutButtonText}>Process Payment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={showPayment}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPayment(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <Text style={styles.paymentTitle}>Process Payment</Text>
            
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
                <Text style={styles.summaryTotalText}>Total: ${getTotalAmount().toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.paymentButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowPayment(false)}
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
}

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
  headerTitle: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    color: Colors.white,
    fontSize: 18,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 2,
    padding: 15,
  },
  categoryScroll: {
    marginBottom: 15,
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
    width: '48%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  cartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 60,
    marginBottom: 10,
  },
  emptyCartSubtext: {
    fontSize: 16,
    color: Colors.lightText,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 15,
    color: Colors.text,
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
  },
  checkoutButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
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
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 30,
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

export default App;
