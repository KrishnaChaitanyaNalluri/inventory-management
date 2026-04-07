import { useState, useRef } from 'react';
import { Bell, Minus, Pencil, Plus, ShoppingCart } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/inventoryHelpers';

interface ItemCardProps {
  item: InventoryItem;
  onQuickAdd: (item: InventoryItem) => void | Promise<void>;
  onQuickSubtract: (item: InventoryItem) => void | Promise<void>;
  /** Opens full form (delivery, larger counts, other reasons). */
  onOpenAdjust: (item: InventoryItem, action: 'add' | 'subtract') => void;
  onThresholdChange?: (item: InventoryItem, threshold: number) => void;
  /** Managers/admins only — open edit name / unit / category */
  onEditDetails?: (item: InventoryItem) => void;
  /** Managers/admins only — same gate as onEditDetails; session to-order list */
  onAddToPurchaseList?: (item: InventoryItem) => void;
  /** Restock mode: current “focus” row for faster scanning */
  restockFocus?: boolean;
  /** From activity log — latest stock change for this item */
  lastStockEdit?: { at: string; by: string } | null;
}

const LOCATION_LABELS: Record<string, string> = {
  storage_room: 'Storage',
  fridge: 'Fridge',
  freezer: 'Freezer',
  front_counter: 'Counter',
};

export function ItemCard({
  item,
  onQuickAdd,
  onQuickSubtract,
  onOpenAdjust,
  onThresholdChange,
  onEditDetails,
  onAddToPurchaseList,
  restockFocus,
  lastStockEdit,
}: ItemCardProps) {
  const isOut = item.currentQuantity === 0;
  const isLow = !isOut && item.currentQuantity <= item.lowStockThreshold;
  const isGood = !isOut && !isLow;

  const [busy, setBusy] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [draft, setDraft] = useState(String(item.lowStockThreshold));
  const inputRef = useRef<HTMLInputElement>(null);

  async function runQuick(fn: (i: InventoryItem) => void | Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn(item);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(String(item.lowStockThreshold));
    setEditingThreshold(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function saveEdit() {
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val >= 0 && val !== item.lowStockThreshold) {
      onThresholdChange!(item, val);
    }
    setEditingThreshold(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingThreshold(false);
  }

  const stepperBtn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none active:bg-muted';

  return (
    <div
      id={`inventory-card-${item.id}`}
      className={cn(
        'rounded-2xl border bg-card flex items-center gap-3 px-4 py-3 shadow-sm',
        isOut && 'border-2 border-destructive',
        isLow && 'border-2 border-amber-400',
        isGood && 'border border-border',
        restockFocus && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p className="font-semibold text-[15px] leading-snug text-foreground truncate">{item.name}</p>
          {onEditDetails && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onEditDetails(item);
              }}
              className="shrink-0 rounded-lg border border-border bg-muted/50 p-1.5 text-muted-foreground active:bg-muted"
              aria-label={`Edit details for ${item.name}`}
              title="Edit name, unit, category"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Only with edit — both are passed together for manager/admin from Inventory & Home */}
          {onEditDetails && onAddToPurchaseList && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onAddToPurchaseList(item);
              }}
              className="shrink-0 rounded-lg border border-primary/35 bg-primary/5 p-1.5 text-primary active:bg-primary/10"
              aria-label={`Add ${item.name} to purchase list`}
              title="Add to purchase list"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </button>
          )}
          {isOut && (
            <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Out
            </span>
          )}
          {isLow && (
            <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Low
            </span>
          )}
          {isGood && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Good
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {item.category}
          {item.storageLocation ? ` · ${LOCATION_LABELS[item.storageLocation]}` : ''}
        </p>

        {/* Low-stock alert threshold — managers and admins only */}
        {onThresholdChange && (
          <div className="mt-1.5">
            {editingThreshold ? (
              <div className="flex items-center gap-1.5">
                <Bell className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700 font-medium">Alert when ≤</span>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  onClick={e => e.stopPropagation()}
                  className="w-12 text-xs border border-amber-400 rounded-md px-1.5 py-0.5 text-center bg-white text-amber-800 font-semibold outline-none focus:ring-1 focus:ring-amber-400"
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 active:bg-amber-100 transition-colors"
              >
                <Bell className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700">Alert ≤ {item.lowStockThreshold}</span>
              </button>
            )}
          </div>
        )}

        {item.note && (
          <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate italic">{item.note}</p>
        )}
        {lastStockEdit && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Updated {formatRelativeTime(lastStockEdit.at)} by {lastStockEdit.by}
          </p>
        )}
      </div>

      {/* Quick stepper + tap center for full form */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={busy || item.currentQuantity < 1}
            onClick={() => void runQuick(onQuickSubtract)}
            className={cn(stepperBtn, 'active:bg-red-50 active:border-red-200 active:text-destructive')}
            aria-label={`Remove 1 ${item.unit} from ${item.name}`}
          >
            <Minus className="h-4 w-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => onOpenAdjust(item, 'add')}
            className="flex min-w-[3.25rem] flex-col items-center justify-center rounded-xl border border-border bg-muted/40 px-2 py-1.5 active:bg-muted transition-colors"
            title="Larger amounts, delivery, or other reasons"
            aria-label={`Open stock form for ${item.name}`}
          >
            <span
              className={cn(
                'text-xl font-bold tabular-nums leading-none',
                isOut ? 'text-destructive' : isLow ? 'text-amber-600' : 'text-foreground',
              )}
            >
              {item.currentQuantity}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5">{item.unit}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runQuick(onQuickAdd)}
            className={cn(stepperBtn, 'border-primary/25 bg-primary/10 text-primary active:bg-primary/20')}
            aria-label={`Add 1 ${item.unit} to ${item.name}`}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
