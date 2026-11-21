/** localStorage persistence. Every call is safe when storage is missing or throws. */
import { overrideKey } from './design';
import type { Design, DesignVersion, FabricCollection, PatternDef } from './types';

const PREFIX = 'vq:v1:';
const designKey = (projectId: string, sizeId: string) => `${PREFIX}design:${projectId}:${sizeId}`;
const sizeKey = (projectId: string) => `${PREFIX}size:${projectId}`;
const guideKey = (projectId: string, sizeId: string) => `${PREFIX}guide:${projectId}:${sizeId}`;
const versionsKey = (projectId: string, sizeId: string) => `${PREFIX}versions:${projectId}:${sizeId}`;

/** Steps of the guided setup, in order. */
export const GUIDE_STEPS = ['size', 'fabrics', 'shuffle', 'blocks', 'touchups', 'done'] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];

/**
 * Where the guide stands for one size. `block` is the cell index for the
 * touch-ups step and 0 elsewhere. 'done' means the guide is finished or closed.
 */
export type GuideProgress = { step: GuideStepId; block: number } | 'done';

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored, for example when storage is full. */
function write(key: string, value: string): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    // Quota or privacy mode. The value just won't persist.
    return false;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Shape check only. Use `sanitizeDesign` to check against a pattern and collection. */
function isDesign(v: unknown): v is Design {
  if (!isRecord(v)) return false;
  if (typeof v.sizeId !== 'string') return false;
  if (!Array.isArray(v.lineup) || !v.lineup.every((x) => x === null || typeof x === 'string')) return false;
  if (
    !Array.isArray(v.cells) ||
    !v.cells.every(
      (c) =>
        isRecord(c) &&
        Number.isInteger(c.blockId) &&
        (c.rotation === 0 || c.rotation === 90 || c.rotation === 180 || c.rotation === 270),
    )
  ) {
    return false;
  }
  if (!isRecord(v.overrides)) return false;
  return Object.values(v.overrides).every((x) => typeof x === 'string');
}

export function loadDesign(projectId: string, sizeId: string): Design | null {
  const raw = read(designKey(projectId, sizeId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDesign(parsed) && parsed.sizeId === sizeId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDesign(projectId: string, design: Design): void {
  write(designKey(projectId, design.sizeId), JSON.stringify(design));
}

function isGuideProgress(v: unknown): v is GuideProgress {
  if (v === 'done') return true;
  if (!isRecord(v)) return false;
  const block = v.block;
  return (
    (GUIDE_STEPS as readonly unknown[]).includes(v.step) &&
    typeof block === 'number' &&
    Number.isInteger(block) &&
    block >= 0
  );
}

/** Saved guide progress for a size, or null when there is none or it does not parse. */
export function loadGuide(projectId: string, sizeId: string): GuideProgress | null {
  const raw = read(guideKey(projectId, sizeId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGuideProgress(parsed)) return null;
    return parsed === 'done' ? 'done' : { step: parsed.step, block: parsed.block };
  } catch {
    return null;
  }
}

export function saveGuide(projectId: string, sizeId: string, progress: GuideProgress): void {
  write(guideKey(projectId, sizeId), JSON.stringify(progress));
}

function isVersion(v: unknown, sizeId: string): v is DesignVersion {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.sizeId === sizeId &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'number' &&
    Number.isFinite(v.createdAt) &&
    typeof v.auto === 'boolean' &&
    (v.reason === undefined || typeof v.reason === 'string') &&
    isDesign(v.design) &&
    v.design.sizeId === sizeId
  );
}

/**
 * Saved versions for a size, newest first. Entries that do not parse are
 * dropped. Use `sanitizeDesign` on a version's design before restoring it.
 */
export function loadVersions(projectId: string, sizeId: string): DesignVersion[] {
  const raw = read(versionsKey(projectId, sizeId));
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is DesignVersion => isVersion(v, sizeId));
  } catch {
    return [];
  }
}

/** Store a size's versions. Returns false when storage is full or missing. */
export function saveVersions(projectId: string, sizeId: string, versions: readonly DesignVersion[]): boolean {
  return write(versionsKey(projectId, sizeId), JSON.stringify(versions));
}

export function loadLastSize(projectId: string): string | null {
  return read(sizeKey(projectId));
}

export function saveLastSize(projectId: string, sizeId: string): void {
  write(sizeKey(projectId), sizeId);
}

/**
 * Check a loaded design against the pattern and collection. Returns null when
 * the size is unknown, the lineup length or cell count is wrong, the lineup
 * names a missing fabric (empty slots are fine), or the cells are not a permutation of block ids with
 * allowed rotations. Overrides naming a missing fabric, piece, or block are dropped.
 */
export function sanitizeDesign(
  pattern: PatternDef,
  collection: FabricCollection,
  design: Design,
): Design | null {
  const size = pattern.sizes.find((s) => s.id === design.sizeId);
  if (!size) return null;
  const cellCount = size.cols * size.rows;
  if (design.lineup.length !== pattern.lineupLength(size)) return null;
  if (design.cells.length !== cellCount) return null;

  const known = new Set(collection.fabrics.map((f) => f.id));
  if (!design.lineup.every((id) => id === null || known.has(id))) return null;

  const seen = new Set<number>();
  for (const c of design.cells) {
    if (c.blockId < 0 || c.blockId >= cellCount || seen.has(c.blockId)) return null;
    if (!pattern.rotations.includes(c.rotation)) return null;
    seen.add(c.blockId);
  }

  const overrides: Record<string, string> = {};
  for (let blockId = 0; blockId < cellCount; blockId++) {
    for (const piece of pattern.block.pieces) {
      const key = overrideKey(blockId, piece.id);
      const fabricId = design.overrides[key];
      if (fabricId !== undefined && known.has(fabricId)) overrides[key] = fabricId;
    }
  }
  return { sizeId: design.sizeId, lineup: [...design.lineup], cells: design.cells.map((c) => ({ ...c })), overrides };
}
