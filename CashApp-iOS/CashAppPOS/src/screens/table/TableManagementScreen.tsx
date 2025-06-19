import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  PanGestureHandler,
  State,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import LazyLoadingWrapper from '../../components/performance/LazyLoadingWrapper';
import { TableSkeleton } from '../../components/performance/SkeletonLoader';
import { usePerformanceMonitor, performanceUtils } from '../../hooks/usePerformanceMonitor';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Fynlo POS Color Scheme
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

interface TablePosition {
  x: number;
  y: number;
}

interface Table {
  id: string;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_order';
  position: TablePosition;
  shape: 'round' | 'square' | 'rectangle';
  section: string;
  server?: string;
  currentOrder?: {
    id: string;
    customerName: string;
    amount: number;
    timeSeated: Date;
  };
  reservations?: {
    time: Date;
    customerName: string;
    partySize: number;
  }[];
}

interface Section {
  id: string;
  name: string;
  color: string;
  tables: string[];
}

const TableManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Sample data
  const sampleSections: Section[] = [
    { id: 'main', name: 'Main Dining', color: Colors.primary, tables: [] },
    { id: 'patio', name: 'Patio', color: Colors.secondary, tables: [] },
    { id: 'bar', name: 'Bar Area', color: Colors.warning, tables: [] },
    { id: 'private', name: 'Private Room', color: Colors.danger, tables: [] },
  ];

  const sampleTables: Table[] = [
    {
      id: 'table1',
      name: 'T1',
      seats: 4,
      status: 'occupied',
      position: { x: 50, y: 100 },
      shape: 'round',
      section: 'main',
      server: 'Sarah M.',
      currentOrder: {
        id: 'order1',
        customerName: 'Johnson Family',
        amount: 45.50,
        timeSeated: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      },
    },
    {
      id: 'table2',
      name: 'T2',
      seats: 2,
      status: 'available',
      position: { x: 200, y: 100 },
      shape: 'square',
      section: 'main',
    },
    {
      id: 'table3',
      name: 'T3',
      seats: 6,
      status: 'reserved',
      position: { x: 350, y: 100 },
      shape: 'rectangle',
      section: 'main',
      reservations: [{
        time: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        customerName: 'Smith Party',
        partySize: 6,
      }],
    },
    {
      id: 'table4',
      name: 'T4',
      seats: 8,
      status: 'occupied',
      position: { x: 50, y: 250 },
      shape: 'rectangle',
      section: 'main',
      server: 'Mike R.',
      currentOrder: {
        id: 'order2',
        customerName: 'Corporate Lunch',
        amount: 120.75,
        timeSeated: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      },
    },
    {
      id: 'table5',
      name: 'P1',
      seats: 4,
      status: 'cleaning',
      position: { x: 100, y: 400 },
      shape: 'round',
      section: 'patio',
    },
    {
      id: 'table6',
      name: 'B1',
      seats: 2,
      status: 'available',
      position: { x: 300, y: 450 },
      shape: 'square',
      section: 'bar',
    },
  ];

  useEffect(() => {
    setTables(sampleTables);
    setSections(sampleSections);
  }, []);

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return Colors.success;
      case 'occupied':
        return Colors.danger;
      case 'reserved':
        return Colors.warning;
      case 'cleaning':
        return Colors.secondary;
      case 'out_of_order':
        return Colors.mediumGray;
      default:
        return Colors.lightGray;
    }
  };

  const getSectionColor = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    return section?.color || Colors.primary;
  };

  const getTableDimensions = (table: Table) => {
    const baseSize = 60;
    const seatMultiplier = Math.sqrt(table.seats / 4); // Scale based on seats
    
    switch (table.shape) {
      case 'round':
        return { width: baseSize * seatMultiplier, height: baseSize * seatMultiplier };
      case 'square':
        return { width: baseSize * seatMultiplier, height: baseSize * seatMultiplier };
      case 'rectangle':
        return { width: baseSize * seatMultiplier * 1.5, height: baseSize * seatMultiplier };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  const updateTableStatus = (tableId: string, newStatus: Table['status']) => {
    setTables(prev => prev.map(table => 
      table.id === tableId 
        ? { 
            ...table, 
            status: newStatus,
            currentOrder: newStatus === 'available' ? undefined : table.currentOrder
          } 
        : table
    ));
  };

  const assignServer = (tableId: string, serverName: string) => {
    setTables(prev => prev.map(table => 
      table.id === tableId ? { ...table, server: serverName } : table
    ));
  };

  const moveTable = (tableId: string, newPosition: TablePosition) => {
    setTables(prev => prev.map(table => 
      table.id === tableId ? { ...table, position: newPosition } : table
    ));
  };

  const addNewTable = (tableData: Partial<Table>) => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: tableData.name || 'New Table',
      seats: tableData.seats || 4,
      status: 'available',
      position: tableData.position || { x: 100, y: 100 },
      shape: tableData.shape || 'round',
      section: tableData.section || 'main',
    };
    
    setTables(prev => [...prev, newTable]);
    setShowAddTableModal(false);
  };

  const deleteTable = (tableId: string) => {
    Alert.alert(
      'Delete Table',
      'Are you sure you want to delete this table?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setTables(prev => prev.filter(table => table.id !== tableId));
          setShowTableModal(false);
        }}
      ]
    );
  };

  const getFilteredTables = () => {
    if (selectedSection === 'all') {
      return tables;
    }
    return tables.filter(table => table.section === selectedSection);
  };

  const TableComponent = ({ table }: { table: Table }) => {
    const dimensions = getTableDimensions(table);
    const statusColor = getTableStatusColor(table.status);
    const sectionColor = getSectionColor(table.section);
    
    return (
      <TouchableOpacity
        style={[
          styles.table,
          {
            left: table.position.x,
            top: table.position.y,
            width: dimensions.width,
            height: dimensions.height,
            backgroundColor: statusColor,
            borderColor: sectionColor,
            borderRadius: table.shape === 'round' ? dimensions.width / 2 : 8,
          }
        ]}
        onPress={() => {
          setSelectedTable(table);
          setShowTableModal(true);
        }}
      >
        <Text style={styles.tableName}>{table.name}</Text>
        <Text style={styles.tableSeats}>{table.seats}</Text>
        {table.currentOrder && (
          <View style={styles.orderIndicator}>
            <Icon name="restaurant" size={12} color={Colors.white} />
          </View>
        )}
        {table.reservations && table.reservations.length > 0 && (
          <View style={styles.reservationIndicator}>
            <Icon name="schedule" size={12} color={Colors.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Table Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setEditMode(!editMode)}
          >
            <Icon name={editMode ? "check" : "edit"} size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowAddTableModal(true)}
          >
            <Icon name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section Filter */}
      <View style={styles.sectionFilter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.sectionButton,
              selectedSection === 'all' && styles.sectionButtonActive
            ]}
            onPress={() => setSelectedSection('all')}
          >
            <Text style={[
              styles.sectionButtonText,
              selectedSection === 'all' && styles.sectionButtonTextActive
            ]}>
              All Sections
            </Text>
          </TouchableOpacity>
          
          {sections.map(section => (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.sectionButton,
                { borderColor: section.color },
                selectedSection === section.id && { backgroundColor: section.color }
              ]}
              onPress={() => setSelectedSection(section.id)}
            >
              <Text style={[
                styles.sectionButtonText,
                selectedSection === section.id && styles.sectionButtonTextActive
              ]}>
                {section.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Floor Plan */}
      <ScrollView 
        style={styles.floorPlan}
        contentContainerStyle={styles.floorPlanContent}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!editMode}
      >
        {/* Background Grid */}
        <View style={styles.gridBackground}>
          {[...Array(20)].map((_, i) => (
            <View key={`h-${i}`} style={[styles.gridLine, { top: i * 30 }]} />
          ))}
          {[...Array(15)].map((_, i) => (
            <View key={`v-${i}`} style={[styles.gridLineVertical, { left: i * 30 }]} />
          ))}
        </View>

        {/* Tables */}
        {getFilteredTables().map(table => (
          <TableComponent key={table.id} table={table} />
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Status Legend</Text>
          <View style={styles.legendItems}>
            {[
              { status: 'available', label: 'Available' },
              { status: 'occupied', label: 'Occupied' },
              { status: 'reserved', label: 'Reserved' },
              { status: 'cleaning', label: 'Cleaning' },
              { status: 'out_of_order', label: 'Out of Order' },
            ].map(item => (
              <View key={item.status} style={styles.legendItem}>
                <View style={[
                  styles.legendColor,
                  { backgroundColor: getTableStatusColor(item.status) }
                ]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Table Details Modal */}
      <Modal
        visible={showTableModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTable && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Table {selectedTable.name} Details
                  </Text>
                  <TouchableOpacity onPress={() => setShowTableModal(false)}>
                    <Icon name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.tableInfoSection}>
                    <Text style={styles.sectionTitle}>Table Information</Text>
                    <Text style={styles.infoText}>Seats: {selectedTable.seats}</Text>
                    <Text style={styles.infoText}>Section: {selectedTable.section}</Text>
                    <Text style={styles.infoText}>Shape: {selectedTable.shape}</Text>
                    <Text style={[
                      styles.infoText,
                      { color: getTableStatusColor(selectedTable.status) }
                    ]}>
                      Status: {selectedTable.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>

                  {selectedTable.currentOrder && (
                    <View style={styles.tableInfoSection}>
                      <Text style={styles.sectionTitle}>Current Order</Text>
                      <Text style={styles.infoText}>
                        Customer: {selectedTable.currentOrder.customerName}
                      </Text>
                      <Text style={styles.infoText}>
                        Amount: £{selectedTable.currentOrder.amount.toFixed(2)}
                      </Text>
                      <Text style={styles.infoText}>
                        Seated: {selectedTable.currentOrder.timeSeated.toLocaleTimeString()}
                      </Text>
                      {selectedTable.server && (
                        <Text style={styles.infoText}>
                          Server: {selectedTable.server}
                        </Text>
                      )}
                    </View>
                  )}

                  {selectedTable.reservations && selectedTable.reservations.length > 0 && (
                    <View style={styles.tableInfoSection}>
                      <Text style={styles.sectionTitle}>Upcoming Reservations</Text>
                      {selectedTable.reservations.map((reservation, index) => (
                        <View key={index} style={styles.reservationItem}>
                          <Text style={styles.infoText}>
                            {reservation.time.toLocaleTimeString()} - {reservation.customerName}
                          </Text>
                          <Text style={styles.infoSubtext}>
                            Party of {reservation.partySize}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.statusActions}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionButtons}>
                      {['available', 'occupied', 'reserved', 'cleaning', 'out_of_order'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            { backgroundColor: getTableStatusColor(status) },
                            selectedTable.status === status && styles.statusButtonActive
                          ]}
                          onPress={() => updateTableStatus(selectedTable.id, status as Table['status'])}
                        >
                          <Text style={styles.statusButtonText}>
                            {status.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.deleteButton]}
                    onPress={() => deleteTable(selectedTable.id)}
                  >
                    <Icon name="delete" size={20} color={Colors.white} />
                    <Text style={styles.modalButtonText}>Delete Table</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.editButton]}
                    onPress={() => {
                      // Navigate to edit table details
                      Alert.alert('Edit Table', 'Table editing would open here');
                    }}
                  >
                    <Icon name="edit" size={20} color={Colors.white} />
                    <Text style={styles.modalButtonText}>Edit Details</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Table Modal */}
      <Modal
        visible={showAddTableModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Table</Text>
              <TouchableOpacity onPress={() => setShowAddTableModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Table Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., T10"
                defaultValue=""
              />

              <Text style={styles.inputLabel}>Number of Seats</Text>
              <TextInput
                style={styles.textInput}
                placeholder="4"
                keyboardType="numeric"
                defaultValue="4"
              />

              <Text style={styles.inputLabel}>Table Shape</Text>
              <View style={styles.shapeSelector}>
                {['round', 'square', 'rectangle'].map(shape => (
                  <TouchableOpacity
                    key={shape}
                    style={styles.shapeOption}
                  >
                    <Text style={styles.shapeOptionText}>{shape}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Section</Text>
              <View style={styles.sectionSelector}>
                {sections.map(section => (
                  <TouchableOpacity
                    key={section.id}
                    style={[styles.sectionOption, { borderColor: section.color }]}
                  >
                    <Text style={styles.sectionOptionText}>{section.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddTableModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  addNewTable({
                    name: 'T' + (tables.length + 1),
                    seats: 4,
                    shape: 'round',
                    section: 'main',
                    position: { x: 100, y: 100 }
                  });
                }}
              >
                <Text style={styles.saveButtonText}>Add Table</Text>
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
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  sectionFilter: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  sectionButtonActive: {
    backgroundColor: Colors.primary,
  },
  sectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  sectionButtonTextActive: {
    color: Colors.white,
  },
  floorPlan: {
    flex: 1,
  },
  floorPlanContent: {
    width: screenWidth * 1.5,
    height: screenHeight * 1.2,
    backgroundColor: Colors.white,
    position: 'relative',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.lightGray,
    opacity: 0.3,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.lightGray,
    opacity: 0.3,
  },
  table: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tableSeats: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.9,
  },
  orderIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservationIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendLabel: {
    fontSize: 12,
    color: Colors.text,
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
    borderBottomColor: Colors.border,
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
  tableInfoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: Colors.lightText,
  },
  reservationItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  statusActions: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderWidth: 2,
    borderColor: Colors.text,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
  },
  editButton: {
    backgroundColor: Colors.secondary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  inputLabel: {
    fontSize: 14,
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
  },
  shapeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  shapeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  shapeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  sectionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default TableManagementScreen;