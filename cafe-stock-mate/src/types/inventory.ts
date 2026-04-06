export type StorageLocation = 'storage_room' | 'fridge' | 'freezer' | 'front_counter';

export type UserRole = 'employee' | 'manager';

export type ActionType = 'add' | 'subtract';

export type TransactionReason =
  | 'moved_to_front'
  | 'prep_kitchen'
  | 'new_delivery'
  | 'spoilage_waste'
  | 'damaged'
  | 'manual_correction';

export const REASON_LABELS: Record<TransactionReason, string> = {
  moved_to_front: 'Moved to front counter',
  prep_kitchen: 'Prep / Kitchen use',
  new_delivery: 'New delivery',
  spoilage_waste: 'Spoilage / Waste',
  damaged: 'Damaged',
  manual_correction: 'Manual correction',
};

export const CATEGORIES = [
  'Ice Creams',
  'Cups & Lids',
  'Teas',
  'Boba Ingredients',
  'Coffee Ingredients',
  'Sweeteners',
  'Toppings & Add-ins',
  'Disposables & Utensils',
  'Cleaning & Sanitation',
  'Packaging & Misc',
] as const;

export type Category = typeof CATEGORIES[number];

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  pin?: string;
  role: UserRole;
  avatar?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  subCategory?: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  storageLocation?: StorageLocation;
  updatedAt: string;
  note?: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  action: ActionType;
  quantity: number;
  reason: TransactionReason;
  note?: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
}
