import { useRef } from "react";

interface DragHandlers {
  onStart?: (x: number, y: number) => void;
  onMove: (dx: number, x: number) => void;
  /** Called on release when the pointer barely moved. */
  onTap?: (x: number, y: number) => void;
}

const TAP_SLOP_PX = 4;

/**
 * Pointer-event dragging that works the same for mouse, pen and touch.
 * Coordinates are relative to the element the handlers are attached to.
 */
export function useDrag({ onStart, onMove, onTap }: DragHandlers) {
  const state = useRef<{ id: number; startX: number; moved: boolean } | null>(null);

  function local(e: React.PointerEvent<Element>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return {
    onPointerDown(e: React.PointerEvent<Element>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = local(e);
      state.current = { id: e.pointerId, startX: e.clientX, moved: false };
      onStart?.(x, y);
    },
    onPointerMove(e: React.PointerEvent<Element>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      if (Math.abs(dx) > TAP_SLOP_PX) s.moved = true;
      if (s.moved) onMove(dx, local(e).x);
    },
    onPointerUp(e: React.PointerEvent<Element>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      state.current = null;
      if (!s.moved) {
        const { x, y } = local(e);
        onTap?.(x, y);
      }
    },
    onPointerCancel() {
      state.current = null;
    },
  };
}
