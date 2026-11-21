import { describe, expect, it } from 'vitest';
import { stacks } from '../../patterns/stacks';
import { bbox, CARD_SPECS, cardScale, fitFont, mapSpec, PAGE_H, PAGE_W, textWidth } from './geometry';

const block = stacks.block;

describe('build sheet card sizes', () => {
  it.each(['large', 'compact'] as const)('%s: a two-digit number fits every Stacks piece at full size', (size) => {
    const spec = CARD_SPECS[size];
    const s = cardScale(block, spec);
    for (const piece of block.pieces) {
      const b = bbox(piece.polygon);
      const pt = fitFont('36', spec.numberPt, b.w * s, b.h * s, spec.padPt);
      expect(pt).toBe(spec.numberPt);
      expect(textWidth('36', pt)).toBeLessThan(b.w * s - 2 * spec.padPt);
    }
  });

  it('shrinks a number that would overflow', () => {
    expect(fitFont('88', 26, 30, 100, 3)).toBeLessThan(26);
    expect(textWidth('88', fitFont('88', 26, 30, 100, 3))).toBeLessThanOrEqual(24.01);
  });

  it.each(['large', 'compact'] as const)('%s: the cards fit one page', (size) => {
    const spec = CARD_SPECS[size];
    const drawW = spec.drawH * (block.width / block.height);
    // Measured from buildSheet.css: card heading, footnote, padding and border
    // take about 58pt (large) or 54pt (compact). The running line and the
    // section heading on the first card page take about 86pt.
    const chrome = size === 'large' ? 60 : 56;
    const heading = 90;
    const gap = size === 'large' ? 14 : 8;
    expect(spec.cols * drawW).toBeLessThan(PAGE_W);
    expect(heading + spec.rows * (spec.drawH + chrome) + (spec.rows - 1) * gap).toBeLessThan(PAGE_H - (size === 'large' ? 10 : 30));
  });
});

describe('build sheet layout map', () => {
  it.each(stacks.sizes.map((s) => [s.id, s.cols, s.rows] as const))('%s fits one page width', (_id, cols, rows) => {
    const m = mapSpec(block, cols, rows);
    expect(m.labelW + cols * m.cellW + (cols - 1) * m.gap).toBeLessThanOrEqual(PAGE_W + 0.01);
    expect(rows * m.cellH + (rows - 1) * m.gap).toBeLessThan(PAGE_H - 125);
    expect(m.numberPt).toBeGreaterThanOrEqual(14);
  });

  it('6 by 6 block numbers stay well above 14pt', () => {
    expect(mapSpec(block, 6, 6).numberPt).toBeGreaterThanOrEqual(18);
  });
});
