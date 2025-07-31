import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useAppStore from '../../store/useAppStore';

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

// Mock transaction data
interface Transaction {
  id: string;
  date: Date;
  total: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  paymentMethod: string;
  status: 'completed' | 'refunded' | 'partially_refunded' | 'voided';
}

// Refund reason options
const REFUND_REASONS = [
  'Customer Request',
  'Wrong Item',
  'Damaged Item',
  'Poor Quality',
  'Order Error',
  'Manager Override',
  'System Error',
  'Other',
];

const RefundScreen: React.FC = () => {
  const navigation = useNavigation();

  // Mock recent transactions
  const [recentTransactions] = useState<Transaction[]>([
    {
      id: 'TXN001',
      date: new Date(Date.now() - 3600000), // 1 hour ago
      total: 25.99,
      items: [
        { id: '1', name: 'Coffee', price: 4.5, quantity: 2 },
        { id: '2', name: 'Sandwich', price: 16.99, quantity: 1 },
      ],
      paymentMethod: 'Card',
      status: 'completed',
    },
    {
      id: 'TXN002',
      date: new Date(Date.now() - 7200000), // 2 hours ago
      total: 18.75,
      items: [
        { id: '3', name: 'Salad', price: 12.99, quantity: 1 },
        { id: '4', name: 'Juice', price: 5.76, quantity: 1 },
      ],
      paymentMethod: 'Cash',
      status: 'completed',
    },
  ]);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'void'>('full');
  const [refundReason, setRefundReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [managerAuth, setManagerAuth] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleTransactionSelect = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setSelectedItems([]);
    setRefundReason('');
    setCustomReason('');
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const calculateRefundAmount = () => {
    if (!selectedTransaction) return 0;

    if (refundType === 'full' || refundType === 'void') {
      return selectedTransaction.total;
    }

    // Partial refund - sum selected items
    return selectedTransaction.items
      .filter((item) => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const processRefund = async () => {
    if (!selectedTransaction) {
      Alert.alert('Error', 'Please select a transaction to refund.');
      return;
    }

    const finalReason = refundReason === 'Other' ? customReason : refundReason;
    if (!finalReason) {
      Alert.alert('Error', 'Please provide a reason for the refund.');
      return;
    }

    if (!managerAuth) {
      Alert.alert('Error', 'Manager authorization is required for refunds.');
      return;
    }

    if (refundType === 'partial' && selectedItems.length === 0) {
      Alert.alert('Error', 'Please select items to refund.');
      return;
    }

    setProcessing(true);

    // Simulate processing
    setTimeout(() => {
      setProcessing(false);

      const amount = calculateRefundAmount();
      const actionType = refundType === 'void' ? 'void' : 'refund';

      Alert.alert(
        'Success',
        `${
          actionType === 'void' ? 'Transaction voided' : 'Refund processed'
        } successfully!\n\nAmount: £${amount.toFixed(2)}\nTransaction: ${selectedTransaction.id}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedTransaction(null);
              setRefundType('full');
              setRefundReason('');
              setCustomReason('');
              setManagerAuth('');
              setSelectedItems([]);
            },
          },
        ]
      );
    }, 2000);
  };

  const TransactionItem = ({ transaction }: { transaction: Transaction }) => (
    <TouchableOpacity
      style={[
        styles.transactionItem,
        selectedTransaction?.id === transaction.id && styles.transactionItemSelected,
      ]}
      onPress={() => handleTransactionSelect(transaction)}
    >
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionId}>#{transaction.id}</Text>
        <Text style={styles.transactionAmount}>£{transaction.total.toFixed(2)}</Text>
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionDate}>
          {transaction.date.toLocaleTimeString()} - {transaction.paymentMethod}
        </Text>
        <View style={[styles.statusBadge, styles[`status${transaction.status.replace('_', '')}`]]}>
          <Text style={styles.statusText}>
            {transaction.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.transactionItems}>
        {transaction.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refunds & Voids</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <FlatList
            data={recentTransactions}
            renderItem={({ item }) => <TransactionItem transaction={item} />}
            keyExtractor={(item) => item.id}
            style={styles.transactionsList}
            scrollEnabled={false}
          />
        </View>

        {/* Refund Details */}
        {selectedTransaction && (
          <>
            {/* Refund Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Refund Type</Text>
              <View style={styles.refundTypeButtons}>
                {[
                  { key: 'full', label: 'Full Refund', icon: 'money-off' },
                  { key: 'partial', label: 'Partial Refund', icon: 'remove-circle-outline' },
                  { key: 'void', label: 'Void Transaction', icon: 'cancel' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.refundTypeButton,
                      refundType === option.key && styles.refundTypeButtonActive,
                    ]}
                    onPress={() => setRefundType(option.key as any)}
                  >
                    <Icon
                      name={option.icon}
                      size={24}
                      color={refundType === option.key ? Colors.white : Colors.darkGray}
                    />
                    <Text
                      style={[
                        styles.refundTypeLabel,
                        refundType === option.key && styles.refundTypeLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Item Selection for Partial Refunds */}
            {refundType === 'partial' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Items to Refund</Text>
                <View style={styles.itemsList}>
                  {selectedTransaction.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemRow,
                        selectedItems.includes(item.id) && styles.itemRowSelected,
                      ]}
                      onPress={() => handleItemToggle(item.id)}
                    >
                      <Icon
                        name={
                          selectedItems.includes(item.id) ? 'check-box' : 'check-box-outline-blank'
                        }
                        size={24}
                        color={selectedItems.includes(item.id) ? Colors.primary : Colors.mediumGray}
                      />
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemName}>
                          {item.quantity}x {item.name}
                        </Text>
                        <Text style={styles.itemPrice}>
                          £{(item.price * item.quantity).toFixed(2)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Refund Reason */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Reason for {refundType === 'void' ? 'Void' : 'Refund'}
              </Text>
              <View style={styles.reasonButtons}>
                {REFUND_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonButton,
                      refundReason === reason && styles.reasonButtonActive,
                    ]}
                    onPress={() => setRefundReason(reason)}
                  >
                    <Text
                      style={[
                        styles.reasonButtonText,
                        refundReason === reason && styles.reasonButtonTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {refundReason === 'Other' && (
                <TextInput
                  style={styles.customReasonInput}
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Enter custom reason..."
                  multiline
                  numberOfLines={3}
                />
              )}
            </View>

            {/* Manager Authorization */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Manager Authorization</Text>
              <TextInput
                style={styles.authInput}
                value={managerAuth}
                onChangeText={setManagerAuth}
                placeholder="Enter manager PIN or ID"
                secureTextEntry
              />
            </View>

            {/* Refund Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Transaction ID:</Text>
                  <Text style={styles.summaryValue}>{selectedTransaction.id}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Original Amount:</Text>
                  <Text style={styles.summaryValue}>£{selectedTransaction.total.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {refundType === 'void' ? 'Void' : 'Refund'} Amount:
                  </Text>
                  <Text style={[styles.summaryValue, styles.refundAmount]}>
                    £{calculateRefundAmount().toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Payment Method:</Text>
                  <Text style={styles.summaryValue}>{selectedTransaction.paymentMethod}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Process Button */}
      {selectedTransaction && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.processButton, processing && styles.processingButton]}
            onPress={processRefund}
            disabled={processing}
          >
            {processing ? (
              <>
                <Icon name="hourglass-empty" size={24} color={Colors.white} />
                <Text style={styles.processButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                <Icon
                  name={refundType === 'void' ? 'cancel' : 'money-off'}
                  size={24}
                  color={Colors.white}
                />
                <Text style={styles.processButtonText}>
                  {refundType === 'void' ? 'Void Transaction' : 'Process Refund'} - £
                  {calculateRefundAmount().toFixed(2)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.danger,
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
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
  transactionsList: {
    paddingHorizontal: 16,
  },
  transactionItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  transactionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionId: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionDate: {
    fontSize: 14,
    color: Colors.lightText,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statuscompleted: {
    backgroundColor: Colors.success,
  },
  statusrefunded: {
    backgroundColor: Colors.warning,
  },
  statuspartiallyrefunded: {
    backgroundColor: Colors.secondary,
  },
  statusvoided: {
    backgroundColor: Colors.danger,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  transactionItems: {
    fontSize: 12,
    color: Colors.lightText,
  },
  refundTypeButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  refundTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  refundTypeButtonActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  refundTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.darkGray,
    marginTop: 8,
    textAlign: 'center',
  },
  refundTypeLabelActive: {
    color: Colors.white,
  },
  itemsList: {
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemRowSelected: {
    backgroundColor: Colors.primary + '20',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    color: Colors.text,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  reasonButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  reasonButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reasonButtonText: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  reasonButtonTextActive: {
    color: Colors.white,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  authInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
  },
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  refundAmount: {
    color: Colors.danger,
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  processButton: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingButton: {
    backgroundColor: Colors.mediumGray,
  },
  processButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default RefundScreen;
