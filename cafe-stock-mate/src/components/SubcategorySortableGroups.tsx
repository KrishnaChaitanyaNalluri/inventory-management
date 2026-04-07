import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { cn } from '@/lib/utils';

function SortableInventoryRow({
  item,
  sortable,
  children,
}: {
  item: InventoryItem;
  sortable: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  if (!sortable) {
    return <div className="min-w-0">{children}</div>;
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-stretch gap-1.5 min-w-0', isDragging && 'opacity-90 z-10')}
    >
      <button
        type="button"
        className="shrink-0 flex w-9 items-center justify-center self-stretch rounded-xl border border-border bg-muted/40 text-muted-foreground cursor-grab active:cursor-grabbing touch-manipulation"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.name}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export interface SortableVerticalListProps {
  items: InventoryItem[];
  renderCard: (item: InventoryItem) => React.ReactNode;
  sortable: boolean;
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}

/** One vertical stack with optional drag handles (same group: one category + sub_category). */
export function SortableVerticalList({
  items,
  renderCard,
  sortable,
  onReorder,
}: SortableVerticalListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map(i => i.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    void onReorder(next);
  };

  const canDrag = sortable && items.length > 1;

  return (
    <div className="space-y-2">
      {canDrag && (
        <p className="text-[10px] text-muted-foreground font-medium px-0.5">Drag ⋮⋮ to reorder</p>
      )}
      {canDrag ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map(item => (
              <SortableInventoryRow key={item.id} item={item} sortable>
                {renderCard(item)}
              </SortableInventoryRow>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        items.map(item => <div key={item.id}>{renderCard(item)}</div>)
      )}
    </div>
  );
}

export interface SubcategorySortableGroupsProps {
  items: InventoryItem[];
  renderCard: (item: InventoryItem) => React.ReactNode;
  /** Managers/admins: show drag handles and persist order */
  sortable: boolean;
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}

export function SubcategorySortableGroups({
  items,
  renderCard,
  sortable,
  onReorder,
}: SubcategorySortableGroupsProps) {
  const { groupOrder, groups } = useMemo(() => {
    const order: string[] = [];
    const g: Record<string, InventoryItem[]> = {};
    for (const item of items) {
      const key = item.subCategory ?? 'Other';
      if (!g[key]) {
        order.push(key);
        g[key] = [];
      }
      g[key].push(item);
    }
    return { groupOrder: order, groups: g };
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGroupDragEnd = (list: InventoryItem[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = list.map(i => i.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    void onReorder(next);
  };

  return (
    <div className="space-y-5">
      {groupOrder.map(group => {
        const list = groups[group];
        const canDrag = sortable && list.length > 1;
        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">{group}</span>
              <span className="text-xs text-muted-foreground font-medium">· {list.length}</span>
              {canDrag && (
                <span className="text-[10px] text-muted-foreground font-medium">Drag ⋮⋮ to reorder</span>
              )}
              <div className="flex-1 h-px bg-border min-w-[2rem]" />
            </div>
            <div className="space-y-2">
              {canDrag ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleGroupDragEnd(list)}
                >
                  <SortableContext items={list.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {list.map(item => (
                      <SortableInventoryRow key={item.id} item={item} sortable>
                        {renderCard(item)}
                      </SortableInventoryRow>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                list.map(item => (
                  <div key={item.id} className="min-w-0">
                    {renderCard(item)}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
