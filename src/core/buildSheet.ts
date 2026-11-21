/**
 * Data for the printable build sheet: fabrics by number, the stack order, what
 * goes in each block, where each block sits, and what extra fabric hand-placed
 * pieces need. Pure, no DOM. Works for any pattern and collection.
 */
import { fabricFor, getSize, overrideKey } from './design';
import { quiltSizeInches } from './layout';
import type { Design, FabricCollection, PatternDef, Rotation } from './types';

export interface SheetFabric {
  /** 1-based number printed on the sheet. */
  number: number;
  id: string;
  name: string;
  design: string;
  colorway: string;
  sku: string;
}

export interface SheetSlot {
  /** 1-based position in the stack, 1 on top. */
  position: number;
  fabric: number | null;
}

export interface SheetPiece {
  id: string;
  label: string;
  fabric: number | null;
  /** Hand-placed: an override that differs from what the shuffle gives. */
  changed: boolean;
}

export interface SheetBlock {
  /** blockId + 1. */
  number: number;
  pieces: SheetPiece[];
}

export interface SheetCell {
  block: number;
  rotation: Rotation;
}

export interface SheetChange {
  block: number;
  piece: string;
  fabric: number;
  /** What the shuffle would have put there. */
  shuffled: number | null;
}

export interface SheetBuy {
  fabric: number;
  /** Stack slots that hold this fabric. */
  fatQuarters: number;
  /** More fat quarters needed for hand-placed pieces. */
  extra: number;
  total: number;
}

export interface SheetShortage {
  fabric: number;
  piece: string;
  /** Pieces needed beyond what the stack gives. */
  extra: number;
}

export interface BuildSheet {
  fabrics: SheetFabric[];
  stack: SheetSlot[];
  blocks: SheetBlock[];
  layout: { cols: number; rows: number; cells: SheetCell[] };
  changes: SheetChange[];
  buy: SheetBuy[];
  shortages: SheetShortage[];
  emptyPieces: number;
  summary: {
    sizeName: string;
    cols: number;
    rows: number;
    widthIn: number;
    heightIn: number;
    blockCount: number;
    fatQuarters: number;
  };
}

export function buildSheetData(
  pattern: PatternDef,
  collection: FabricCollection,
  design: Design,
): BuildSheet {
  const size = getSize(pattern, design.sizeId);
  const defs = pattern.block.pieces;
  const n = design.lineup.length;
  const byId = new Map(collection.fabrics.map((f) => [f.id, f]));
  const blockIds = [...new Set(design.cells.map((c) => c.blockId))].sort((a, b) => a - b);

  // Final and shuffled fabric for every piece of every block.
  const resolved = blockIds.map((blockId) =>
    defs.map((piece, p) => {
      const final = fabricFor(pattern, design, blockId, p).fabricId;
      const shuffled = design.lineup[pattern.assign(blockId, p, n)] ?? null;
      const changed = overrideKey(blockId, piece.id) in design.overrides && final !== shuffled;
      return { piece, final, shuffled, changed };
    }),
  );

  // Numbers: stack order first, then fabrics only used by hand.
  const numberOf = new Map<string, number>();
  const order: string[] = [];
  const add = (id: string | null) => {
    if (id === null || numberOf.has(id)) return;
    order.push(id);
    numberOf.set(id, order.length);
  };
  design.lineup.forEach(add);
  for (const block of resolved) for (const r of block) add(r.final);
  const num = (id: string | null) => (id === null ? null : (numberOf.get(id) ?? null));

  const fabrics: SheetFabric[] = order.map((id, i) => {
    const f = byId.get(id);
    return {
      number: i + 1,
      id,
      name: f?.name ?? id,
      design: f?.design ?? '',
      colorway: f?.colorway ?? '',
      sku: f?.sku ?? '',
    };
  });

  const stack: SheetSlot[] = design.lineup.map((id, i) => ({ position: i + 1, fabric: num(id) }));

  const blocks: SheetBlock[] = resolved.map((block, b) => ({
    number: blockIds[b]! + 1,
    pieces: block.map((r) => ({
      id: r.piece.id,
      label: r.piece.label,
      fabric: num(r.final),
      changed: r.changed,
    })),
  }));

  const changes: SheetChange[] = [];
  let emptyPieces = 0;
  // demand[fabric][pieceIndex] = blocks using that fabric in that piece.
  const demand = new Map<string, number[]>();
  resolved.forEach((block, b) => {
    block.forEach((r, p) => {
      if (r.final === null) {
        emptyPieces++;
        return;
      }
      let row = demand.get(r.final);
      if (!row) {
        row = defs.map(() => 0);
        demand.set(r.final, row);
      }
      row[p] = (row[p] ?? 0) + 1;
      if (r.changed) {
        changes.push({ block: blockIds[b]! + 1, piece: r.piece.label, fabric: num(r.final)!, shuffled: num(r.shuffled) });
      }
    });
  });

  const supply = new Map<string, number>();
  for (const id of design.lineup) if (id !== null) supply.set(id, (supply.get(id) ?? 0) + 1);

  const shortages: SheetShortage[] = [];
  const buy: SheetBuy[] = order.map((id, i) => {
    const have = supply.get(id) ?? 0;
    let extra = 0;
    (demand.get(id) ?? []).forEach((need, p) => {
      if (need <= have) return;
      shortages.push({ fabric: i + 1, piece: defs[p]?.label ?? '', extra: need - have });
      extra = Math.max(extra, need - have);
    });
    return { fabric: i + 1, fatQuarters: have, extra, total: have + extra };
  });

  const { width, height } = quiltSizeInches(pattern, size);
  return {
    fabrics,
    stack,
    blocks,
    layout: {
      cols: size.cols,
      rows: size.rows,
      cells: design.cells.map((c) => ({ block: c.blockId + 1, rotation: c.rotation })),
    },
    changes,
    buy,
    shortages,
    emptyPieces,
    summary: {
      sizeName: size.name,
      cols: size.cols,
      rows: size.rows,
      widthIn: width,
      heightIn: height,
      blockCount: blocks.length,
      fatQuarters: buy.reduce((s, b) => s + b.total, 0),
    },
  };
}
