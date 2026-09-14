/**
 * ============================================================================
 * SHARED REACT HOOKS  (tools/gallery-manager/app/hooks.ts)
 * ============================================================================
 *
 * A "hook" is a function starting with `use` that bundles React logic so
 * several components can share it.
 *
 * useDragReorder   drag items into a new order (photos, galleries, reviews)
 * useUnsavedGuard  warn before closing the tab with unsaved edits
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';

/**
 * Drag & drop reordering with the browser's built-in drag and drop.
 *
 *   const { itemProps } = useDragReorder(photos, (p) => p.name, (next) => save(next));
 *   {photos.map((p) => <div key={p.name} {...itemProps(p)}>…</div>)}
 *
 * itemProps() adds the event handlers plus `data-dragging` / `data-over`
 * attributes, which styles.css uses to highlight the dragged item and the drop spot.
 */
export function useDragReorder<T>(items: T[], keyOf: (item: T) => string, onReorder: (next: T[]) => void) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const reset = () => {
    setDragKey(null);
    setOverKey(null);
  };

  function itemProps(item: T) {
    const key = keyOf(item);
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        setDragKey(key);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', key);
      },
      onDragOver: (event: DragEvent) => {
        if (dragKey === null) return; // files from Explorer are handled by the drop zone
        event.preventDefault(); // allows dropping here
        if (overKey !== key) setOverKey(key);
      },
      onDrop: (event: DragEvent) => {
        if (dragKey === null) return;
        event.preventDefault();
        event.stopPropagation();
        if (dragKey !== key) {
          const next = [...items];
          const from = next.findIndex((i) => keyOf(i) === dragKey);
          const to = next.findIndex((i) => keyOf(i) === key);
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onReorder(next);
        }
        reset();
      },
      onDragEnd: reset,
      'data-dragging': dragKey === key ? true : undefined,
      'data-over': overKey === key && dragKey !== key ? true : undefined,
    };
  }

  return { itemProps, dragging: dragKey !== null };
}

/** Shows the browser's "Leave site?" dialog when the tab is closed with unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
