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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { generateInventory, InventoryData } from '../../utils/mockDataGenerator';

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
  const [showRestockModal, setShowRestockModal] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    filterInventory();
  }, [inventory, searchQuery, selectedCategory, selectedStatus]);

  const loadInventory = () => {
    const inventoryData = generateInventory();
    setInventory(inventoryData);
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

  const categories = ['Snacks', 'Tacos', 'Special Tacos', 'Burritos', 'Sides', 'Drinks'];
  const stats = {
    total: inventory.length,
    lowStock: inventory.filter(item => item.currentStock <= item.minimumStock).length,
    outOfStock: inventory.filter(item => item.currentStock === 0).length,
    totalValue: inventory.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0),
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
        
        <TouchableOpacity style={styles.scanButton}>
          <Icon name="qr-code-scanner" size={24} color={Colors.white} />
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="inventory" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No items found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first inventory item'}
            </Text>
          </View>
        }
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
                  <TouchableOpacity style={[styles.actionButton, styles.editActionButton]}>
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
});

export default InventoryScreen;