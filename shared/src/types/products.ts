export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  is_available: boolean;
  sort_order: number;
  variants?: ProductVariant[];
  modifiers?: ProductModifier[];
  nutritional_info?: NutritionalInfo;
  allergens?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface ProductModifier {
  id: string;
  name: string;
  description?: string;
  options: ModifierOption[];
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  sort_order: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface MenuSection {
  category: ProductCategory;
  products: Product[];
}