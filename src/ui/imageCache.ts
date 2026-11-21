/**
 * Loads swatch images once and keeps halved copies (mip levels) so a zoomed
 * out quilt samples a small image instead of shimmering on the full one.
 */
import type { FabricDef } from '../core/types';
import type { SwatchLevel, SwatchSource } from './renderQuilt';

interface Entry {
  promise: Promise<void>;
  levels: SwatchLevel[] | null;
}

const MIN_LEVEL_PX = 24;

export class ImageCache implements SwatchSource {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();

  /** Called whenever an image finishes loading. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  load(fabric: FabricDef): Promise<void> {
    const existing = this.entries.get(fabric.id);
    if (existing) return existing.promise;
    const entry: Entry = { levels: null, promise: Promise.resolve() };
    entry.promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        entry.levels = buildLevels(fabric, img);
        this.listeners.forEach((fn) => fn());
        resolve();
      };
      // A missing image keeps the flat color fill.
      img.onerror = () => resolve();
      img.src = fabric.image;
    });
    this.entries.set(fabric.id, entry);
    return entry.promise;
  }

  loadAll(fabrics: readonly FabricDef[]): Promise<void> {
    return Promise.all(fabrics.map((f) => this.load(f))).then(() => undefined);
  }

  level(fabric: FabricDef, devicePxPerInch: number): SwatchLevel | null {
    const entry = this.entries.get(fabric.id);
    if (!entry) {
      void this.load(fabric);
      return null;
    }
    const levels = entry.levels;
    if (!levels || levels.length === 0) return null;
    // Smallest level that still has at least as many pixels per inch as the screen.
    let pick = levels[0]!;
    for (const lvl of levels) {
      if (Math.min(lvl.pxPerInchX, lvl.pxPerInchY) >= devicePxPerInch) pick = lvl;
      else break;
    }
    return pick;
  }
}

function buildLevels(fabric: FabricDef, img: HTMLImageElement): SwatchLevel[] {
  const w = img.naturalWidth || fabric.widthPx;
  const h = img.naturalHeight || fabric.heightPx;
  const inchesW = fabric.widthPx / fabric.pxPerInch;
  const inchesH = fabric.heightPx / fabric.pxPerInch;
  const levels: SwatchLevel[] = [
    { source: img, pxPerInchX: w / inchesW, pxPerInchY: h / inchesH, key: `${fabric.id}@0` },
  ];
  let prev: CanvasImageSource = img;
  let pw = w;
  let ph = h;
  for (let i = 1; Math.min(pw, ph) / 2 >= MIN_LEVEL_PX; i++) {
    const cw = Math.max(1, Math.round(pw / 2));
    const ch = Math.max(1, Math.round(ph / 2));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(prev, 0, 0, cw, ch);
    levels.push({
      source: canvas,
      pxPerInchX: cw / inchesW,
      pxPerInchY: ch / inchesH,
      key: `${fabric.id}@${i}`,
    });
    prev = canvas;
    pw = cw;
    ph = ch;
  }
  return levels;
}

/** One cache for the app, shared by the screen and export. */
export const imageCache = new ImageCache();
