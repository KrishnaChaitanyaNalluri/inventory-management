import { useState, useMemo } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { REASON_LABELS, ActionType } from '@/types/inventory';
import { cn } from '@/lib/utils';

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function groupByDate(transactions: ReturnType<typeof useInventory>['transactions']) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; items: typeof transactions }[] = [];
  const map: Record<string, typeof transactions> = {};

  for (const tx of transactions) {
    const d = new Date(tx.timestamp).toDateString();
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!map[label]) { map[label] = []; groups.push({ label, items: map[label] }); }
    map[label].push(tx);
  }

  return groups;
}

export default function ActivityLog() {
  const { transactions } = useInventory();
  const [filterAction, setFilterAction] = useState<ActionType | 'all'>('all');

  const filtered = useMemo(() => {
    if (filterAction === 'all') return transactions;
    return transactions.filter(t => t.action === filterAction);
  }, [transactions, filterAction]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const addCount = transactions.filter(t => t.action === 'add').length;
  const subCount = transactions.filter(t => t.action === 'subtract').length;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">Activity Log</h1>
          <span className="text-xs text-muted-foreground font-medium">{filtered.length} records</span>
        </div>
        <div className="flex gap-2">
          {([
            { key: 'all', label: `All · ${transactions.length}` },
            { key: 'add', label: `Added · ${addCount}` },
            { key: 'subtract', label: `Removed · ${subCount}` },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilterAction(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors',
                filterAction === f.key
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card text-muted-foreground active:bg-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 pb-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground text-sm">No activity found</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(tx => (
                  <div key={tx.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5',
                          tx.action === 'add' ? 'bg-primary/10' : 'bg-red-50'
                        )}
                      >
                        {tx.action === 'add'
                          ? <Plus className="h-3.5 w-3.5 text-primary" />
                          : <Minus className="h-3.5 w-3.5 text-destructive" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate leading-snug">{tx.itemName}</p>
                        <p className="text-xs font-medium text-foreground/60 mt-0.5">{tx.employeeName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            tx.action === 'add' ? 'text-primary' : 'text-destructive'
                          )}
                        >
                          {tx.action === 'add' ? '+' : '−'}{tx.quantity} {tx.unit}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(tx.timestamp)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {REASON_LABELS[tx.reason]}
                      </span>
                      {tx.note && (
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                          &ldquo;{tx.note}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
