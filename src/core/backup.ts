/**
 * The data file: everything a quilter has saved, as one document that does not
 * depend on how the app stores it. Nothing here touches the DOM. Storage and
 * the list of projects are passed in.
 *
 * Rules for changing the format. Keep them, because old files must open
 * forever:
 * - Adding a field needs no new format number. Readers ignore fields they do
 *   not know, so older apps still read the file.
 * - A breaking change raises `format`, adds one migration to `MIGRATIONS`
 *   (from the old shape to the new one), sets `readableBy` honestly, and adds
 *   a fixture file of the new format under `src/core/fixtures/`.
 * - `readableBy` is the oldest reader that can still read the file safely.
 *   A reader refuses a file only when `readableBy` is higher than its own
 *   `READER_FORMAT`. Additive changes never raise it.
 * - The migration chain is the only place that knows old shapes. The rest of
 *   the code reads the newest shape.
 */
import { isEmptyDesign } from './design';
import { repairDesign, resolveAlias } from './repair';
import {
  isDesignShape,
  parseDataKey,
  parseGuideProgress,
  parseVersion,
  readDesignFrom,
  readGuideFrom,
  readHintSeenFrom,
  readLastSizeFrom,
  readVersionsFrom,
  STORAGE_PREFIX,
  writeDesignTo,
  writeGuideTo,
  writeHintSeenTo,
  writeLastSizeTo,
  writeVersionsTo,
  type GuideProgress,
  type KeyValueStorage,
} from './storage';
import type { Design, DesignVersion, ProjectDef } from './types';

export type { KeyValueStorage } from './storage';

export const BACKUP_APP = 'vibe-quilting';
/** The format this app writes. */
export const BACKUP_FORMAT = 2;
/** The newest `readableBy` this app can read. */
export const READER_FORMAT = 2;
/** Longest backup text, in characters, that `parseBackup` accepts. */
export const MAX_BACKUP_CHARS = 5_000_000;

/** What the app tells the backup code about itself. */
export interface BackupContext {
  projects: readonly ProjectDef[];
  /** Old project id to current project id. */
  projectAliases?: Readonly<Record<string, string>>;
  /** Informational, written to the file. */
  appVersion?: string;
}

/** The file, as this app writes it. Every descriptive field is optional for readers. */
export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  readableBy: number;
  /** ISO 8601 time. */
  exportedAt: string;
  appVersion?: string;
  projects: Record<string, BackupProject>;
  settings: { hintSeen?: boolean };
}

export interface BackupProject {
  title?: string;
  pattern?: { id: string; name: string; pieceIds: string[] };
  collection?: {
    id: string;
    name: string;
    /** Only the fabrics the file uses. */
    fabrics: Record<string, { name: string; sku: string; design: string; colorway: string }>;
  };
  lastSizeId?: string;
  sizes: Record<string, BackupSize>;
}

export interface BackupSize {
  name?: string;
  cols?: number;
  rows?: number;
  design: Design | null;
  guide: GuideProgress | null;
  versions: DesignVersion[];
}

/** What a file holds once it is read and repaired, ready to write to storage. */
export interface ImportData {
  projects: ImportProject[];
  hintSeen: boolean;
}

export interface ImportProject {
  projectId: string;
  lastSizeId: string | null;
  sizes: ImportSize[];
}

export interface ImportSize {
  sizeId: string;
  design: Design | null;
  guide: GuideProgress | null;
  versions: DesignVersion[];
}

/** Things to tell her about a file before she imports it. */
export interface ImportNotes {
  /** Quilts in projects or sizes this app does not have. They are skipped. */
  skippedQuilts: number;
  /** Saved versions in projects or sizes this app does not have. They are skipped. */
  skippedVersions: number;
  /** Quilts and versions with the wrong shape. They are skipped. */
  unreadable: number;
  /** Fabric ids in the file that this app does not have. Their spots are left empty. */
  missingFabrics: number;
  /** Quilts whose blocks did not fit and went back to their starting places. */
  blocksReset: number;
}

/** What a set of stored data holds. */
export interface StorageCounts {
  /** Designs that are not empty. */
  quilts: number;
  /** Saved versions across all sizes, automatic ones included. */
  versions: number;
  /** Size ids that have a quilt, in first-seen order. */
  sizeIds: string[];
  /** Number of `vq:v1:` keys, whatever they hold. */
  entries: number;
}

export interface BackupSummary extends StorageCounts {
  /** Null when the file has no usable date. */
  exportedAt: string | null;
  notes: ImportNotes;
}

export type BackupError = 'too-large' | 'not-json' | 'not-ours' | 'too-new' | 'bad-data';

export type ParseResult =
  | { ok: true; file: ImportData; summary: BackupSummary }
  | { ok: false; reason: BackupError };

export type ApplyResult = { ok: true } | { ok: false; reason: 'storage-full' | 'failed' };

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

// Storage side.

function appKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  return keys;
}

/** Everything stored, read through the loaders, in the file's shape without the descriptive fields. */
function collect(storage: KeyValueStorage): { projects: Record<string, BackupProject>; settings: BackupFile['settings'] } {
  const found = new Map<string, Set<string>>();
  for (const key of appKeys(storage)) {
    const k = parseDataKey(key);
    if (!k) continue;
    const sizes = found.get(k.projectId) ?? new Set<string>();
    if (k.sizeId !== null) sizes.add(k.sizeId);
    found.set(k.projectId, sizes);
  }
  const projects: Record<string, BackupProject> = {};
  for (const [projectId, sizeIds] of found) {
    const sizes: Record<string, BackupSize> = {};
    for (const sizeId of sizeIds) {
      const design = readDesignFrom(storage, projectId, sizeId);
      const guide = readGuideFrom(storage, projectId, sizeId);
      const versions = readVersionsFrom(storage, projectId, sizeId);
      if (design || guide || versions.length > 0) sizes[sizeId] = { design, guide, versions };
    }
    const lastSizeId = readLastSizeFrom(storage, projectId);
    if (Object.keys(sizes).length === 0 && lastSizeId === null) continue;
    projects[projectId] = lastSizeId === null ? { sizes } : { lastSizeId, sizes };
  }
  return { projects, settings: readHintSeenFrom(storage) ? { hintSeen: true } : {} };
}

function usedFabricIds(size: BackupSize): string[] {
  const ids: string[] = [];
  const add = (d: Design | null) => {
    if (!d) return;
    for (const id of d.lineup) if (id !== null) ids.push(id);
    ids.push(...Object.values(d.overrides));
  };
  add(size.design);
  for (const v of size.versions) add(v.design);
  return ids;
}

export function buildBackup(storage: KeyValueStorage, now: Date, ctx: BackupContext): BackupFile {
  const { projects, settings } = collect(storage);
  for (const [id, project] of Object.entries(projects)) {
    const def = ctx.projects.find((p) => p.id === id);
    if (!def) continue;
    project.title = def.title;
    project.pattern = { id: def.pattern.id, name: def.pattern.name, pieceIds: def.pattern.block.pieces.map((p) => p.id) };
    const known = new Map(def.collection.fabrics.map((f) => [f.id, f]));
    const fabrics: NonNullable<BackupProject['collection']>['fabrics'] = {};
    for (const [sizeId, size] of Object.entries(project.sizes)) {
      const def2 = def.pattern.sizes.find((s) => s.id === sizeId);
      if (def2) Object.assign(size, { name: def2.name, cols: def2.cols, rows: def2.rows });
      for (const fid of usedFabricIds(size)) {
        const f = known.get(fid);
        if (f) fabrics[fid] = { name: f.name, sku: f.sku, design: f.design, colorway: f.colorway };
      }
    }
    project.collection = { id: def.collection.id, name: def.collection.name, fabrics };
  }
  const file: BackupFile = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    readableBy: 2,
    exportedAt: now.toISOString(),
    projects,
    settings,
  };
  if (ctx.appVersion) file.appVersion = ctx.appVersion;
  return file;
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

/** "vibe-quilting-2026-03-12.json", using the local date. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `vibe-quilting-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function countQuilts(projects: Iterable<{ sizeId: string; design: Design | null; versions: unknown[] }>): StorageCounts {
  let quilts = 0;
  let versions = 0;
  const sizeIds: string[] = [];
  for (const s of projects) {
    versions += s.versions.length;
    if (s.design && !isEmptyDesign(s.design)) {
      quilts++;
      if (!sizeIds.includes(s.sizeId)) sizeIds.push(s.sizeId);
    }
  }
  return { quilts, versions, sizeIds, entries: 0 };
}

/** What is saved on this device now. */
export function summarizeStorage(storage: KeyValueStorage): StorageCounts {
  const { projects } = collect(storage);
  const sizes = Object.values(projects).flatMap((p) => Object.entries(p.sizes).map(([sizeId, s]) => ({ sizeId, ...s })));
  return { ...countQuilts(sizes), entries: appKeys(storage).length };
}

// Migrations. Each one turns a file of format n into a file of format n + 1.

/** An in-memory storage, so the format 1 migration can use the storage loaders. */
class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** Format 1 was a raw dump of the `vq:v1:` storage keys, in `data`. */
function migrate1to2(f: Raw): Raw | null {
  if (!isRecord(f.data)) return null;
  const mem = new MemoryStorage();
  for (const [k, v] of Object.entries(f.data)) {
    if (typeof v === 'string' && k.startsWith(STORAGE_PREFIX)) mem.setItem(k, v);
  }
  const { projects, settings } = collect(mem);
  return { app: BACKUP_APP, format: 2, readableBy: 2, exportedAt: f.exportedAt, projects, settings };
}

const MIGRATIONS: Record<number, (f: Raw) => Raw | null> = { 1: migrate1to2 };

/** Bring a file of any accepted format up to the newest shape. Null when it cannot be done. */
function migrate(raw: Raw, from: number): Raw | null {
  let file: Raw | null = raw;
  for (let v = from; v < BACKUP_FORMAT && file; v++) {
    const step = MIGRATIONS[v];
    file = step ? step(file) : null;
  }
  return file && isRecord(file.projects) ? file : null;
}

// Reading the newest shape.

const intAtLeast1 = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

/**
 * Read a file of the newest shape against the projects this app has. Anything
 * unknown is skipped and counted, never an error.
 */
function readFile(file: Raw, ctx: BackupContext): { data: ImportData; notes: ImportNotes } {
  const notes: ImportNotes = { skippedQuilts: 0, skippedVersions: 0, unreadable: 0, missingFabrics: 0, blocksReset: 0 };
  const missing = new Set<string>();
  const projects = new Map<string, ImportProject>();

  const countSkipped = (size: unknown) => {
    if (!isRecord(size)) return;
    if (isDesignShape(size.design) && !isEmptyDesign(size.design)) notes.skippedQuilts++;
    if (Array.isArray(size.versions)) notes.skippedVersions += size.versions.filter((v) => parseVersion(v, '') !== null).length;
  };

  const repair = (def: ProjectDef, design: Design): Design | null => {
    const r = repairDesign(def.pattern, def.collection, design);
    if (!r) return null;
    for (const n of r.notes) {
      if (n.kind === 'fabric-missing') n.ids.forEach((id) => missing.add(id));
      if (n.kind === 'blocks-reset') notes.blocksReset++;
    }
    return r.design;
  };

  for (const [rawId, p] of Object.entries(file.projects as Raw)) {
    if (!isRecord(p)) continue;
    const id = resolveAlias(ctx.projectAliases, rawId);
    const def = ctx.projects.find((x) => x.id === id);
    const rawSizes = isRecord(p.sizes) ? Object.entries(p.sizes) : [];
    if (!def) {
      for (const [, s] of rawSizes) countSkipped(s);
      continue;
    }
    const sizes = new Map<string, ImportSize>();
    for (const [rawSizeId, s] of rawSizes) {
      const sizeId = resolveAlias(def.pattern.aliases?.sizes, rawSizeId);
      if (!isRecord(s)) continue;
      if (!def.pattern.sizes.some((x) => x.id === sizeId)) {
        countSkipped(s);
        continue;
      }
      let design: Design | null = null;
      if (s.design !== null && s.design !== undefined) {
        if (isDesignShape(s.design)) {
          design = repair(def, { ...s.design, sizeId });
          if (!design) notes.unreadable++;
        } else {
          notes.unreadable++;
        }
      }
      const versions: DesignVersion[] = [];
      if (Array.isArray(s.versions)) {
        for (const item of s.versions) {
          const v = parseVersion(item, sizeId);
          const d = v ? repair(def, v.design) : null;
          if (v && d) versions.push({ ...v, design: d });
          else notes.unreadable++;
        }
      }
      sizes.set(sizeId, { sizeId, design, guide: parseGuideProgress(s.guide), versions });
    }
    const last = typeof p.lastSizeId === 'string' ? resolveAlias(def.pattern.aliases?.sizes, p.lastSizeId) : null;
    projects.set(def.id, {
      projectId: def.id,
      lastSizeId: last !== null && def.pattern.sizes.some((x) => x.id === last) ? last : null,
      sizes: [...sizes.values()],
    });
  }
  notes.missingFabrics = missing.size;
  const settings = isRecord(file.settings) ? file.settings : {};
  return { data: { projects: [...projects.values()], hintSeen: settings.hintSeen === true }, notes };
}

/** Check backup text, repair what it holds against this app, and count it. Never throws. */
export function parseBackup(text: string, ctx: BackupContext): ParseResult {
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, reason: 'too-large' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isRecord(json) || json.app !== BACKUP_APP) return { ok: false, reason: 'not-ours' };
  const format = intAtLeast1(json.format) ? json.format : isRecord(json.projects) ? 2 : 1;
  const readableBy = intAtLeast1(json.readableBy) ? json.readableBy : format;
  if (readableBy > READER_FORMAT) return { ok: false, reason: 'too-new' };
  // A file newer than this app but readable by it has the shape of the newest format this app knows.
  const file = migrate(json, Math.min(format, BACKUP_FORMAT));
  if (!file) return { ok: false, reason: 'bad-data' };
  try {
    const { data, notes } = readFile(file, ctx);
    const sizes = data.projects.flatMap((p) => p.sizes);
    const counts = countQuilts(sizes);
    const exportedAt =
      typeof file.exportedAt === 'string' && !Number.isNaN(Date.parse(file.exportedAt)) ? file.exportedAt : null;
    return { ok: true, file: data, summary: { ...counts, entries: 0, exportedAt, notes } };
  } catch {
    return { ok: false, reason: 'bad-data' };
  }
}

function isQuota(err: unknown): boolean {
  return err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

/**
 * Replace every saved key with what the file holds, written through the
 * storage writers. If anything fails part way, the previous keys and values
 * are put back.
 */
export function applyBackup(storage: KeyValueStorage, data: ImportData): ApplyResult {
  const before: Record<string, string> = {};
  for (const k of appKeys(storage)) {
    const v = storage.getItem(k);
    if (v !== null) before[k] = v;
  }
  try {
    for (const k of appKeys(storage)) storage.removeItem(k);
    for (const p of data.projects) {
      if (p.lastSizeId !== null) writeLastSizeTo(storage, p.projectId, p.lastSizeId);
      for (const s of p.sizes) {
        if (s.design) writeDesignTo(storage, p.projectId, s.design);
        if (s.guide) writeGuideTo(storage, p.projectId, s.sizeId, s.guide);
        if (s.versions.length > 0) writeVersionsTo(storage, p.projectId, s.sizeId, s.versions);
      }
    }
    if (data.hintSeen) writeHintSeenTo(storage);
    return { ok: true };
  } catch (err) {
    try {
      for (const k of appKeys(storage)) storage.removeItem(k);
      for (const [k, v] of Object.entries(before)) storage.setItem(k, v);
    } catch {
      return { ok: false, reason: 'failed' };
    }
    return { ok: false, reason: isQuota(err) ? 'storage-full' : 'failed' };
  }
}

/** Remove every saved key of the app. Keys of other apps stay. */
export function clearAllData(storage: KeyValueStorage): void {
  for (const k of appKeys(storage)) storage.removeItem(k);
}
