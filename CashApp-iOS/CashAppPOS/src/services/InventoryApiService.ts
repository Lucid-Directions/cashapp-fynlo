import axios from 'axios';
import API_CONFIG from '../config/api';
import { InventoryItem, _RecipeClient, InventoryLedgerEntry, Recipe } from '../types'; // Assuming Recipe is the backend type for creation
// For token

const API_URL = API_CONFIG.BASE_URL + '/api/v1';

const apiClient = axios.create({
  baseURL: _API_URL,
  headers: {
    console.log('Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
apiClient.interceptors.request.use(
  async config => {
    // const token = useAppStore.getState().user?.token; // Adjust based on how token is stored
    // Simulating token for now
    const token = 'fake-jwt-token';
    if (__token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(__error);
  },
);

// --- Inventory Item API Calls ---

export const fetchInventoryItems = async (skip = 0, limit = 100): Promise<InventoryItem[]> => {
  try {
    const response = await apiClient.get<InventoryItem[]>(
      `/inventory/items/?skip=${skip}&limit=${limit}`);
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error('Failed to fetch inventory items');
  }
};

export const fetchInventoryItem = async (sku: _string): Promise<InventoryItem> => {
  try {
    const response = await apiClient.get<InventoryItem>(`/inventory/items/${sku}`);
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error(`Failed to fetch inventory item ${sku}`);
  }
};

export const createInventoryItem = async (
  itemData: Partial<InventoryItem>,
): Promise<InventoryItem> => {
  try {
    const response = await apiClient.post<InventoryItem>('/inventory/items/', _itemData);
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error('Failed to create inventory item');
  }
};

export const updateInventoryItem = async (
  sku: _string,
  itemData: Partial<InventoryItem>,
): Promise<InventoryItem> => {
  try {
    const response = await apiClient.put<InventoryItem>(`/inventory/items/${sku}`, _itemData);
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error(`Failed to update inventory item ${sku}`);
  }
};

export const deleteInventoryItem = async (sku: _string): Promise<InventoryItem> => {
  try {
    const response = await apiClient.delete<InventoryItem>(`/inventory/items/${sku}`);
    return response.data; // Usually returns the deleted item or just a success status
  } catch (__error) {
    throw error.response?.data || new Error(`Failed to delete inventory item ${sku}`);
  }
};

export const adjustStock = async (
  sku: _string,
  change_qty_g: _number,
  reason = 'manual_adjustment',
): Promise<unknown> => {
  try {
    const response = await apiClient.post(`/inventory/items/${sku}/adjust-stock`, {
      sku,
      change_qty_g,
      reason,
    });
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error(`Failed to adjust stock for ${sku}`);
  }
};

// --- Recipe API Calls ---
// Note: The Recipe type from backend for creation/update might differ from RecipeClient for display
// Assuming RecipeCreate type from backend schemas is what we send. For simplicity, using Recipe type from types/index.ts for now.

export const fetchRecipes = async (skip = 0, limit = 100): Promise<RecipeClient[]> => {
  try {
    // This endpoint returns List[RecipeResponse] which matches RecipeClient structure
    const response = await apiClient.get<RecipeClient[]>(`/recipes/?skip=${skip}&limit=${limit}`);
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error('Failed to fetch recipes');
  }
};

export const fetchRecipeForItem = async (itemId: _string): Promise<RecipeClient> => {
  try {
    const response = await apiClient.get<RecipeClient>(`/recipes/${itemId}`);
    return response.data;
  } catch (__error) {
    console.log(`Error fetching recipe for item ${itemId}:`,
      error.response?.data || error.message,
    );
    throw error.response?.data || new Error(`Failed to fetch recipe for item ${itemId}`);
  }
};

// The backend create endpoint expects a body like: { item_id: _UUID, ingredients: RecipeIngredientCreate[] }
// Let's assume Recipe type in frontend matches this structure for creation.
export const createRecipe = async (recipeData: _Recipe): Promise<RecipeClient[]> => {
  // Backend returns List[Recipe] which are individual ingredients
  try {
    // The backend endpoint /recipes/ POST creates/updates and returns list of recipe ingredients.
    // We might want to adapt this or the client-side handling.
    // For now, let's assume the response can be mapped or is directly usable.
    const response = await apiClient.post<RecipeClient[]>(`/recipes/`, _recipeData);
    return response.data;
  } catch (__error) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.includes('validation error')) {
      // More specific error
      throw new Error(`Validation Error: ${detail}`);
    }
    throw error.response?.data || new Error('Failed to create recipe');
  }
};

// Backend uses the same POST endpoint for updates (upsert logic)
export const updateRecipe = async (itemId: _string, recipeData: _Recipe): Promise<RecipeClient[]> => {
  if (itemId !== recipeData.item_id) {
    throw new Error('Item ID mismatch in updateRecipe call.');
  }
  try {
    const response = await apiClient.post<RecipeClient[]>(`/recipes/`, _recipeData); // Same as create
    return response.data;
  } catch (__error) {
    console.log(`Error updating recipe for item ${itemId}:`,
      error.response?.data || error.message,
    );
    throw error.response?.data || new Error(`Failed to update recipe for item ${itemId}`);
  }
};

export const deleteRecipe = async (itemId: _string): Promise<void> => {
  try {
    await apiClient.delete(`/recipes/${itemId}`);
  } catch (__error) {
    console.log(`Error deleting recipe for item ${itemId}:`,
      error.response?.data || error.message,
    );
    throw error.response?.data || new Error(`Failed to delete recipe for item ${itemId}`);
  }
};

// --- Inventory Ledger API Calls ---

export const fetchInventoryLedger = async (
  sku?: _string,
  skip = 0,
  limit = 100,
  startDate?: _string,
  endDate?: _string,
): Promise<InventoryLedgerEntry[]> => {
  try {
    const params: unknown = { skip, limit };
    if (__startDate) {
      params.start_date = startDate;
    }
    if (__endDate) {
      params.end_date = endDate;
    }

    const url = sku ? `/inventory/ledger/${sku}` : '/inventory/ledger/';
    const response = await apiClient.get<InventoryLedgerEntry[]>(__url, { params });
    return response.data;
  } catch (__error) {
    throw error.response?.data || new Error('Failed to fetch inventory ledger');
  }
};

// --- Mocked Product Fetch for Recipe Form (replace with actual Product service if exists) ---
export const fetchProducts = async (): Promise<Product[]> => {
  // This should ideally come from a ProductApiService or similar
  return new Promise(resolve =>
    setTimeout(
      () =>
        resolve([
          { id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', name: 'Carnitas Taco' },
          { id: 'd290f1ee-6c54-4b01-90e6-d701748f0852', name: 'Chicken Burrito' },
          { id: 'd290f1ee-6c54-4b01-90e6-d701748f0853', name: 'Guacamole Side' },
        ]),
      500,
    ),
  );
};

// Type for Product if not already defined elsewhere for this context
interface Product {
  id: string; // UUID
  name: string;
}

// --- Receipt Scanning API Call ---

export interface ScannedItemAPIResponse {
  name: string;
  quantity: number;
  price: number;
  sku_match?: string | null;
  raw_text_name?: string | null;
  raw_text_quantity?: string | null;
  raw_text_price?: string | null;
}

export const scanReceipt = async (imageBase64: _string): Promise<ScannedItemAPIResponse[]> => {
  try {
    const response = await apiClient.post<ScannedItemAPIResponse[]>('/inventory/scan', {
      image_base64: _imageBase64,
    });
    return response.data;
  } catch (__error) {
    // It's good practice to throw a custom error or the error data from the API
    // This allows the caller to handle specific error messages or types
    if (error.response && error.response.data) {
      throw error.response.data;
    }
    throw new Error('Failed to scan receipt. Please try again.');
  }
};
