/**
 * Tests for useItemModifications hook
 * Validates modification state management and user interactions
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useItemModifications } from '../useItemModifications';
import { EnhancedOrderItem, CartItemModification } from '../../types/cart';
import { ModificationPricingService } from '../../services/ModificationPricingService';

// Mock the stores and services
jest.mock('../../store/useEnhancedCartStore');
jest.mock('../../store/cartStoreAdapter');
jest.mock('../../services/ModificationPricingService');

describe('useItemModifications', () => {
  const mockItem: EnhancedOrderItem = {
    id: '123',
    productId: 'prod-1',
    name: 'Cappuccino',
    price: 3.5,
    quantity: 1,
    originalPrice: 3.5,
    modificationPrice: 0,
    totalPrice: 3.5,
    modifications: [],
    categoryName: 'coffee',
    emoji: '☕',
    addedAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    addedBy: 'user-1',
  };

  const mockModifications: CartItemModification[] = [
    {
      id: 'size-small',
      type: 'size',
      category: 'Size',
      name: 'Small',
      price: -0.5,
      selected: false,
    },
    {
      id: 'size-medium',
      type: 'size',
      category: 'Size',
      name: 'Medium',
      price: 0.0,
      selected: true,
    },
    {
      id: 'size-large',
      type: 'size',
      category: 'Size',
      name: 'Large',
      price: 0.5,
      selected: false,
    },
    {
      id: 'temp-hot',
      type: 'temperature',
      category: 'Temp',
      name: 'Hot',
      price: 0.0,
      selected: true,
    },
    {
      id: 'temp-iced',
      type: 'temperature',
      category: 'Temp',
      name: 'Iced',
      price: 0.0,
      selected: false,
    },
    {
      id: 'add-shot',
      type: 'addition',
      category: 'Add-ons',
      name: 'Extra Shot',
      price: 0.75,
      selected: false,
      quantity: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ModificationPricingService
    const mockPricingService = {
      getAvailableModifications: jest.fn().mockReturnValue(mockModifications),
      calculateModificationPrice: jest.fn().mockReturnValue(0),
      validateModifications: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      resetToDefaults: jest.fn().mockReturnValue(mockModifications),
      getModificationSummary: jest.fn().mockReturnValue('Medium, Hot'),
      getPriceImpactSummary: jest.fn().mockReturnValue('No price change'),
    };

    (ModificationPricingService.getInstance as jest.Mock).mockReturnValue(mockPricingService);
  });

  describe('initialization', () => {
    it('initializes with item modifications if available', () => {
      const itemWithMods = {
        ...mockItem,
        modifications: [
          { ...mockModifications[2], selected: true }, // Large selected
          { ...mockModifications[3], selected: false }, // Hot deselected
        ],
      };

      const { result } = renderHook(() =>
        useItemModifications({ item: itemWithMods, useEnhancedCart: false })
      );

      expect(result.current.modifications).toEqual(itemWithMods.modifications);
    });

    it('initializes with default modifications for category', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(
        ModificationPricingService.getInstance().getAvailableModifications
      ).toHaveBeenCalledWith('coffee');
      expect(result.current.modifications).toEqual(mockModifications);
    });

    it('initializes special instructions from item', () => {
      const itemWithInstructions = {
        ...mockItem,
        specialInstructions: 'Extra hot please',
      };

      const { result } = renderHook(() =>
        useItemModifications({ item: itemWithInstructions, useEnhancedCart: false })
      );

      expect(result.current.specialInstructions).toBe('Extra hot please');
    });
  });

  describe('toggleModification', () => {
    it('toggles modification selection', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      act(() => {
        result.current.toggleModification('add-shot');
      });

      const extraShot = result.current.modifications.find((m) => m.id === 'add-shot');
      expect(extraShot?.selected).toBe(true);
    });

    it('enforces exclusive size selection', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      // Medium is selected by default
      act(() => {
        result.current.toggleModification('size-large');
      });

      const medium = result.current.modifications.find((m) => m.id === 'size-medium');
      const large = result.current.modifications.find((m) => m.id === 'size-large');

      expect(medium?.selected).toBe(false);
      expect(large?.selected).toBe(true);
    });

    it('enforces exclusive temperature selection', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      // Hot is selected by default
      act(() => {
        result.current.toggleModification('temp-iced');
      });

      const hot = result.current.modifications.find((m) => m.id === 'temp-hot');
      const iced = result.current.modifications.find((m) => m.id === 'temp-iced');

      expect(hot?.selected).toBe(false);
      expect(iced?.selected).toBe(true);
    });
  });

  describe('updateModificationQuantity', () => {
    it('updates quantity for modifications that support it', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      // First select the extra shot
      act(() => {
        result.current.toggleModification('add-shot');
      });

      // Then update quantity
      act(() => {
        result.current.updateModificationQuantity('add-shot', 3);
      });

      const extraShot = result.current.modifications.find((m) => m.id === 'add-shot');
      expect(extraShot?.quantity).toBe(3);
    });

    it('clamps quantity between 1 and 10', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      act(() => {
        result.current.updateModificationQuantity('add-shot', 15);
      });

      const extraShot = result.current.modifications.find((m) => m.id === 'add-shot');
      expect(extraShot?.quantity).toBe(10);

      act(() => {
        result.current.updateModificationQuantity('add-shot', 0);
      });

      expect(result.current.modifications.find((m) => m.id === 'add-shot')?.quantity).toBe(1);
    });
  });

  describe('pricing calculations', () => {
    it('calculates modification price correctly', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.calculateModificationPrice.mockReturnValue(1.25);

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.modificationPrice).toBe(1.25);
    });

    it('calculates total price with quantity', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.calculateModificationPrice.mockReturnValue(0.5);

      const itemWithQuantity = { ...mockItem, quantity: 2 };
      const { result } = renderHook(() =>
        useItemModifications({ item: itemWithQuantity, useEnhancedCart: false })
      );

      // (3.50 + 0.50) * 2 = 8.00
      expect(result.current.totalPrice).toBe(8.0);
    });
  });

  describe('validation', () => {
    it('reflects validation state from pricing service', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.validateModifications.mockReturnValue({
        isValid: false,
        errors: ['Only one size can be selected'],
      });

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors).toContain('Only one size can be selected');
    });
  });

  describe('change detection', () => {
    it('detects changes to modifications', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.hasChanges).toBe(false);

      act(() => {
        result.current.toggleModification('add-shot');
      });

      expect(result.current.hasChanges).toBe(true);
    });

    it('detects changes to special instructions', () => {
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.hasChanges).toBe(false);

      act(() => {
        result.current.setSpecialInstructions('Extra foam please');
      });

      expect(result.current.hasChanges).toBe(true);
    });
  });

  describe('resetModifications', () => {
    it('resets to original item modifications', () => {
      const itemWithMods = {
        ...mockItem,
        modifications: [{ ...mockModifications[2], selected: true }],
        specialInstructions: 'Original instructions',
      };

      const { result } = renderHook(() =>
        useItemModifications({ item: itemWithMods, useEnhancedCart: false })
      );

      // Make changes
      act(() => {
        result.current.toggleModification('add-shot');
        result.current.setSpecialInstructions('New instructions');
      });

      // Reset
      act(() => {
        result.current.resetModifications();
      });

      expect(result.current.modifications).toEqual(itemWithMods.modifications);
      expect(result.current.specialInstructions).toBe('Original instructions');
      expect(result.current.hasChanges).toBe(false);
    });

    it('resets to defaults when no original modifications', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      act(() => {
        result.current.resetModifications();
      });

      expect(mockPricingService.resetToDefaults).toHaveBeenCalled();
    });
  });

  describe('applyModifications', () => {
    it('updates cart with modifications', () => {
      const mockStore = {
        modifyCartItem: jest.fn(),
        setItemSpecialInstructions: jest.fn(),
      };

      // Mock the cart store adapter
      jest.doMock('../../store/cartStoreAdapter', () => ({
        useCartStore: jest.fn(() => mockStore),
      }));

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      act(() => {
        result.current.toggleModification('add-shot');
        result.current.setSpecialInstructions('Extra hot');
        result.current.applyModifications();
      });

      expect(mockStore.modifyCartItem).toHaveBeenCalledWith('123', expect.any(Array));
      expect(mockStore.setItemSpecialInstructions).toHaveBeenCalledWith('123', 'Extra hot');
    });

    it('does not apply if validation fails', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.validateModifications.mockReturnValue({
        isValid: false,
        errors: ['Invalid selection'],
      });

      const mockStore = {
        modifyCartItem: jest.fn(),
        setItemSpecialInstructions: jest.fn(),
      };

      jest.doMock('../../store/cartStoreAdapter', () => ({
        useCartStore: jest.fn(() => mockStore),
      }));

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      act(() => {
        result.current.applyModifications();
      });

      expect(mockStore.modifyCartItem).not.toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('provides modification summary', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.getModificationSummary.mockReturnValue('Large, Iced, Extra Shot');

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.getModificationSummary()).toBe('Large, Iced, Extra Shot');
    });

    it('provides price impact summary', () => {
      const mockPricingService =
        ModificationPricingService.getInstance() as jest.Mocked<ModificationPricingService>;
      mockPricingService.getPriceImpactSummary.mockReturnValue('+$1.25');

      const { result } = renderHook(() =>
        useItemModifications({ item: mockItem, useEnhancedCart: false })
      );

      expect(result.current.getPriceImpactSummary()).toBe('+$1.25');
    });
  });
});
