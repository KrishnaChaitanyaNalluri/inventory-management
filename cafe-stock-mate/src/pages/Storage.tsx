import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Minus, Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { CategoryChips } from '@/components/CategoryChips';
import { OffsiteAdjustModal } from '@/components/OffsiteAdjustModal';
import { InventoryItem, Category, canManageOffsiteStorage } from '@/types/inventory';
import { cn } from '@/lib/utils';

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
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{group}</span>
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

function StorageItemCard({
  item,
  onAdd,
  onSubtract,
}: {
  item: InventoryItem;
  onAdd: (item: InventoryItem) => void;
  onSubtract: (item: InventoryItem) => void;
}) {
  const empty = item.offsiteQuantity === 0;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card flex items-center gap-3 px-4 py-3 shadow-sm',
        empty ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-200 bg-slate-50/30',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.category}</p>
        <p className="text-[10px] text-muted-foreground/80 mt-1">
          At cafe: <span className="font-semibold text-foreground">{item.currentQuantity}</span> {item.unit}
        </p>
      </div>
      <div className="shrink-0 text-right min-w-[52px]">
        <span
          className={cn(
            'text-xl font-bold tabular-nums leading-none',
            empty ? 'text-muted-foreground' : 'text-slate-800',
          )}
        >
          {item.offsiteQuantity}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{item.unit}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onSubtract(item)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground active:bg-red-50 active:text-destructive active:border-red-200 transition-colors"
          aria-label={`Remove off-site ${item.name}`}
        >
          <Minus className="h-4 w-4 stroke-[2.5]" />
        </button>
        <button
          onClick={() => onAdd(item)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-600/15 border border-slate-500/25 text-slate-800 active:bg-slate-600/25 transition-colors"
          aria-label={`Add off-site ${item.name}`}
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

export default function Storage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { items, isLoading, error } = useInventory();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [subCategory, setSubCategory] = useState<string | 'all'>('all');
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [modalAction, setModalAction] = useState<'add' | 'subtract'>('add');

  useEffect(() => {
    if (!canManageOffsiteStorage(currentUser?.role)) {
      navigate('/', { replace: true });
    }
  }, [currentUser?.role, navigate]);

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

  const filtered = useMemo(() => {
    let result = items;
    if (onlyWithStock) result = result.filter(i => i.offsiteQuantity > 0);
    if (category !== 'all') result = result.filter(i => i.category === category);
    if (subCategory !== 'all') result = result.filter(i => i.subCategory === subCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return result;
  }, [items, category, subCategory, search, onlyWithStock]);

  const withOffsiteCount = useMemo(() => items.filter(i => i.offsiteQuantity > 0).length, [items]);

  const useSubCatGrouping = !search && subCategory === 'all' && filtered.some(i => i.subCategory);

  const openModal = (item: InventoryItem, action: 'add' | 'subtract') => {
    setModalItem(item);
    setModalAction(action);
  };

  const renderCard = (item: InventoryItem) => (
    <StorageItemCard
      key={item.id}
      item={item}
      onAdd={i => openModal(i, 'add')}
      onSubtract={i => openModal(i, 'subtract')}
    />
  );

  if (!canManageOffsiteStorage(currentUser?.role)) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-600/10 text-slate-700">
              <Warehouse className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight">Off-site storage</h1>
              <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                Stock outside the cafe — update Inventory when it arrives on the floor
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            {filtered.length}
          </span>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setOnlyWithStock(false)}
            className={cn(
              'py-2.5 text-xs font-semibold transition-colors',
              !onlyWithStock ? 'bg-slate-700 text-white' : 'bg-card text-muted-foreground border-r border-border',
            )}
          >
            All items
          </button>
          <button
            type="button"
            onClick={() => setOnlyWithStock(true)}
            className={cn(
              'py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
              onlyWithStock ? 'bg-slate-700 text-white' : 'bg-card text-muted-foreground border-l border-border',
            )}
          >
            Has off-site
            {withOffsiteCount > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-bold leading-4',
                  onlyWithStock ? 'bg-white/25 text-white' : 'bg-slate-600 text-white',
                )}
              >
                {withOffsiteCount}
              </span>
            )}
          </button>
        </div>

        <SearchBar value={search} onChange={setSearch} placeholder="Search items…" />
        <CategoryChips
          selected={category}
          onSelect={cat => { setCategory(cat); setSubCategory('all'); }}
        />

        {subCategories.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 pb-0.5 w-max">
              <button
                type="button"
                onClick={() => setSubCategory('all')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  subCategory === 'all'
                    ? 'bg-slate-600/15 text-slate-800 border border-slate-500/35'
                    : 'bg-muted text-muted-foreground border border-transparent hover:border-border',
                )}
              >
                All
              </button>
              {subCategories.map(sc => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setSubCategory(sc)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    subCategory === sc
                      ? 'bg-slate-600/15 text-slate-800 border border-slate-500/35'
                      : 'bg-muted text-muted-foreground border border-transparent hover:border-border',
                  )}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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

      <div className="px-4 mt-3 pb-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground text-sm font-medium">No items match</p>
            {search && (
              <button type="button" onClick={() => setSearch('')} className="mt-2 text-primary text-sm font-semibold">
                Clear search
              </button>
            )}
          </div>
        ) : useSubCatGrouping ? (
          buildGroupedView(filtered, renderCard, 'subCategory')
        ) : (
          <div className="space-y-2">{filtered.map(renderCard)}</div>
        )}
      </div>

      {modalItem && (
        <OffsiteAdjustModal item={modalItem} action={modalAction} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}
