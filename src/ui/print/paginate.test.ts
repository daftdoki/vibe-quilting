import { describe, expect, it } from 'vitest';
import { stacks } from '../../patterns/stacks';
import { cardSpec, FILL_H_MM, stackColumns, type CardSize } from './geometry';
import { packPages, pageUsed, type PackedPage, type PackItem } from './paginate';

const H = 100;

function order(pages: PackedPage[]): number[] {
  return pages.flat().map((p) => p.item);
}

function expectFits(items: PackItem[], pages: PackedPage[], height = H) {
  for (const page of pages) expect(pageUsed(items, page)).toBeLessThanOrEqual(height);
}

describe('packPages', () => {
  it('fills pages in order and never goes over the page height', () => {
    const items: PackItem[] = Array.from({ length: 12 }, (_, i) => ({ height: 15 + (i % 3) * 5, gapBefore: 2 }));
    const pages = packPages(items, H);
    expectFits(items, pages);
    expect(order(pages)).toEqual(items.map((_, i) => i));
    expect(pages.length).toBeGreaterThan(1);
  });

  it('drops the gap above the first block of a page', () => {
    const items: PackItem[] = [{ height: 60 }, { height: 45, gapBefore: 10 }];
    const pages = packPages(items, H);
    expect(pages).toHaveLength(2);
    expect(pages[1]![0]).toMatchObject({ item: 1, first: true });
    expect(pageUsed(items, pages[1]!)).toBe(45);
  });

  it('keeps a heading with what follows it', () => {
    const items: PackItem[] = [{ height: 70 }, { height: 10, keepWithNext: true }, { height: 25 }];
    const pages = packPages(items, H);
    expect(pages.map((p) => p.map((x) => x.item))).toEqual([[0], [1, 2]]);
  });

  it('never ends a page with a heading', () => {
    const items: PackItem[] = [];
    for (let s = 0; s < 6; s++) {
      items.push({ height: 12, gapBefore: 6, keepWithNext: true });
      for (let r = 0; r < 4 + s; r++) items.push({ height: 9 });
    }
    const pages = packPages(items, H);
    expectFits(items, pages);
    for (const page of pages) expect(items[page[page.length - 1]!.item]!.keepWithNext).toBeFalsy();
    expect(order(pages)).toEqual(items.map((_, i) => i));
  });

  it('repeats a table header row on the page that continues the table', () => {
    const items: PackItem[] = [
      { height: 10, keepWithNext: true },
      { height: 8, keepWithNext: true, group: 't' },
      ...Array.from({ length: 15 }, (): PackItem => ({ height: 10, group: 't', header: 8 })),
    ];
    const pages = packPages(items, H);
    expectFits(items, pages);
    expect(pages.length).toBe(2);
    // Page 1: heading, header row, 8 rows. Page 2: the other 7 rows under a repeated header.
    expect(pages[0]!.map((p) => p.item)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(pages[0]!.some((p) => p.repeatsHeader)).toBe(false);
    expect(pages[1]![0]).toMatchObject({ item: 10, repeatsHeader: true });
    expect(pages[1]!.filter((p) => p.repeatsHeader)).toHaveLength(1);
    expect(pageUsed(items, pages[1]!)).toBe(8 + 70);
  });

  it('does not leave the last table row alone on a page', () => {
    const items: PackItem[] = [
      { height: 10, keepWithNext: true },
      { height: 8, keepWithNext: true, group: 't' },
      ...Array.from({ length: 9 }, (): PackItem => ({ height: 9, group: 't', header: 8 })),
    ];
    // Without balancing, 9 rows fill page 1 (10 + 8 + 81 = 99) and nothing is left over. With 10 rows one would be.
    items.push({ height: 9, group: 't', header: 8 });
    const pages = packPages(items, H);
    expectFits(items, pages);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.length).toBeGreaterThanOrEqual(2);
    expect(pages[1]![0]!.repeatsHeader).toBe(true);
    expect(pageUsed(items, pages[1]!)).toBeGreaterThanOrEqual(H / 6);
  });

  it('pulls a short closing line back onto a page of its own rather than leaving it alone', () => {
    const items: PackItem[] = [{ height: 30 }, { height: 30, gapBefore: 3 }, { height: 32, gapBefore: 3 }, { height: 6, gapBefore: 3 }];
    const pages = packPages(items, H);
    expectFits(items, pages);
    expect(pages.map((p) => p.map((x) => x.item))).toEqual([[0, 1], [2, 3]]);
  });

  it('gives an oversized block a page of its own and carries on', () => {
    const items: PackItem[] = [{ height: 30 }, { height: 250 }, { height: 30 }, { height: 30 }];
    const pages = packPages(items, H);
    expect(pages.map((p) => p.map((x) => x.item))).toEqual([[0], [1], [2, 3]]);
  });

  it('lays out a chain taller than a page one block at a time', () => {
    const items: PackItem[] = [
      { height: 60, keepWithNext: true },
      { height: 60, keepWithNext: true },
      { height: 20 },
    ];
    const pages = packPages(items, H);
    expectFits(items, pages);
    expect(order(pages)).toEqual([0, 1, 2]);
  });

  it('handles no items', () => {
    expect(packPages([], H)).toEqual([]);
  });

  it('leaves no page less than a third full unless it is the last page of its section', () => {
    // A long section of mixed blocks, in mm: headings, table rows, boxes and notes.
    const items: PackItem[] = [];
    for (let s = 0; s < 5; s++) {
      items.push({ height: 10.6, gapBefore: 7, keepWithNext: true });
      items.push({ height: 8.3, keepWithNext: true, group: `t${s}` });
      for (let r = 0; r < 9 + 7 * s; r++) items.push({ height: r % 5 === 0 ? 13.4 : 7.45, group: `t${s}`, header: 8.3 });
      items.push({ height: 28, gapBefore: 4 });
      items.push({ height: 5.7, gapBefore: 3 });
    }
    const pages = packPages(items, FILL_H_MM);
    expectFits(items, pages, FILL_H_MM);
    pages.slice(0, -1).forEach((p) => expect(pageUsed(items, p)).toBeGreaterThanOrEqual(FILL_H_MM / 3));
    expect(order(pages)).toEqual(items.map((_, i) => i));
  });
});

/*
 * Page totals from stand-in heights, in mm. The Fabrics figures were measured
 * in a browser and checked against printed PDFs on Letter and A4: header 23
 * (title, then the facts running on over two lines), note 10 after a 3mm
 * gap, "Fabrics" 10.6 after 5mm, header row 6.9, rows 6.6 (a 5.5mm swatch
 * with 0.3mm padding). The Stacking order section is one block: heading 10.6,
 * three steps over five lines 30.6, the cut line 7.7, the key line a
 * three-column list adds 13.4, the list heading 11.2, then rows of 12.4mm
 * with 11mm swatches, or without pictures 11.5mm (three columns, names on
 * two lines) or 6.5mm (two columns, one line).
 */
function fabricsItems(fabrics: number): PackItem[] {
  return [
    { height: 23 },
    { height: 10, gapBefore: 3 },
    { height: 10.6, gapBefore: 5, keepWithNext: true },
    { height: 6.9, keepWithNext: true, group: 'f' },
    ...Array.from({ length: fabrics }, (): PackItem => ({ height: 6.6, group: 'f', header: 6.9 })),
  ];
}

function stackingHeight(entries: number, pictures: boolean): number {
  const cols = stackColumns(entries);
  const rows = Math.ceil(entries / cols);
  const head = cols === 3 ? 73.5 : 60.1;
  const row = pictures ? 12.4 : cols === 3 ? 11.5 : 6.5;
  return head + rows * row;
}

function totalPages(blocks: number, fabrics: number, size: CardSize, pictures: boolean, changes: number): number {
  const fab = fabricsItems(fabrics);
  const stacking: PackItem = { height: stackingHeight(blocks, pictures), gapBefore: 7 };
  const head = pictures
    ? packPages(fab, FILL_H_MM).length + 1 + packPages([stacking], FILL_H_MM).length
    : packPages([...fab, stacking], FILL_H_MM).length;
  const spec = cardSpec(size);
  const cards = Math.ceil(blocks / (spec.cols * spec.rows));
  // The map shrinks to make room for a changes table of a few rows, so they share one page.
  const map = changes > 12 ? 2 : 1;
  return head + cards + map;
}

describe('build sheet page totals from stand-in heights', () => {
  it('the Stacking order section fits one page for every size, as one block', () => {
    for (const s of stacks.sizes) {
      const n = s.cols * s.rows;
      expect(stackingHeight(n, true)).toBeLessThanOrEqual(FILL_H_MM);
      expect(stackingHeight(n, false)).toBeLessThanOrEqual(FILL_H_MM);
    }
    const king: PackItem[] = [{ height: stackingHeight(36, true) }];
    expect(packPages(king, FILL_H_MM)).toHaveLength(1);
  });

  it('a 20-fabric table fits the first page with the header and note', () => {
    expect(packPages(fabricsItems(20), FILL_H_MM)).toHaveLength(1);
  });

  it.each([
    // blocks, fabrics, card size, pictures on, changes, pages
    [30, 20, 'medium', true, 3, 9],
    [30, 20, 'compact', true, 3, 8],
    [30, 20, 'large', true, 3, 12],
    [16, 16, 'medium', true, 0, 7],
    [16, 16, 'compact', true, 0, 6],
    [36, 20, 'medium', true, 0, 10],
    [30, 20, 'medium', false, 3, 8],
    [16, 16, 'medium', false, 0, 6],
  ] as const)('%i blocks, %i fabrics, %s cards, pictures %s, %i changes: %i pages', (blocks, fabrics, size, pictures, changes, pages) => {
    expect(totalPages(blocks, fabrics, size, pictures, changes)).toBe(pages);
  });

  it('meets the targets: queen 10 or fewer, throw 7 or fewer, king 11 or fewer, compact queen about 8', () => {
    expect(totalPages(30, 20, 'medium', true, 3)).toBeLessThanOrEqual(10);
    expect(totalPages(16, 16, 'medium', true, 0)).toBeLessThanOrEqual(7);
    expect(totalPages(36, 20, 'medium', true, 0)).toBeLessThanOrEqual(11);
    expect(totalPages(30, 20, 'compact', true, 3)).toBeLessThanOrEqual(8);
  });
});

describe('rounding', () => {
  it('keeps a chain together when it fills the page to within rounding', () => {
    const items: PackItem[] = [
      { height: 10.6, keepWithNext: true },
      { height: 200.4 + 1e-9, keepWithNext: true },
      { height: 25 },
    ];
    const pages = packPages(items, 236);
    expect(pages).toHaveLength(1);
  });
});
