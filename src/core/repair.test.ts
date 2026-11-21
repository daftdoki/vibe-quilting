import { describe, expect, it } from 'vitest';
import { stacks } from '../patterns/stacks';
import { createDesign, createEmptyDesign, setLineupSlot, setOverride } from './design';
import { repairDesign } from './repair';
import { makeCollection } from './test-fixtures';
import type { Design } from './types';

const collection = makeCollection();
const d: Design = createDesign(stacks, collection, 'crib');
const kinds = (r: ReturnType<typeof repairDesign>) => r?.notes.map((n) => n.kind);

describe('repairDesign', () => {
  it('keeps a valid design as it is, with no notes', () => {
    const r = repairDesign(stacks, collection, d);
    expect(r?.design).toEqual(d);
    expect(r?.notes).toEqual([]);
  });

  it('keeps empty and half-filled designs', () => {
    const empty = createEmptyDesign(stacks, 'king');
    expect(repairDesign(stacks, collection, empty)?.design).toEqual(empty);
    const half = setOverride(stacks, setLineupSlot(createEmptyDesign(stacks, 'throw'), 0, 'd0-c0'), 3, 'C', 'd4-c0');
    expect(repairDesign(stacks, collection, half)?.design).toEqual(half);
  });

  it('returns null only for an unknown size', () => {
    expect(repairDesign(stacks, collection, { ...d, sizeId: 'nope' })).toBeNull();
  });

  it('empties a lineup slot with an unknown fabric and keeps the rest', () => {
    const r = repairDesign(stacks, collection, setLineupSlot(d, 1, 'ghost'));
    expect(r?.design.lineup[1]).toBeNull();
    expect(r?.design.lineup[0]).toBe(d.lineup[0]);
    expect(r?.notes).toEqual([{ kind: 'fabric-missing', ids: ['ghost'] }]);
  });

  it('cuts a lineup that is too long and pads one that is too short', () => {
    const long = repairDesign(stacks, collection, { ...d, lineup: [...d.lineup, 'd0-c0', 'd0-c1'] });
    expect(long?.design.lineup).toEqual(d.lineup);
    expect(long?.notes).toEqual([{ kind: 'lineup-cut', count: 2 }]);
    const short = repairDesign(stacks, collection, { ...d, lineup: d.lineup.slice(0, -3) });
    expect(short?.design.lineup).toEqual([...d.lineup.slice(0, -3), null, null, null]);
    expect(short?.notes).toEqual([{ kind: 'lineup-padded', count: 3 }]);
  });

  it('drops overrides with an unknown fabric, piece or block', () => {
    const r = repairDesign(stacks, collection, {
      ...d,
      overrides: { '0:A': 'ghost', '1:B': 'd0-c0', '2:ZZ': 'd0-c0', '99:A': 'd0-c0', 'x:A': 'd0-c0', nocolon: 'd0-c0' },
    });
    expect(r?.design.overrides).toEqual({ '1:B': 'd0-c0' });
    expect(r?.notes).toContainEqual({ kind: 'override-dropped', count: 5 });
    expect(r?.notes).toContainEqual({ kind: 'fabric-missing', ids: ['ghost'] });
  });

  it('resets cells that are not a valid arrangement and keeps lineup and overrides', () => {
    const base = setOverride(stacks, d, 2, 'B', 'd3-c1');
    const bad: Design[] = [
      { ...base, cells: base.cells.slice(1) },
      { ...base, cells: base.cells.map((c) => ({ ...c, blockId: 0 })) },
      { ...base, cells: base.cells.map((c, i) => (i === 0 ? { ...c, rotation: 90 as const } : c)) },
    ];
    for (const b of bad) {
      const r = repairDesign(stacks, collection, b);
      expect(r?.design.cells).toEqual(d.cells);
      expect(r?.design.lineup).toEqual(base.lineup);
      expect(r?.design.overrides).toEqual({ '2:B': 'd3-c1' });
      expect(kinds(r)).toEqual(['blocks-reset']);
    }
  });

  it('keeps a valid block arrangement that is not the default', () => {
    const swapped = { ...d, cells: [d.cells[1]!, d.cells[0]!, ...d.cells.slice(2)] };
    expect(repairDesign(stacks, collection, swapped)?.design.cells).toEqual(swapped.cells);
  });

  it('strips unknown fields', () => {
    const r = repairDesign(stacks, collection, { ...d, extra: 1 } as Design);
    expect(Object.keys(r!.design).sort()).toEqual(['cells', 'lineup', 'overrides', 'sizeId']);
  });

  describe('aliases', () => {
    it('resolves a fabric id in the lineup and in overrides', () => {
      const c = {
        ...collection,
        fabrics: collection.fabrics.map((f) => (f.id === 'd0-c0' ? { ...f, id: 'new' } : f)),
        aliases: { 'd0-c0': 'new' },
      };
      const r = repairDesign(stacks, c, { ...d, lineup: d.lineup.map((id) => id), overrides: { '1:B': 'd0-c0' } });
      expect(r?.design.lineup[0]).toBe('new');
      expect(r?.design.overrides).toEqual({ '1:B': 'new' });
      expect(r?.notes).toEqual([]);
    });

    it('resolves a size id and a piece id', () => {
      const pattern = {
        ...stacks,
        sizes: stacks.sizes.map((s) => (s.id === 'crib' ? { ...s, id: 'baby' } : s)),
        aliases: { sizes: { crib: 'baby' }, pieces: { OLD: 'B' } },
      };
      const r = repairDesign(pattern, collection, { ...d, overrides: { '1:OLD': 'd0-c0' } });
      expect(r?.design.sizeId).toBe('baby');
      expect(r?.design.overrides).toEqual({ '1:B': 'd0-c0' });
    });

    it('ignores prototype names as ids', () => {
      const r = repairDesign(stacks, collection, setLineupSlot(d, 0, 'constructor'));
      expect(r?.design.lineup[0]).toBeNull();
    });
  });
});
