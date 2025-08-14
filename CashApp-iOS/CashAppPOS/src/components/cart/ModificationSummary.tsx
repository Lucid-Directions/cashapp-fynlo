/**
 * Component to display modification summary in cart items
 * Shows selected modifications, special instructions, and price breakdown
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import type { CartItemModification } from '../../types/cart';

interface ModificationSummaryProps {
  modifications?: CartItemModification[];
  specialInstructions?: string;
  modificationPrice?: number;
  originalPrice?: number;
  quantity?: number;
  showPriceBreakdown?: boolean;
  onCustomizePress?: () => void;
  compact?: boolean;
}

export default function ModificationSummary({
  modifications = [],
  specialInstructions,
  modificationPrice = 0,
  originalPrice = 0,
  quantity = 1,
  showPriceBreakdown = false,
  onCustomizePress,
  compact = false,
}: ModificationSummaryProps) {
  const { theme } = useTheme();

  // Filter selected modifications
  const selectedModifications = modifications.filter((mod) => mod.selected);

  if (selectedModifications.length === 0 && !specialInstructions && !showPriceBreakdown) {
    return null;
  }

  // Group modifications by category for better display
  const modificationsByCategory = selectedModifications.reduce((acc, mod) => {
    if (!acc[mod.category]) {
      acc[mod.category] = [];
    }
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, CartItemModification[]>);

  const formatModificationText = (mod: CartItemModification): string => {
    if (mod.quantity && mod.quantity > 1) {
      return `${mod.quantity}x ${mod.name}`;
    }
    return mod.name;
  };

  const formatPrice = (price: number): string => {
    return `£${Math.abs(price).toFixed(2)}`;
  };

  if (compact) {
    // Compact view for cart list
    const modificationText = selectedModifications.map(formatModificationText).join(', ');

    return (
      <View style={styles.compactContainer}>
        {modificationText.length > 0 && (
          <View style={styles.compactRow}>
            <Icon name="tune" size={12} color={theme.colors.textSecondary} />
            <Text
              style={[styles.compactText, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {modificationText}
            </Text>
          </View>
        )}
        {specialInstructions && (
          <View style={styles.compactRow}>
            <Icon name="note" size={12} color={theme.colors.textSecondary} />
            <Text
              style={[styles.compactText, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              Special instructions
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Full view for detailed display
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Modifications by category */}
      {Object.entries(modificationsByCategory).map(([category, mods]) => (
        <View key={category} style={styles.categorySection}>
          <Text style={[styles.categoryTitle, { color: theme.colors.textSecondary }]}>
            {category}
          </Text>
          <View style={styles.modificationsList}>
            {mods.map((mod) => (
              <View key={mod.id} style={styles.modificationItem}>
                <Text style={[styles.modificationText, { color: theme.colors.text }]}>
                  {formatModificationText(mod)}
                </Text>
                {mod.price !== 0 && (
                  <Text style={[styles.modificationPrice, { color: theme.colors.textSecondary }]}>
                    {mod.price > 0 ? '+' : ''}
                    {formatPrice(mod.price)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Special Instructions */}
      {specialInstructions && (
        <View style={styles.instructionsSection}>
          <View style={styles.instructionsHeader}>
            <Icon name="note" size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.instructionsTitle, { color: theme.colors.textSecondary }]}>
              Special Instructions
            </Text>
          </View>
          <Text style={[styles.instructionsText, { color: theme.colors.text }]}>
            {specialInstructions}
          </Text>
        </View>
      )}

      {/* Price Breakdown */}
      {showPriceBreakdown && modificationPrice !== 0 && (
        <View style={[styles.priceBreakdown, { borderTopColor: theme.colors.border }]}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>
              Base Price
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.text }]}>
              {formatPrice(originalPrice)}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>
              Modifications
            </Text>
            <Text
              style={[
                styles.priceValue,
                { color: modificationPrice > 0 ? theme.colors.success : theme.colors.text },
              ]}
            >
              {modificationPrice > 0 ? '+' : ''}
              {formatPrice(modificationPrice)}
            </Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
              Item Total (per unit)
            </Text>
            <Text style={[styles.totalValue, { color: theme.colors.primary }]}>
              {formatPrice(originalPrice + modificationPrice)}
            </Text>
          </View>
          {quantity > 1 && (
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, styles.lineTotalLabel, { color: theme.colors.text }]}>
                Line Total ({quantity}x)
              </Text>
              <Text
                style={[styles.totalValue, styles.lineTotalValue, { color: theme.colors.primary }]}
              >
                {formatPrice((originalPrice + modificationPrice) * quantity)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Customize Button */}
      {onCustomizePress && (
        <TouchableOpacity
          style={[styles.customizeButton, { borderColor: theme.colors.primary }]}
          onPress={onCustomizePress}
        >
          <Icon name="edit" size={16} color={theme.colors.primary} />
          <Text style={[styles.customizeButtonText, { color: theme.colors.primary }]}>
            Customize
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  compactContainer: {
    marginTop: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactText: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  categorySection: {
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modificationsList: {
    marginLeft: 8,
  },
  modificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modificationText: {
    fontSize: 14,
    flex: 1,
  },
  modificationPrice: {
    fontSize: 13,
    marginLeft: 8,
  },
  instructionsSection: {
    marginBottom: 12,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  instructionsText: {
    fontSize: 14,
    marginLeft: 18,
    fontStyle: 'italic',
  },
  priceBreakdown: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 13,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 12,
  },
  customizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  lineTotalLabel: {
    fontWeight: 'bold',
  },
  lineTotalValue: {
    fontWeight: 'bold',
  },
});
