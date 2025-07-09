import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Text } from '../../components/ui/Text';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../design-system/ThemeProvider';
import PlatformService, { PlatformSetting } from '../../services/PlatformService';
import { SimpleTextInput } from '../../components/inputs';

interface BulkUpdateItem {
  config_key: string;
  current_value: any;
  new_value: any;
  category: string;
  description: string;
  validation_error?: string;
}

interface BulkUpdateTemplate {
  id: string;
  name: string;
  description: string;
  updates: Record<string, any>;
}

const BulkSettingsScreen: React.FC = () => {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [bulkUpdates, setBulkUpdates] = useState<BulkUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BulkUpdateItem | null>(null);
  const [changeReason, setChangeReason] = useState('');

  const platformService = PlatformService.getInstance();

  const builtInTemplates: BulkUpdateTemplate[] = [
    {
      id: 'uk_payment_fees',
      name: 'UK Payment Fee Update',
      description: 'Update all payment processing fees for UK market rates',
      updates: {
        'payment.fees.stripe': { percentage: 1.4, fixed_fee: 0.20, currency: 'GBP' },
        'payment.fees.square': { percentage: 1.75, currency: 'GBP' },
        'payment.fees.sumup': {
          standard: { percentage: 1.95 },
          high_volume: { threshold: 2714, percentage: 0.95, monthly_fee: 39 },
          currency: 'GBP'
        },
        'payment.fees.qr_code': { percentage: 1.2, currency: 'GBP' },
      },
    },
    {
      id: 'security_hardening',
      name: 'Security Hardening',
      description: 'Apply enhanced security settings across platform',
      updates: {
        'security.max_login_attempts': 3,
        'security.session_timeout': 1800,
        'security.require_2fa': true,
        'security.password_min_length': 12,
      },
    },
    {
      id: 'business_limits_update',
      name: 'Business Limits Update',
      description: 'Update platform business rule limits',
      updates: {
        'business.max_discount_percentage': 30.0,
        'business.max_transaction_amount': 10000.0,
        'business.daily_transaction_limit': 50000.0,
      },
    },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setError(null);
      const platformSettings = await platformService.getPlatformSettings();
      setSettings(platformSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load platform settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSettings();
  };

  const addBulkUpdateItem = (configKey: string, newValue: any) => {
    const setting = settings.find(s => s.key === configKey);
    if (!setting) return;

    const item: BulkUpdateItem = {
      config_key: configKey,
      current_value: setting.value,
      new_value: newValue,
      category: setting.category,
      description: setting.description,
    };

    // Validate the new value
    const validationError = validateValue(item);
    if (validationError) {
      item.validation_error = validationError;
    }

    setBulkUpdates(prev => {
      const existing = prev.findIndex(item => item.config_key === configKey);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = item;
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeBulkUpdateItem = (configKey: string) => {
    setBulkUpdates(prev => prev.filter(item => item.config_key !== configKey));
  };

  const updateBulkUpdateItem = (configKey: string, newValue: any) => {
    setBulkUpdates(prev => prev.map(item => {
      if (item.config_key === configKey) {
        const updated = { ...item, new_value: newValue };
        const validationError = validateValue(updated);
        updated.validation_error = validationError;
        return updated;
      }
      return item;
    }));
  };

  const validateValue = (item: BulkUpdateItem): string | undefined => {
    const { config_key, new_value } = item;

    // Payment fee validation
    if (config_key.startsWith('payment.fees.')) {
      if (typeof new_value !== 'object') {
        return 'Payment fee must be an object';
      }
      if (new_value.percentage < 0 || new_value.percentage > 10) {
        return 'Payment fee percentage must be between 0% and 10%';
      }
    }

    // Security validation
    if (config_key.startsWith('security.')) {
      if (config_key === 'security.max_login_attempts') {
        if (typeof new_value !== 'number' || new_value < 1 || new_value > 10) {
          return 'Login attempts must be between 1 and 10';
        }
      }
      if (config_key === 'security.session_timeout') {
        if (typeof new_value !== 'number' || new_value < 300 || new_value > 86400) {
          return 'Session timeout must be between 5 minutes and 24 hours';
        }
      }
    }

    // Business rules validation
    if (config_key.startsWith('business.')) {
      if (config_key === 'business.max_discount_percentage') {
        if (typeof new_value !== 'number' || new_value < 0 || new_value > 100) {
          return 'Discount percentage must be between 0% and 100%';
        }
      }
    }

    return undefined;
  };

  const applyTemplate = (template: BulkUpdateTemplate) => {
    Object.entries(template.updates).forEach(([key, value]) => {
      addBulkUpdateItem(key, value);
    });
    setShowTemplatesModal(false);
  };

  const executeBulkUpdate = async () => {
    const validItems = bulkUpdates.filter(item => !item.validation_error);
    
    if (validItems.length === 0) {
      Alert.alert('No Valid Updates', 'Please fix validation errors before proceeding.');
      return;
    }

    if (!changeReason.trim()) {
      Alert.alert('Change Reason Required', 'Please provide a reason for these changes.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Update',
      `This will update ${validItems.length} platform settings. This action cannot be undone.\n\nAre you sure you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          style: 'destructive',
          onPress: async () => {
            try {
              const updates: Record<string, any> = {};
              validItems.forEach(item => {
                updates[item.config_key] = item.new_value;
              });

              const result = await platformService.bulkUpdatePlatformSettings(
                updates,
                changeReason
              );

              if (result.successful > 0) {
                Alert.alert(
                  'Bulk Update Complete',
                  `Successfully updated ${result.successful} settings.${result.failed > 0 ? ` ${result.failed} updates failed.` : ''}`,
                  [{ text: 'OK', onPress: () => {
                    setBulkUpdates([]);
                    setChangeReason('');
                    loadSettings();
                  }}]
                );
              } else {
                Alert.alert('Update Failed', 'No settings were updated. Please check the logs for details.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to execute bulk update. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return value.toString();
  };

  const parseValue = (valueString: string, originalValue: any): any => {
    if (typeof originalValue === 'object') {
      try {
        return JSON.parse(valueString);
      } catch {
        return originalValue;
      }
    }
    if (typeof originalValue === 'number') {
      const parsed = parseFloat(valueString);
      return isNaN(parsed) ? originalValue : parsed;
    }
    if (typeof originalValue === 'boolean') {
      return valueString.toLowerCase() === 'true';
    }
    return valueString;
  };

  const renderAddSettingModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAddModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Setting to Bulk Update</Text>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {settings.map((setting) => {
            const isAlreadyAdded = bulkUpdates.some(item => item.config_key === setting.key);
            return (
              <TouchableOpacity
                key={setting.key}
                style={[styles.settingItem, isAlreadyAdded && styles.settingItemDisabled]}
                onPress={() => {
                  if (!isAlreadyAdded) {
                    addBulkUpdateItem(setting.key, setting.value);
                    setShowAddModal(false);
                  }
                }}
                disabled={isAlreadyAdded}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingKey}>{setting.key}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                  <Text style={styles.settingCategory}>Category: {setting.category}</Text>
                </View>
                {isAlreadyAdded && (
                  <Icon name="check" size={20} color={theme.colors.success} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderTemplatesModal = () => (
    <Modal
      visible={showTemplatesModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowTemplatesModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Bulk Update Templates</Text>
          <TouchableOpacity onPress={() => setShowTemplatesModal(false)}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {builtInTemplates.map((template) => (
            <Card key={template.id} style={styles.templateCard}>
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
                <Text style={styles.templateUpdates}>
                  {Object.keys(template.updates).length} settings
                </Text>
              </View>
              <Button
                title="Apply"
                onPress={() => applyTemplate(template)}
                size="small"
              />
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={loadSettings} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bulk Settings Update</Text>
          <Text style={styles.subtitle}>Manage multiple platform settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Add Setting"
            onPress={() => setShowAddModal(true)}
            style={styles.actionButton}
            variant="secondary"
          />
          <Button
            title="Use Template"
            onPress={() => setShowTemplatesModal(true)}
            style={styles.actionButton}
            variant="secondary"
          />
        </View>

        {/* Bulk Updates Queue */}
        {bulkUpdates.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Updates ({bulkUpdates.length})</Text>
            
            {bulkUpdates.map((item) => (
              <Card key={item.config_key} style={styles.updateCard}>
                <View style={styles.updateHeader}>
                  <View style={styles.updateInfo}>
                    <Text style={styles.updateConfigKey}>{item.config_key}</Text>
                    <Text style={styles.updateDescription}>{item.description}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeBulkUpdateItem(item.config_key)}
                    style={styles.removeButton}
                  >
                    <Icon name="close" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>

                <View style={styles.valueComparison}>
                  <View style={styles.valueSection}>
                    <Text style={styles.valueLabel}>Current:</Text>
                    <Text style={styles.valueText}>{formatValue(item.current_value)}</Text>
                  </View>
                  <Icon name="arrow-forward" size={16} color={theme.colors.textLight} />
                  <View style={styles.valueSection}>
                    <Text style={styles.valueLabel}>New:</Text>
                    <TouchableOpacity
                      onPress={() => setEditingItem(item)}
                      style={styles.editableValue}
                    >
                      <Text style={styles.valueText}>{formatValue(item.new_value)}</Text>
                      <Icon name="edit" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {item.validation_error && (
                  <View style={styles.validationError}>
                    <Icon name="error" size={16} color={theme.colors.error} />
                    <Text style={styles.validationErrorText}>{item.validation_error}</Text>
                  </View>
                )}
              </Card>
            ))}

            {/* Change Reason */}
            <Card style={styles.reasonCard}>
              <SimpleTextInput
                label="Change Reason (Required)"
                value={changeReason}
                onValueChange={setChangeReason}
                placeholder="Describe the reason for these changes..."
                multiline={true}
                numberOfLines={3}
                // style prop (styles.reasonInput) removed, internal styling will apply
              />
            </Card>

            {/* Execute Button */}
            <Button
              title="Execute Bulk Update"
              onPress={executeBulkUpdate}
              style={styles.executeButton}
              disabled={bulkUpdates.every(item => item.validation_error) || !changeReason.trim()}
            />
          </>
        )}

        {bulkUpdates.length === 0 && (
          <Card style={styles.emptyCard}>
            <Icon name="layers" size={48} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>No Updates Queued</Text>
            <Text style={styles.emptyText}>
              Add settings to update or use a template to get started.
            </Text>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Value Modal */}
      {editingItem && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditingItem(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Value</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editModalContent}>
              <Text style={styles.editConfigKey}>{editingItem.config_key}</Text>
              <Text style={styles.editDescription}>{editingItem.description}</Text>

              <SimpleTextInput
                label="New Value:"
                value={formatValue(editingItem.new_value)}
                onValueChange={(text) => {
                  const parsedNewValue = parseValue(text, editingItem.current_value);
                  // Update the local editingItem state immediately for responsiveness
                  setEditingItem(prevItem => {
                    if (prevItem) {
                      return { ...prevItem, new_value: parsedNewValue };
                    }
                    return null;
                  });
                  // Then, call the function that also handles validation
                  updateBulkUpdateItem(editingItem.config_key, parsedNewValue);
                }}
                multiline={true}
                placeholder="Enter new value..."
                numberOfLines={4} // Approximating minHeight from styles.editInput
                // style prop (styles.editInput) removed
              />

              {editingItem.validation_error && (
                <View style={styles.validationError}>
                  <Icon name="error" size={16} color={theme.colors.error} />
                  <Text style={styles.validationErrorText}>{editingItem.validation_error}</Text>
                </View>
              )}

              <Button
                title="Save Changes"
                onPress={() => setEditingItem(null)}
                style={styles.saveButton}
              />
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {renderAddSettingModal()}
      {renderTemplatesModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textLight,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    marginVertical: theme.spacing.lg,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  updateCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  updateInfo: {
    flex: 1,
  },
  updateConfigKey: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  updateDescription: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  valueComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  valueSection: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  valueText: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: '#FFEBEE',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  validationErrorText: {
    fontSize: 12,
    color: theme.colors.error,
    flex: 1,
  },
  reasonCard: {
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    textAlignVertical: 'top',
  },
  executeButton: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: theme.spacing.xl,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  settingItem: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingInfo: {
    flex: 1,
  },
  settingKey: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  settingCategory: {
    fontSize: 10,
    color: theme.colors.textLight,
    textTransform: 'uppercase',
  },
  templateCard: {
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  templateDescription: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  templateUpdates: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  editModalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  editConfigKey: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  editDescription: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.lg,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 14,
    backgroundColor: theme.colors.surface,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
    minHeight: 120,
    marginBottom: theme.spacing.md,
  },
  saveButton: {
    marginTop: theme.spacing.lg,
  },
});

export default BulkSettingsScreen;