import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, TrendingDown, LayoutGrid } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { ItemCard } from '@/components/ItemCard';
import { AddSubtractModal } from '@/components/AddSubtractModal';
import { InventoryItem, ActionType } from '@/types/inventory';

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
  const { items, getRecentItems, searchItems, transactions, updateThreshold } = useInventory();
  const { currentUser: authUser } = useAuth();
  const currentUser = authUser ?? { name: '—' };
  const isManager = authUser?.role === 'manager';
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>('add');

  // Smart alert filtering:
  // "Running low" = has stock, but at or below threshold
  // "Out of stock" = qty is 0, but exclude Ice Cream placeholders (they start at 0 intentionally)
  const runningLow = items.filter(i => i.currentQuantity > 0 && i.currentQuantity <= i.lowStockThreshold);
  const trueOutOfStock = items.filter(i => i.currentQuantity === 0 && i.category !== 'Ice Creams');

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
                  onAdd={i => openModal(i, 'add')}
                  onSubtract={i => openModal(i, 'subtract')}
                  onThresholdChange={handleThreshold}
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
                totalAlerts > 0 ? 'bg-red-50 border border-red-100' : 'bg-card border border-border'
              }`}
            >
              <p className={`text-2xl font-bold leading-none ${totalAlerts > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {totalAlerts}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Alerts</p>
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
              onClick={() => navigate('/inventory?filter=low')}
              className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3.5 active:bg-red-100 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {trueOutOfStock.length} item{trueOutOfStock.length !== 1 ? 's' : ''} out of stock
                </p>
                <p className="text-xs text-destructive/60 mt-0.5 truncate">
                  {trueOutOfStock.slice(0, 2).map(i => i.name).join(', ')}
                  {trueOutOfStock.length > 2 ? ` +${trueOutOfStock.length - 2} more` : ''}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive/40 shrink-0" />
            </button>
          )}

          {/* Running Low — grouped by category */}
          {runningLow.length > 0 && (
            <div className="px-4 mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Needs Restocking
                </h2>
                <button onClick={() => navigate('/inventory?filter=low')} className="text-xs text-primary font-semibold">
                  View all {runningLow.length}
                </button>
              </div>

              {/* Category summary chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(lowByCategory).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700"
                  >
                    {cat}: {count}
                  </span>
                ))}
              </div>

              {/* Top cards — most critical (closest to empty) */}
              <div className="space-y-2">
                {[...runningLow]
                  .sort((a, b) => a.currentQuantity - b.currentQuantity)
                  .slice(0, 3)
                  .map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onAdd={i => openModal(i, 'add')}
                      onSubtract={i => openModal(i, 'subtract')}
                      onThresholdChange={handleThreshold}
                    />
                  ))}
              </div>
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
                  onAdd={i => openModal(i, 'add')}
                  onSubtract={i => openModal(i, 'subtract')}
                  onThresholdChange={handleThreshold}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {modalItem && (
        <AddSubtractModal item={modalItem} action={modalAction} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}
