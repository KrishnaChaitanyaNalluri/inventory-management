import { ActionType, InventoryTransaction } from '@/types/inventory';

const STOCK_ACTIONS: ActionType[] = ['add', 'subtract', 'offsite_add', 'offsite_subtract'];

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Latest on-hand stock adjustment per item (from loaded transaction history). */
export function buildLastStockEditMap(
  transactions: InventoryTransaction[],
): Record<string, { at: string; by: string }> {
  const m: Record<string, { at: string; by: string; t: number }> = {};
  for (const t of transactions) {
    if (!STOCK_ACTIONS.includes(t.action)) continue;
    const time = new Date(t.timestamp).getTime();
    if (!m[t.itemId] || time > m[t.itemId].t) {
      m[t.itemId] = { at: t.timestamp, by: t.employeeName, t: time };
    }
  }
  const out: Record<string, { at: string; by: string }> = {};
  for (const id of Object.keys(m)) {
    out[id] = { at: m[id].at, by: m[id].by };
  }
  return out;
}

const PURCHASE_DRAFT_KEY = 'dumont_purchase_draft';

/** Same-tab listeners (sessionStorage does not fire storage events in the same tab). */
export const PURCHASE_DRAFT_EVENT = 'dumont-purchase-draft';

export type PurchaseDraftRow = { id: string; name: string; addedAt: number };

function persistPurchaseDraft(arr: PurchaseDraftRow[]) {
  if (arr.length === 0) sessionStorage.removeItem(PURCHASE_DRAFT_KEY);
  else sessionStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify(arr));
  window.dispatchEvent(new Event(PURCHASE_DRAFT_EVENT));
}

export function getPurchaseDraft(): PurchaseDraftRow[] {
  try {
    const raw = sessionStorage.getItem(PURCHASE_DRAFT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PurchaseDraftRow[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addToPurchaseDraft(item: { id: string; name: string }): boolean {
  try {
    const arr = getPurchaseDraft();
    if (arr.some(x => x.id === item.id)) return false;
    persistPurchaseDraft([...arr, { ...item, addedAt: Date.now() }]);
    return true;
  } catch {
    return false;
  }
}

export function removeFromPurchaseDraft(id: string): void {
  persistPurchaseDraft(getPurchaseDraft().filter(x => x.id !== id));
}

export function clearPurchaseDraft(): void {
  persistPurchaseDraft([]);
}
