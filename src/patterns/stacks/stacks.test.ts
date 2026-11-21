import { describe, expect, it } from 'vitest';
import { stacks } from './index';

function bbox(poly: readonly (readonly [number, number])[]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe('stacks pieces', () => {
  const boxes = stacks.block.pieces.map((p) => bbox(p.polygon));

  it('has nine pieces A..I', () => {
    expect(stacks.block.pieces.map((p) => p.id).join('')).toBe('ABCDEFGHI');
  });

  it('areas sum to the block area', () => {
    const total = boxes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    expect(total).toBeCloseTo(15.5 * 18.5, 9);
  });

  it('has no overlaps', () => {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        expect(w > 1e-9 && h > 1e-9).toBe(false);
      }
    }
  });

  it('alternates default rotation', () => {
    expect(stacks.defaultRotation(0, 0)).toBe(0);
    expect(stacks.defaultRotation(1, 0)).toBe(180);
    expect(stacks.defaultRotation(1, 1)).toBe(0);
  });
});
