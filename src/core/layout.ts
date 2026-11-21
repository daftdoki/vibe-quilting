/** Quilt geometry in inches. Pure, no DOM. */
import { getSize, fabricFor } from './design';
import type {
  Design,
  FabricCollection,
  FabricDef,
  PatternDef,
  Point,
  QuiltSize,
  ResolvedPiece,
  Rotation,
} from './types';

export function quiltSizeInches(
  pattern: PatternDef,
  size: QuiltSize,
): { width: number; height: number } {
  return { width: size.cols * pattern.block.width, height: size.rows * pattern.block.height };
}

/** FNV-1a over a string, then a finishing mix. Returns an unsigned 32 bit int. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stable value in [0, 1) from (blockId, pieceIndex, fabricId). `salt` gives independent streams. */
export function hash01(
  blockId: number,
  pieceIndex: number,
  fabricId: string,
  salt = '',
): number {
  return hash32(`${blockId}|${pieceIndex}|${fabricId}|${salt}`) / 4294967296;
}

/** Rotate a block-local point clockwise (y down) about the block center. */
export function rotatePoint(p: Point, rotation: Rotation, cx: number, cy: number): Point {
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  switch (rotation) {
    case 0:
      return [p[0], p[1]];
    case 90:
      return [cx - dy, cy + dx];
    case 180:
      return [cx - dx, cy - dy];
    case 270:
      return [cx + dy, cy - dx];
  }
}

/**
 * Top left of the crop in swatch inches. The crop is the piece's unrotated
 * bounding box, placed with a stable hash so it survives reloads, swaps and
 * rotations. An axis where the piece is larger than the swatch gets 0.
 */
export function cropOrigin(
  fabric: FabricDef,
  blockId: number,
  pieceIndex: number,
  bboxWidth: number,
  bboxHeight: number,
): Point {
  const swatchW = fabric.widthPx / fabric.pxPerInch;
  const swatchH = fabric.heightPx / fabric.pxPerInch;
  const rangeX = Math.max(0, swatchW - bboxWidth);
  const rangeY = Math.max(0, swatchH - bboxHeight);
  return [
    hash01(blockId, pieceIndex, fabric.id, 'x') * rangeX,
    hash01(blockId, pieceIndex, fabric.id, 'y') * rangeY,
  ];
}

/** Every piece of every cell in quilt inches. */
export function resolvePieces(
  pattern: PatternDef,
  collection: FabricCollection,
  design: Design,
): ResolvedPiece[] {
  const size = getSize(pattern, design.sizeId);
  const { width: bw, height: bh } = pattern.block;
  const fabrics = new Map(collection.fabrics.map((f) => [f.id, f]));
  const out: ResolvedPiece[] = [];

  design.cells.forEach((cell, cellIndex) => {
    if ((cell.rotation === 90 || cell.rotation === 270) && bw !== bh) {
      throw new Error(`Rotation ${cell.rotation} needs a square block`);
    }
    const ox = (cellIndex % size.cols) * bw;
    const oy = Math.floor(cellIndex / size.cols) * bh;
    pattern.block.pieces.forEach((piece, pieceIndex) => {
      const { fabricId, overridden } = fabricFor(pattern, design, cell.blockId, pieceIndex);
      const fabric = fabricId === null ? null : fabrics.get(fabricId);
      if (fabric === undefined) throw new Error(`Unknown fabric "${fabricId}"`);

      const xs = piece.polygon.map((p) => p[0]);
      const ys = piece.polygon.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);

      out.push({
        key: `${cell.blockId}:${piece.id}`,
        blockId: cell.blockId,
        cellIndex,
        pieceId: piece.id,
        pieceIndex,
        fabricId,
        overridden,
        polygon: piece.polygon.map((p) => {
          const r = rotatePoint(p, cell.rotation, bw / 2, bh / 2);
          return [ox + r[0], oy + r[1]] as Point;
        }),
        rotation: cell.rotation,
        cropOrigin: fabric ? cropOrigin(fabric, cell.blockId, pieceIndex, w, h) : [0, 0],
      });
    });
  });
  return out;
}

/** Ray casting point in polygon test. */
export function pointInPolygon(polygon: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The piece under a point in quilt inches, or null. On a shared edge the earlier piece wins. */
export function hitTest(
  pieces: readonly ResolvedPiece[],
  x: number,
  y: number,
): ResolvedPiece | null {
  for (const piece of pieces) {
    if (pointInPolygon(piece.polygon, x, y)) return piece;
  }
  return null;
}

/** Row-major cell index at a point in quilt inches, or null outside the quilt. */
export function cellAt(
  pattern: PatternDef,
  size: QuiltSize,
  x: number,
  y: number,
): number | null {
  const { width, height } = quiltSizeInches(pattern, size);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const col = Math.floor(x / pattern.block.width);
  const row = Math.floor(y / pattern.block.height);
  return row * size.cols + col;
}

/**
 * The pieces that lineup slot `slot` fills, found through the pattern's
 * shuffle. A piece with a hand-placed fabric is left out unless
 * `includeOverridden` is set.
 */
export function piecesForSlot(
  pattern: PatternDef,
  pieces: readonly ResolvedPiece[],
  slotCount: number,
  slot: number,
  includeOverridden = false,
): ResolvedPiece[] {
  if (slot < 0 || slot >= slotCount) return [];
  return pieces.filter(
    (p) => (includeOverridden || !p.overridden) && pattern.assign(p.blockId, p.pieceIndex, slotCount) === slot,
  );
}
