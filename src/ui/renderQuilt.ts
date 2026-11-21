/**
 * Pure quilt drawing, shared by the screen canvas and PNG export.
 * Everything is drawn in quilt inches; the caller sets the view transform.
 */
import { getSize } from '../core/design';
import { quiltSizeInches } from '../core/layout';
import type {
  Design,
  FabricCollection,
  FabricDef,
  PatternDef,
  Point,
  ResolvedPiece,
} from '../core/types';

/** 2D affine in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function applyAffine(m: Affine, p: Point): Point {
  return [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
}

/**
 * Maps swatch inches to quilt inches for one piece. The swatch point
 * `cropOrigin` lands on the top left of the piece's unrotated bounding box in
 * block space, and the whole block is then turned about its center.
 */
export function pieceAffine(
  pattern: PatternDef,
  cols: number,
  piece: ResolvedPiece,
): Affine {
  const { width: bw, height: bh } = pattern.block;
  const def = pattern.block.pieces[piece.pieceIndex];
  const poly = def ? def.polygon : piece.polygon;
  let bx0 = Infinity;
  let by0 = Infinity;
  for (const [x, y] of poly) {
    if (x < bx0) bx0 = x;
    if (y < by0) by0 = y;
  }
  const ox = (piece.cellIndex % cols) * bw;
  const oy = Math.floor(piece.cellIndex / cols) * bh;
  const cx = bw / 2;
  const cy = bh / 2;
  const tx = bx0 - piece.cropOrigin[0] - cx;
  const ty = by0 - piece.cropOrigin[1] - cy;
  const rad = (piece.rotation * Math.PI) / 180;
  // Exact values for the quarter turns.
  const cos = Math.round(Math.cos(rad) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(rad) * 1e12) / 1e12;
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cos * tx - sin * ty + ox + cx,
    f: sin * tx + cos * ty + oy + cy,
  };
}

export interface SceneItem {
  piece: ResolvedPiece;
  /** Null when the piece has no fabric yet. */
  fabric: FabricDef | null;
  /** The piece label from the pattern, for example "A". */
  label: string;
  /** Swatch inches to quilt inches. */
  affine: Affine;
  path: Path2D | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Scene {
  width: number;
  height: number;
  cols: number;
  rows: number;
  blockWidth: number;
  blockHeight: number;
  items: SceneItem[];
}

function polygonPath(poly: readonly Point[]): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  const path = new Path2D();
  poly.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

export function buildScene(
  pattern: PatternDef,
  collection: FabricCollection,
  design: Design,
  pieces: readonly ResolvedPiece[],
): Scene {
  const size = getSize(pattern, design.sizeId);
  const { width, height } = quiltSizeInches(pattern, size);
  const fabrics = new Map(collection.fabrics.map((f) => [f.id, f]));
  const items: SceneItem[] = [];
  for (const piece of pieces) {
    // Empty pieces stay in the scene so they draw and can be tapped.
    const fabric = piece.fabricId === null ? null : fabrics.get(piece.fabricId);
    if (fabric === undefined) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of piece.polygon) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    items.push({
      piece,
      fabric,
      label: pattern.block.pieces[piece.pieceIndex]?.label ?? piece.pieceId,
      affine: pieceAffine(pattern, size.cols, piece),
      path: polygonPath(piece.polygon),
      minX,
      minY,
      maxX,
      maxY,
    });
  }
  return {
    width,
    height,
    cols: size.cols,
    rows: size.rows,
    blockWidth: pattern.block.width,
    blockHeight: pattern.block.height,
    items,
  };
}

/** One resolution of a swatch image. */
export interface SwatchLevel {
  source: CanvasImageSource;
  /** Image pixels per swatch inch on each axis. */
  pxPerInchX: number;
  pxPerInchY: number;
  key: string;
}

/** Supplies swatch images. Returns null while an image is still loading. */
export interface SwatchSource {
  level(fabric: FabricDef, devicePxPerInch: number): SwatchLevel | null;
}

export interface Highlights {
  /** Piece key under a drag. */
  dropKey?: string | null;
  /** Piece key shown in the info line. */
  infoKey?: string | null;
  /** Selected cell in Blocks mode. */
  selectedCell?: number | null;
  /** Cell the guide is working on. The rest of the quilt is dimmed. */
  focusCell?: number | null;
  /** Keys of the pieces one fat quarter fills, outlined in yellow. */
  slotKeys?: ReadonlySet<string> | null;
}

export interface DrawOptions {
  /** Device pixels per quilt inch. Used for line widths and image levels. */
  devicePxPerInch: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
  /** Visible area in quilt inches, for culling. Omit to draw everything. */
  visible?: { minX: number; minY: number; maxX: number; maxY: number };
  highlights?: Highlights;
  /**
   * How to draw pieces with no fabric. 'screen' draws a dashed patch with its
   * label, 'print' draws a plain light patch for export. Default 'screen'.
   */
  empty?: 'screen' | 'print';
  /** False skips the seam lines between pieces, for small thumbnails. Default true. */
  seams?: boolean;
}

const SEAM = 'rgba(24, 8, 40, 0.55)';
const BLOCK_LINE = 'rgba(24, 8, 40, 0.9)';
const DROP = '#ffe14d';
const INFO = '#ff3d9a';
const SELECT = '#2de2e6';
const FOCUS = '#fff4fb';
/** A step lighter than the mat, so an empty piece reads as a hole in the quilt. */
const EMPTY_FILL = '#311a52';
const EMPTY_DASH = 'rgba(199, 179, 230, 0.6)';
const EMPTY_LABEL = 'rgba(199, 179, 230, 0.9)';
const EMPTY_PRINT = '#ece8ef';
/** Labels show once the shorter side of a piece is this many CSS pixels on screen. */
const LABEL_MIN_CSS_PX = 26;

type PatternCache = Map<string, CanvasPattern | null>;
const patternCaches = new WeakMap<object, PatternCache>();

function patternFor(
  ctx: CanvasRenderingContext2D,
  level: SwatchLevel,
): CanvasPattern | null {
  let cache = patternCaches.get(ctx);
  if (!cache) {
    cache = new Map();
    patternCaches.set(ctx, cache);
  }
  if (cache.has(level.key)) return cache.get(level.key) ?? null;
  let pat: CanvasPattern | null = null;
  try {
    pat = ctx.createPattern(level.source, 'repeat');
  } catch {
    pat = null;
  }
  cache.set(level.key, pat);
  return pat;
}

/** Draw the quilt. The context transform must map quilt inches to device pixels. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  swatches: SwatchSource,
  opts: DrawOptions,
): void {
  const { devicePxPerInch: k, dpr, visible, highlights } = opts;
  const emptyStyle = opts.empty ?? 'screen';
  const unit = 1 / k; // one device pixel in inches
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const shown: SceneItem[] = [];
  const empties: SceneItem[] = [];
  for (const item of scene.items) {
    if (
      visible &&
      (item.maxX < visible.minX ||
        item.minX > visible.maxX ||
        item.maxY < visible.minY ||
        item.minY > visible.maxY)
    ) {
      continue;
    }
    shown.push(item);
    if (!item.path) continue;
    if (!item.fabric) {
      empties.push(item);
      ctx.fillStyle = emptyStyle === 'print' ? EMPTY_PRINT : EMPTY_FILL;
      ctx.fill(item.path);
      continue;
    }
    const level = swatches.level(item.fabric, k);
    const pat = level ? patternFor(ctx, level) : null;
    if (pat && level) {
      const m = item.affine;
      const sx = 1 / level.pxPerInchX;
      const sy = 1 / level.pxPerInchY;
      pat.setTransform(new DOMMatrix([m.a * sx, m.b * sx, m.c * sy, m.d * sy, m.e, m.f]));
      ctx.fillStyle = pat;
    } else {
      ctx.fillStyle = item.fabric.color;
    }
    ctx.fill(item.path);
  }

  // Seams between pieces.
  if (opts.seams !== false) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = Math.max(1, dpr * 0.6) * unit;
    ctx.beginPath();
    for (const item of shown) {
      const poly = item.piece.polygon;
      poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    }
    ctx.stroke();
  }

  // Block grid and outer edge.
  ctx.strokeStyle = BLOCK_LINE;
  ctx.lineWidth = Math.max(1.5, dpr * 1.25) * unit;
  ctx.beginPath();
  for (let c = 0; c <= scene.cols; c++) {
    const x = c * scene.blockWidth;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, scene.height);
  }
  for (let r = 0; r <= scene.rows; r++) {
    const y = r * scene.blockHeight;
    ctx.moveTo(0, y);
    ctx.lineTo(scene.width, y);
  }
  ctx.stroke();

  if (emptyStyle === 'screen' && empties.length > 0) drawEmptyMarks(ctx, empties, k, dpr);

  if (!highlights) return;

  const focus = highlights.focusCell;
  if (focus !== null && focus !== undefined && focus >= 0 && focus < scene.cols * scene.rows && focus !== highlights.selectedCell) {
    const x = (focus % scene.cols) * scene.blockWidth;
    const y = Math.floor(focus / scene.cols) * scene.blockHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(29, 11, 51, 0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, scene.width, scene.height);
    ctx.rect(x + scene.blockWidth, y, -scene.blockWidth, scene.blockHeight);
    ctx.fill('evenodd');
    ctx.restore();
    outlineRect(ctx, x, y, scene.blockWidth, scene.blockHeight, FOCUS, dpr * 2 * unit, unit * dpr);
  }

  const sel = highlights.selectedCell;
  if (sel !== null && sel !== undefined && sel >= 0 && sel < scene.cols * scene.rows) {
    const x = (sel % scene.cols) * scene.blockWidth;
    const y = Math.floor(sel / scene.cols) * scene.blockHeight;
    // Dim the rest so the picked block stands out.
    ctx.save();
    ctx.fillStyle = 'rgba(29, 11, 51, 0.38)';
    ctx.beginPath();
    ctx.rect(0, 0, scene.width, scene.height);
    ctx.rect(x + scene.blockWidth, y, -scene.blockWidth, scene.blockHeight);
    ctx.fill('evenodd');
    ctx.restore();
    outlineRect(ctx, x, y, scene.blockWidth, scene.blockHeight, SELECT, dpr * 3 * unit, unit * dpr);
  }

  const slotKeys = highlights.slotKeys;
  if (slotKeys && slotKeys.size > 0) {
    // One path for every piece, so the casing and the line stay one device width at any zoom.
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (const item of shown) {
      if (!slotKeys.has(item.piece.key)) continue;
      item.piece.polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    }
    const line = Math.max(2, dpr * 2.25) * unit;
    ctx.strokeStyle = 'rgba(24, 8, 40, 0.9)';
    ctx.lineWidth = line + Math.max(1.5, dpr * 1.5) * unit * 2;
    ctx.stroke();
    ctx.strokeStyle = DROP;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.restore();
  }

  const info = highlights.infoKey ? scene.items.find((i) => i.piece.key === highlights.infoKey) : undefined;
  if (info) outlinePoly(ctx, info.piece.polygon, INFO, dpr * 2.5 * unit, unit * dpr);

  const drop = highlights.dropKey ? scene.items.find((i) => i.piece.key === highlights.dropKey) : undefined;
  if (drop) {
    if (drop.path) {
      ctx.fillStyle = 'rgba(255, 225, 77, 0.28)';
      ctx.fill(drop.path);
    }
    outlinePoly(ctx, drop.piece.polygon, DROP, dpr * 3 * unit, unit * dpr);
  }
}

/** Colored outline with a thin dark edge so it reads on any print. */
function outlinePoly(
  ctx: CanvasRenderingContext2D,
  poly: readonly Point[],
  color: string,
  width: number,
  edge: number,
): void {
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(24, 8, 40, 0.85)';
  ctx.lineWidth = width + edge * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function outlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  width: number,
  edge: number,
): void {
  outlinePoly(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    color,
    width,
    edge,
  );
}

/**
 * Dashed outline inside each empty piece, and its label once the piece is big
 * enough to read. The outline is clipped to the piece, so the seam on top of
 * the edge stays solid. Labels are drawn upright in device pixels.
 */
function drawEmptyMarks(
  ctx: CanvasRenderingContext2D,
  empties: readonly SceneItem[],
  k: number,
  dpr: number,
): void {
  const unit = 1 / k;
  ctx.save();
  ctx.strokeStyle = EMPTY_DASH;
  ctx.lineWidth = Math.max(1, dpr) * 1.5 * unit * 2;
  ctx.setLineDash([5 * dpr * unit, 4 * dpr * unit]);
  for (const item of empties) {
    if (!item.path) continue;
    ctx.save();
    ctx.clip(item.path);
    // Half of the doubled width lands inside the clip, next to the seam.
    ctx.stroke(item.path);
    ctx.restore();
  }
  ctx.restore();

  const m = ctx.getTransform();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = EMPTY_LABEL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const item of empties) {
    const shortCss = (Math.min(item.maxX - item.minX, item.maxY - item.minY) * k) / dpr;
    if (shortCss < LABEL_MIN_CSS_PX) continue;
    const size = Math.min(22, Math.max(11, shortCss * 0.3)) * dpr;
    const cx = (item.minX + item.maxX) / 2;
    const cy = (item.minY + item.maxY) / 2;
    ctx.font = `650 ${Math.round(size)}px 'Outfit Variable', 'Outfit', system-ui, sans-serif`;
    ctx.fillText(item.label, m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f);
  }
  ctx.restore();
}
