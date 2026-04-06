import { CATEGORIES, Category } from '@/types/inventory';
import { cn } from '@/lib/utils';

interface CategoryChipsProps {
  selected: Category | 'all';
  onSelect: (cat: Category | 'all') => void;
  /** When provided, shows a count badge on each chip with a non-zero count */
  counts?: Partial<Record<Category | 'all', number>>;
}

export function CategoryChips({ selected, onSelect, counts }: CategoryChipsProps) {
  const totalCount = counts?.['all'];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-4 px-4">
      <button
        onClick={() => onSelect('all')}
        className={cn(
          'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap flex items-center gap-1.5',
          selected === 'all'
            ? 'border-primary bg-primary text-white'
            : 'border-border bg-card text-muted-foreground active:bg-muted'
        )}
      >
        All
        {totalCount != null && totalCount > 0 && (
          <span className={cn(
            'rounded-full px-1.5 py-0 text-[10px] font-bold leading-4',
            selected === 'all' ? 'bg-white/30 text-white' : 'bg-destructive text-white'
          )}>
            {totalCount}
          </span>
        )}
      </button>
      {CATEGORIES.map(cat => {
        const count = counts?.[cat];
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap flex items-center gap-1.5',
              selected === cat
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card text-muted-foreground active:bg-muted'
            )}
          >
            {cat}
            {count != null && count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0 text-[10px] font-bold leading-4',
                selected === cat ? 'bg-white/30 text-white' : 'bg-destructive text-white'
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
