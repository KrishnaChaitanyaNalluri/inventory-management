import { useState, useRef } from 'react';
import { Minus, Plus, Bell } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: InventoryItem;
  onAdd: (item: InventoryItem) => void;
  onSubtract: (item: InventoryItem) => void;
  onThresholdChange?: (item: InventoryItem, threshold: number) => void;
}

const LOCATION_LABELS: Record<string, string> = {
  storage_room: 'Storage',
  fridge: 'Fridge',
  freezer: 'Freezer',
  front_counter: 'Counter',
};

export function ItemCard({ item, onAdd, onSubtract, onThresholdChange }: ItemCardProps) {
  const isOut = item.currentQuantity === 0;
  const isLow = !isOut && item.currentQuantity <= item.lowStockThreshold;

  const [editingThreshold, setEditingThreshold] = useState(false);
  const [draft, setDraft] = useState(String(item.lowStockThreshold));
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card flex items-center gap-3 px-4 py-3 shadow-sm',
        isOut && 'border-red-200 bg-red-50/60',
        isLow && 'border-amber-200 bg-amber-50/40',
        !isOut && !isLow && 'border-border'
      )}
    >
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
          {isOut && (
            <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
              Out
            </span>
          )}
          {isLow && (
            <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
              Low
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {item.category}
          {item.storageLocation ? ` · ${LOCATION_LABELS[item.storageLocation]}` : ''}
        </p>

        {/* Threshold badge — always shown; editable for managers, read-only for staff */}
        <div className="mt-1.5">
          {onThresholdChange ? (
            editingThreshold ? (
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
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 active:bg-amber-100 transition-colors"
              >
                <Bell className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700">Alert ≤ {item.lowStockThreshold}</span>
              </button>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5">
              <Bell className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-600">Alert ≤ {item.lowStockThreshold}</span>
            </span>
          )}
        </div>

        {item.note && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate italic">{item.note}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="shrink-0 text-right min-w-[52px]">
        <span
          className={cn(
            'text-xl font-bold tabular-nums leading-none',
            isOut ? 'text-destructive' : isLow ? 'text-amber-600' : 'text-foreground'
          )}
        >
          {item.currentQuantity}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{item.unit}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onSubtract(item)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground active:bg-red-50 active:text-destructive active:border-red-200 transition-colors"
          aria-label={`Remove from ${item.name}`}
        >
          <Minus className="h-4 w-4 stroke-[2.5]" />
        </button>
        <button
          onClick={() => onAdd(item)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary active:bg-primary/20 transition-colors"
          aria-label={`Add to ${item.name}`}
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
