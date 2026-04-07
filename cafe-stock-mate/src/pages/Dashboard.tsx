import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  TrendingDown,
  LayoutGrid,
} from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { ItemCard } from '@/components/ItemCard';
import { AddSubtractModal } from '@/components/AddSubtractModal';
import { EditItemDialog } from '@/components/EditItemDialog';
import { cn } from '@/lib/utils';
import { buildLastStockEditMap } from '@/lib/inventoryHelpers';
import { useAddToPurchaseList } from '@/hooks/useAddToPurchaseList';
import { usePurchaseDraftCount } from '@/hooks/usePurchaseDraft';
import { InventoryItem, ActionType, InventoryTransaction, canEditThreshold, isTrueOutOfStock } from '@/types/inventory';

function buildReorderHints(
  items: InventoryItem[],
  transactions: InventoryTransaction[],
): { itemId: string; name: string; detail: string }[] {
  const runningLow = items.filter(
    i => i.currentQuantity > 0 && i.currentQuantity <= i.lowStockThreshold,
  );
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const removed: Record<string, number> = {};
  for (const t of transactions) {
    if (t.action !== 'subtract') continue;
    if (new Date(t.timestamp).getTime() < weekAgo) continue;
    removed[t.itemId] = (removed[t.itemId] ?? 0) + t.quantity;
  }
  const scored = runningLow.map(item => ({ item, use: removed[item.id] ?? 0 }));
  scored.sort((a, b) => {
    if (b.use !== a.use) return b.use - a.use;
    return a.item.currentQuantity - b.item.currentQuantity;
  });
  return scored.slice(0, 3).map(({ item, use }) => ({
    itemId: item.id,
    name: item.name,
    detail:
      use > 0
        ? `High use last 7 days (~${use} ${item.unit} out)`
        : `Only ${item.currentQuantity} ${item.unit} left`,
  }));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function Dashboard() {
  const { items, getRecentItems, searchItems, transactions, updateThreshold, quickAdjust } = useInventory();
  const { currentUser: authUser } = useAuth();
  const currentUser = authUser ?? { name: '—' };
  const isManager = canEditThreshold(authUser?.role);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>('add');
  const [restockOpen, setRestockOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);

  const runningLow = items.filter(i => i.currentQuantity > 0 && i.currentQuantity <= i.lowStockThreshold);
  const trueOutOfStock = items.filter(isTrueOutOfStock);

  // Group running-low items by category for the summary chips
  const lowByCategory = runningLow.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const totalAlerts = runningLow.length + trueOutOfStock.length;
  const inStockCount = items.length - trueOutOfStock.length - runningLow.length;

  const recentItems = getRecentItems();
  const searchResults = search ? searchItems(search) : [];

  const todayStr = new Date().toDateString();
  const todayCount = transactions.filter(t => new Date(t.timestamp).toDateString() === todayStr).length;

  const reorderHints = useMemo(
    () => buildReorderHints(items, transactions),
    [items, transactions],
  );

  const purchaseDraftCount = usePurchaseDraftCount();
  const addToPurchaseList = useAddToPurchaseList();

  const lastStockEditMap = useMemo(() => buildLastStockEditMap(transactions), [transactions]);

  const openModal = (item: InventoryItem, action: ActionType) => {
    setModalItem(item);
    setModalAction(action);
  };

  const handleThreshold = isManager
    ? async (item: InventoryItem, threshold: number) => { await updateThreshold(item.id, threshold); }
    : undefined;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary px-4 pt-6 pb-7">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white/60 text-xs font-medium tracking-wide uppercase">{formatDate()}</p>
          <button
            onClick={() => navigate('/profile')}
            className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm"
          >
            {currentUser.name.split(' ').map(n => n[0]).join('')}
          </button>
        </div>
        <h1 className="text-xl font-bold text-white mb-4">
          {getGreeting()}, {currentUser.name.split(' ')[0]}
        </h1>
        <SearchBar value={search} onChange={setSearch} placeholder={`Search ${items.length} items…`} light />
      </div>

      {/* Search Results */}
      {search ? (
        <div className="px-4 mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            <span className="font-semibold text-foreground">{searchResults.length}</span>{' '}
            result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">No items match your search</p>
              <button onClick={() => setSearch('')} className="mt-2 text-primary text-sm font-medium">
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onQuickAdd={i => quickAdjust(i.id, 'add')}
                  onQuickSubtract={i => quickAdjust(i.id, 'subtract')}
                  onOpenAdjust={(i, action) => openModal(i, action)}
                  onThresholdChange={handleThreshold}
                  onEditDetails={isManager ? i => setEditItem(i) : undefined}
                  onAddToPurchaseList={isManager ? addToPurchaseList : undefined}
                  lastStockEdit={lastStockEditMap[item.id] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="px-4 -mt-3.5 grid grid-cols-3 gap-2 mb-5">
            <button
              onClick={() => navigate('/inventory')}
              className="rounded-2xl bg-card border border-border p-3.5 shadow-sm text-center active:scale-95 transition-transform"
            >
              <p className="text-2xl font-bold text-foreground leading-none">{items.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Total Items</p>
            </button>
            <button
              onClick={() => navigate('/inventory?filter=low')}
              className={`rounded-2xl p-3.5 shadow-sm text-center active:scale-95 transition-transform ${
                totalAlerts > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-card border border-border'
              }`}
            >
              <p className={`text-2xl font-bold leading-none ${totalAlerts > 0 ? 'text-amber-700' : 'text-foreground'}`}>
                {totalAlerts}
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1 leading-tight px-0.5">
                items need attention
              </p>
              <p className="text-[9px] text-muted-foreground/90 mt-1 leading-tight px-0.5">
                {trueOutOfStock.length} out of stock • {runningLow.length} low
              </p>
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 shadow-sm text-center active:scale-95 transition-transform"
            >
              <p className="text-2xl font-bold text-success leading-none">{inStockCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">In Stock</p>
            </button>
          </div>

          {/* Out of Stock Banner (non-placeholder items only) */}
          {trueOutOfStock.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/inventory?filter=out')}
              className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3.5 active:bg-red-100 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {trueOutOfStock.length} item{trueOutOfStock.length !== 1 ? 's' : ''} out of stock
                </p>
                <p className="text-xs font-semibold text-primary mt-1">View out of stock items →</p>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive/40 shrink-0" />
            </button>
          )}

          {isManager && reorderHints.length > 0 && (
            <div className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs font-bold text-primary flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                Suggested next actions
              </p>
              <ul className="space-y-2.5">
                {reorderHints.map(h => (
                  <li key={h.itemId} className="text-xs leading-snug">
                    <div className="text-foreground">
                      <span className="font-semibold">{h.name}</span>
                      <span className="text-muted-foreground"> — {h.detail}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/inventory?filter=low&highlight=${encodeURIComponent(h.itemId)}`)
                        }
                        className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground active:opacity-90"
                      >
                        Restock now
                      </button>
                      <button
                        type="button"
                        onClick={() => addToPurchaseList({ id: h.itemId, name: h.name })}
                        className="rounded-lg border border-primary/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-primary active:bg-muted"
                      >
                        Add to purchase list
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {purchaseDraftCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/activity?tab=purchase')}
                  className="mt-3 w-full rounded-lg border border-primary/25 bg-primary/8 py-2 text-center text-[11px] font-bold text-primary active:bg-primary/15"
                >
                  View to-order list ({purchaseDraftCount})
                </button>
              )}
            </div>
          )}

          {runningLow.length > 0 && (
            <div className="px-4 mb-5">
              <button
                type="button"
                onClick={() => setRestockOpen(o => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left active:bg-muted transition-colors"
              >
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  Needs restocking
                  <span className="text-muted-foreground font-normal">· {runningLow.length}</span>
                </span>
                <ChevronDown
                  className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', restockOpen && 'rotate-180')}
                />
              </button>

              {restockOpen && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(lowByCategory).map(([cat, count]) => (
                      <span
                        key={cat}
                        className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700"
                      >
                        {cat}: {count}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate('/inventory?filter=low')}
                      className="text-xs text-primary font-semibold"
                    >
                      View all {runningLow.length} →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {[...runningLow]
                      .sort((a, b) => a.currentQuantity - b.currentQuantity)
                      .slice(0, 3)
                      .map(item => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onQuickAdd={i => quickAdjust(i.id, 'add')}
                          onQuickSubtract={i => quickAdjust(i.id, 'subtract')}
                          onOpenAdjust={(i, action) => openModal(i, action)}
                          onThresholdChange={handleThreshold}
                          onEditDetails={isManager ? i => setEditItem(i) : undefined}
                          onAddToPurchaseList={isManager ? addToPurchaseList : undefined}
                          lastStockEdit={lastStockEditMap[item.id] ?? null}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Today's Activity */}
          {todayCount > 0 && (
            <button
              onClick={() => navigate('/activity')}
              className="mx-4 mb-5 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3.5 active:bg-emerald-100 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-success">
                  {todayCount} update{todayCount !== 1 ? 's' : ''} logged today
                </p>
                <p className="text-xs text-success/60 mt-0.5">Tap to view activity log</p>
              </div>
              <ChevronRight className="h-4 w-4 text-success/40 shrink-0" />
            </button>
          )}

          {/* Browse by Category */}
          <div className="px-4 mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                Browse Inventory
              </h2>
              <button onClick={() => navigate('/inventory')} className="text-xs text-primary font-semibold">
                View all →
              </button>
            </div>
            <div className="space-y-2">
              {recentItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onQuickAdd={i => quickAdjust(i.id, 'add')}
                  onQuickSubtract={i => quickAdjust(i.id, 'subtract')}
                  onOpenAdjust={(i, action) => openModal(i, action)}
                  onThresholdChange={handleThreshold}
                  onEditDetails={isManager ? i => setEditItem(i) : undefined}
                  onAddToPurchaseList={isManager ? addToPurchaseList : undefined}
                  lastStockEdit={lastStockEditMap[item.id] ?? null}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {modalItem && (
        <AddSubtractModal
          key={`${modalItem.id}-${modalAction}`}
          item={modalItem}
          action={modalAction}
          onClose={() => setModalItem(null)}
        />
      )}

      <EditItemDialog
        item={editItem}
        open={editItem !== null}
        onOpenChange={open => {
          if (!open) setEditItem(null);
        }}
      />
    </div>
  );
}
