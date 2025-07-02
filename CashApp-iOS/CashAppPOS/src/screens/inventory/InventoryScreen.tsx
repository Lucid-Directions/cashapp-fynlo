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
  TextInput,
  Modal,
  Alert,
  ActivityIndicator, // Will be replaced by LoadingView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
// import { generateInventory, InventoryData } from '../../utils/mockDataGenerator'; // Removed
import DataService from '../../services/DataService'; // Added
import * as InventoryApiService from '../../services/InventoryApiService'; // Added
import { InventoryData, ReceiptItem as ScannedReceiptItem } from '../../types'; // Updated import path, added ReceiptItem
import LoadingView from '../../components/feedback/LoadingView'; // Added
import ComingSoon from '../../components/feedback/ComingSoon'; // Added
import ReceiptScanModal from '../../components/modals/ReceiptScanModal'; // Added

// Mock ENV flag (would typically come from an env config file)
const ENV = {
  FEATURE_INVENTORY: true, // Set to true to enable the screen, false to show ComingSoon
};

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',      // Clover Green
  secondary: '#0066CC',    // Clover Blue
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

const InventoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const [inventory, setInventory] = useState<InventoryData[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState<InventoryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiptScanModal, setShowReceiptScanModal] = useState(false); // Added
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    currentStock: '',
    minimumStock: '',
    maximumStock: '',
    unitCost: '',
    supplier: '',
  });

  useEffect(() => {
    if (ENV.FEATURE_INVENTORY) {
      loadInventory();
    } else {
      setIsLoading(false); // Not loading if feature is off
    }
  }, []);

  useEffect(() => {
    if (ENV.FEATURE_INVENTORY && !isLoading && !error) {
      filterInventory();
    } else {
      setFilteredInventory([]);
    }
  }, [inventory, searchQuery, selectedCategory, selectedStatus, isLoading, error]);

  const loadInventory = async () => { // Modified
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming a getInventory method will be added to DataService
      const inventoryData = await dataService.getInventory();
      setInventory(inventoryData || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load inventory.');
      setInventory([]); // Clear inventory on error
    } finally {
      setIsLoading(false);
    }
  };

  const filterInventory = () => {
    let filtered = inventory;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      switch (selectedStatus) {
        case 'low':
          filtered = filtered.filter(item => item.currentStock <= item.minimumStock);
          break;
        case 'out':
          filtered = filtered.filter(item => item.currentStock === 0);
          break;
        case 'overstocked':
          filtered = filtered.filter(item => item.currentStock > item.maximumStock);
          break;
        case 'optimal':
          filtered = filtered.filter(item => 
            item.currentStock > item.minimumStock && item.currentStock <= item.maximumStock
          );
          break;
      }
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredInventory(filtered);
  };

  const handleQRScan = () => {
    // This function will be updated later to open the new ReceiptScanModal.
    // For now, let's update the alert text as per UI-1.
    // Now opens the new modal directly for scanning receipts.
    // Barcode scanning can be a separate option or integrated into ReceiptScanModal if needed.
    setShowReceiptScanModal(true);
  };

  const handleReceiptSubmit = async (items: ScannedReceiptItem[]) => {
    console.log('Receipt items submitted to InventoryScreen:', items);
    // Here, you would typically call an API service to process these items.
    // For example, update inventory based on these items.
    // This is a placeholder for the actual logic (INT-1).

    // Example: Add to current inventory (very simplified)
    // This is NOT production logic, just for demonstration.
    // Actual logic will involve matching by SKU, creating new items, etc. via backend.

    // Simulating a delay for processing
    // await new Promise(resolve => setTimeout(resolve, 500));

    let successCount = 0;
    let errorCount = 0;
    const newItemsToCreate = [];

    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        console.warn(`Invalid quantity for item ${item.name}, skipping.`);
        errorCount++;
        continue;
      }

      if (item.sku) { // SKU matched by backend
        try {
          // Assuming item.quantity is the change in quantity.
          // The backend's adjustStock takes change_qty_g.
          // This assumes the 'quantity' from receipt is the amount to add.
          // And for now, we pass it directly as change_qty_g, hoping backend handles units or it's a general field.
          await InventoryApiService.adjustStock(item.sku, quantity, 'receipt_scan_import');
          console.log(`Stock adjusted for SKU ${item.sku} by ${quantity}`);
          successCount++;
        } catch (apiError) {
          console.error(`Failed to adjust stock for SKU ${item.sku}:`, apiError);
          Alert.alert('API Error', `Could not adjust stock for ${item.name} (SKU: ${item.sku}).`);
          errorCount++;
        }
      } else {
        // No SKU match, pre-populate New Item form (placeholder)
        console.log(`Item "${item.name}" (Qty: ${quantity}, Price: ${item.price}) has no SKU. Would pre-populate new item form.`);
        // In a real app, you'd navigate to a "Create New Item" screen/modal here,
        // passing item.name, item.quantity, item.price etc.
        // e.g., navigation.navigate('CreateItemScreen', { initialData: item });
        newItemsToCreate.push(item);
      }
    }

    // Potentially refresh inventory list after submission
    loadInventory();
    setShowReceiptScanModal(false); // Close modal after submission

    let summaryMessage = `${successCount} item(s) processed successfully.`;
    if (errorCount > 0) {
      summaryMessage += ` ${errorCount} item(s) had errors.`;
    }
    if (newItemsToCreate.length > 0) {
      summaryMessage += ` ${newItemsToCreate.length} item(s) need to be created.`;
      // Optionally, trigger the first new item creation flow here
      // if (newItemsToCreate.length > 0) {
      //   Alert.alert("New Items", `You have ${newItemsToCreate.length} new items to create. Starting with "${newItemsToCreate[0].name}".`);
      //   // Pseudocode: openCreateItemModal(newItemsToCreate[0]);
      // }
    }
    Alert.alert('Processing Complete', summaryMessage);
  };

  const getStockStatus = (item: InventoryData) => {
    if (item.currentStock === 0) return { status: 'Out of Stock', color: Colors.danger };
    if (item.currentStock <= item.minimumStock) return { status: 'Low Stock', color: Colors.warning };
    if (item.currentStock > item.maximumStock) return { status: 'Overstocked', color: Colors.secondary };
    return { status: 'In Stock', color: Colors.success };
  };

  const getStockPercentage = (item: InventoryData) => {
    return Math.min((item.currentStock / item.maximumStock) * 100, 100);
  };

  const formatLastRestocked = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const handleRestock = (item: InventoryData) => {
    setSelectedItem(item);
    setShowRestockModal(true);
  };

  const handleEditItem = (item: InventoryData | null) => {
    if (item) {
      setEditFormData({
        name: item.name,
        category: item.category,
        currentStock: item.currentStock.toString(),
        minimumStock: item.minimumStock.toString(),
        maximumStock: item.maximumStock.toString(),
        unitCost: item.unitCost.toFixed(2),
        supplier: item.supplier,
      });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedItem) return;

    // Validate input
    const currentStock = parseInt(editFormData.currentStock);
    const minimumStock = parseInt(editFormData.minimumStock);
    const maximumStock = parseInt(editFormData.maximumStock);
    const unitCost = parseFloat(editFormData.unitCost);

    if (isNaN(currentStock) || isNaN(minimumStock) || isNaN(maximumStock) || isNaN(unitCost)) {
      Alert.alert('Error', 'Please enter valid numbers for stock and cost fields.');
      return;
    }

    if (minimumStock >= maximumStock) {
      Alert.alert('Error', 'Maximum stock must be greater than minimum stock.');
      return;
    }

    if (!editFormData.name.trim() || !editFormData.supplier.trim()) {
      Alert.alert('Error', 'Please enter valid name and supplier.');
      return;
    }

    // Update the inventory item
    const updatedInventory = inventory.map(item => 
      item.itemId === selectedItem.itemId
        ? {
            ...item,
            name: editFormData.name.trim(),
            category: editFormData.category,
            currentStock,
            minimumStock,
            maximumStock,
            unitCost,
            supplier: editFormData.supplier.trim(),
          }
        : item
    );

    setInventory(updatedInventory);
    setShowEditModal(false);
    setSelectedItem(null);
    
    Alert.alert('Success', 'Inventory item updated successfully!');
  };

  const renderInventoryItem = ({ item }: { item: InventoryData }) => {
    const stockStatus = getStockStatus(item);
    const stockPercentage = getStockPercentage(item);
    
    return (
      <TouchableOpacity 
        style={styles.inventoryCard}
        onPress={() => setSelectedItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <Text style={styles.itemSupplier}>by {item.supplier}</Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity 
              style={styles.restockButton}
              onPress={() => handleRestock(item)}
            >
              <Icon name="add" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stockInfo}>
          <View style={styles.stockLevel}>
            <View style={styles.stockBar}>
              <View 
                style={[
                  styles.stockProgress, 
                  { 
                    width: `${stockPercentage}%`,
                    backgroundColor: stockStatus.color 
                  }
                ]} 
              />
            </View>
            <Text style={styles.stockText}>
              {item.currentStock} / {item.maximumStock} units
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${stockStatus.color}20` }]}>
            <Text style={[styles.statusText, { color: stockStatus.color }]}>
              {stockStatus.status}
            </Text>
          </View>
        </View>

        <View style={styles.itemMetrics}>
          <View style={styles.metric}>
            <Icon name="attach-money" size={16} color={Colors.darkGray} />
            <Text style={styles.metricText}>£{item.unitCost.toFixed(2)}</Text>
          </View>
          <View style={styles.metric}>
            <Icon name="trending-up" size={16} color={Colors.darkGray} />
            <Text style={styles.metricText}>{item.turnoverRate}x/week</Text>
          </View>
          <View style={styles.metric}>
            <Icon name="schedule" size={16} color={Colors.darkGray} />
            <Text style={styles.metricText}>{formatLastRestocked(item.lastRestocked)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const categories = ['Vegetables', 'Meat', 'Dairy', 'Pantry', 'Spices', 'Beverages'];
  const stats = {
    total: inventory.length,
    lowStock: inventory.filter(item => item.currentStock <= item.minimumStock).length,
    outOfStock: inventory.filter(item => item.currentStock === 0).length,
    totalValue: inventory.length > 0 ? inventory.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0) : 0,
  };

  if (!ENV.FEATURE_INVENTORY) {
    return <ComingSoon />;
  }

  if (isLoading) {
    return <LoadingView message="Loading Inventory..." />;
  }

  const renderEmptyListComponent = () => {
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.emptyStateText}>Error Loading Inventory</Text>
          <Text style={styles.emptyStateSubtext}>{error}</Text>
          <TouchableOpacity onPress={loadInventory} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="inventory" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyStateText}>No items found</Text>
        <Text style={styles.emptyStateSubtext}>
          {searchQuery ? 'Try adjusting your search' : 'Add your first inventory item or pull to refresh'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSubtitle}>{filteredInventory.length} items</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={handleQRScan}
          // TODO: Add a proper tooltip component if available, or implement one.
          // For now, relying on the text itself or accessibilityLabel if set.
          accessibilityLabel="Scan Receipt or Barcode"
        >
          <Icon name="camera" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>{stats.lowStock}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.danger }]}>{stats.outOfStock}</Text>
          <Text style={styles.statLabel}>Out of Stock</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.secondary }]}>
            £{stats.totalValue.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.darkGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.darkGray}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterSection}
        >
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Category:</Text>
            {['all', ...categories].map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterButton,
                  selectedCategory === category && styles.filterButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedCategory === category && styles.filterButtonTextActive
                ]}>
                  {category === 'all' ? 'All' : category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterSection}
        >
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Status:</Text>
            {[
              { key: 'all', label: 'All' },
              { key: 'low', label: 'Low Stock' },
              { key: 'out', label: 'Out of Stock' },
              { key: 'optimal', label: 'In Stock' },
            ].map(status => (
              <TouchableOpacity
                key={status.key}
                style={[
                  styles.filterButton,
                  selectedStatus === status.key && styles.filterButtonActive
                ]}
                onPress={() => setSelectedStatus(status.key)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedStatus === status.key && styles.filterButtonTextActive
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        renderItem={renderInventoryItem}
        keyExtractor={item => item.itemId.toString()}
        contentContainerStyle={styles.inventoryList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyListComponent}
        onRefresh={loadInventory} // Added
        refreshing={isLoading} // Added
      />

      {/* Item Detail Modal */}
      <Modal
        visible={!!selectedItem && !showRestockModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.itemModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Item Details</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.itemProfile}>
                  <Text style={styles.profileItemName}>{selectedItem.name}</Text>
                  <Text style={styles.profileCategory}>{selectedItem.category}</Text>
                  <View style={[styles.profileStatus, { backgroundColor: `${getStockStatus(selectedItem).color}20` }]}>
                    <Text style={[styles.profileStatusText, { color: getStockStatus(selectedItem).color }]}>
                      {getStockStatus(selectedItem).status}
                    </Text>
                  </View>
                </View>

                <View style={styles.stockDetails}>
                  <Text style={styles.sectionTitle}>Stock Levels</Text>
                  <View style={styles.stockGrid}>
                    <View style={styles.stockCard}>
                      <Text style={styles.stockCardValue}>{selectedItem.currentStock}</Text>
                      <Text style={styles.stockCardLabel}>Current Stock</Text>
                    </View>
                    <View style={styles.stockCard}>
                      <Text style={styles.stockCardValue}>{selectedItem.minimumStock}</Text>
                      <Text style={styles.stockCardLabel}>Minimum</Text>
                    </View>
                    <View style={styles.stockCard}>
                      <Text style={styles.stockCardValue}>{selectedItem.maximumStock}</Text>
                      <Text style={styles.stockCardLabel}>Maximum</Text>
                    </View>
                    <View style={styles.stockCard}>
                      <Text style={styles.stockCardValue}>{selectedItem.turnoverRate}</Text>
                      <Text style={styles.stockCardLabel}>Turnover/Week</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.supplierDetails}>
                  <Text style={styles.sectionTitle}>Supplier Information</Text>
                  <View style={styles.detailRow}>
                    <Icon name="business" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>{selectedItem.supplier}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="attach-money" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>£{selectedItem.unitCost.toFixed(2)} per unit</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="schedule" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>
                      Last restocked {formatLastRestocked(selectedItem.lastRestocked)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.restockActionButton]}
                    onPress={() => handleRestock(selectedItem)}
                  >
                    <Icon name="add" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Restock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.editActionButton]}
                    onPress={() => handleEditItem(selectedItem)}
                  >
                    <Icon name="edit" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Restock Modal */}
      <Modal
        visible={showRestockModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRestockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.restockModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Restock Item</Text>
              <TouchableOpacity onPress={() => setShowRestockModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={styles.restockContent}>
                <Text style={styles.restockItemName}>{selectedItem.name}</Text>
                <Text style={styles.restockCurrentStock}>
                  Current Stock: {selectedItem.currentStock} units
                </Text>
                
                <View style={styles.restockInputSection}>
                  <Text style={styles.inputLabel}>Quantity to Add</Text>
                  <TextInput
                    style={styles.quantityInput}
                    placeholder="Enter quantity"
                    keyboardType="numeric"
                    defaultValue={(selectedItem.maximumStock - selectedItem.currentStock).toString()}
                  />
                </View>

                <View style={styles.restockSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Current Stock:</Text>
                    <Text style={styles.summaryValue}>{selectedItem.currentStock}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Adding:</Text>
                    <Text style={styles.summaryValue}>
                      {selectedItem.maximumStock - selectedItem.currentStock}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.summaryLabel}>New Total:</Text>
                    <Text style={styles.summaryTotal}>{selectedItem.maximumStock}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.confirmRestockButton}
                  onPress={() => {
                    Alert.alert('Success', 'Item restocked successfully!');
                    setShowRestockModal(false);
                    setSelectedItem(null);
                  }}
                >
                  <Text style={styles.confirmRestockText}>Confirm Restock</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Inventory Item</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.editContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Item Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editFormData.name}
                  onChangeText={(text) => setEditFormData({...editFormData, name: text})}
                  placeholder="Enter item name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {['Vegetables', 'Meat', 'Dairy', 'Pantry', 'Spices', 'Beverages'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        editFormData.category === cat && styles.categoryOptionSelected
                      ]}
                      onPress={() => setEditFormData({...editFormData, category: cat})}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        editFormData.category === cat && styles.categoryOptionTextSelected
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.formLabel}>Current Stock</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editFormData.currentStock}
                    onChangeText={(text) => setEditFormData({...editFormData, currentStock: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.formLabel}>Unit Cost (£)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editFormData.unitCost}
                    onChangeText={(text) => setEditFormData({...editFormData, unitCost: text})}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.formLabel}>Minimum Stock</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editFormData.minimumStock}
                    onChangeText={(text) => setEditFormData({...editFormData, minimumStock: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.formLabel}>Maximum Stock</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editFormData.maximumStock}
                    onChangeText={(text) => setEditFormData({...editFormData, maximumStock: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Supplier</Text>
                <TextInput
                  style={styles.formInput}
                  value={editFormData.supplier}
                  onChangeText={(text) => setEditFormData({...editFormData, supplier: text})}
                  placeholder="Enter supplier name"
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.formButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Icon name="save" size={20} color={Colors.white} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Receipt Scan Modal */}
      <ReceiptScanModal
        visible={showReceiptScanModal}
        onClose={() => setShowReceiptScanModal(false)}
        onSubmit={handleReceiptSubmit}
      />
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
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scanButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  statCard: {
    flex: 1,
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
    marginTop: 4,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 12,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  filterButtonTextActive: {
    color: Colors.white,
  },
  inventoryList: {
    padding: 16,
  },
  inventoryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: Colors.secondary,
    marginBottom: 2,
  },
  itemSupplier: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  itemActions: {
    flexDirection: 'row',
  },
  restockButton: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 20,
    padding: 8,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockLevel: {
    flex: 1,
    marginRight: 12,
  },
  stockBar: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
    marginBottom: 4,
  },
  stockProgress: {
    height: '100%',
    borderRadius: 3,
  },
  stockText: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 12,
    color: Colors.darkGray,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  restockModal: {
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
  modalContent: {
    padding: 20,
  },
  itemProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileItemName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  profileCategory: {
    fontSize: 16,
    color: Colors.secondary,
    marginBottom: 8,
  },
  profileStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profileStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockDetails: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  stockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stockCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  stockCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  stockCardLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
  supplierDetails: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  restockActionButton: {
    backgroundColor: Colors.success,
  },
  editActionButton: {
    backgroundColor: Colors.secondary,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  restockContent: {
    padding: 20,
  },
  restockItemName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  restockCurrentStock: {
    fontSize: 14,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 24,
  },
  restockInputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  restockSummary: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  confirmRestockButton: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmRestockText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // Edit Modal Styles
  editModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '95%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  editContent: {
    padding: 20,
    maxHeight: 600,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryOptionTextSelected: {
    color: Colors.white,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  formButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Styles for LoadingView and Error/Retry will be implicitly handled by LoadingView component
  // but ensure emptyState styles are robust.
  // Centered style for the LoadingView/ErrorView wrapper if not using Fullscreen component
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Specific retry button style if not part of a generic ErrorDisplayComponent
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InventoryScreen;