import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { InventoryItem, InventoryTransaction, ActionType, TransactionReason } from '@/types/inventory';
import { apiGetItems, apiGetTransactions, apiAdjustItem, apiUpdateThreshold } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface InventoryContextType {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  isLoading: boolean;
  error: string | null;
  addTransaction: (itemId: string, action: ActionType, quantity: number, reason: TransactionReason, note?: string) => Promise<void>;
  updateThreshold: (itemId: string, threshold: number) => Promise<void>;
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

  const updateThreshold = useCallback(async (itemId: string, threshold: number) => {
    await apiUpdateThreshold(itemId, threshold);
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, lowStockThreshold: threshold } : item
    ));
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
      addTransaction, updateThreshold, getItem, getLowStockItems, getRecentItems, searchItems,
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
