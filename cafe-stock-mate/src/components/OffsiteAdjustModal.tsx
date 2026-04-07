import { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { InventoryItem, TransactionReason } from '@/types/inventory';
import { useInventory } from '@/context/InventoryContext';
import { cn } from '@/lib/utils';

interface OffsiteAdjustModalProps {
  item: InventoryItem;
  action: 'add' | 'subtract';
  onClose: () => void;
}

const ADD_REASONS: { key: TransactionReason; label: string; emoji: string }[] = [
  { key: 'offsite_delivery', label: 'Delivery / received', emoji: '📦' },
  { key: 'manual_correction', label: 'Manual adjustment', emoji: '✏️' },
];

const REMOVE_REASONS: { key: TransactionReason; label: string; emoji: string }[] = [
  { key: 'offsite_to_cafe', label: 'Toward cafe / floor', emoji: '🏪' },
  { key: 'manual_correction', label: 'Manual adjustment', emoji: '✏️' },
];

function unitForCount(unit: string, n: number): string {
  if (n !== 1) return unit;
  const irregular: Record<string, string> = { boxes: 'box', glasses: 'glass' };
  if (irregular[unit]) return irregular[unit];
  if (unit.endsWith('s')) return unit.slice(0, -1);
  return unit;
}

export function OffsiteAdjustModal({ item, action, onClose }: OffsiteAdjustModalProps) {
  const { adjustOffsite } = useInventory();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<TransactionReason | ''>('');
  const [note, setNote] = useState('');

  const isAdd = action === 'add';
  const REASONS = isAdd ? ADD_REASONS : REMOVE_REASONS;
  const newQty = isAdd
    ? item.offsiteQuantity + quantity
    : Math.max(0, item.offsiteQuantity - quantity);

  const handleSubmit = () => {
    if (!reason || quantity < 1) return;
    void adjustOffsite(item.id, isAdd ? 'add' : 'subtract', quantity, reason as TransactionReason, note || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className={cn(
          'relative z-10 flex w-full max-w-lg flex-col rounded-t-3xl bg-card shadow-xl animate-slide-up',
          'max-h-[min(88dvh,calc(100svh-0.5rem))]',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2 pb-0.5">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-1 pb-2">
          <div className="min-w-0">
            <div className="mb-0.5">
              <span
                className={cn(
                  'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  isAdd ? 'bg-slate-600/15 text-slate-700' : 'bg-red-100 text-destructive',
                )}
              >
                {isAdd ? '+ Off-site stock' : '− Off-site stock'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-foreground leading-snug line-clamp-2">{item.name}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cafe floor:{' '}
              <span className="font-semibold text-foreground">
                {item.currentQuantity} {item.unit}
              </span>
              {' · '}
              Off-site:{' '}
              <span className="font-semibold text-foreground">
                {item.offsiteQuantity} {item.unit}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          <div className="mb-3">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              {isAdd ? `How many ${item.unit}?` : `How many ${item.unit} removed?`}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted active:bg-border transition-colors shrink-0"
              >
                <Minus className="h-4 w-4 text-foreground" />
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                className="min-w-0 flex-1 h-11 rounded-xl border border-border bg-card text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted active:bg-border transition-colors shrink-0"
              >
                <Plus className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Reason
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {REASONS.map(r => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReason(r.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left transition-colors',
                    reason === r.key
                      ? 'border-slate-600 bg-slate-700 text-white shadow-sm'
                      : 'border-border bg-muted text-foreground active:bg-border',
                  )}
                >
                  <span className="text-sm leading-none shrink-0">{r.emoji}</span>
                  <span className="text-[11px] font-medium leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Note <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Location, invoice, batch…"
              className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-center text-muted-foreground mb-1.5">
            Off-site after:{' '}
            <span
              className={cn(
                'font-semibold',
                isAdd ? 'text-slate-700' : newQty === 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {newQty} {item.unit}
            </span>
          </p>
          {!reason && (
            <p className="text-[10px] text-center text-amber-800 bg-amber-50 border border-amber-200/80 rounded-md py-1.5 px-2 mb-1.5 leading-snug">
              Choose a reason above to continue
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason || quantity < 1}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-bold transition-all',
              !reason || quantity < 1
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isAdd
                  ? 'bg-slate-700 text-white active:bg-slate-800'
                  : 'bg-destructive text-white active:bg-destructive/90',
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
