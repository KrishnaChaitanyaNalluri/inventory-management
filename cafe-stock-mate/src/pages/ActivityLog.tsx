import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Bell, Warehouse, ShoppingCart, Trash2, X, PackagePlus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { REASON_LABELS, ActionType, canEditThreshold } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { clearPurchaseDraft, removeFromPurchaseDraft } from '@/lib/inventoryHelpers';
import { usePurchaseDraftRows } from '@/hooks/usePurchaseDraft';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

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

type LogFilter = 'all' | ActionType | 'offsite';

type ActivityTab = 'log' | 'purchase';

export default function ActivityLog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const canUsePurchaseList = canEditThreshold(currentUser?.role);
  const { transactions } = useInventory();
  const [filterAction, setFilterAction] = useState<LogFilter>('all');
  const [clearListOpen, setClearListOpen] = useState(false);
  const purchaseRows = usePurchaseDraftRows();

  const tab: ActivityTab =
    canUsePurchaseList && searchParams.get('tab') === 'purchase' ? 'purchase' : 'log';

  const purchaseTabParam = searchParams.get('tab');
  useEffect(() => {
    if (!canUsePurchaseList && purchaseTabParam === 'purchase') {
      setSearchParams({}, { replace: true });
    }
  }, [canUsePurchaseList, purchaseTabParam, setSearchParams]);

  const setTab = (next: ActivityTab) => {
    if (next === 'purchase') setSearchParams({ tab: 'purchase' });
    else setSearchParams({});
  };

  const filtered = useMemo(() => {
    if (filterAction === 'all') return transactions;
    if (filterAction === 'offsite') {
      return transactions.filter(t => t.action === 'offsite_add' || t.action === 'offsite_subtract');
    }
    return transactions.filter(t => t.action === filterAction);
  }, [transactions, filterAction]);

  function reasonLabel(reason: string) {
    return reason in REASON_LABELS ? REASON_LABELS[reason as keyof typeof REASON_LABELS] : reason;
  }

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const addCount = transactions.filter(t => t.action === 'add').length;
  const subCount = transactions.filter(t => t.action === 'subtract').length;
  const thresholdCount = transactions.filter(t => t.action === 'set_threshold').length;
  const offsiteCount = transactions.filter(
    t => t.action === 'offsite_add' || t.action === 'offsite_subtract',
  ).length;

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">Activity</h1>
          <span className="text-xs text-muted-foreground font-medium">
            {tab === 'log' ? `${filtered.length} records` : `${purchaseRows.length} to order`}
          </span>
        </div>

        {canUsePurchaseList ? (
          <div
            className="flex gap-1 rounded-xl border border-border bg-muted/50 p-1 mb-3"
            role="tablist"
            aria-label="Activity sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'log'}
              onClick={() => setTab('log')}
              className={cn(
                'flex-1 rounded-lg py-2.5 text-xs font-bold transition-all duration-200',
                tab === 'log'
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
                  : 'text-muted-foreground bg-transparent hover:bg-muted/80 hover:text-foreground',
              )}
            >
              Stock log
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'purchase'}
              onClick={() => setTab('purchase')}
              className={cn(
                'flex-1 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5',
                tab === 'purchase'
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
                  : 'text-muted-foreground bg-transparent hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              To order
              {purchaseRows.length > 0 && (
                <span
                  className={cn(
                    'min-w-[1.125rem] rounded-full px-1 text-[10px] font-bold leading-4',
                    tab === 'purchase'
                      ? 'bg-white/25 text-primary-foreground'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  {purchaseRows.length}
                </span>
              )}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground mb-3">Stock adjustments and thresholds for your team.</p>
        )}

        {tab === 'log' && (
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all' as const, label: `All · ${transactions.length}` },
              { key: 'add' as const, label: `Added · ${addCount}` },
              { key: 'subtract' as const, label: `Removed · ${subCount}` },
              { key: 'offsite' as const, label: `Off-site · ${offsiteCount}` },
              { key: 'set_threshold' as const, label: `Thresholds · ${thresholdCount}` },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterAction(f.key)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors',
                  filterAction === f.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card text-muted-foreground active:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'purchase' && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              For your ordering run — not synced to inventory or a vendor. Cleared when you close this browser tab.
            </p>
            <button
              type="button"
              onClick={() => navigate('/inventory/add?from=purchase')}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-card py-2.5 text-xs font-semibold text-primary active:bg-muted"
            >
              <PackagePlus className="h-3.5 w-3.5 shrink-0" />
              Add new inventory item
            </button>
          </div>
        )}
      </div>

      {tab === 'log' && (
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
                  {group.items.map(tx => {
                    const isAddLike = tx.action === 'add' || tx.action === 'offsite_add';
                    const isSubLike = tx.action === 'subtract' || tx.action === 'offsite_subtract';
                    const isOffsite = tx.action === 'offsite_add' || tx.action === 'offsite_subtract';
                    return (
                      <div key={tx.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5',
                              isAddLike && 'bg-primary/10',
                              isSubLike && 'bg-red-50',
                              tx.action === 'set_threshold' && 'bg-amber-50',
                            )}
                          >
                            {isAddLike && !isOffsite && <Plus className="h-3.5 w-3.5 text-primary" />}
                            {isSubLike && !isOffsite && <Minus className="h-3.5 w-3.5 text-destructive" />}
                            {isOffsite && (
                              <Warehouse className={cn('h-3.5 w-3.5', isAddLike ? 'text-primary' : 'text-destructive')} />
                            )}
                            {tx.action === 'set_threshold' && <Bell className="h-3.5 w-3.5 text-amber-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-foreground truncate leading-snug">{tx.itemName}</p>
                            <p className="text-xs font-medium text-foreground/60 mt-0.5">{tx.employeeName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={cn(
                                'text-sm font-bold tabular-nums',
                                isAddLike ? 'text-primary' : 'text-destructive',
                              )}
                            >
                              {isAddLike ? '+' : '−'}
                              {tx.quantity} {tx.unit}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(tx.timestamp)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {reasonLabel(tx.reason)}
                          </span>
                          {tx.note && (
                            <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                              &ldquo;{tx.note}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'purchase' && (
        <div className="px-4 mt-3 pb-4">
          {purchaseRows.length === 0 ? (
            <div className="py-16 text-center px-2">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Nothing on your list yet</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                On Home, under suggested actions, use &ldquo;Add to purchase list&rdquo; to flag items to buy. Then
                come back here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {purchaseRows.map(row => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground leading-snug">{row.name}</p>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/inventory?filter=low&highlight=${encodeURIComponent(row.id)}`)
                        }
                        className="text-[11px] font-semibold text-primary mt-1 active:opacity-80"
                      >
                        Open in inventory →
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromPurchaseDraft(row.id)}
                      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground active:bg-muted"
                      aria-label={`Remove ${row.name} from list`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (purchaseRows.length === 0) return;
                  setClearListOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive active:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Clear list
              </button>
            </>
          )}
        </div>
      )}

      <AlertDialog open={clearListOpen} onOpenChange={setClearListOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear to-order list?</AlertDialogTitle>
            <AlertDialogDescription>
              Every line will be removed from this list. You can add items again from inventory or Home.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                clearPurchaseDraft();
                toast.success('To-order list cleared');
                setClearListOpen(false);
              }}
            >
              Clear list
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
