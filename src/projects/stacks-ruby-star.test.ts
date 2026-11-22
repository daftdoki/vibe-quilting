import { describe, expect, it } from 'vitest';
import { createDesign, fabricFor } from '../core/design';
import { resolvePieces } from '../core/layout';
import { stacksRubyStar } from './stacks-ruby-star';

const { pattern, collection } = stacksRubyStar;

describe('Stacks with Ruby Star', () => {
  it('has 111 fabrics', () => {
    expect(collection.fabrics).toHaveLength(111);
  });

  it('never repeats a fabric inside a block in the default design, crib through king', () => {
    for (const size of pattern.sizes) {
      if (size.id === 'runner') continue;
      const design = createDesign(pattern, collection, size.id);
      for (const cell of design.cells) {
        const ids = pattern.block.pieces.map((_, p) => fabricFor(pattern, design, cell.blockId, p).fabricId);
        expect(new Set(ids).size, `${size.id} block ${cell.blockId}`).toBe(ids.length);
      }
    }
  });

  it('fits every piece inside its swatch, so nothing tiles', () => {
    const design = createDesign(pattern, collection, 'king');
    for (const piece of resolvePieces(pattern, collection, design)) {
      const fabric = collection.fabrics.find((f) => f.id === piece.fabricId)!;
      const xs = piece.polygon.map((p) => p[0]);
      const ys = piece.polygon.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      expect(piece.cropOrigin[0] + w).toBeLessThanOrEqual(fabric.widthPx / fabric.pxPerInch + 1e-9);
      expect(piece.cropOrigin[1] + h).toBeLessThanOrEqual(fabric.heightPx / fabric.pxPerInch + 1e-9);
    }
  });
});
