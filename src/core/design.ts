/**
 * Pure functions over `Design`. Every function returns a new object and never
 * mutates its inputs.
 */
import type {
  Design,
  FabricCollection,
  PatternDef,
  PlacedBlock,
  QuiltSize,
  Rotation,
} from './types';

/** A fabric repeated in the lineup should sit at least this many slots from its twin. */
const MIN_REPEAT_GAP = 9;

export function getSize(pattern: PatternDef, sizeId: string): QuiltSize {
  const size = pattern.sizes.find((s) => s.id === sizeId);
  if (!size) throw new Error(`Unknown size "${sizeId}" for pattern "${pattern.id}"`);
  return size;
}

export function overrideKey(blockId: number, pieceId: string): string {
  return `${blockId}:${pieceId}`;
}

/** Small seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cyclic distance between two slots of an n-slot lineup. */
function cyclicDistance(a: number, b: number, n: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, n - d);
}

/** Fabric ids ordered so neighbors come from different designs where possible. */
function interleaveByDesign(collection: FabricCollection): string[] {
  const groups = new Map<string, string[]>();
  for (const f of collection.fabrics) {
    const g = groups.get(f.design);
    if (g) g.push(f.id);
    else groups.set(f.design, [f.id]);
  }
  const lists = [...groups.values()];
  const out: string[] = [];
  for (let round = 0; out.length < collection.fabrics.length; round++) {
    for (const list of lists) {
      const id = list[round];
      if (id !== undefined) out.push(id);
    }
  }
  return out;
}

/** Fabric id to design name. */
function designsOf(collection: FabricCollection): Map<string, string> {
  return new Map(collection.fabrics.map((f) => [f.id, f.design]));
}

/**
 * Fill the null slots of `lineup` in place, slot by slot. Each slot takes the
 * fabric that keeps repeats at least 9 slots apart (cyclically), then the
 * least used one, then one whose design differs from its filled neighbors,
 * then the first in design-interleaved order. Filled slots count toward use
 * and gaps but never change. Returns the slots it filled.
 */
function fillNullSlots(
  lineup: (string | null)[],
  order: readonly string[],
  designOf: ReadonlyMap<string, string>,
): boolean[] {
  const n = lineup.length;
  const filledHere = lineup.map(() => false);
  if (order.length === 0) return filledHere;
  const slotsOf = new Map<string, number[]>(order.map((id) => [id, []]));
  lineup.forEach((id, slot) => {
    if (id !== null) slotsOf.get(id)?.push(slot);
  });

  for (let slot = 0; slot < n; slot++) {
    if (lineup[slot] !== null) continue;
    const neighbors = new Set<string>();
    for (const at of [(slot + n - 1) % n, (slot + 1) % n]) {
      const id = at === slot ? null : lineup[at];
      const design = id ? designOf.get(id) : undefined;
      if (design !== undefined) neighbors.add(design);
    }
    const ranked = order.map((id, i) => {
      const slots = slotsOf.get(id)!;
      const gap = Math.min(Infinity, ...slots.map((s) => cyclicDistance(s, slot, n)));
      return {
        id,
        i,
        used: slots.length,
        gap,
        clash: neighbors.has(designOf.get(id) ?? '') ? 1 : 0,
      };
    });
    const spaced = ranked.filter((c) => c.gap >= MIN_REPEAT_GAP);
    const best =
      spaced.length > 0
        ? spaced.sort((a, b) => a.used - b.used || a.clash - b.clash || a.i - b.i)[0]!
        : // No fabric can keep the gap. Take the least used with the widest gap.
          ranked.sort((a, b) => a.used - b.used || b.gap - a.gap || a.clash - b.clash || a.i - b.i)[0]!;
    slotsOf.get(best.id)!.push(slot);
    lineup[slot] = best.id;
    filledHere[slot] = true;
  }
  return filledHere;
}

/**
 * Initial lineup of n fabric ids. With n at most the fabric count, the first n
 * of a design-interleaved order. Above that, fabrics repeat with copies kept at
 * least 9 slots apart (cyclically) where the arithmetic allows.
 */
export function defaultLineup(
  pattern: PatternDef,
  collection: FabricCollection,
  size: QuiltSize,
): string[] {
  const n = pattern.lineupLength(size);
  const order = interleaveByDesign(collection);
  if (order.length === 0) return [];
  const lineup = new Array<string | null>(n).fill(null);
  fillNullSlots(lineup, order, designsOf(collection));
  return lineup.map((id) => id!);
}

/**
 * Fill only the empty slots with a mix of fabrics, keeping the filled ones.
 * Repeats of a fabric sit at least 9 slots apart where the arithmetic allows,
 * and neighbors come from different designs where possible. Deterministic.
 */
export function fillEmptySlots(
  pattern: PatternDef,
  collection: FabricCollection,
  design: Design,
): Design {
  if (!design.lineup.includes(null)) return design;
  const order = interleaveByDesign(collection);
  if (order.length === 0) return design;
  const lineup = [...design.lineup];
  const filledHere = fillNullSlots(lineup, order, designsOf(collection));
  return { ...design, lineup: repairLineup(lineup, filledHere) };
}

/** Count of slot pairs holding the same fabric closer than the minimum gap. Empty slots never count. */
function conflictCost(lineup: readonly (string | null)[]): number {
  const n = lineup.length;
  let cost = 0;
  for (let i = 0; i < n; i++) {
    if (lineup[i] === null) continue;
    for (let d = 1; d < MIN_REPEAT_GAP && d < n; d++) {
      // Count each unordered pair once when the window wraps on a short lineup.
      const j = (i + d) % n;
      if (lineup[i] === lineup[j] && (n > 2 * d || i < j)) cost++;
    }
  }
  return cost;
}

/**
 * Swap slots until no swap lowers the conflict count. Best effort. Only slots
 * marked in `movable` take part, so filled slots the caller wants kept stay put.
 */
function repairLineup(lineup: (string | null)[], movable: readonly boolean[]): (string | null)[] {
  const n = lineup.length;
  let cost = conflictCost(lineup);
  for (let guard = 0; guard < 500 && cost > 0; guard++) {
    let bestI = -1;
    let bestJ = -1;
    let bestCost = cost;
    for (let i = 0; i < n; i++) {
      if (!movable[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!movable[j] || lineup[i] === lineup[j]) continue;
        [lineup[i], lineup[j]] = [lineup[j]!, lineup[i]!];
        const c = conflictCost(lineup);
        [lineup[i], lineup[j]] = [lineup[j]!, lineup[i]!];
        if (c < bestCost) {
          bestCost = c;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0) break;
    [lineup[bestI], lineup[bestJ]] = [lineup[bestJ]!, lineup[bestI]!];
    cost = bestCost;
  }
  return lineup;
}

/** Default cells for a size: row-major, blockId = cell index, pattern rotations. */
function defaultCells(pattern: PatternDef, size: QuiltSize): PlacedBlock[] {
  const cells: PlacedBlock[] = [];
  for (let i = 0; i < size.cols * size.rows; i++) {
    cells.push({
      blockId: i,
      rotation: pattern.defaultRotation(i % size.cols, Math.floor(i / size.cols)),
    });
  }
  return cells;
}

/** A design with every slot empty, cells in order with the pattern's rotations, no overrides. */
export function createEmptyDesign(pattern: PatternDef, sizeId: string): Design {
  const size = getSize(pattern, sizeId);
  return {
    sizeId,
    lineup: new Array<string | null>(pattern.lineupLength(size)).fill(null),
    cells: defaultCells(pattern, size),
    overrides: {},
  };
}

export function createDesign(
  pattern: PatternDef,
  collection: FabricCollection,
  sizeId: string,
): Design {
  const size = getSize(pattern, sizeId);
  return {
    sizeId,
    lineup: defaultLineup(pattern, collection, size),
    cells: defaultCells(pattern, size),
    overrides: {},
  };
}

/**
 * Seeded reshuffle of the lineup, then a best effort repair of repeats within
 * a block. Empty slots stay where they are; only the filled values move.
 */
export function shuffleLineup(design: Design, seed: number): Design {
  const rand = seededRandom(seed);
  const filled: number[] = [];
  design.lineup.forEach((id, i) => {
    if (id !== null) filled.push(i);
  });
  const values = filled.map((i) => design.lineup[i]!);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  const lineup = [...design.lineup];
  filled.forEach((slot, k) => {
    lineup[slot] = values[k]!;
  });
  const movable = lineup.map((id) => id !== null);
  return { ...design, lineup: repairLineup(lineup, movable) };
}

/** Put a fabric in one slot, or empty it with null. */
export function setLineupSlot(design: Design, slot: number, fabricId: string | null): Design {
  if (slot < 0 || slot >= design.lineup.length) return design;
  const lineup = [...design.lineup];
  lineup[slot] = fabricId;
  return { ...design, lineup };
}

export function swapLineupSlots(design: Design, a: number, b: number): Design {
  const n = design.lineup.length;
  if (a === b || a < 0 || b < 0 || a >= n || b >= n) return design;
  const lineup = [...design.lineup];
  [lineup[a], lineup[b]] = [lineup[b]!, lineup[a]!];
  return { ...design, lineup };
}

/** Fabric the shuffle gives a piece, ignoring overrides. */
function shuffledFabric(
  pattern: PatternDef,
  design: Design,
  blockId: number,
  pieceIndex: number,
): string | null {
  const n = design.lineup.length;
  return design.lineup[pattern.assign(blockId, pieceIndex, n)] ?? null;
}

/**
 * Hand-place a fabric on one piece. Setting the fabric the shuffle already
 * gives that piece removes the override instead of storing it.
 */
export function setOverride(
  pattern: PatternDef,
  design: Design,
  blockId: number,
  pieceId: string,
  fabricId: string,
): Design {
  const pieceIndex = pattern.block.pieces.findIndex((p) => p.id === pieceId);
  if (pieceIndex < 0) return design;
  if (shuffledFabric(pattern, design, blockId, pieceIndex) === fabricId) {
    return clearOverride(design, blockId, pieceId);
  }
  return {
    ...design,
    overrides: { ...design.overrides, [overrideKey(blockId, pieceId)]: fabricId },
  };
}

export function clearOverride(design: Design, blockId: number, pieceId: string): Design {
  const key = overrideKey(blockId, pieceId);
  if (!(key in design.overrides)) return design;
  const { [key]: _removed, ...overrides } = design.overrides;
  return { ...design, overrides };
}

export function clearAllOverrides(design: Design): Design {
  return { ...design, overrides: {} };
}

/** Step to the next rotation the pattern allows. */
export function rotateCell(pattern: PatternDef, design: Design, cellIndex: number): Design {
  const cell = design.cells[cellIndex];
  if (!cell || pattern.rotations.length === 0) return design;
  const at = pattern.rotations.indexOf(cell.rotation);
  const next: Rotation = pattern.rotations[(at + 1) % pattern.rotations.length]!;
  const cells = [...design.cells];
  cells[cellIndex] = { ...cell, rotation: next };
  return { ...design, cells };
}

/** Swap two grid cells. Each block keeps its id, rotation, and overrides. */
export function swapCells(design: Design, a: number, b: number): Design {
  const n = design.cells.length;
  if (a === b || a < 0 || b < 0 || a >= n || b >= n) return design;
  const cells = [...design.cells];
  [cells[a], cells[b]] = [cells[b]!, cells[a]!];
  return { ...design, cells };
}

/**
 * Give every cell the pattern's default rotation, or no turn at all. A pattern
 * that does not allow rotation 0 keeps its default rotations for 'none'.
 */
export function setAllRotations(
  pattern: PatternDef,
  design: Design,
  mode: 'pattern' | 'none',
): Design {
  const size = getSize(pattern, design.sizeId);
  const noTurn = mode === 'none' && pattern.rotations.includes(0);
  const cells = design.cells.map((cell, i) => ({
    ...cell,
    rotation: noTurn ? (0 as Rotation) : pattern.defaultRotation(i % size.cols, Math.floor(i / size.cols)),
  }));
  return { ...design, cells };
}

/** Restore cell order and the pattern's default rotations. Lineup and overrides stay. */
export function resetBlocks(pattern: PatternDef, design: Design): Design {
  const size = getSize(pattern, design.sizeId);
  return { ...design, cells: defaultCells(pattern, size) };
}

/** Fabric on a piece, and whether it comes from an override. An override wins over an empty slot. */
export function fabricFor(
  pattern: PatternDef,
  design: Design,
  blockId: number,
  pieceIndex: number,
): { fabricId: string | null; overridden: boolean } {
  const piece = pattern.block.pieces[pieceIndex];
  if (piece) {
    const over = design.overrides[overrideKey(blockId, piece.id)];
    if (over !== undefined) return { fabricId: over, overridden: true };
  }
  return { fabricId: shuffledFabric(pattern, design, blockId, pieceIndex), overridden: false };
}

/** Number of pieces each fabric covers across the whole quilt. Empty pieces are not counted. */
export function fabricUsage(pattern: PatternDef, design: Design): Map<string, number> {
  const usage = new Map<string, number>();
  for (const cell of design.cells) {
    for (let p = 0; p < pattern.block.pieces.length; p++) {
      const { fabricId } = fabricFor(pattern, design, cell.blockId, p);
      if (fabricId === null) continue;
      usage.set(fabricId, (usage.get(fabricId) ?? 0) + 1);
    }
  }
  return usage;
}

/** Number of lineup slots each fabric fills. */
export function slotUsage(design: Design): Map<string, number> {
  const usage = new Map<string, number>();
  for (const id of design.lineup) {
    if (id !== null) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/** True when the design has no fabric anywhere: every slot empty and no overrides. */
export function isEmptyDesign(design: Design): boolean {
  return design.lineup.every((id) => id === null) && Object.keys(design.overrides).length === 0;
}
