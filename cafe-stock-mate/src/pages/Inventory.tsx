import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { CategoryChips } from '@/components/CategoryChips';
import { ItemCard } from '@/components/ItemCard';
import { AddSubtractModal } from '@/components/AddSubtractModal';
import { InventoryItem, ActionType, Category, CATEGORIES, canEditThreshold } from '@/types/inventory';

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
  const { items, isLoading, error, updateThreshold } = useInventory();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [subCategory, setSubCategory] = useState<string | 'all'>('all');
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>('add');

  const showLowOnly = searchParams.get('filter') === 'low';

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

  // Count of low-stock items per category (for chip badges)
  const lowStockCounts = useMemo(() => {
    if (!showLowOnly) return undefined;
    const counts: Partial<Record<Category | 'all', number>> = {};
    let total = 0;
    for (const item of items) {
      if (item.currentQuantity <= item.lowStockThreshold) {
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
    if (showLowOnly) result = result.filter(i => i.currentQuantity <= i.lowStockThreshold);
    if (category !== 'all') result = result.filter(i => i.category === category);
    if (subCategory !== 'all') result = result.filter(i => i.subCategory === subCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return result;
  }, [items, category, subCategory, search, showLowOnly]);

  const outCount = filtered.filter(i => i.currentQuantity === 0).length;
  const lowCount = filtered.filter(i => i.currentQuantity > 0 && i.currentQuantity <= i.lowStockThreshold).length;

  // Total low-stock count across ALL items (for the toggle badge)
  const totalLowCount = useMemo(
    () => items.filter(i => i.currentQuantity <= i.lowStockThreshold).length,
    [items],
  );

  const toggleLowFilter = () => {
    if (showLowOnly) {
      navigate('/inventory');
    } else {
      navigate('/inventory?filter=low');
    }
    setCategory('all');
    setSubCategory('all');
    setSearch('');
  };

  const openModal = (item: InventoryItem, action: ActionType) => {
    setModalItem(item);
    setModalAction(action);
  };

  const isManager = canEditThreshold(currentUser?.role);
  const handleThreshold = isManager
    ? async (item: InventoryItem, threshold: number) => { await updateThreshold(item.id, threshold); }
    : undefined;

  const renderCard = (item: InventoryItem) => (
    <ItemCard
      key={item.id}
      item={item}
      onAdd={i => openModal(i, 'add')}
      onSubtract={i => openModal(i, 'subtract')}
      onThresholdChange={handleThreshold}
    />
  );

  // Decide grouping strategy
  const useCategoryGrouping = showLowOnly && category === 'all' && !search && !subCategory || false;
  const useSubCatGrouping = !search && subCategory === 'all' && filtered.some(i => i.subCategory);

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-foreground">Inventory</h1>
          <span className="text-xs text-muted-foreground font-medium">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* All / Low Stock segmented control */}
        <div className="grid grid-cols-2 rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => { if (showLowOnly) toggleLowFilter(); }}
            className={`py-2.5 text-xs font-semibold transition-colors ${
              !showLowOnly
                ? 'bg-primary text-white'
                : 'bg-card text-muted-foreground border-r border-border'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => { if (!showLowOnly) toggleLowFilter(); }}
            className={`py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              showLowOnly
                ? 'bg-amber-500 text-white'
                : 'bg-card text-muted-foreground border-l border-border'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Low Stock
            {totalLowCount > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${
                showLowOnly ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
              }`}>
                {totalLowCount}
              </span>
            )}
          </button>
        </div>
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

      {/* Low Stock info bar */}
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
        <AddSubtractModal item={modalItem} action={modalAction} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}
