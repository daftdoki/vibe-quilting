/**
 * Drag a fabric from the tray with Pointer Events. HTML5 drag and drop does
 * not work on iOS. In a scrolling tray, a move along the scroll axis is left
 * to the browser, and a move across it or a long press starts the drag.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FabricDef, ResolvedPiece } from '../core/types';
import type { QuiltCanvasHandle } from './QuiltCanvas';

export interface DropResult {
  fabricId: string;
  piece: ResolvedPiece | null;
  slot: number | null;
}

interface Options {
  canvas: RefObject<QuiltCanvasHandle | null>;
  /** The axis the tray scrolls along on touch. */
  scrollAxis: 'x' | 'y';
  onDrop(result: DropResult): void;
  onStart?(fabricId: string): void;
}

interface Pending {
  pointerId: number;
  pointerType: string;
  fabric: FabricDef;
  el: HTMLElement;
  sx: number;
  sy: number;
  dragging: boolean;
  timer: number;
  chipX: number;
  chipY: number;
  /** Where the drag started. A drop only counts after the pointer has moved. */
  dragX: number;
  dragY: number;
  moved: boolean;
}

const LONG_PRESS_MS = 380;
const CHIP_SIZE = 60;

function chipOffset(pointerType: string): { x: number; y: number } {
  return pointerType === 'mouse' ? { x: 0, y: -34 } : { x: 0, y: -78 };
}

export function useFabricDrag({ canvas, scrollAxis, onDrop, onStart }: Options) {
  const state = useRef<Pending | null>(null);
  const chip = useRef<HTMLDivElement | null>(null);
  const slotEl = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const opts = useRef({ scrollAxis, onDrop, onStart });
  opts.current = { scrollAxis, onDrop, onStart };

  const setSlotHighlight = (el: HTMLElement | null) => {
    if (slotEl.current === el) return;
    slotEl.current?.classList.remove('is-drop-target');
    el?.classList.add('is-drop-target');
    slotEl.current = el;
  };

  const placeChip = (s: Pending, x: number, y: number) => {
    const off = chipOffset(s.pointerType);
    s.chipX = x + off.x;
    s.chipY = y + off.y;
    const c = chip.current;
    if (c) {
      c.style.transform = `translate3d(${s.chipX - CHIP_SIZE / 2}px, ${s.chipY - CHIP_SIZE / 2}px, 0)`;
    }
    const piece = canvas.current?.pieceAtClient(s.chipX, s.chipY) ?? null;
    canvas.current?.setDropKey(piece ? piece.key : null);
    let slot: HTMLElement | null = null;
    if (!piece) {
      const hit = document.elementFromPoint(s.chipX, s.chipY);
      slot = hit instanceof Element ? (hit.closest('[data-drop-slot]') as HTMLElement | null) : null;
    }
    setSlotHighlight(slot);
  };

  const startDrag = (s: Pending, x: number, y: number) => {
    if (s.dragging) return;
    s.dragging = true;
    s.dragX = x;
    s.dragY = y;
    suppressClick.current = true;
    window.clearTimeout(s.timer);
    try {
      s.el.setPointerCapture(s.pointerId);
    } catch {
      // The pointer may already be gone.
    }
    const c = document.createElement('div');
    c.className = 'drag-chip';
    c.setAttribute('aria-hidden', 'true');
    c.style.backgroundImage = `url("${s.fabric.thumb}")`;
    c.style.backgroundColor = s.fabric.color;
    document.body.appendChild(c);
    chip.current = c;
    document.documentElement.classList.add('is-dragging');
    navigator.vibrate?.(8);
    placeChip(s, x, y);
    opts.current.onStart?.(s.fabric.id);
  };

  const finish = useCallback(
    (drop: boolean) => {
      const s = state.current;
      state.current = null;
      if (!s) return;
      window.clearTimeout(s.timer);
      if (s.dragging) {
        let piece: ResolvedPiece | null = null;
        let slot: number | null = null;
        if (drop && s.moved) {
          piece = canvas.current?.pieceAtClient(s.chipX, s.chipY) ?? null;
          const raw = slotEl.current?.dataset.dropSlot;
          if (!piece && raw !== undefined) slot = Number(raw);
        }
        canvas.current?.setDropKey(null);
        setSlotHighlight(null);
        chip.current?.remove();
        chip.current = null;
        document.documentElement.classList.remove('is-dragging');
        // Swallow only the click that directly follows this drag.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        if (piece || slot !== null) opts.current.onDrop({ fabricId: s.fabric.id, piece, slot });
      }
    },
    [canvas],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (s.dragging) {
        if (!s.moved && Math.hypot(e.clientX - s.dragX, e.clientY - s.dragY) > 10) s.moved = true;
        placeChip(s, e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - s.sx;
      const dy = e.clientY - s.sy;
      const dist = Math.hypot(dx, dy);
      if (s.pointerType === 'mouse') {
        if (dist > 4) startDrag(s, e.clientX, e.clientY);
        return;
      }
      if (dist < 8) return;
      const across = opts.current.scrollAxis === 'x' ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) > Math.abs(dy);
      if (across) startDrag(s, e.clientX, e.clientY);
      else finish(false); // The browser scrolls the tray.
    };
    const up = (e: PointerEvent) => {
      if (state.current && e.pointerId === state.current.pointerId) finish(true);
    };
    const cancel = (e: PointerEvent) => {
      if (state.current && e.pointerId === state.current.pointerId) finish(false);
    };
    // Stops the browser from scrolling or zooming once a drag has started.
    // It must be registered before the touch starts and must not be passive.
    const touchMove = (e: TouchEvent) => {
      if (state.current?.dragging && e.cancelable) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.current) finish(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    document.addEventListener('touchmove', touchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      document.removeEventListener('touchmove', touchMove);
      finish(false);
    };
  }, [finish]);

  /** Props for one draggable fabric element. */
  const dragProps = useCallback(
    (fabric: FabricDef) => ({
      onPointerDown(e: React.PointerEvent<HTMLElement>) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (state.current) finish(false);
        suppressClick.current = false;
        const s: Pending = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          fabric,
          el: e.currentTarget,
          sx: e.clientX,
          sy: e.clientY,
          dragging: false,
          timer: 0,
          chipX: e.clientX,
          chipY: e.clientY,
          dragX: e.clientX,
          dragY: e.clientY,
          moved: false,
        };
        if (e.pointerType !== 'mouse') {
          s.timer = window.setTimeout(() => {
            if (state.current === s) startDrag(s, s.sx, s.sy);
          }, LONG_PRESS_MS);
        }
        state.current = s;
      },
      onContextMenu(e: React.MouseEvent) {
        e.preventDefault();
      },
    }),
    [finish],
  );

  /** True once after a drag, so the click that follows does not toggle selection. */
  const takeClickSuppression = useCallback(() => {
    const v = suppressClick.current;
    suppressClick.current = false;
    return v;
  }, []);

  return { dragProps, takeClickSuppression };
}
