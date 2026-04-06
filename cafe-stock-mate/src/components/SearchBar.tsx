import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  light?: boolean;
}

export function SearchBar({ value, onChange, placeholder = 'Search items…', light }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className={cn(
        'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
        light ? 'text-white/60' : 'text-muted-foreground'
      )} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-11 w-full rounded-xl pl-10 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
          light
            ? 'bg-white/20 border border-white/30 text-white placeholder:text-white/60 focus:ring-white/40'
            : 'border border-border bg-card placeholder:text-muted-foreground'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            light ? 'text-white/60' : 'text-muted-foreground'
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
