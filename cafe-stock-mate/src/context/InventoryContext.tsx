import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { InventoryItem, InventoryTransaction, ActionType, TransactionReason } from '@/types/inventory';
import {
  apiGetItems,
  apiGetTransactions,
  apiAdjustItem,
  apiUpdateThreshold,
  apiAdjustOffsite,
  apiUpdateItemMetadata,
  UpdateItemMetadataBody,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface InventoryContextType {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  isLoading: boolean;
  error: string | null;
  addTransaction: (itemId: string, action: ActionType, quantity: number, reason: TransactionReason, note?: string) => Promise<void>;
  /** ±1 with manual correction — for rush tap adjustments on the list. */
  quickAdjust: (itemId: string, direction: 'add' | 'subtract') => Promise<void>;
  updateThreshold: (itemId: string, threshold: number) => Promise<void>;
  /** Managers/admins — name, unit, category, etc. */
  updateItemMetadata: (itemId: string, body: UpdateItemMetadataBody) => Promise<void>;
  adjustOffsite: (
    itemId: string,
    action: 'add' | 'subtract',
    quantity: number,
    reason: TransactionReason,
    note?: string,
  ) => Promise<void>;
  getItem: (id: string) => InventoryItem | undefined;
  getLowStockItems: () => InventoryItem[];
  getRecentItems: () => InventoryItem[];
  searchItems: (query: string) => InventoryItem[];
  refresh: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedItems, fetchedTx] = await Promise.all([
        apiGetItems(),
        apiGetTransactions({ limit: 200 }),
      ]);
      setItems(fetchedItems);
      setTransactions(fetchedTx);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) loadAll();
  }, [currentUser, loadAll]);

  const addTransaction = useCallback(async (
    itemId: string,
    action: ActionType,
    quantity: number,
    reason: TransactionReason,
    note?: string,
  ) => {
    const tx = await apiAdjustItem(itemId, { action, quantity, reason, note });

    // Update local item quantity optimistically
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = action === 'add'
        ? item.currentQuantity + quantity
        : Math.max(0, item.currentQuantity - quantity);
      return { ...item, currentQuantity: newQty, updatedAt: tx.timestamp };
    }));

    // Prepend transaction
    setTransactions(prev => [tx, ...prev]);
  }, []);

  const quickAdjust = useCallback(async (itemId: string, direction: 'add' | 'subtract') => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    if (direction === 'subtract' && item.currentQuantity < 1) return;
    try {
      await addTransaction(
        itemId,
        direction === 'add' ? 'add' : 'subtract',
        1,
        'manual_correction',
        'Quick tap ±1',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update stock');
    }
  }, [items, addTransaction]);

  const updateThreshold = useCallback(async (itemId: string, threshold: number) => {
    await apiUpdateThreshold(itemId, threshold);
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, lowStockThreshold: threshold } : item
    ));
  }, []);

  const updateItemMetadata = useCallback(async (itemId: string, body: UpdateItemMetadataBody) => {
    const updated = await apiUpdateItemMetadata(itemId, body);
    setItems(prev => prev.map(i => (i.id === itemId ? updated : i)));
  }, []);

  const adjustOffsite = useCallback(async (
    itemId: string,
    action: 'add' | 'subtract',
    quantity: number,
    reason: TransactionReason,
    note?: string,
  ) => {
    const tx = await apiAdjustOffsite(itemId, { action, quantity, reason, note });
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const delta = action === 'add' ? quantity : -quantity;
      return {
        ...item,
        offsiteQuantity: Math.max(0, item.offsiteQuantity + delta),
        updatedAt: tx.timestamp,
      };
    }));
    setTransactions(prev => [tx, ...prev]);
  }, []);

  const getItem = useCallback((id: string) => items.find(i => i.id === id), [items]);

  const getLowStockItems = useCallback(
    () => items.filter(i => i.currentQuantity <= i.lowStockThreshold),
    [items],
  );

  const getRecentItems = useCallback(
    () => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [items],
  );

  const searchItems = useCallback((query: string) => {
    const q = query.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [items]);

  return (
    <InventoryContext.Provider value={{
      items, transactions, isLoading, error,
      addTransaction, quickAdjust, updateThreshold, updateItemMetadata, adjustOffsite, getItem, getLowStockItems, getRecentItems, searchItems,
      refresh: loadAll,
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
