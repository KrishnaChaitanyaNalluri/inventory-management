import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { CategoryChips } from '@/components/CategoryChips';
import { ItemCard } from '@/components/ItemCard';
import { AddSubtractModal } from '@/components/AddSubtractModal';
import { EditItemDialog } from '@/components/EditItemDialog';
import { cn } from '@/lib/utils';
import { buildLastStockEditMap } from '@/lib/inventoryHelpers';
import {
  InventoryItem,
  ActionType,
  Category,
  CATEGORIES,
  canAddInventoryItems,
  canEditThreshold,
  isTrueOutOfStock,
  needsAttention,
} from '@/types/inventory';

function buildGroupedView(
  items: InventoryItem[],
  renderCard: (item: InventoryItem) => React.ReactNode,
  groupBy: 'category' | 'subCategory',
) {
  const groupOrder: string[] = [];
  const groups: Record<string, InventoryItem[]> = {};

  for (const item of items) {
    const key = groupBy === 'category'
      ? item.category
      : (item.subCategory ?? 'Other');
    if (!groups[key]) { groupOrder.push(key); groups[key] = []; }
    groups[key].push(item);
  }

  return (
    <div className="space-y-5">
      {groupOrder.map(group => (
        <div key={group}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{group}</span>
            <span className="text-xs text-muted-foreground font-medium">· {groups[group].length}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {groups[group].map(renderCard)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Inventory() {
  const { items, isLoading, error, updateThreshold, quickAdjust, transactions } = useInventory();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [subCategory, setSubCategory] = useState<string | 'all'>('all');
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>('add');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockMode, setRestockMode] = useState(false);
  const [restockFocusId, setRestockFocusId] = useState<string | null>(null);
  const [advanceFromId, setAdvanceFromId] = useState<string | null>(null);
  const highlightAppliedRef = useRef<string | null>(null);
  const restockModeRef = useRef(false);
  restockModeRef.current = restockMode;

  const filterParam = searchParams.get('filter');
  const showLowOnly = filterParam === 'low';
  const showOutOnly = filterParam === 'out';
  const listFilter: 'all' | 'low' | 'out' = showOutOnly ? 'out' : showLowOnly ? 'low' : 'all';

  // Sub-categories for the selected category
  const subCategories = useMemo(() => {
    if (category === 'all') return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
      if (item.category === category && item.subCategory && !seen.has(item.subCategory)) {
        seen.add(item.subCategory);
        result.push(item.subCategory);
      }
    }
    return result;
  }, [items, category]);

  // Count of attention items per category (for chip badges on Need attention view)
  const lowStockCounts = useMemo(() => {
    if (!showLowOnly) return undefined;
    const counts: Partial<Record<Category | 'all', number>> = {};
    let total = 0;
    for (const item of items) {
      if (needsAttention(item)) {
        counts[item.category as Category] = (counts[item.category as Category] ?? 0) + 1;
        total++;
      }
    }
    counts['all'] = total;
    return counts;
  }, [items, showLowOnly]);

  const handleCategoryChange = (cat: Category | 'all') => {
    setCategory(cat);
    setSubCategory('all');
  };

  const filtered = useMemo(() => {
    let result = items;
    if (showLowOnly) result = result.filter(needsAttention);
    if (showOutOnly) result = result.filter(isTrueOutOfStock);
    if (category !== 'all') result = result.filter(i => i.category === category);
    if (subCategory !== 'all') result = result.filter(i => i.subCategory === subCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return result;
  }, [items, category, subCategory, search, showLowOnly, showOutOnly]);

  const totalLowCount = useMemo(() => items.filter(needsAttention).length, [items]);

  const totalOutCount = useMemo(() => items.filter(isTrueOutOfStock).length, [items]);

  const attentionBreakdown = useMemo(() => {
    const need = items.filter(needsAttention);
    const outStock = need.filter(
      i => i.currentQuantity === 0 && i.category !== 'Ice Creams',
    ).length;
    const running = need.filter(i => i.currentQuantity > 0).length;
    const iceZero = need.filter(
      i => i.currentQuantity === 0 && i.category === 'Ice Creams',
    ).length;
    return { total: need.length, outStock, running, iceZero };
  }, [items]);

  const lastStockEditMap = useMemo(() => buildLastStockEditMap(transactions), [transactions]);

  const setListFilter = (next: 'all' | 'low' | 'out') => {
    setRestockMode(false);
    setRestockFocusId(null);
    setAdvanceFromId(null);
    setCategory('all');
    setSubCategory('all');
    setSearch('');
    if (next === 'all') navigate('/inventory');
    else navigate(`/inventory?filter=${next}`);
  };

  useEffect(() => {
    if (!searchParams.get('highlight')) highlightAppliedRef.current = null;
  }, [searchParams]);

  useEffect(() => {
    const id = searchParams.get('highlight');
    if (!id || isLoading || items.length === 0) return;
    if (highlightAppliedRef.current === id) return;
    highlightAppliedRef.current = id;
    setRestockMode(true);
    setRestockFocusId(id);
    const t = window.setTimeout(() => {
      document.getElementById(`inventory-card-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
    return () => clearTimeout(t);
  }, [searchParams, isLoading, items.length]);

  useEffect(() => {
    if (!restockMode) {
      setAdvanceFromId(null);
      return;
    }
    if (advanceFromId === null) return;

    let list = [...items];
    if (showLowOnly) list = list.filter(needsAttention);
    if (showOutOnly) list = list.filter(isTrueOutOfStock);
    if (category !== 'all') list = list.filter(i => i.category === category);
    if (subCategory !== 'all') list = list.filter(i => i.subCategory === subCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q),
      );
    }

    const stillNeeds = (i: InventoryItem) => {
      if (showOutOnly) return isTrueOutOfStock(i);
      if (showLowOnly) return needsAttention(i);
      return false;
    };

    const ids = list.map(i => i.id);
    const idx = ids.indexOf(advanceFromId);
    let next: string | null = null;
    for (let j = idx + 1; j < ids.length; j++) {
      const it = items.find(x => x.id === ids[j]);
      if (it && stillNeeds(it)) {
        next = ids[j];
        break;
      }
    }
    if (next === null && idx >= 0) {
      for (let j = 0; j < idx; j++) {
        const it = items.find(x => x.id === ids[j]);
        if (it && stillNeeds(it)) {
          next = ids[j];
          break;
        }
      }
    }

    setRestockFocusId(next);
    setAdvanceFromId(null);
    if (next) {
      requestAnimationFrame(() => {
        document.getElementById(`inventory-card-${next}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    } else {
      toast.success('Nothing left in this list that still needs restocking');
    }
  }, [
    advanceFromId,
    items,
    restockMode,
    showLowOnly,
    showOutOnly,
    category,
    subCategory,
    search,
  ]);

  useEffect(() => {
    if (!restockMode || !restockFocusId) return;
    if (filtered.some(i => i.id === restockFocusId)) return;
    setRestockFocusId(filtered[0]?.id ?? null);
  }, [filtered, restockMode, restockFocusId]);

  const openModal = (item: InventoryItem, action: ActionType) => {
    setModalItem(item);
    setModalAction(action);
  };

  const isManager = canEditThreshold(currentUser?.role);
  const canAddSku = canAddInventoryItems(currentUser?.role);
  const handleThreshold = isManager
    ? async (item: InventoryItem, threshold: number) => { await updateThreshold(item.id, threshold); }
    : undefined;

  const handleQuickAdd = async (item: InventoryItem) => {
    await quickAdjust(item.id, 'add');
    if (restockModeRef.current) setAdvanceFromId(item.id);
  };

  const renderCard = (item: InventoryItem) => (
    <ItemCard
      key={item.id}
      item={item}
      onQuickAdd={handleQuickAdd}
      onQuickSubtract={i => quickAdjust(i.id, 'subtract')}
      onOpenAdjust={(i, action) => openModal(i, action)}
      onThresholdChange={handleThreshold}
      onEditDetails={isManager ? i => setEditItem(i) : undefined}
      restockFocus={restockMode && restockFocusId === item.id}
      lastStockEdit={lastStockEditMap[item.id] ?? null}
    />
  );

  const useCategoryGrouping =
    (showLowOnly || showOutOnly) && category === 'all' && !search && subCategory === 'all';
  const useSubCatGrouping =
    !search && subCategory === 'all' && filtered.some(i => i.subCategory);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h1 className="text-lg font-bold text-foreground leading-tight">
            {showOutOnly ? 'Out of stock' : showLowOnly ? 'Need attention' : 'Inventory'}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {canAddSku && (
              <button
                type="button"
                onClick={() => navigate('/inventory/add')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary active:bg-primary/20"
                aria-label="Add new inventory item (managers and admins only)"
                title="Add new item"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </button>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setListFilter('all')}
            className={cn(
              'py-2.5 px-1.5 text-[11px] font-bold transition-colors border-r border-border',
              listFilter === 'all' ? 'bg-primary text-white' : 'bg-card text-muted-foreground',
            )}
          >
            All items
          </button>
          <button
            type="button"
            onClick={() => setListFilter('low')}
            className={cn(
              'py-2.5 px-1.5 text-[11px] font-bold transition-colors border-r border-border flex flex-col items-center justify-center gap-0.5 leading-tight',
              listFilter === 'low' ? 'bg-amber-500 text-white' : 'bg-card text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Need attention</span>
            </span>
            {totalLowCount > 0 && (
              <>
                <span
                  className={cn(
                    'text-[10px] font-bold tabular-nums',
                    listFilter === 'low' ? 'text-white/90' : 'text-amber-600',
                  )}
                >
                  {totalLowCount} items need attention
                </span>
                <span
                  className={cn(
                    'text-[9px] font-semibold leading-tight text-center px-0.5',
                    listFilter === 'low' ? 'text-white/80' : 'text-amber-700/90',
                  )}
                >
                  {attentionBreakdown.outStock} out of stock · {attentionBreakdown.running} low
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setListFilter('out')}
            className={cn(
              'py-2.5 px-1.5 text-[11px] font-bold transition-colors flex flex-col items-center justify-center gap-0.5 leading-tight',
              listFilter === 'out' ? 'bg-destructive text-white' : 'bg-card text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3 shrink-0" />
              <span>Out</span>
            </span>
            {totalOutCount > 0 && (
              <span
                className={cn(
                  'text-[10px] font-bold tabular-nums',
                  listFilter === 'out' ? 'text-white/90' : 'text-destructive',
                )}
              >
                {totalOutCount} out of stock
              </span>
            )}
          </button>
        </div>

        {listFilter === 'low' && attentionBreakdown.total > 0 && (
          <p className="text-[10px] text-center text-muted-foreground leading-snug px-1 -mt-1">
            {attentionBreakdown.total} items need attention · {attentionBreakdown.outStock} out of stock ·{' '}
            {attentionBreakdown.running} running low
            {attentionBreakdown.iceZero > 0
              ? ` · ${attentionBreakdown.iceZero} ice cream at zero`
              : ''}
          </p>
        )}
        {listFilter === 'out' && totalOutCount > 0 && (
          <p className="text-[10px] text-center text-muted-foreground leading-snug px-1 -mt-1">
            {totalOutCount} out of stock · use Need attention to see ice cream at zero
          </p>
        )}

        {(showLowOnly || showOutOnly) && (
          <button
            type="button"
            onClick={() => {
              setRestockMode(v => {
                const next = !v;
                if (next) setRestockFocusId(filtered[0]?.id ?? null);
                else {
                  setRestockFocusId(null);
                  setAdvanceFromId(null);
                }
                return next;
              });
            }}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-xs font-bold transition-colors',
              restockMode
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-dashed border-border text-muted-foreground active:bg-muted',
            )}
          >
            <Zap className={cn('h-4 w-4', restockMode && 'text-primary')} />
            {restockMode ? 'Exit restock mode' : 'Start restock mode'}
          </button>
        )}

        <SearchBar value={search} onChange={setSearch} placeholder="Search items…" />
        <CategoryChips
          selected={category}
          onSelect={handleCategoryChange}
          counts={lowStockCounts}
        />

        {/* Sub-category chips — visible when a specific category with sub-groups is selected */}
        {subCategories.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 pb-0.5 w-max">
              <button
                onClick={() => setSubCategory('all')}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  subCategory === 'all'
                    ? 'bg-primary/15 text-primary border border-primary/40'
                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                }`}
              >
                All
              </button>
              {subCategories.map(sc => (
                <button
                  key={sc}
                  onClick={() => setSubCategory(sc)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    subCategory === sc
                      ? 'bg-primary/15 text-primary border border-primary/40'
                      : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="px-4 mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      {showLowOnly && filtered.length > 0 && category !== 'all' && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} below reorder threshold in {category}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="px-4 mt-3 pb-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground text-sm font-medium">No items found</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-2 text-primary text-sm font-semibold">
                Clear search
              </button>
            )}
          </div>
        ) : useCategoryGrouping ? (
          // Low Stock + All: group by category first, then sub-category within
          <div className="space-y-6">
            {CATEGORIES.filter(cat => filtered.some(i => i.category === cat)).map(cat => {
              const catItems = filtered.filter(i => i.category === cat);
              const hasSubs = catItems.some(i => i.subCategory);
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm font-bold text-foreground">{cat}</span>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                      {catItems.length}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {hasSubs ? (
                    // Sub-category groups inside this category
                    buildGroupedView(catItems, renderCard, 'subCategory')
                  ) : (
                    <div className="space-y-2">{catItems.map(renderCard)}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : useSubCatGrouping ? (
          // Normal inventory: group by sub-category
          buildGroupedView(filtered, renderCard, 'subCategory')
        ) : (
          // Flat list (search active, or specific sub-category selected)
          <div className="space-y-2">{filtered.map(renderCard)}</div>
        )}
      </div>

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
