/** localStorage persistence. Every call is safe when storage is missing or throws. */
import type { Design, DesignVersion, FabricCollection } from './types';

export const STORAGE_PREFIX = 'vq:v1:';
const PREFIX = STORAGE_PREFIX;
const HINT_KEY = `${PREFIX}hint-seen`;
/** The part of `Storage` this module uses, so tests and the backup code can pass a fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const designKey = (projectId: string, sizeId: string) => `${PREFIX}design:${projectId}:${sizeId}`;
const sizeKey = (projectId: string) => `${PREFIX}size:${projectId}`;
const guideKey = (projectId: string, sizeId: string) => `${PREFIX}guide:${projectId}:${sizeId}`;
const versionsKey = (projectId: string, sizeId: string) => `${PREFIX}versions:${projectId}:${sizeId}`;
const excludedKey = (projectId: string) => `${PREFIX}excluded:${projectId}`;

/** Steps of the guided setup, in order. 'intro' is the overview shown before the first counted step. */
export const GUIDE_STEPS = ['intro', 'size', 'fabrics', 'blocks', 'touchups', 'done'] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];

/**
 * Steps that earlier builds had and this one folded into another. Stored
 * progress and data files can still name them. The old Mix the order step
 * ('shuffle') is now part of Pick your fabrics.
 */
const RETIRED_STEPS: Readonly<Record<string, GuideStepId>> = { shuffle: 'fabrics' };

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

function readFrom(s: Pick<KeyValueStorage, 'getItem'> | null, key: string): string | null {
  try {
    return s?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  return readFrom(store(), key);
}

/**
 * While true, every save in this module is skipped. The data tools set it
 * between changing storage and reloading the page, so an autosave cannot
 * write the old state back over what was just imported or erased.
 */
let writesFrozen = false;

export function setWritesFrozen(frozen: boolean): void {
  writesFrozen = frozen;
}

/** Returns false when the value could not be stored, for example when storage is full. */
function write(key: string, value: string): boolean {
  if (writesFrozen) return false;
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
export function isDesignShape(v: unknown): v is Design {
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

type Reader = Pick<KeyValueStorage, 'getItem'>;
type Writer = Pick<KeyValueStorage, 'setItem'>;

/** Parse stored design text. Null when it is not JSON, has the wrong shape, or is for another size. */
export function parseStoredDesign(raw: string, sizeId: string): Design | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDesignShape(parsed) && parsed.sizeId === sizeId ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The stored design as it is, or null when there is none or it does not parse.
 * Use `repairDesign` before showing it, so it fits the current pattern and fabrics.
 */
export function readDesignFrom(s: Reader | null, projectId: string, sizeId: string): Design | null {
  const raw = readFrom(s, designKey(projectId, sizeId));
  return raw === null ? null : parseStoredDesign(raw, sizeId);
}

export function loadDesign(projectId: string, sizeId: string): Design | null {
  return readDesignFrom(store(), projectId, sizeId);
}

/** Like `saveDesign`, but on the given storage and it throws when the write fails. */
export function writeDesignTo(s: Writer, projectId: string, design: Design): void {
  s.setItem(designKey(projectId, design.sizeId), JSON.stringify(design));
}

export function saveDesign(projectId: string, design: Design): void {
  write(designKey(projectId, design.sizeId), JSON.stringify(design));
}

/** Guide progress with the right shape and a known step, cleaned of other fields. Null otherwise. */
export function parseGuideProgress(v: unknown): GuideProgress | null {
  if (v === 'done') return 'done';
  if (!isRecord(v)) return null;
  const { step, block } = v;
  if (typeof block !== 'number' || !Number.isInteger(block) || block < 0) return null;
  const retired = typeof step === 'string' && Object.hasOwn(RETIRED_STEPS, step) ? RETIRED_STEPS[step] : undefined;
  if (retired) return { step: retired, block: 0 };
  const known = GUIDE_STEPS.find((x) => x === step);
  return known ? { step: known, block } : null;
}

export function readGuideFrom(s: Reader | null, projectId: string, sizeId: string): GuideProgress | null {
  const raw = readFrom(s, guideKey(projectId, sizeId));
  if (raw === null) return null;
  try {
    return parseGuideProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Saved guide progress for a size, or null when there is none or it does not parse. */
export function loadGuide(projectId: string, sizeId: string): GuideProgress | null {
  return readGuideFrom(store(), projectId, sizeId);
}

export function writeGuideTo(s: Writer, projectId: string, sizeId: string, progress: GuideProgress): void {
  s.setItem(guideKey(projectId, sizeId), JSON.stringify(progress));
}

export function saveGuide(projectId: string, sizeId: string, progress: GuideProgress): void {
  write(guideKey(projectId, sizeId), JSON.stringify(progress));
}

/**
 * One version with the right shape, cleaned of other fields and filed under
 * `sizeId`. Null when a known field has the wrong type.
 */
export function parseVersion(v: unknown, sizeId: string): DesignVersion | null {
  if (!isRecord(v)) return null;
  if (
    typeof v.id !== 'string' ||
    typeof v.name !== 'string' ||
    typeof v.createdAt !== 'number' ||
    !Number.isFinite(v.createdAt) ||
    typeof v.auto !== 'boolean' ||
    (v.reason !== undefined && typeof v.reason !== 'string') ||
    !isDesignShape(v.design)
  ) {
    return null;
  }
  const out: DesignVersion = {
    id: v.id,
    sizeId,
    name: v.name,
    createdAt: v.createdAt,
    auto: v.auto,
    design: { ...v.design, sizeId },
  };
  if (v.reason !== undefined) out.reason = v.reason;
  return out;
}

function isVersion(v: unknown, sizeId: string): v is DesignVersion {
  return isRecord(v) && v.sizeId === sizeId && isRecord(v.design) && v.design.sizeId === sizeId && parseVersion(v, sizeId) !== null;
}

/**
 * Saved versions for a size, newest first. Entries that do not parse are
 * dropped. Use `repairDesign` on a version's design before restoring it.
 */
export function parseStoredVersions(raw: string, sizeId: string): DesignVersion[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is DesignVersion => isVersion(v, sizeId));
  } catch {
    return [];
  }
}

export function readVersionsFrom(s: Reader | null, projectId: string, sizeId: string): DesignVersion[] {
  const raw = readFrom(s, versionsKey(projectId, sizeId));
  return raw === null ? [] : parseStoredVersions(raw, sizeId);
}

export function loadVersions(projectId: string, sizeId: string): DesignVersion[] {
  return readVersionsFrom(store(), projectId, sizeId);
}

export function writeVersionsTo(s: Writer, projectId: string, sizeId: string, versions: readonly DesignVersion[]): void {
  s.setItem(versionsKey(projectId, sizeId), JSON.stringify(versions));
}

/** Store a size's versions. Returns false when storage is full or missing. */
export function saveVersions(projectId: string, sizeId: string, versions: readonly DesignVersion[]): boolean {
  return write(versionsKey(projectId, sizeId), JSON.stringify(versions));
}

export type DataKey =
  | { kind: 'design' | 'versions' | 'guide'; projectId: string; sizeId: string }
  | { kind: 'size' | 'excluded'; projectId: string; sizeId: null };

/** Split a key of a design, versions, guide, last size or hidden fabrics entry into its parts. Null for any other key. */
export function parseDataKey(key: string): DataKey | null {
  for (const kind of ['design', 'versions', 'guide'] as const) {
    const head = `${PREFIX}${kind}:`;
    if (!key.startsWith(head)) continue;
    const rest = key.slice(head.length);
    const i = rest.lastIndexOf(':');
    if (i <= 0 || i === rest.length - 1) return null;
    return { kind, projectId: rest.slice(0, i), sizeId: rest.slice(i + 1) };
  }
  for (const kind of ['size', 'excluded'] as const) {
    const head = `${PREFIX}${kind}:`;
    if (key.startsWith(head) && key.length > head.length) return { kind, projectId: key.slice(head.length), sizeId: null };
  }
  return null;
}

/** The storage keys that hold one size's quilt, versions and guide progress, and the project's last size. */
export function quiltKeys(projectId: string, sizeId: string): string[] {
  return [designKey(projectId, sizeId), versionsKey(projectId, sizeId), guideKey(projectId, sizeId), sizeKey(projectId)];
}

export function removeGuideFrom(s: Pick<KeyValueStorage, 'removeItem'>, projectId: string, sizeId: string): void {
  s.removeItem(guideKey(projectId, sizeId));
}

export function readLastSizeFrom(s: Reader | null, projectId: string): string | null {
  return readFrom(s, sizeKey(projectId));
}

export function loadLastSize(projectId: string): string | null {
  return readLastSizeFrom(store(), projectId);
}

export function writeLastSizeTo(s: Writer, projectId: string, sizeId: string): void {
  s.setItem(sizeKey(projectId), sizeId);
}

export function saveLastSize(projectId: string, sizeId: string): void {
  write(sizeKey(projectId), sizeId);
}

export function readHintSeenFrom(s: Reader | null): boolean {
  return readFrom(s, HINT_KEY) === '1';
}

export function loadHintSeen(): boolean {
  return readHintSeenFrom(store());
}

export function writeHintSeenTo(s: Writer): void {
  s.setItem(HINT_KEY, '1');
}

export function saveHintSeen(): void {
  write(HINT_KEY, '1');
}

/**
 * Hidden fabrics: fabric ids she does not want picked, one list per project
 * for every size. Without a collection, any list of strings passes. With one,
 * old ids go through `collection.aliases`, unknown ids are dropped, and each
 * id appears once.
 */
export function parseExcluded(v: unknown, collection?: FabricCollection): string[] | null {
  if (!Array.isArray(v)) return null;
  const ids = v.filter((x): x is string => typeof x === 'string');
  if (!collection) return [...new Set(ids)];
  const known = new Set(collection.fabrics.map((f) => f.id));
  const out = new Set<string>();
  for (const raw of ids) {
    const aliases = collection.aliases;
    const id = aliases && Object.hasOwn(aliases, raw) ? (aliases[raw] ?? raw) : raw;
    if (known.has(id)) out.add(id);
  }
  return [...out];
}

/** The stored list, checked against `collection` when one is given. Null when there is none or it does not parse. */
export function readExcludedFrom(s: Reader | null, projectId: string, collection?: FabricCollection): string[] | null {
  const raw = readFrom(s, excludedKey(projectId));
  if (raw === null) return null;
  try {
    return parseExcluded(JSON.parse(raw), collection);
  } catch {
    return null;
  }
}

/** Hidden fabric ids for a project, known to `collection`. Empty when none are stored. */
export function loadExcluded(projectId: string, collection: FabricCollection): string[] {
  return readExcludedFrom(store(), projectId, collection) ?? [];
}

export function writeExcludedTo(s: Writer, projectId: string, ids: readonly string[]): void {
  s.setItem(excludedKey(projectId), JSON.stringify(ids));
}

export function saveExcluded(projectId: string, ids: readonly string[]): boolean {
  return write(excludedKey(projectId), JSON.stringify(ids));
}
