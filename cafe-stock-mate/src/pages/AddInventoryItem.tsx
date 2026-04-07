import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useInventory } from '@/context/InventoryContext';
import { apiCreateItem } from '@/lib/api';
import { CATEGORIES, Category, StorageLocation, canAddInventoryItems } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LOCATIONS: { value: StorageLocation; label: string }[] = [
  { value: 'storage_room', label: 'Storage' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'front_counter', label: 'Counter' },
];

export default function AddInventoryItem() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { refresh } = useInventory();
  const allowed = canAddInventoryItems(currentUser?.role);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('0');
  const [threshold, setThreshold] = useState('1');
  const [location, setLocation] = useState<StorageLocation>('storage_room');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!currentUser || !allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <p className="text-sm text-muted-foreground">Only managers and admins can add new inventory items.</p>
        <Button variant="outline" onClick={() => navigate('/inventory')}>
          Back to inventory
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = parseInt(qty, 10);
    const t = parseInt(threshold, 10);
    if (Number.isNaN(q) || q < 0) {
      toast.error('Starting quantity must be a number ≥ 0');
      return;
    }
    if (Number.isNaN(t) || t < 0) {
      toast.error('Low-stock alert must be a number ≥ 0');
      return;
    }
    setSaving(true);
    try {
      await apiCreateItem({
        name: name.trim(),
        category,
        sub_category: subCategory.trim() || undefined,
        unit: unit.trim(),
        current_quantity: q,
        low_stock_threshold: t,
        storage_location: location,
        note: note.trim() || undefined,
      });
      toast.success('Item created');
      await refresh();
      navigate('/inventory');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-28 bg-background">
      <div className="bg-primary px-4 pt-4 pb-8 rounded-b-[1.75rem] shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-2 text-white/90 hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-white flex-1">Add inventory item</h1>
        </div>
        <p className="text-xs text-white/80 pl-11">
          New SKU appears in the main list. Set starting count and low-stock alert here.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 -mt-2 relative z-10 space-y-4 max-w-md mx-auto">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-name">Item name</Label>
            <Input
              id="ai-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Oat milk 32oz"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-sub">Sub-category (optional)</Label>
            <Input
              id="ai-sub"
              value={subCategory}
              onChange={e => setSubCategory(e.target.value)}
              placeholder="e.g. Boba Syrups"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-unit">Unit</Label>
            <Input
              id="ai-unit"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              required
              placeholder="e.g. bottles, bags, sleeves"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-qty">Starting quantity</Label>
              <Input
                id="ai-qty"
                inputMode="numeric"
                value={qty}
                onChange={e => setQty(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-th">Low-stock alert at</Label>
              <Input
                id="ai-th"
                inputMode="numeric"
                value={threshold}
                onChange={e => setThreshold(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Storage location</Label>
            <Select value={location} onValueChange={v => setLocation(v as StorageLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(l => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-note">Note (optional)</Label>
            <Input id="ai-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Vendor, size…" />
          </div>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create item'}
        </Button>
      </form>
    </div>
  );
}
