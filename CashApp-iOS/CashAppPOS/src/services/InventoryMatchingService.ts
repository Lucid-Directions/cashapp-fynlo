/**
 * InventoryMatchingService - Smart matching of receipt items to inventory items
 * Uses fuzzy string matching and heuristics to identify inventory items from receipt data
 */

import { InventoryItem } from '../types';

export interface MatchingResult {
  sku: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'category';
  inventoryItem: InventoryItem;
}

export interface MatchingOptions {
  minConfidence: number;
  enableFuzzyMatching: boolean;
  enablePartialMatching: boolean;
  enableCategoryMatching: boolean;
  maxResults: number;
}

class InventoryMatchingService {
  private defaultOptions: MatchingOptions = {
    minConfidence: 0.6,
    enableFuzzyMatching: true,
    enablePartialMatching: true,
    enableCategoryMatching: true,
    maxResults: 5,
  };

  /**
   * Find matching inventory items for a receipt item name
   */
  findMatches(
    itemName: string,
    inventoryItems: InventoryItem[],
    options: Partial<MatchingOptions> = {}
  ): MatchingResult[] {
    const opts = { ...this.defaultOptions, ...options };
    const normalizedItemName = this.normalizeString(itemName);
    const matches: MatchingResult[] = [];

    for (const inventoryItem of inventoryItems) {
      const confidence = this.calculateMatchConfidence(normalizedItemName, inventoryItem, opts);
      
      if (confidence >= opts.minConfidence) {
        matches.push({
          sku: inventoryItem.sku,
          confidence,
          matchType: this.determineMatchType(normalizedItemName, inventoryItem, confidence),
          inventoryItem,
        });
      }
    }

    // Sort by confidence (highest first) and limit results
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, opts.maxResults);
  }

  /**
   * Get the best match for a receipt item
   */
  getBestMatch(
    itemName: string,
    inventoryItems: InventoryItem[],
    options: Partial<MatchingOptions> = {}
  ): MatchingResult | null {
    const matches = this.findMatches(itemName, inventoryItems, options);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Calculate match confidence between receipt item and inventory item
   */
  private calculateMatchConfidence(
    normalizedItemName: string,
    inventoryItem: InventoryItem,
    options: MatchingOptions
  ): number {
    const normalizedInventoryName = this.normalizeString(inventoryItem.name);
    const normalizedDescription = inventoryItem.description 
      ? this.normalizeString(inventoryItem.description) 
      : '';

    // Exact match gets highest confidence
    if (normalizedItemName === normalizedInventoryName) {
      return 1.0;
    }

    // Check for exact match in description
    if (normalizedDescription && normalizedItemName === normalizedDescription) {
      return 0.95;
    }

    let maxConfidence = 0;

    // Fuzzy matching on name
    if (options.enableFuzzyMatching) {
      const fuzzyConfidence = this.calculateLevenshteinSimilarity(
        normalizedItemName,
        normalizedInventoryName
      );
      maxConfidence = Math.max(maxConfidence, fuzzyConfidence * 0.9);

      // Fuzzy matching on description
      if (normalizedDescription) {
        const descriptionFuzzyConfidence = this.calculateLevenshteinSimilarity(
          normalizedItemName,
          normalizedDescription
        );
        maxConfidence = Math.max(maxConfidence, descriptionFuzzyConfidence * 0.85);
      }
    }

    // Partial matching - check if one string contains the other
    if (options.enablePartialMatching) {
      if (normalizedInventoryName.includes(normalizedItemName) || 
          normalizedItemName.includes(normalizedInventoryName)) {
        maxConfidence = Math.max(maxConfidence, 0.8);
      }

      if (normalizedDescription && 
          (normalizedDescription.includes(normalizedItemName) || 
           normalizedItemName.includes(normalizedDescription))) {
        maxConfidence = Math.max(maxConfidence, 0.75);
      }
    }

    // Word-based matching
    const itemWords = normalizedItemName.split(/\s+/);
    const inventoryWords = normalizedInventoryName.split(/\s+/);
    const commonWords = itemWords.filter(word => 
      inventoryWords.some(invWord => invWord.includes(word) || word.includes(invWord))
    );

    if (commonWords.length > 0) {
      const wordMatchConfidence = (commonWords.length / Math.max(itemWords.length, inventoryWords.length)) * 0.7;
      maxConfidence = Math.max(maxConfidence, wordMatchConfidence);
    }

    // Category-based matching (lower confidence boost)
    if (options.enableCategoryMatching && inventoryItem.category) {
      const normalizedCategory = this.normalizeString(inventoryItem.category);
      if (normalizedItemName.includes(normalizedCategory) || 
          itemWords.some(word => normalizedCategory.includes(word))) {
        maxConfidence = Math.max(maxConfidence, 0.4);
      }
    }

    return Math.min(maxConfidence, 1.0);
  }

  /**
   * Determine the type of match based on confidence and matching patterns
   */
  private determineMatchType(
    normalizedItemName: string,
    inventoryItem: InventoryItem,
    confidence: number
  ): 'exact' | 'fuzzy' | 'partial' | 'category' {
    const normalizedInventoryName = this.normalizeString(inventoryItem.name);

    if (confidence >= 0.95) {
      return 'exact';
    }

    if (normalizedInventoryName.includes(normalizedItemName) || 
        normalizedItemName.includes(normalizedInventoryName)) {
      return 'partial';
    }

    if (confidence >= 0.7) {
      return 'fuzzy';
    }

    return 'category';
  }

  /**
   * Normalize string for comparison (lowercase, remove special chars, trim)
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate Levenshtein distance-based similarity
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Batch match multiple receipt items
   */
  batchMatch(
    itemNames: string[],
    inventoryItems: InventoryItem[],
    options: Partial<MatchingOptions> = {}
  ): { [itemName: string]: MatchingResult | null } {
    const results: { [itemName: string]: MatchingResult | null } = {};

    for (const itemName of itemNames) {
      results[itemName] = this.getBestMatch(itemName, inventoryItems, options);
    }

    return results;
  }

  /**
   * Validate a potential match based on business rules
   */
  validateMatch(
    itemName: string,
    matchResult: MatchingResult,
    quantity?: number,
    price?: number
  ): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid = true;

    // Check confidence threshold
    if (matchResult.confidence < 0.8) {
      warnings.push(`Low confidence match (${Math.round(matchResult.confidence * 100)}%)`);
    }

    // Check quantity reasonableness
    if (quantity && matchResult.inventoryItem.par_level_g) {
      const quantityInGrams = quantity * 1000; // Assume quantity is in kg for receipts
      if (quantityInGrams > matchResult.inventoryItem.par_level_g * 2) {
        warnings.push('Quantity seems unusually high for this item');
      }
    }

    // Check price reasonableness
    if (price && matchResult.inventoryItem.cost_per_unit) {
      const expectedPrice = (quantity || 1) * matchResult.inventoryItem.cost_per_unit * 1000; // Convert to kg
      const priceDifference = Math.abs(price - expectedPrice) / expectedPrice;
      
      if (priceDifference > 0.5) { // 50% difference
        warnings.push('Price differs significantly from expected cost');
      }
    }

    // Suggestions based on match type
    switch (matchResult.matchType) {
      case 'partial':
        suggestions.push('Consider updating inventory item name for better matching');
        break;
      case 'category':
        suggestions.push('Low confidence match - verify this is the correct item');
        isValid = false;
        break;
      case 'fuzzy':
        if (matchResult.confidence < 0.7) {
          suggestions.push('Consider manual verification of this match');
        }
        break;
    }

    return { isValid, warnings, suggestions };
  }
}

// Create default matching service instance
export const inventoryMatchingService = new InventoryMatchingService();

export default InventoryMatchingService;