/**
 * CostAnalysisDashboard - Comprehensive cost analysis and profitability dashboard
 * Provides real-time insights into COGS, waste costs, profitability, and pricing optimization
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Colors from '../../constants/Colors';
import { costCalculationService, MenuItemCost, InventoryCostReport } from '../../services/CostCalculationService';
import useInventoryStore from '../../store/useInventoryStore';

const { width: screenWidth } = Dimensions.get('window');

interface CostAnalysisDashboardProps {
  visible: boolean;
  onClose: () => void;
}

interface DashboardTab {
  id: string;
  title: string;
  icon: string;
}

const tabs: DashboardTab[] = [
  { id: 'overview', title: 'Overview', icon: 'dashboard' },
  { id: 'waste', title: 'Waste Analysis', icon: 'delete-outline' },
  { id: 'profitability', title: 'Profitability', icon: 'trending-up' },
  { id: 'pricing', title: 'Pricing', icon: 'attach-money' },
];

const CostAnalysisDashboard: React.FC<CostAnalysisDashboardProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [costReport, setCostReport] = useState<InventoryCostReport | null>(null);
  const [menuItemCosts, setMenuItemCosts] = useState<MenuItemCost[]>([]);

  const { inventoryItems, costAnalysis, loadCostAnalysis } = useInventoryStore();

  useEffect(() => {
    if (visible) {
      loadDashboardData();
    }
  }, [visible]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load cost analysis from store
      await loadCostAnalysis();
      
      // Calculate comprehensive cost report
      const report = costCalculationService.calculateInventoryCostReport(inventoryItems);
      setCostReport(report);

      // TODO: Load menu items and calculate costs
      // This would integrate with menu management system
      setMenuItemCosts([]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContainer}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Icon 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? Colors.white : Colors.darkGray} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Key Metrics Cards */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Icon name="inventory" size={24} color={Colors.primary} />
          <Text style={styles.metricValue}>
            ${costReport?.totalInventoryValue.toFixed(0) || '0'}
          </Text>
          <Text style={styles.metricLabel}>Inventory Value</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Icon name="trending-down" size={24} color={Colors.danger} />
          <Text style={styles.metricValue}>
            ${costReport?.totalWasteCost.toFixed(0) || '0'}
          </Text>
          <Text style={styles.metricLabel}>Waste Cost</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Icon name="percent" size={24} color={Colors.warning} />
          <Text style={styles.metricValue}>
            {costReport?.wastePercentage.toFixed(1) || '0'}%
          </Text>
          <Text style={styles.metricLabel}>Waste Percentage</Text>
        </View>
        
        <View style={styles.metricCard}>
          <Icon name="monetization-on" size={24} color={Colors.success} />
          <Text style={styles.metricValue}>
            ${costReport?.monthlyCOGS.toFixed(0) || '0'}
          </Text>
          <Text style={styles.metricLabel}>Monthly COGS</Text>
        </View>
      </View>

      {/* Category Breakdown */}
      {costReport && costReport.costCategories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost by Category</Text>
          {costReport.costCategories.map((category, index) => (
            <View key={index} style={styles.categoryRow}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.category}</Text>
                <Text style={styles.categoryWaste}>
                  {category.wastePercentage.toFixed(1)}% waste
                </Text>
              </View>
              <Text style={styles.categoryValue}>
                ${category.totalCost.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setActiveTab('waste')}
          >
            <Icon name="delete-outline" size={32} color={Colors.danger} />
            <Text style={styles.actionLabel}>Manage Waste</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setActiveTab('pricing')}
          >
            <Icon name="attach-money" size={32} color={Colors.success} />
            <Text style={styles.actionLabel}>Price Optimization</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderWasteTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Waste Items</Text>
        {costReport?.topWasteItems.map((item, index) => (
          <View key={index} style={styles.wasteItemRow}>
            <View style={styles.wasteItemInfo}>
              <Text style={styles.wasteItemName}>{item.name}</Text>
              <Text style={styles.wasteItemSku}>SKU: {item.sku}</Text>
            </View>
            <View style={styles.wasteItemCosts}>
              <Text style={styles.wasteItemCost}>
                ${item.wasteCost.toFixed(2)}
              </Text>
              <Text style={[
                styles.wasteItemPercent,
                { color: getWasteColor(item.wastePercentage) }
              ]}>
                {item.wastePercentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Waste Reduction Recommendations</Text>
        <View style={styles.recommendationCard}>
          <Icon name="lightbulb-outline" size={24} color={Colors.warning} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>
              Focus on High-Impact Items
            </Text>
            <Text style={styles.recommendationText}>
              The top 3 waste items account for {
                costReport?.topWasteItems.slice(0, 3)
                  .reduce((sum, item) => sum + item.wasteCost, 0)
                  .toFixed(0)
              }% of total waste cost. Prioritize these for immediate action.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderProfitabilityTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Menu Item Profitability</Text>
        {menuItemCosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="restaurant-menu" size={48} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>
              Menu integration pending
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Connect menu items to see profitability analysis
            </Text>
          </View>
        ) : (
          menuItemCosts.map((item, index) => (
            <View key={index} style={styles.profitabilityRow}>
              {/* Menu item profitability display */}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing Optimization</Text>
        
        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>Target Margin Analysis</Text>
          <Text style={styles.pricingDescription}>
            Current configuration targets {costCalculationService.getConfig().targetMarginPercentage}% margin
          </Text>
          
          <View style={styles.marginBreakdown}>
            <View style={styles.marginItem}>
              <Text style={styles.marginLabel}>Ingredient Cost</Text>
              <View style={styles.marginBar}>
                <View style={[styles.marginFill, { width: '40%', backgroundColor: Colors.primary }]} />
              </View>
              <Text style={styles.marginPercent}>40%</Text>
            </View>
            
            <View style={styles.marginItem}>
              <Text style={styles.marginLabel}>Waste Cost</Text>
              <View style={styles.marginBar}>
                <View style={[styles.marginFill, { width: '5%', backgroundColor: Colors.danger }]} />
              </View>
              <Text style={styles.marginPercent}>5%</Text>
            </View>
            
            <View style={styles.marginItem}>
              <Text style={styles.marginLabel}>Labor Cost</Text>
              <View style={styles.marginBar}>
                <View style={[styles.marginFill, { width: '25%', backgroundColor: Colors.warning }]} />
              </View>
              <Text style={styles.marginPercent}>25%</Text>
            </View>
            
            <View style={styles.marginItem}>
              <Text style={styles.marginLabel}>Target Profit</Text>
              <View style={styles.marginBar}>
                <View style={[styles.marginFill, { width: '30%', backgroundColor: Colors.success }]} />
              </View>
              <Text style={styles.marginPercent}>30%</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const getWasteColor = (wastePercent: number): string => {
    if (wastePercent <= 2) return Colors.success;
    if (wastePercent <= 5) return Colors.warning;
    return Colors.danger;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading cost analysis...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'waste':
        return renderWasteTab();
      case 'profitability':
        return renderProfitabilityTab();
      case 'pricing':
        return renderPricingTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Cost Analysis</Text>
          <TouchableOpacity onPress={loadDashboardData} style={styles.refreshButton}>
            <Icon name="refresh" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {renderTabBar()}
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tabContainer: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    gap: 6,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  activeTabText: {
    color: Colors.white,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.darkGray,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: (screenWidth - 56) / 2,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  categoryWaste: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  wasteItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  wasteItemInfo: {
    flex: 1,
  },
  wasteItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  wasteItemSku: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  wasteItemCosts: {
    alignItems: 'flex-end',
  },
  wasteItemCost: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  wasteItemPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.warning + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  profitabilityRow: {
    // Placeholder for profitability display
  },
  pricingCard: {
    backgroundColor: Colors.lightGray,
    padding: 16,
    borderRadius: 12,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  pricingDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 16,
  },
  marginBreakdown: {
    gap: 12,
  },
  marginItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marginLabel: {
    fontSize: 14,
    color: Colors.text,
    width: 100,
  },
  marginBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  marginFill: {
    height: '100%',
    borderRadius: 4,
  },
  marginPercent: {
    fontSize: 12,
    color: Colors.darkGray,
    width: 40,
    textAlign: 'right',
  },
});

export default CostAnalysisDashboard;