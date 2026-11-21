/**
 * Lenient repair of a design against the current pattern and collection. It
 * is used for data from localStorage and from data files, so a renamed fabric
 * or a changed pattern never makes a saved quilt disappear.
 */
import { defaultCells, getSize, overrideKey } from './design';
import type { Design, FabricCollection, PatternDef } from './types';

export type RepairNote =
  /** Fabric ids this app does not have. Their lineup slots are now empty. */
  | { kind: 'fabric-missing'; ids: string[] }
  /** Hand-placed fabrics dropped, because the fabric, piece or block is unknown. */
  | { kind: 'override-dropped'; count: number }
  /** Lineup slots cut from the end, because the lineup was too long. */
  | { kind: 'lineup-cut'; count: number }
  /** Empty slots added to the end, because the lineup was too short. */
  | { kind: 'lineup-padded'; count: number }
  /** The block arrangement did not fit the size and went back to the pattern's default. */
  | { kind: 'blocks-reset' };

export interface Repaired {
  design: Design;
  notes: RepairNote[];
}

/** Follow one alias, once. An id with no alias stays as it is. */
export function resolveAlias(map: Readonly<Record<string, string>> | undefined, id: string): string {
  return map && Object.hasOwn(map, id) ? (map[id] ?? id) : id;
}

/**
 * Make a design fit. Rules:
 * - An unknown size id is the only reason to return null. The size id is
 *   looked up through the pattern's size aliases first.
 * - A lineup fabric id is looked up through the collection's aliases. One that
 *   is still unknown becomes an empty slot.
 * - A lineup that is too long is cut. One that is too short gets empty slots.
 * - A hand-placed fabric is dropped when its fabric, piece or block is unknown.
 *   Piece ids and fabric ids go through the aliases first.
 * - Cells that are not a valid arrangement (wrong count, not a permutation of
 *   block ids, or a rotation the pattern does not allow) go back to the
 *   pattern's default. The lineup and hand-placed fabrics stay.
 */
export function repairDesign(pattern: PatternDef, collection: FabricCollection, design: Design): Repaired | null {
  const sizeId = resolveAlias(pattern.aliases?.sizes, design.sizeId);
  if (!pattern.sizes.some((s) => s.id === sizeId)) return null;
  const size = getSize(pattern, sizeId);
  const cellCount = size.cols * size.rows;
  const slots = pattern.lineupLength(size);
  const known = new Set(collection.fabrics.map((f) => f.id));
  const notes: RepairNote[] = [];
  const missing = new Set<string>();

  const fabric = (id: string): string | null => {
    const r = resolveAlias(collection.aliases, id);
    if (known.has(r)) return r;
    missing.add(id);
    return null;
  };

  const lineup = design.lineup.slice(0, slots).map((id) => (id === null ? null : fabric(id)));
  if (design.lineup.length > slots) notes.push({ kind: 'lineup-cut', count: design.lineup.length - slots });
  if (design.lineup.length < slots) {
    notes.push({ kind: 'lineup-padded', count: slots - design.lineup.length });
    while (lineup.length < slots) lineup.push(null);
  }

  const pieceIds = new Set(pattern.block.pieces.map((p) => p.id));
  const overrides: Record<string, string> = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(design.overrides)) {
    const colon = key.indexOf(':');
    const blockId = colon > 0 && /^\d+$/.test(key.slice(0, colon)) ? Number(key.slice(0, colon)) : -1;
    const pieceId = resolveAlias(pattern.aliases?.pieces, key.slice(colon + 1));
    const fabricId = fabric(value);
    if (blockId < 0 || blockId >= cellCount || !pieceIds.has(pieceId) || fabricId === null) {
      dropped++;
      continue;
    }
    overrides[overrideKey(blockId, pieceId)] = fabricId;
  }
  if (dropped > 0) notes.push({ kind: 'override-dropped', count: dropped });
  if (missing.size > 0) notes.unshift({ kind: 'fabric-missing', ids: [...missing].sort() });

  const seen = new Set<number>();
  const cellsOk =
    design.cells.length === cellCount &&
    design.cells.every((c) => {
      const ok =
        Number.isInteger(c.blockId) &&
        c.blockId >= 0 &&
        c.blockId < cellCount &&
        !seen.has(c.blockId) &&
        pattern.rotations.includes(c.rotation);
      seen.add(c.blockId);
      return ok;
    });
  if (!cellsOk) notes.push({ kind: 'blocks-reset' });
  const cells = cellsOk ? design.cells.map((c) => ({ blockId: c.blockId, rotation: c.rotation })) : defaultCells(pattern, size);

  return { design: { sizeId, lineup, cells, overrides }, notes };
}
