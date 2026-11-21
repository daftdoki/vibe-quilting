import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { hitTest } from '../core/layout';
import type { ResolvedPiece } from '../core/types';
import { imageCache } from './imageCache';
import { drawScene, type Highlights, type Scene } from './renderQuilt';
import { clampView, fitView, zoomAt, zoomLimits, type Box, type Padding, type View } from './view';

export interface QuiltCanvasHandle {
  /** Piece under a client point, or null outside the quilt or canvas. */
  pieceAtClient(clientX: number, clientY: number): ResolvedPiece | null;
  setDropKey(key: string | null): void;
  fit(): void;
  /**
   * Move the view so one block fills most of the canvas. Animates, or jumps
   * under reduced motion. The block stays in view through canvas resizes until
   * the user pans, zooms, or fits.
   */
  zoomToCell(cellIndex: number): void;
}

export interface QuiltTap {
  piece: ResolvedPiece | null;
  cell: number | null;
}

interface Props {
  scene: Scene;
  highlights: Highlights;
  onTap(tap: QuiltTap): void;
  className?: string;
  ref?: Ref<QuiltCanvasHandle>;
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pending' | 'pan'; sx: number; sy: number; view0: View; multi: boolean }
  | { kind: 'pinch'; dist0: number; mx0: number; my0: number; view0: View };

const MAT = '#1d0b33';

/** Fit padding. The bottom keeps clear of the status pill. */
function padFor(box: Box): Padding {
  const p = Math.min(box.width, box.height) < 500 ? 14 : 32;
  return { top: p + 8, right: p, bottom: p + 64, left: p };
}

/** Padding around a zoomed block. Clear of the corner buttons and the status pill. */
function cellPadFor(box: Box): Padding {
  const small = Math.min(box.width, box.height) < 500;
  const side = small ? 58 : 64;
  return { top: small ? 12 : 20, right: side, bottom: small ? 70 : 76, left: side };
}

const ZOOM_MS = 360;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function QuiltCanvas({ scene, highlights, onTap, className, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  const piecesRef = useRef(scene.items.map((i) => i.piece));
  const highlightsRef = useRef(highlights);
  const dropKeyRef = useRef<string | null>(null);
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 });
  const boxRef = useRef<Box>({ width: 0, height: 0 });
  const fittedRef = useRef(true);
  const frameRef = useRef(0);
  /** Cell kept in view by zoomToCell, or null. */
  const focusRef = useRef<number | null>(null);
  const animRef = useRef(0);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const draw = useCallback(() => {
    frameRef.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || boxRef.current.width === 0) return;
    const dpr = canvas.width / Math.max(1, boxRef.current.width) || 1;
    const view = viewRef.current;
    const s = sceneRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = MAT;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMatGrid(ctx, view, boxRef.current, dpr);

    const k = view.scale * dpr;
    ctx.setTransform(k, 0, 0, k, view.x * dpr, view.y * dpr);
    drawScene(ctx, s, imageCache, {
      devicePxPerInch: k,
      dpr,
      visible: {
        minX: -view.x / view.scale,
        minY: -view.y / view.scale,
        maxX: (boxRef.current.width - view.x) / view.scale,
        maxY: (boxRef.current.height - view.y) / view.scale,
      },
      highlights: { ...highlightsRef.current, dropKey: dropKeyRef.current },
    });
  }, []);

  const requestDraw = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const quiltBox = (): Box => ({ width: sceneRef.current.width, height: sceneRef.current.height });

  const limits = () => zoomLimits(fitView(boxRef.current, quiltBox(), padFor(boxRef.current)).scale);

  const stopZoom = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  }, []);

  const setView = useCallback(
    (v: View, userMoved = true) => {
      viewRef.current = clampView(v, boxRef.current, quiltBox());
      if (userMoved) {
        fittedRef.current = false;
        focusRef.current = null;
        stopZoom();
      }
      requestDraw();
    },
    [requestDraw, stopZoom],
  );

  /** The view that shows one cell as large as the padding allows. */
  const cellView = (cell: number): View => {
    const s = sceneRef.current;
    const col = cell % Math.max(1, s.cols);
    const row = Math.floor(cell / Math.max(1, s.cols));
    const box = boxRef.current;
    const v = fitView(box, { width: s.blockWidth, height: s.blockHeight }, cellPadFor(box));
    const { max } = limits();
    const scale = Math.min(max, v.scale);
    const cx = (col + 0.5) * s.blockWidth;
    const cy = (row + 0.5) * s.blockHeight;
    // Center of the padded area.
    const pad = cellPadFor(box);
    const sx = pad.left + (box.width - pad.left - pad.right) / 2;
    const sy = pad.top + (box.height - pad.top - pad.bottom) / 2;
    return { scale, x: sx - cx * scale, y: sy - cy * scale };
  };

  const zoomToCell = useCallback(
    (cell: number) => {
      const s = sceneRef.current;
      if (cell < 0 || cell >= s.cols * s.rows) return;
      stopZoom();
      focusRef.current = cell;
      fittedRef.current = false;
      if (boxRef.current.width === 0) return; // The resize handler applies it.
      if (prefersReducedMotion()) {
        viewRef.current = cellView(cell);
        requestDraw();
        return;
      }
      // Interpolate the quilt point at the canvas center and the log of the scale.
      const box = boxRef.current;
      const from = viewRef.current;
      const fx = (box.width / 2 - from.x) / from.scale;
      const fy = (box.height / 2 - from.y) / from.scale;
      const t0 = performance.now();
      const step = (now: number) => {
        if (focusRef.current !== cell) return;
        const b = boxRef.current;
        const to = cellView(cell);
        const tx = (b.width / 2 - to.x) / to.scale;
        const ty = (b.height / 2 - to.y) / to.scale;
        const t = Math.min(1, (now - t0) / ZOOM_MS);
        const e = 1 - (1 - t) ** 3;
        const scale = Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e);
        const qx = fx + (tx - fx) * e;
        const qy = fy + (ty - fy) * e;
        viewRef.current = t >= 1 ? to : { scale, x: b.width / 2 - qx * scale, y: b.height / 2 - qy * scale };
        draw();
        animRef.current = t >= 1 ? 0 : requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    // cellView and limits read refs only.
    [draw, requestDraw, stopZoom],
  );

  const fit = useCallback(() => {
    stopZoom();
    focusRef.current = null;
    viewRef.current = fitView(boxRef.current, quiltBox(), padFor(boxRef.current));
    fittedRef.current = true;
    requestDraw();
  }, [requestDraw, stopZoom]);

  // Scene and highlight changes.
  useEffect(() => {
    const prev = sceneRef.current;
    sceneRef.current = scene;
    piecesRef.current = scene.items.map((i) => i.piece);
    if (prev.width !== scene.width || prev.height !== scene.height) fit();
    else requestDraw();
  }, [scene, fit, requestDraw]);

  useEffect(() => {
    highlightsRef.current = highlights;
    requestDraw();
  }, [highlights, requestDraw]);

  useEffect(() => imageCache.subscribe(requestDraw), [requestDraw]);

  // Size the backing store and redraw in the same callback so it never flashes blank.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const old = boxRef.current;
      boxRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      if (focusRef.current !== null) {
        // Keep the zoomed block in view as the card above the tray grows or shrinks.
        // A running zoom recomputes its target every frame, so leave it alone.
        if (!animRef.current) viewRef.current = cellView(focusRef.current);
      } else if (fittedRef.current || old.width === 0) {
        viewRef.current = fitView(boxRef.current, quiltBox(), padFor(boxRef.current));
        fittedRef.current = true;
      } else {
        // Keep the same quilt point in the middle.
        const v = viewRef.current;
        const dx = (rect.width - old.width) / 2;
        const dy = (rect.height - old.height) / 2;
        const { min, max } = limits();
        viewRef.current = clampView(
          { scale: Math.min(max, Math.max(min, v.scale)), x: v.x + dx, y: v.y + dy },
          boxRef.current,
          quiltBox(),
        );
      }
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', resize);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', resize);
      stopZoom();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [draw, stopZoom]);

  const toQuilt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) return null;
    const v = viewRef.current;
    return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale, sx, sy };
  };

  useImperativeHandle(
    ref,
    () => ({
      pieceAtClient(clientX, clientY) {
        const q = toQuilt(clientX, clientY);
        if (!q) return null;
        return hitTest(piecesRef.current, q.x, q.y);
      },
      setDropKey(key) {
        if (dropKeyRef.current === key) return;
        dropKeyRef.current = key;
        requestDraw();
      },
      fit,
      zoomToCell,
    }),
    [fit, zoomToCell, requestDraw],
  );

  // Pointer gestures.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ kind: 'none' });
  const lastEmptyTap = useRef({ t: 0, x: 0, y: 0 });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    gesture.current = {
      kind: 'pinch',
      dist0: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mx0: (a.x + b.x) / 2,
      my0: (a.y + b.y) / 2,
      view0: viewRef.current,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      gesture.current = { kind: 'pending', sx: p.x, sy: p.y, view0: viewRef.current, multi: false };
    } else if (pointers.current.size === 2) {
      startPinch();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.kind === 'pending' || g.kind === 'pan') {
      const dx = p.x - g.sx;
      const dy = p.y - g.sy;
      const slop = e.pointerType === 'mouse' ? 4 : 9;
      if (g.kind === 'pending' && Math.hypot(dx, dy) < slop) return;
      if (g.kind === 'pending') gesture.current = { ...g, kind: 'pan' };
      setView({ scale: g.view0.scale, x: g.view0.x + dx, y: g.view0.y + dy });
    } else if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const { min, max } = limits();
      const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const scale = Math.min(max, Math.max(min, (g.view0.scale * dist) / g.dist0));
      const qx = (g.mx0 - g.view0.x) / g.view0.scale;
      const qy = (g.my0 - g.view0.y) / g.view0.scale;
      setView({ scale, x: mx - qx * scale, y: my - qy * scale });
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const left = [...pointers.current.values()];
    if (left.length === 1 && g.kind === 'pinch') {
      // Carry on as a pan from where the remaining finger is.
      const p = left[0]!;
      gesture.current = { kind: 'pan', sx: p.x, sy: p.y, view0: viewRef.current, multi: true };
      return;
    }
    if (left.length >= 2) {
      startPinch();
      return;
    }
    if (left.length > 0) return;
    gesture.current = { kind: 'none' };
    if (cancelled || g.kind !== 'pending' || g.multi) return;
    const q = toQuilt(e.clientX, e.clientY);
    if (!q) return;
    const s = sceneRef.current;
    const inside = q.x >= 0 && q.y >= 0 && q.x < s.width && q.y < s.height;
    if (!inside) {
      // Double tap on the mat fits the quilt. On the quilt a tap is always an action.
      const last = lastEmptyTap.current;
      const now = performance.now();
      if (now - last.t < 350 && Math.hypot(q.sx - last.x, q.sy - last.y) < 40) {
        lastEmptyTap.current = { t: 0, x: 0, y: 0 };
        fit();
      } else {
        lastEmptyTap.current = { t: now, x: q.sx, y: q.sy };
      }
      onTapRef.current({ piece: null, cell: null });
      return;
    }
    const piece = hitTest(piecesRef.current, q.x, q.y);
    const col = Math.floor(q.x / s.blockWidth);
    const row = Math.floor(q.y / s.blockHeight);
    onTapRef.current({ piece, cell: row * s.cols + col });
  };

  // Wheel and Safari gesture events need non-passive native listeners.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const v = viewRef.current;
      const { min, max } = limits();
      // Wheel always zooms at the cursor. Trackpad pinch arrives as ctrl+wheel.
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));
      setView(zoomAt(v, factor, p.x, p.y, min, max));
    };
    const stop = (e: Event) => e.preventDefault();
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('gesturestart', stop);
    canvas.addEventListener('gesturechange', stop);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('gesturestart', stop);
      canvas.removeEventListener('gesturechange', stop);
    };
  }, [setView]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Quilt preview. Drag to pan, pinch or scroll to zoom."
      role="img"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPointer(e, false)}
      onPointerCancel={(e) => endPointer(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

/** Faint cutting mat grid: 1 inch lines when there is room, stronger 6 inch lines. */
function drawMatGrid(ctx: CanvasRenderingContext2D, view: View, box: Box, dpr: number): void {
  const line = (step: number, color: string) => {
    const px = step * view.scale;
    if (px < 7) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const i0 = Math.floor(-view.x / px);
    const i1 = Math.ceil((box.width - view.x) / px);
    for (let i = i0; i <= i1; i++) {
      const x = Math.round((view.x + i * px) * dpr) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, box.height * dpr);
    }
    const j0 = Math.floor(-view.y / px);
    const j1 = Math.ceil((box.height - view.y) / px);
    for (let j = j0; j <= j1; j++) {
      const y = Math.round((view.y + j * px) * dpr) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(box.width * dpr, y);
    }
    ctx.stroke();
  };
  const inchAlpha = Math.min(1, Math.max(0, (view.scale - 7) / 10));
  if (inchAlpha > 0) line(1, `rgba(255, 61, 154, ${(0.13 * inchAlpha).toFixed(3)})`);
  line(6, 'rgba(45, 226, 230, 0.2)');
}
