import { describe, expect, it } from 'vitest';
import { stacks } from '../patterns/stacks';
import {
  clearAllOverrides,
  clearOverride,
  createDesign,
  createEmptyDesign,
  defaultLineup,
  fillEmptySlots,
  randomLineup,
  removeFabric,
  usableCollection,
  visibleFabrics,
  fabricFor,
  fabricUsage,
  repeatedFabricBlocks,
  getSize,
  resetBlocks,
  rotateCell,
  setAllRotations,
  setLineupSlot,
  setOverride,
  shuffleLineup,
  swapCells,
} from './design';
import { quiltSizeInches, resolvePieces } from './layout';
import { makeCollection } from './test-fixtures';
import type { Design } from './types';

const collection = makeCollection();

/** Fabric ids per block for a design, ignoring overrides. */
function blocks(design: Design): (string | null)[][] {
  const n = design.lineup.length;
  return design.cells.map((c) =>
    stacks.block.pieces.map((_, p) => design.lineup[stacks.assign(c.blockId, p, n)]!),
  );
}

describe('quilt sizes', () => {
  it('computes inches', () => {
    expect(quiltSizeInches(stacks, getSize(stacks, 'throw'))).toEqual({ width: 62, height: 74 });
    expect(quiltSizeInches(stacks, getSize(stacks, 'king'))).toEqual({ width: 93, height: 111 });
    expect(quiltSizeInches(stacks, getSize(stacks, 'runner'))).toEqual({ width: 46.5, height: 18.5 });
  });
});

describe('shuffle', () => {
  it('crib with 9 fabrics uses each once per block and once per position', () => {
    const d = createDesign(stacks, collection, 'crib');
    expect(new Set(d.lineup).size).toBe(9);
    const b = blocks(d);
    for (const row of b) expect(new Set(row).size).toBe(9);
    for (let p = 0; p < 9; p++) expect(new Set(b.map((row) => row[p])).size).toBe(9);
  });
});

describe('default lineup', () => {
  it.each(['crib', 'throw', 'twin', 'full', 'queen', 'king'])('%s has no repeats in a block', (id) => {
    const d = createDesign(stacks, collection, id);
    for (const row of blocks(d)) expect(new Set(row).size).toBe(9);
  });

  it('mixes designs between neighbors', () => {
    const d = createDesign(stacks, collection, 'throw');
    const design = new Map(collection.fabrics.map((f) => [f.id, f.design]));
    for (let i = 1; i < d.lineup.length; i++) {
      expect(design.get(d.lineup[i]!)).not.toBe(design.get(d.lineup[i - 1]!));
    }
  });

  it('is deterministic and uses all fabrics when n exceeds the count', () => {
    const size = getSize(stacks, 'king');
    const a = defaultLineup(stacks, collection, size);
    expect(a).toEqual(defaultLineup(stacks, collection, size));
    expect(a).toHaveLength(36);
    expect(new Set(a).size).toBe(20);
  });

  it('runner has 3 fabrics', () => {
    expect(createDesign(stacks, collection, 'runner').lineup).toHaveLength(3);
  });
});

describe('shuffleLineup', () => {
  it('is deterministic per seed and keeps the multiset', () => {
    const d = createDesign(stacks, collection, 'king');
    const a = shuffleLineup(d, 7);
    expect(a).toEqual(shuffleLineup(d, 7));
    expect(a).not.toEqual(shuffleLineup(d, 8));
    expect([...a.lineup].sort()).toEqual([...d.lineup].sort());
  });

  it('repairs repeats within a block for a throw', () => {
    const d = shuffleLineup(createDesign(stacks, collection, 'queen'), 3);
    for (const row of blocks(d)) expect(new Set(row).size).toBe(9);
  });

  it('does not mutate its input', () => {
    const d = createDesign(stacks, collection, 'throw');
    const copy = structuredClone(d);
    shuffleLineup(d, 1);
    expect(d).toEqual(copy);
  });
});

describe('overrides', () => {
  const base = createDesign(stacks, collection, 'throw');
  const other = collection.fabrics.find((f) => f.id !== fabricFor(stacks, base, 0, 0).fabricId)!.id;

  it('sets, reports, and clears', () => {
    const d = setOverride(stacks, base, 0, 'A', other);
    expect(d.overrides).toEqual({ '0:A': other });
    expect(fabricFor(stacks, d, 0, 0)).toEqual({ fabricId: other, overridden: true });
    expect(clearOverride(d, 0, 'A').overrides).toEqual({});
    expect(clearAllOverrides(d).overrides).toEqual({});
    expect(base.overrides).toEqual({});
  });

  it('removes a redundant override', () => {
    const d = setOverride(stacks, base, 0, 'A', other);
    const shuffled = fabricFor(stacks, base, 0, 0).fabricId!;
    expect(setOverride(stacks, d, 0, 'A', shuffled).overrides).toEqual({});
  });

  it('follows the block through swapCells', () => {
    const d = swapCells(setOverride(stacks, base, 0, 'A', other), 0, 5);
    expect(d.cells[5]!.blockId).toBe(0);
    expect(fabricFor(stacks, d, d.cells[5]!.blockId, 0).overridden).toBe(true);
  });
});

describe('cells', () => {
  const base = createDesign(stacks, collection, 'throw');

  it('rotates through allowed rotations', () => {
    const d = rotateCell(stacks, base, 0);
    expect(d.cells[0]!.rotation).toBe(180);
    expect(rotateCell(stacks, d, 0).cells[0]!.rotation).toBe(0);
    expect(base.cells[0]!.rotation).toBe(0);
  });

  it('resets blocks', () => {
    const d = resetBlocks(stacks, rotateCell(stacks, swapCells(base, 0, 3), 2));
    expect(d.cells).toEqual(base.cells);
  });

  it('counts usage', () => {
    const usage = fabricUsage(stacks, base);
    expect([...usage.values()].reduce((a, b) => a + b, 0)).toBe(16 * 9);
  });
});

describe('empty designs', () => {
  it('starts with every slot empty, default cells, and no overrides', () => {
    const d = createEmptyDesign(stacks, 'throw');
    expect(d.lineup).toHaveLength(16);
    expect(d.lineup.every((id) => id === null)).toBe(true);
    expect(d.cells).toEqual(createDesign(stacks, collection, 'throw').cells);
    expect(d.overrides).toEqual({});
  });

  it('resolves every piece with no fabric and a zero crop', () => {
    const d = createEmptyDesign(stacks, 'throw');
    const pieces = resolvePieces(stacks, collection, d);
    expect(pieces).toHaveLength(16 * stacks.block.pieces.length);
    for (const p of pieces) {
      expect(p.fabricId).toBeNull();
      expect(p.overridden).toBe(false);
      expect(p.cropOrigin).toEqual([0, 0]);
    }
  });

  it('shows an override on an empty slot', () => {
    const id = collection.fabrics[0]!.id;
    const d = setOverride(stacks, createEmptyDesign(stacks, 'throw'), 2, 'B', id);
    expect(fabricFor(stacks, d, 2, 1)).toEqual({ fabricId: id, overridden: true });
    expect(fabricFor(stacks, d, 2, 0)).toEqual({ fabricId: null, overridden: false });
    const piece = resolvePieces(stacks, collection, d).find((p) => p.key === '2:B')!;
    expect(piece.fabricId).toBe(id);
    expect(piece.cropOrigin).not.toEqual([0, 0]);
  });

  it('counts usage without empty pieces', () => {
    const id = collection.fabrics[0]!.id;
    const d = setLineupSlot(createEmptyDesign(stacks, 'throw'), 0, id);
    const usage = fabricUsage(stacks, d);
    expect([...usage.keys()]).toEqual([id]);
    expect(usage.get(id)).toBe(stacks.block.pieces.length);
  });

  it('clears a slot with null', () => {
    const d = setLineupSlot(createDesign(stacks, collection, 'crib'), 4, null);
    expect(d.lineup[4]).toBeNull();
  });
});

describe('fillEmptySlots', () => {
  const sizes = ['crib', 'throw', 'twin', 'full', 'queen', 'king'];

  it('keeps filled slots and fills the rest', () => {
    let d = createEmptyDesign(stacks, 'queen');
    d = setLineupSlot(d, 0, 'd3-c1');
    d = setLineupSlot(d, 7, 'd3-c1');
    d = setLineupSlot(d, 20, 'd6-c0');
    const f = fillEmptySlots(stacks, collection, d);
    expect(f.lineup[0]).toBe('d3-c1');
    expect(f.lineup[7]).toBe('d3-c1');
    expect(f.lineup[20]).toBe('d6-c0');
    expect(f.lineup.every((id) => id !== null)).toBe(true);
    expect(d.lineup.filter((id) => id !== null)).toHaveLength(3);
  });

  it('is deterministic and leaves a full lineup alone', () => {
    const d = setLineupSlot(createEmptyDesign(stacks, 'twin'), 3, 'd0-c0');
    expect(fillEmptySlots(stacks, collection, d)).toEqual(fillEmptySlots(stacks, collection, d));
    const full = createDesign(stacks, collection, 'twin');
    expect(fillEmptySlots(stacks, collection, full)).toBe(full);
  });

  it('matches the default lineup when starting from empty', () => {
    for (const id of sizes) {
      const filled = fillEmptySlots(stacks, collection, createEmptyDesign(stacks, id));
      expect(filled.lineup, id).toEqual(defaultLineup(stacks, collection, getSize(stacks, id)));
    }
  });

  it.each(sizes)('%s from empty has no repeated fabric in a block', (id) => {
    const d = fillEmptySlots(stacks, collection, createEmptyDesign(stacks, id));
    for (const row of blocks(d)) expect(new Set(row).size).toBe(stacks.block.pieces.length);
  });

  it('keeps repeats apart around filled slots', () => {
    let d = createEmptyDesign(stacks, 'king');
    d = setLineupSlot(d, 5, 'd0-c0');
    d = setLineupSlot(d, 30, 'd1-c1');
    const f = fillEmptySlots(stacks, collection, d);
    for (const row of blocks(f)) expect(new Set(row).size).toBe(stacks.block.pieces.length);
  });

  it('mixes designs between neighbors after a partial fill', () => {
    const d = setLineupSlot(createEmptyDesign(stacks, 'throw'), 1, 'd0-c1');
    const f = fillEmptySlots(stacks, collection, d);
    const design = new Map(collection.fabrics.map((x) => [x.id, x.design]));
    for (let i = 0; i < f.lineup.length; i++) {
      const next = f.lineup[(i + 1) % f.lineup.length]!;
      expect(design.get(f.lineup[i]!), `slot ${i}`).not.toBe(design.get(next));
    }
  });
});

describe('shuffleLineup with empty slots', () => {
  it('keeps empty slots in place and moves only filled values', () => {
    let d = createEmptyDesign(stacks, 'throw');
    ['d0-c0', 'd1-c0', 'd2-c0', 'd3-c0', 'd4-c0'].forEach((id, i) => {
      d = setLineupSlot(d, i * 3, id);
    });
    const s = shuffleLineup(d, 11);
    expect(s).toEqual(shuffleLineup(d, 11));
    s.lineup.forEach((id, i) => expect(id === null, `slot ${i}`).toBe(d.lineup[i] === null));
    expect(s.lineup.filter((x) => x !== null).sort()).toEqual(d.lineup.filter((x) => x !== null).sort());
  });

  it('does nothing to a fully empty lineup', () => {
    const d = createEmptyDesign(stacks, 'crib');
    expect(shuffleLineup(d, 4).lineup).toEqual(d.lineup);
  });
});

describe('setAllRotations', () => {
  const base = createDesign(stacks, collection, 'throw');

  it('sets the pattern rotations or none', () => {
    const none = setAllRotations(stacks, base, 'none');
    expect(none.cells.every((c) => c.rotation === 0)).toBe(true);
    const back = setAllRotations(stacks, none, 'pattern');
    expect(back.cells).toEqual(base.cells);
  });

  it('keeps each block in its cell', () => {
    const moved = swapCells(base, 0, 3);
    const none = setAllRotations(stacks, moved, 'none');
    expect(none.cells.map((c) => c.blockId)).toEqual(moved.cells.map((c) => c.blockId));
    expect(setAllRotations(stacks, none, 'pattern').cells[1]!.rotation).toBe(180);
  });

  it('leaves default rotations when the pattern does not allow 0', () => {
    const turned = { ...stacks, rotations: [180] as const, defaultRotation: () => 180 as const };
    const d = setAllRotations(turned, base, 'none');
    expect(d.cells.every((c) => c.rotation === 180)).toBe(true);
  });
});

describe('repeatedFabricBlocks', () => {
  it('is 0 for the default lineup, crib through king', () => {
    for (const size of stacks.sizes) {
      if (size.id === 'runner') continue;
      const d = createDesign(stacks, collection, size.id);
      expect(repeatedFabricBlocks(stacks, d.lineup, d.cells.length), size.id).toBe(0);
    }
  });

  it('counts blocks that get one fabric twice', () => {
    const d = createDesign(stacks, collection, 'crib');
    const lineup = [...d.lineup];
    lineup[1] = lineup[0]!;
    // Nine slots feed nine pieces in every crib block, so every block now repeats.
    expect(repeatedFabricBlocks(stacks, lineup, d.cells.length)).toBe(9);
  });

  it('ignores empty slots', () => {
    const d = createEmptyDesign(stacks, 'throw');
    expect(repeatedFabricBlocks(stacks, d.lineup, d.cells.length)).toBe(0);
  });

  it('is null when the stack is shorter than a block', () => {
    const d = createDesign(stacks, collection, 'runner');
    expect(repeatedFabricBlocks(stacks, d.lineup, d.cells.length)).toBeNull();
  });
});

describe('randomLineup', () => {
  const crib = () => createEmptyDesign(stacks, 'crib');

  it('is the same for the same seed and differs between seeds', () => {
    expect(randomLineup(stacks, collection, crib(), 7)).toEqual(randomLineup(stacks, collection, crib(), 7));
    expect(randomLineup(stacks, collection, crib(), 7).lineup).not.toEqual(
      randomLineup(stacks, collection, crib(), 8).lineup,
    );
  });

  it('picks a different subset of fabrics for a small size', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      const lineup = randomLineup(stacks, collection, crib(), seed).lineup;
      expect(lineup).toHaveLength(9);
      expect(new Set(lineup).size).toBe(9);
      for (const id of lineup) seen.add(id!);
    }
    expect(seen.size).toBeGreaterThan(9);
  });

  it.each(['crib', 'throw', 'twin', 'full', 'queen', 'king'])('%s never repeats a fabric in a block', (id) => {
    const size = getSize(stacks, id);
    for (let seed = 1; seed <= 8; seed++) {
      const d = randomLineup(stacks, collection, createEmptyDesign(stacks, id), seed * 7919);
      expect(d.lineup.every((f) => f !== null)).toBe(true);
      expect(repeatedFabricBlocks(stacks, d.lineup, size.cols * size.rows)).toBe(0);
      if (d.lineup.length >= collection.fabrics.length) expect(new Set(d.lineup).size).toBe(collection.fabrics.length);
    }
  });

  it('replaces every pick and leaves overrides alone', () => {
    const start = { ...createDesign(stacks, collection, 'crib'), overrides: { '0:A': collection.fabrics[19]!.id } };
    const d = randomLineup(stacks, collection, start, 3);
    expect(d.overrides).toEqual(start.overrides);
    expect(d.cells).toEqual(start.cells);
  });
});

describe('removeFabric', () => {
  it('empties the slots and drops the hand-placed pieces that use it', () => {
    const base = createDesign(stacks, collection, 'crib');
    const gone = base.lineup[2]!;
    const other = collection.fabrics.find((f) => !base.lineup.includes(f.id))!.id;
    const d = { ...base, overrides: { '0:A': gone, '1:B': other, '4:C': gone } };
    const out = removeFabric(d, gone);
    expect(out.lineup[2]).toBeNull();
    expect(out.lineup.filter((id) => id === null)).toHaveLength(1);
    expect(out.overrides).toEqual({ '1:B': other });
    expect(out.cells).toEqual(d.cells);
    expect(d.lineup[2]).toBe(gone);
  });

  it('returns the design untouched when the fabric is not used', () => {
    const d = createDesign(stacks, collection, 'crib');
    const unused = collection.fabrics.find((f) => !d.lineup.includes(f.id))!.id;
    expect(removeFabric(d, unused)).toBe(d);
  });
});

describe('picking with hidden fabrics', () => {
  const sizes = ['crib', 'throw', 'twin', 'full', 'queen', 'king'];
  /**
   * A stack of n slots can keep every block free of repeats with k fabrics when
   * it splits into R runs of distinct fabrics, each 9 to k long: 9R <= n <= kR.
   */
  const repeatFreePossible = (n: number, k: number) => {
    for (let r = 1; 9 * r <= n; r++) if (n <= k * r) return true;
    return false;
  };

  it.each(Array.from({ length: 12 }, (_, i) => i))('never uses a hidden fabric with %i hidden, and avoids repeats where possible', (count) => {
    const excluded = new Set(collection.fabrics.slice(0, count).map((f) => f.id));
    const usable = usableCollection(collection, excluded);
    expect(usable.fabrics).toHaveLength(20 - count);
    for (const id of sizes) {
      const size = getSize(stacks, id);
      for (let seed = 1; seed <= 4; seed++) {
        const r = randomLineup(stacks, usable, createEmptyDesign(stacks, id), seed);
        expect(r.lineup.some((f) => f === null || excluded.has(f))).toBe(false);
        if (repeatFreePossible(r.lineup.length, usable.fabrics.length)) {
          expect(repeatedFabricBlocks(stacks, r.lineup, size.cols * size.rows)).toBe(0);
        }
      }
      // With one pick kept, filling the rest is best effort, but never uses a hidden fabric.
      const part = setLineupSlot(createEmptyDesign(stacks, id), 0, usable.fabrics[0]!.id);
      const partFilled = fillEmptySlots(stacks, usable, part);
      expect(partFilled.lineup.some((f) => f === null || excluded.has(f))).toBe(false);
      const filled = fillEmptySlots(stacks, usable, createEmptyDesign(stacks, id));
      expect(filled.lineup.some((f) => f === null || excluded.has(f))).toBe(false);
      if (repeatFreePossible(filled.lineup.length, usable.fabrics.length)) {
        expect(repeatedFabricBlocks(stacks, filled.lineup, size.cols * size.rows)).toBe(0);
      }
    }
  });

  it.each([1, 2])('finishes with only %i fabrics left', (left) => {
    const excluded = new Set(collection.fabrics.slice(left).map((f) => f.id));
    const usable = usableCollection(collection, excluded);
    for (const id of sizes) {
      const r = randomLineup(stacks, usable, createEmptyDesign(stacks, id), 9);
      expect(r.lineup.every((f) => f !== null && !excluded.has(f))).toBe(true);
      const filled = fillEmptySlots(stacks, usable, createEmptyDesign(stacks, id));
      expect(filled.lineup.every((f) => f !== null && !excluded.has(f))).toBe(true);
    }
  });

  it('the possible cases are the ones checked', () => {
    // 11 hidden leaves 9: only the king (36 = 4 runs of 9) and the crib can avoid repeats.
    expect(['crib', 'throw', 'twin', 'full', 'queen', 'king'].map((id) => {
      const s = getSize(stacks, id);
      return repeatFreePossible(s.cols * s.rows, 9);
    })).toEqual([true, false, false, false, false, true]);
  });

  it('keeps the full collection when nothing is hidden', () => {
    expect(usableCollection(collection, new Set())).toBe(collection);
  });
});

describe('visibleFabrics', () => {
  const hidden = new Set(['d0-c1', 'd3-c2']);
  it('drops hidden fabrics outside the hide mode', () => {
    const out = visibleFabrics(collection.fabrics, hidden, false);
    expect(out).toHaveLength(18);
    expect(out.some((f) => hidden.has(f.id))).toBe(false);
  });
  it('shows every fabric in the hide mode, in collection order', () => {
    expect(visibleFabrics(collection.fabrics, hidden, true)).toEqual(collection.fabrics);
  });
  it('returns the same list when nothing is hidden', () => {
    expect(visibleFabrics(collection.fabrics, new Set(), false)).toBe(collection.fabrics);
  });
});
