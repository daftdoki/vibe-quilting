import { describe, expect, it } from 'vitest';
import { stacks } from '../patterns/stacks';
import { buildSheetData } from './buildSheet';
import { createDesign, createEmptyDesign, overrideKey, rotateCell, swapCells } from './design';
import { makeCollection } from './test-fixtures';
import type { Design } from './types';

const collection = makeCollection();
const ids = collection.fabrics.map((f) => f.id);
const id = (i: number) => ids[i]!;

/** Crib (3 by 3, 9 slots) with fabrics 0..8 in order. */
function crib(): Design {
  return { ...createEmptyDesign(stacks, 'crib'), lineup: ids.slice(0, 9) };
}

/** The shuffled fabric slot for a block and piece letter. */
function slotFor(design: Design, blockId: number, pieceId: string): number {
  const p = stacks.block.pieces.findIndex((x) => x.id === pieceId);
  return stacks.assign(blockId, p, design.lineup.length);
}

describe('buildSheetData', () => {
  it('numbers fabrics by stack position when nothing repeats', () => {
    const sheet = buildSheetData(stacks, collection, crib());
    expect(sheet.fabrics.map((f) => f.id)).toEqual(ids.slice(0, 9));
    sheet.stack.forEach((s) => expect(s.fabric).toBe(s.position));
    expect(sheet.buy.every((b) => b.fatQuarters === 1 && b.extra === 0 && b.total === 1)).toBe(true);
    expect(sheet.shortages).toEqual([]);
    expect(sheet.changes).toEqual([]);
    expect(sheet.emptyPieces).toBe(0);
    expect(sheet.summary).toEqual({
      sizeName: 'Crib',
      cols: 3,
      rows: 3,
      widthIn: 46.5,
      heightIn: 55.5,
      blockCount: 9,
      fatQuarters: 9,
    });
  });

  it('includes name, design, colorway and sku', () => {
    const f = buildSheetData(stacks, collection, crib()).fabrics[0]!;
    expect(f).toEqual({ number: 1, id: id(0), name: id(0), design: 'design0', colorway: 'c0', sku: id(0) });
  });

  it('gives the first appearance a number, then hand-placed fabrics by block and piece', () => {
    const d = crib();
    d.lineup = [id(5), id(2), id(5), id(1), id(2), id(1), id(0), id(0), id(5)];
    d.overrides = {
      [overrideKey(3, 'B')]: id(12),
      [overrideKey(1, 'H')]: id(10),
      [overrideKey(1, 'C')]: id(11),
    };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.fabrics.map((f) => f.id)).toEqual([id(5), id(2), id(1), id(0), id(11), id(10), id(12)]);
    expect(sheet.stack.map((s) => s.fabric)).toEqual([1, 2, 1, 3, 2, 3, 4, 4, 1]);
  });

  it('counts fat quarters per fabric from the stack', () => {
    const d = createDesign(stacks, collection, 'throw');
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.stack).toHaveLength(16);
    const counts = new Map<string, number>();
    for (const f of d.lineup) counts.set(f!, (counts.get(f!) ?? 0) + 1);
    for (const f of sheet.fabrics) expect(sheet.buy[f.number - 1]!.fatQuarters).toBe(counts.get(f.id));
    expect(sheet.summary.fatQuarters).toBe(16);
    expect(sheet.shortages).toEqual([]);
  });

  it('handles repeats in a stack bigger than the collection', () => {
    const d = createDesign(stacks, collection, 'king');
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.fabrics).toHaveLength(20);
    expect(sheet.buy.reduce((s, b) => s + b.fatQuarters, 0)).toBe(36);
    expect(sheet.shortages).toEqual([]);
  });

  it('lists hand-placed pieces as changes and skips a redundant override', () => {
    const d = crib();
    const shuffledE = d.lineup[slotFor(d, 0, 'E')]!;
    d.overrides = {
      [overrideKey(2, 'D')]: id(15),
      [overrideKey(0, 'E')]: shuffledE,
    };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.changes).toEqual([
      { block: 3, piece: 'D', fabric: 10, shuffled: slotFor(d, 2, 'D') + 1 },
    ]);
    const block3 = sheet.blocks[2]!;
    expect(block3.pieces.find((p) => p.id === 'D')).toEqual({ id: 'D', label: 'D', fabric: 10, changed: true });
    expect(sheet.blocks[0]!.pieces.find((p) => p.id === 'E')!.changed).toBe(false);
  });

  it('asks for an extra fat quarter when a stack fabric goes on a second piece of one letter', () => {
    const d = crib();
    // Fabric in slot 0 sits on D of exactly one block. Put it on D of another block too.
    const other = [0, 1, 2].find((b) => slotFor(d, b, 'D') !== 0)!;
    d.overrides = { [overrideKey(other, 'D')]: id(0) };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.shortages).toEqual([{ fabric: 1, piece: 'D', extra: 1 }]);
    expect(sheet.buy[0]).toEqual({ fabric: 1, fatQuarters: 1, extra: 1, total: 2 });
    expect(sheet.summary.fatQuarters).toBe(10);
  });

  it('a fabric used only by hand on two letters needs one fat quarter', () => {
    const d = crib();
    d.overrides = { [overrideKey(0, 'A')]: id(15), [overrideKey(4, 'G')]: id(15) };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.shortages).toEqual([
      { fabric: 10, piece: 'A', extra: 1 },
      { fabric: 10, piece: 'G', extra: 1 },
    ]);
    expect(sheet.buy[9]).toEqual({ fabric: 10, fatQuarters: 0, extra: 1, total: 1 });
  });

  it('a fabric used only by hand on one letter twice needs two fat quarters', () => {
    const d = crib();
    d.overrides = { [overrideKey(0, 'A')]: id(15), [overrideKey(4, 'A')]: id(15) };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.shortages).toEqual([{ fabric: 10, piece: 'A', extra: 2 }]);
    expect(sheet.buy[9]).toEqual({ fabric: 10, fatQuarters: 0, extra: 2, total: 2 });
  });

  it('reports empty slots and empty pieces', () => {
    const d = crib();
    d.lineup[4] = null;
    d.lineup[7] = null;
    // A hand-placed fabric fills one piece of an empty slot.
    const blockId = 0;
    const pieceId = stacks.block.pieces[4]!.id; // block 0 piece 4 uses slot 4
    d.overrides = { [overrideKey(blockId, pieceId)]: id(0) };
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.stack[4]).toEqual({ position: 5, fabric: null });
    expect(sheet.stack[7]).toEqual({ position: 8, fabric: null });
    expect(sheet.fabrics).toHaveLength(7);
    expect(sheet.emptyPieces).toBe(17);
    expect(sheet.changes).toEqual([{ block: 1, piece: 'E', fabric: 1, shuffled: null }]);
    expect(sheet.summary.fatQuarters).toBe(8);
  });

  it('an empty design has nothing to buy', () => {
    const sheet = buildSheetData(stacks, collection, createEmptyDesign(stacks, 'runner'));
    expect(sheet.fabrics).toEqual([]);
    expect(sheet.emptyPieces).toBe(27);
    expect(sheet.summary.fatQuarters).toBe(0);
  });

  it('reports the right block per cell after a swap and a turn', () => {
    let d = crib();
    d = swapCells(d, 0, 4);
    d = rotateCell(stacks, d, 4);
    const sheet = buildSheetData(stacks, collection, d);
    expect(sheet.layout.cols).toBe(3);
    expect(sheet.layout.rows).toBe(3);
    expect(sheet.layout.cells[0]).toEqual({ block: 5, rotation: 0 });
    // Cell 4 starts at 0 (col 1 + row 1 is even), so one turn makes it 180.
    expect(sheet.layout.cells[4]).toEqual({ block: 1, rotation: 180 });
    expect(sheet.blocks.map((b) => b.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('block k takes layer k of each shuffled stack', () => {
    // Stack p, with slot 0 on top, has its top p layers moved to the bottom.
    const n = 9;
    for (let p = 0; p < 9; p++) {
      const pile = Array.from({ length: n }, (_, s) => s);
      const shuffled = [...pile.slice(p), ...pile.slice(0, p)];
      for (let k = 0; k < n; k++) expect(stacks.assign(k, p, n)).toBe(shuffled[k]);
    }
  });
});
