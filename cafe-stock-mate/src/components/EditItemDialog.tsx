import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { InventoryItem, CATEGORIES, StorageLocation } from '@/types/inventory';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const LOC_NONE = '__none__';

interface EditItemDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditItemDialog({ item, open, onOpenChange }: EditItemDialogProps) {
  const { updateItemMetadata } = useInventory();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<string>('');
  const [subCategory, setSubCategory] = useState('');
  const [locationKey, setLocationKey] = useState<string>(LOC_NONE);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(() => {
    if (!item) return [...CATEGORIES];
    const seen = new Set<string>([...CATEGORIES]);
    if (!seen.has(item.category)) {
      return [item.category, ...CATEGORIES];
    }
    return [...CATEGORIES];
  }, [item]);

  useEffect(() => {
    if (!item || !open) return;
    setName(item.name);
    setUnit(item.unit);
    setCategory(item.category);
    setSubCategory(item.subCategory ?? '');
    setLocationKey(item.storageLocation ?? LOC_NONE);
    setNote(item.note ?? '');
  }, [item, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const nn = name.trim();
    const uu = unit.trim();
    if (!nn || !uu) {
      toast.error('Name and unit are required');
      return;
    }
    setSaving(true);
    try {
      await updateItemMetadata(item.id, {
        name: nn,
        unit: uu,
        category,
        sub_category: subCategory.trim() || null,
        storage_location: locationKey === LOC_NONE ? null : locationKey,
        note: note.trim() || null,
      });
      toast.success('Item updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
            <DialogDescription>
              Change how this SKU appears (name, unit label, category). Count on hand is not changed here — use +/− or
              the stock form.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-unit">Unit label</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="e.g. gallons, bottles, boxes"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sub">Sub-category (optional)</Label>
              <Input id="edit-sub" value={subCategory} onChange={e => setSubCategory(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Storage location</Label>
              <Select value={locationKey} onValueChange={setLocationKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LOC_NONE}>Not set</SelectItem>
                  {LOCATIONS.map(l => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note">Note (optional)</Label>
              <Input id="edit-note" value={note} onChange={e => setNote(e.target.value)} autoComplete="off" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
