export type StorageLocation = 'storage_room' | 'fridge' | 'freezer' | 'front_counter';

export type UserRole = 'employee' | 'manager' | 'admin';

/** Managers and admins can edit low-stock thresholds. */
export function canEditThreshold(role: UserRole | undefined): boolean {
  return role === 'manager' || role === 'admin';
}

/** Adding new inventory SKUs — managers and admins only (not employees). */
export function canAddInventoryItems(role: UserRole | undefined): boolean {
  return canEditThreshold(role);
}

/** Managers and admins see the off-site storage tab and can adjust those counts. */
export function canManageOffsiteStorage(role: UserRole | undefined): boolean {
  return role === 'manager' || role === 'admin';
}

export type ActionType = 'add' | 'subtract' | 'set_threshold' | 'offsite_add' | 'offsite_subtract';

export type TransactionReason =
  | 'moved_to_front'
  | 'prep_kitchen'
  | 'new_delivery'
  | 'spoilage_waste'
  | 'damaged'
  | 'manual_correction'
  | 'threshold_change'
  | 'offsite_delivery'
  | 'offsite_to_cafe';

export const REASON_LABELS: Record<TransactionReason, string> = {
  moved_to_front: 'Moved to front counter',
  prep_kitchen: 'Prep / Kitchen use',
  new_delivery: 'New delivery',
  spoilage_waste: 'Spoilage / Waste',
  damaged: 'Damaged',
  manual_correction: 'Manual correction',
  threshold_change: 'Low stock threshold updated',
  offsite_delivery: 'Off-site · Delivery / received',
  offsite_to_cafe: 'Off-site · Toward cafe (update cafe stock separately)',
};

export const CATEGORIES = [
  'Ice Creams',
  'Cups & Lids',
  'Teas',
  'Boba Ingredients',
  'Coffee Ingredients',
  'Milk & Dairy Alternatives',
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
  /** Stock held outside the cafe (managers only in UI). */
  offsiteQuantity: number;
  lowStockThreshold: number;
  storageLocation?: StorageLocation;
  updatedAt: string;
  note?: string;
}

/** True “out” for dashboards (ice cream placeholders often stay at 0 on purpose). */
export function isTrueOutOfStock(item: InventoryItem): boolean {
  return item.currentQuantity === 0 && item.category !== 'Ice Creams';
}

/** At or below low-stock threshold (includes zero). */
export function needsAttention(item: InventoryItem): boolean {
  return item.currentQuantity <= item.lowStockThreshold;
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
