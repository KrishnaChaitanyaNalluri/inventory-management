import { useEffect, useState } from 'react';
import { getPurchaseDraft, PURCHASE_DRAFT_EVENT, PurchaseDraftRow } from '@/lib/inventoryHelpers';

export function usePurchaseDraftRows(): PurchaseDraftRow[] {
  const [rows, setRows] = useState<PurchaseDraftRow[]>(getPurchaseDraft);

  useEffect(() => {
    const sync = () => setRows([...getPurchaseDraft()]);
    window.addEventListener(PURCHASE_DRAFT_EVENT, sync);
    return () => window.removeEventListener(PURCHASE_DRAFT_EVENT, sync);
  }, []);

  return rows;
}

export function usePurchaseDraftCount(): number {
  const [n, setN] = useState(() => getPurchaseDraft().length);
  useEffect(() => {
    const sync = () => setN(getPurchaseDraft().length);
    window.addEventListener(PURCHASE_DRAFT_EVENT, sync);
    return () => window.removeEventListener(PURCHASE_DRAFT_EVENT, sync);
  }, []);
  return n;
}
