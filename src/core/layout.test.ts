import { describe, expect, it } from 'vitest';
import { stacks } from '../patterns/stacks';
import { createDesign, getSize, rotateCell, setOverride, swapCells } from './design';
import { cellAt, hitTest, piecesForSlot, resolvePieces } from './layout';
import { makeCollection } from './test-fixtures';

const collection = makeCollection();
const design = createDesign(stacks, collection, 'throw');
const bounds = (poly: readonly (readonly [number, number])[]) => ({
  x0: Math.min(...poly.map((p) => p[0])),
  x1: Math.max(...poly.map((p) => p[0])),
  y0: Math.min(...poly.map((p) => p[1])),
  y1: Math.max(...poly.map((p) => p[1])),
});

describe('resolvePieces', () => {
  const pieces = resolvePieces(stacks, collection, design);

  it('returns cells * 9 pieces', () => {
    expect(pieces).toHaveLength(16 * 9);
  });

  it('puts piece A of a 180 block at its bottom right', () => {
    // Cell 1 (col 1, row 0) is rotated 180.
    const a = pieces.find((p) => p.cellIndex === 1 && p.pieceId === 'A')!;
    expect(a.rotation).toBe(180);
    const b = bounds(a.polygon);
    expect(b.x1).toBeCloseTo(31, 9);
    expect(b.y1).toBeCloseTo(18.5, 9);
    expect(b.x0).toBeCloseTo(31 - 3.5, 9);
    expect(b.y0).toBeCloseTo(18.5 - 6.5, 9);
  });

  it('places piece A of an unrotated block at its top left', () => {
    const b = bounds(pieces.find((p) => p.cellIndex === 0 && p.pieceId === 'A')!.polygon);
    expect([b.x0, b.y0, b.x1, b.y1]).toEqual([0, 0, 3.5, 6.5]);
  });

  it('keeps every crop inside the swatch', () => {
    for (const p of pieces) {
      const def = stacks.block.pieces[p.pieceIndex]!;
      const bb = bounds(def.polygon);
      expect(p.cropOrigin[0]).toBeGreaterThanOrEqual(0);
      expect(p.cropOrigin[1]).toBeGreaterThanOrEqual(0);
      expect(p.cropOrigin[0] + (bb.x1 - bb.x0)).toBeLessThanOrEqual(12.1 + 1e-9);
      expect(p.cropOrigin[1] + (bb.y1 - bb.y0)).toBeLessThanOrEqual(10.8 + 1e-9);
    }
  });

  it('uses 0 on an axis where the piece exceeds the swatch', () => {
    const small = {
      ...collection,
      fabrics: collection.fabrics.map((f) => ({ ...f, widthPx: 300, heightPx: 300 })),
    };
    const p = resolvePieces(stacks, small, design).find((q) => q.pieceId === 'B')!;
    expect(p.cropOrigin[1]).toBe(0); // B is 7.5 tall, swatch is 3.
  });

  it('keeps cropOrigin stable across swapCells and rotateCell', () => {
    const moved = rotateCell(stacks, swapCells(design, 0, 6), 2);
    const after = resolvePieces(stacks, collection, moved);
    for (const p of pieces) {
      const q = after.find((x) => x.blockId === p.blockId && x.pieceIndex === p.pieceIndex)!;
      expect(q.cropOrigin).toEqual(p.cropOrigin);
    }
  });

  it('throws for 90 degrees on a non-square block', () => {
    const bad = { ...design, cells: design.cells.map((c, i) => (i === 0 ? { ...c, rotation: 90 as const } : c)) };
    expect(() => resolvePieces(stacks, collection, bad)).toThrow();
  });
});

describe('hitTest and cellAt', () => {
  const pieces = resolvePieces(stacks, collection, design);

  it('finds pieces', () => {
    expect(hitTest(pieces, 1, 1)?.pieceId).toBe('A');
    expect(hitTest(pieces, 1, 1)?.cellIndex).toBe(0);
    expect(hitTest(pieces, 5, 5)?.pieceId).toBe('D');
    // Cell 1 is rotated 180, so A is at its bottom right.
    expect(hitTest(pieces, 15.5 + 14, 17)?.pieceId).toBe('A');
    expect(hitTest(pieces, 15.5 + 14, 17)?.cellIndex).toBe(1);
  });

  it('returns null outside the quilt', () => {
    expect(hitTest(pieces, -1, 5)).toBeNull();
    expect(hitTest(pieces, 62.5, 5)).toBeNull();
    expect(hitTest(pieces, 5, 74.5)).toBeNull();
  });

  it('finds the cell', () => {
    const size = getSize(stacks, 'throw');
    expect(cellAt(stacks, size, 1, 1)).toBe(0);
    expect(cellAt(stacks, size, 16, 1)).toBe(1);
    expect(cellAt(stacks, size, 1, 19)).toBe(4);
    expect(cellAt(stacks, size, 62, 1)).toBeNull();
    expect(cellAt(stacks, size, -0.1, 1)).toBeNull();
  });
});

describe('piecesForSlot', () => {
  const pieces = resolvePieces(stacks, collection, design);
  const n = design.lineup.length;

  it('finds one piece of each letter, each in a different block, for a throw', () => {
    const got = piecesForSlot(stacks, pieces, n, 3);
    expect(got).toHaveLength(stacks.block.pieces.length);
    expect(new Set(got.map((p) => p.pieceId)).size).toBe(stacks.block.pieces.length);
    expect(new Set(got.map((p) => p.blockId)).size).toBe(stacks.block.pieces.length);
    for (const p of got) expect(stacks.assign(p.blockId, p.pieceIndex, n)).toBe(3);
  });

  it('leaves out hand-placed pieces unless asked', () => {
    const first = piecesForSlot(stacks, pieces, n, 3)[0]!;
    const other = collection.fabrics.find((f) => f.id !== first.fabricId)!.id;
    const d = setOverride(stacks, design, first.blockId, first.pieceId, other);
    const after = resolvePieces(stacks, collection, d);
    expect(piecesForSlot(stacks, after, n, 3).map((p) => p.key)).not.toContain(first.key);
    expect(piecesForSlot(stacks, after, n, 3, true).map((p) => p.key)).toContain(first.key);
  });

  it('returns nothing for a slot out of range', () => {
    expect(piecesForSlot(stacks, pieces, n, -1)).toEqual([]);
    expect(piecesForSlot(stacks, pieces, n, n)).toEqual([]);
  });
});
