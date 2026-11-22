import { describe, expect, it } from 'vitest';
import { stacks } from '../../patterns/stacks';
import {
  BODY_H_MM,
  bbox,
  CARDS_HEAD_MM,
  cardHeight,
  cardScale,
  cardSpec,
  DRAW_EDGE_PT,
  fitFont,
  MAP_MAX_H,
  mapSpec,
  PAGE_H_MM,
  PAGE_W,
  PAGE_W_MM,
  PICTURE_CAPTION_MM,
  PICTURE_HEAD_MM,
  PICTURE_MAX_PX,
  pictureBox,
  picturePixels,
  PT_PER_MM,
  SLACK_MM,
  textWidth,
} from './geometry';

const block = stacks.block;
const SIZES = ['large', 'medium', 'compact'] as const;

describe('page box', () => {
  it('fits Letter and A4 inside a 10mm margin with a few millimetres to spare', () => {
    const letter = { w: 215.9 - 20, h: 279.4 - 20 };
    const a4 = { w: 210 - 20, h: 297 - 20 };
    for (const paper of [letter, a4]) {
      expect(paper.w - PAGE_W_MM).toBeGreaterThanOrEqual(3);
      expect(paper.h - PAGE_H_MM).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('build sheet card sizes', () => {
  it.each(SIZES)('%s: a two-digit number fits every Stacks piece at full size', (size) => {
    const spec = cardSpec(size, 1);
    const s = cardScale(block, spec);
    for (const piece of block.pieces) {
      const b = bbox(piece.polygon);
      const pt = fitFont('36', spec.numberPt, b.w * s, b.h * s, spec.padPt);
      expect(pt).toBe(spec.numberPt);
      expect(textWidth('36', pt)).toBeLessThan(b.w * s - 2 * spec.padPt);
    }
  });

  it.each(SIZES)('%s: with a two-line footnote, numbers stay at 14pt or more', (size) => {
    const spec = cardSpec(size, 2);
    const s = cardScale(block, spec);
    for (const piece of block.pieces) {
      const b = bbox(piece.polygon);
      expect(fitFont('36', spec.numberPt, b.w * s, b.h * s, spec.padPt)).toBeGreaterThanOrEqual(14);
    }
  });

  it('shrinks a number that would overflow', () => {
    expect(fitFont('88', 26, 30, 100, 3)).toBeLessThan(26);
    expect(textWidth('88', fitFont('88', 26, 30, 100, 3))).toBeLessThanOrEqual(24.01);
  });

  it.each(SIZES.flatMap((size) => [1, 2, 3].map((lines) => [size, lines] as const)))(
    '%s with %i footnote lines: the cards and the heading fit the first card page',
    (size, lines) => {
      const spec = cardSpec(size, lines);
      const s = cardScale(block, spec);
      const cardW = block.width * s + 2 * DRAW_EDGE_PT;
      const colGap = spec.colGapMm * PT_PER_MM;
      expect(spec.cols * cardW + (spec.cols - 1) * colGap).toBeLessThan(PAGE_W);
      const used =
        CARDS_HEAD_MM * PT_PER_MM + spec.rows * cardHeight(spec, block) + (spec.rows - 1) * spec.rowGapMm * PT_PER_MM;
      expect(used).toBeLessThanOrEqual((BODY_H_MM - SLACK_MM) * PT_PER_MM + 0.01);
      // And the grid uses the page: less than 2mm left over beyond the slack.
      expect((BODY_H_MM - SLACK_MM) * PT_PER_MM - used).toBeLessThan(2 * PT_PER_MM);
    },
  );
});

describe('build sheet layout map', () => {
  const grids: [number, number][] = [];
  for (let cols = 3; cols <= 6; cols++) for (let rows = 1; rows <= 6; rows++) grids.push([cols, rows]);

  it.each(grids)('%i by %i fits the map space with numbers of 14pt or more', (cols, rows) => {
    const m = mapSpec(block, cols, rows);
    expect(m.labelW + cols * m.cellW + (cols - 1) * m.gap + 2 * DRAW_EDGE_PT).toBeLessThanOrEqual(PAGE_W + 0.01);
    expect(rows * m.cellH + (rows - 1) * m.gap).toBeLessThanOrEqual(MAP_MAX_H + 0.01);
    expect(m.numberPt).toBeGreaterThanOrEqual(14);
  });

  it('6 by 6 block numbers stay well above 14pt', () => {
    expect(mapSpec(block, 6, 6).numberPt).toBeGreaterThanOrEqual(18);
  });
});

describe('quilt picture page', () => {
  it.each(stacks.sizes.map((s) => [s.id, s.cols * block.width, s.rows * block.height] as const))(
    '%s fits under the heading and above the caption, in proportion',
    (_id, w, h) => {
      const box = pictureBox(w, h);
      expect(box.wMm).toBeLessThanOrEqual(PAGE_W_MM);
      expect(PICTURE_HEAD_MM + box.hMm + PICTURE_CAPTION_MM).toBeLessThanOrEqual(BODY_H_MM - SLACK_MM);
      expect(box.wMm / box.hMm).toBeCloseTo(w / h, 2);
      const px = picturePixels(box.wMm, box.hMm);
      expect(Math.max(px.w, px.h)).toBeLessThanOrEqual(PICTURE_MAX_PX);
      // About 150 pixels per inch of paper.
      expect(px.w / (box.wMm / 25.4)).toBeGreaterThan(140);
    },
  );
});
