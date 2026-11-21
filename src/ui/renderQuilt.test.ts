import { describe, expect, it } from 'vitest';
import { createDesign, createEmptyDesign, rotateCell } from '../core/design';
import { resolvePieces } from '../core/layout';
import { makeCollection } from '../core/test-fixtures';
import type { ResolvedPiece } from '../core/types';
import { stacks } from '../patterns/stacks';
import { applyAffine, buildScene, pieceAffine } from './renderQuilt';

const collection = makeCollection();

function bounds(p: ResolvedPiece) {
  const xs = p.polygon.map((q) => q[0]);
  const ys = p.polygon.map((q) => q[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

describe('pieceAffine', () => {
  const design = createDesign(stacks, collection, 'throw');
  const cols = 4;

  it('puts cropOrigin on the top left of an unrotated piece', () => {
    const pieces = resolvePieces(stacks, collection, design).filter((p) => p.rotation === 0);
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      const [x, y] = applyAffine(pieceAffine(stacks, cols, p), p.cropOrigin);
      const b = bounds(p);
      expect(x).toBeCloseTo(b.minX, 9);
      expect(y).toBeCloseTo(b.minY, 9);
    }
  });

  it('puts cropOrigin on the bottom right of a piece in a block turned 180', () => {
    const pieces = resolvePieces(stacks, collection, design).filter((p) => p.rotation === 180);
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      const [x, y] = applyAffine(pieceAffine(stacks, cols, p), p.cropOrigin);
      const b = bounds(p);
      expect(x).toBeCloseTo(b.maxX, 9);
      expect(y).toBeCloseTo(b.maxY, 9);
    }
  });

  it('keeps one swatch inch equal to one quilt inch', () => {
    const turned = rotateCell(stacks, design, 0);
    for (const p of resolvePieces(stacks, collection, turned).slice(0, 18)) {
      const m = pieceAffine(stacks, cols, p);
      expect(Math.hypot(m.a, m.b)).toBeCloseTo(1, 12);
      expect(Math.hypot(m.c, m.d)).toBeCloseTo(1, 12);
      expect(m.a * m.c + m.b * m.d).toBeCloseTo(0, 12);
    }
  });

  it('covers every piece of the quilt in the scene', () => {
    const pieces = resolvePieces(stacks, collection, design);
    const scene = buildScene(stacks, collection, design, pieces);
    expect(scene.items).toHaveLength(16 * 9);
    expect(scene.width).toBe(62);
    expect(scene.height).toBe(74);
  });
});

describe('buildScene with empty pieces', () => {
  it('keeps empty pieces so they draw and can be tapped', () => {
    const design = createEmptyDesign(stacks, 'crib');
    const scene = buildScene(stacks, collection, design, resolvePieces(stacks, collection, design));
    expect(scene.items).toHaveLength(9 * stacks.block.pieces.length);
    expect(scene.items.every((i) => i.fabric === null)).toBe(true);
    expect(scene.items.map((i) => i.label).slice(0, stacks.block.pieces.length)).toEqual(
      stacks.block.pieces.map((p) => p.label),
    );
  });
});
