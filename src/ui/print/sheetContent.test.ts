import { describe, expect, it } from 'vitest';
import { buildSheetData } from '../../core/buildSheet';
import { createDesign } from '../../core/design';
import { makeCollection } from '../../core/test-fixtures';
import type { ProjectDef } from '../../core/types';
import { stacks } from '../../patterns/stacks';
import { composePages, sheetContent, type SheetLayout, type SheetPage } from './BuildSheet';

const collection = makeCollection();
const project: ProjectDef = { id: 'test', title: 'Stacks', pattern: stacks, collection };
const thumbs = new Map(collection.fabrics.map((f) => [f.id, f.thumb]));

describe('build sheet blocks', () => {
  it.each(stacks.sizes.map((s) => s.id))('%s: the Stacking order section is a single block after the Fabrics section', (sizeId) => {
    const design = createDesign(stacks, collection, sizeId);
    const sheet = buildSheetData(stacks, collection, design);
    for (const pictures of [true, false]) {
      const content = sheetContent({ project, sheet, printed: '1 May 2026', quiltName: '', pictures, thumbs });
      const stacking = content.first.filter((b) => b.kind === 'stacking');
      expect(stacking).toHaveLength(1);
      expect(content.first.indexOf(stacking[0]!)).toBe(content.fabricsCount);
      expect(content.first.length).toBe(content.fabricsCount + 1);
    }
  });
});

describe('build sheet page order', () => {
  const design = createDesign(stacks, collection, 'queen');
  const sheet = buildSheetData(stacks, collection, design);
  const content = sheetContent({ project, sheet, printed: '1 May 2026', quiltName: '', pictures: true, thumbs });
  const n = content.fabricsCount;
  const placed = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, i) => ({ item: from + i, first: i === 0, repeatsHeader: false }));
  // Fabrics on two pages, stacking on one, map and changes on one.
  const layout: SheetLayout = {
    fabrics: [placed(0, n - 3), placed(n - 3, n)],
    stacking: [placed(n, n + 1)],
    together: [placed(0, n - 3), placed(n - 3, n + 1)],
    map: [placed(0, content.map.length)],
    footLines: 1,
    stackSmall: false,
    mapMaxH: 400,
  };
  const kinds = (pages: SheetPage[]) =>
    pages.map((p) => (p.kind === 'flow' ? `${p.section}:${p.placed.map((x) => x.item).join(',')}` : p.kind));

  it('with the quilt picture: Fabrics, the picture alone, Stacking order on a new page, cards, map', () => {
    const pages = composePages(content, sheet, 'medium', layout, true);
    const k = kinds(pages);
    expect(k[0]).toMatch(/^first:0,/);
    expect(k[1]).toBe(`first:${[n - 3, n - 2, n - 1].join(',')}`);
    expect(k[2]).toBe('picture');
    expect(k[3]).toBe(`first:${n}`);
    expect(k.slice(4, 9)).toEqual(['cards', 'cards', 'cards', 'cards', 'cards']);
    expect(k[9]).toMatch(/^map:0,/);
    expect(k).toHaveLength(10);
  });

  it('without it: Stacking order follows the Fabrics section, and there is no picture page', () => {
    const k = kinds(composePages(content, sheet, 'medium', layout, false));
    expect(k).not.toContain('picture');
    expect(k[1]).toBe(`first:${[n - 3, n - 2, n - 1, n].join(',')}`);
    expect(k.slice(2, 7)).toEqual(['cards', 'cards', 'cards', 'cards', 'cards']);
  });
});
