import { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { InventoryItem, ActionType, TransactionReason } from '@/types/inventory';
import { useInventory } from '@/context/InventoryContext';
import { cn } from '@/lib/utils';

interface AddSubtractModalProps {
  item: InventoryItem;
  action: ActionType;
  onClose: () => void;
}


const ADD_REASONS: { key: TransactionReason; label: string; emoji: string }[] = [
  { key: 'new_delivery',      label: 'New Delivery',       emoji: '📦' },
  { key: 'manual_correction', label: 'Manual Adjustment',  emoji: '✏️' },
];

const REMOVE_REASONS: { key: TransactionReason; label: string; emoji: string }[] = [
  { key: 'moved_to_front',    label: 'Moved to Counter',   emoji: '🏃' },
  { key: 'manual_correction', label: 'Manual Adjustment',  emoji: '✏️' },
];

/** Singular label for quantity 1 (e.g. "bags" -> "bag"; "boxes" -> "box") */
function unitForCount(unit: string, n: number): string {
  if (n !== 1) return unit;
  const irregular: Record<string, string> = { boxes: 'box', glasses: 'glass' };
  if (irregular[unit]) return irregular[unit];
  if (unit.endsWith('s')) return unit.slice(0, -1);
  return unit;
}

export function AddSubtractModal({ item, action, onClose }: AddSubtractModalProps) {
  const { addTransaction } = useInventory();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<TransactionReason | ''>('');
  const [note, setNote] = useState('');

  const isAdd = action === 'add';
  const REASONS = isAdd ? ADD_REASONS : REMOVE_REASONS;
  const newQty = isAdd
    ? item.currentQuantity + quantity
    : Math.max(0, item.currentQuantity - quantity);

  const handleSubmit = () => {
    if (!reason || quantity < 1) return;
    addTransaction(item.id, action, quantity, reason as TransactionReason, note || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative z-10 w-full max-w-lg rounded-t-3xl bg-card animate-slide-up overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

          {/* Header — always visible */}
          <div className="flex items-start justify-between px-5 pt-2 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  isAdd ? 'bg-primary/10 text-primary' : 'bg-red-100 text-destructive'
                )}>
                  {isAdd ? '+ Add Stock' : '− Remove Stock'}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground leading-tight">{item.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                In stock: <span className="font-semibold text-foreground">{item.currentQuantity} {item.unit}</span>
              </p>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-5" style={{ maxHeight: 'calc(80vh - 200px)' }}>
            {/* Quantity */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                {isAdd ? `How many ${item.unit} received?` : `How many ${item.unit} used/removed?`}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted active:bg-border transition-colors shrink-0"
                >
                  <Minus className="h-5 w-5 text-foreground" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="flex-1 h-14 rounded-2xl border border-border bg-card text-center text-3xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted active:bg-border transition-colors shrink-0"
                >
                  <Plus className="h-5 w-5 text-foreground" />
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 block">Reason</label>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setReason(r.key)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                      reason === r.key
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-border bg-muted text-foreground active:bg-border'
                    )}
                  >
                    <span className="text-base leading-none">{r.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 block">
                Note <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={
                  isAdd
                    ? 'e.g. Vendor, delivery date, invoice #…'
                    : 'e.g. Moving to counter (where); or adjusting count because…'
                }
                className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Submit — always pinned at bottom */}
          <div className="px-5 pt-3 pb-6 border-t border-border bg-card">
            <p className="text-xs text-center text-muted-foreground mb-2">
              After this:{' '}
              <span className={cn('font-semibold', isAdd ? 'text-primary' : newQty === 0 ? 'text-destructive' : 'text-foreground')}>
                {newQty} {item.unit}
              </span>
              {' '}remaining
            </p>
            {!reason && (
              <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3 mb-2">
                Tap a reason above to enable this button
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!reason || quantity < 1}
              className={cn(
                'w-full h-13 rounded-2xl text-sm font-bold transition-all py-3.5',
                !reason || quantity < 1
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : isAdd
                    ? 'bg-primary text-white active:bg-primary/90'
                    : 'bg-destructive text-white active:bg-destructive/90'
              )}
            >
              {isAdd
                ? `Add ${quantity} ${unitForCount(item.unit, quantity)}`
                : `Remove ${quantity} ${unitForCount(item.unit, quantity)}`}
            </button>
          </div>
      </div>
    </div>
  );
}
