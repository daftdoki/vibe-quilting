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
 *
 * Scope. `scope` says what a file is for. Missing or exactly "all" means a
 * full export that replaces everything on the device. "quilt" means one size
 * of one project, which is opened without touching anything else. Any other
 * value, from a newer app, is read as a quilt-style file and never as a full
 * replace, so a reader that does not understand a scope cannot wipe the
 * device. `applyBackup` refuses data that is not scope "all" for the same
 * reason.
 */
import { isEmptyDesign } from './design';
import { addVersion, designsEqual, mergeVersions } from './versions';
import { repairDesign, resolveAlias } from './repair';
import {
  isDesignShape,
  normalizeQuiltName,
  parseDataKey,
  parseExcluded,
  parseGuideProgress,
  parseVersion,
  quiltKeys,
  removeGuideFrom,
  readDesignFrom,
  readExcludedFrom,
  readGuideFrom,
  readCurrentProjectFrom,
  readHintSeenFrom,
  readLastSizeFrom,
  readQuiltNameFrom,
  readVersionsFrom,
  CURRENT_PROJECT_KEY,
  STORAGE_PREFIX,
  writeDesignTo,
  writeExcludedTo,
  writeGuideTo,
  writeCurrentProjectTo,
  writeHintSeenTo,
  writeLastSizeTo,
  writeQuiltNameTo,
  writeVersionsTo,
  type GuideProgress,
  type KeyValueStorage,
} from './storage';
import { quiltFileBase } from './fileName';
import type { Design, DesignVersion, ProjectDef } from './types';

export type { KeyValueStorage } from './storage';

export const BACKUP_APP = 'vibe-quilting';
/** The format this app writes. */
export const BACKUP_FORMAT = 2;
/** The newest `readableBy` this app can read. */
export const READER_FORMAT = 2;
/** Reason and name of the automatic version saved when a quilt file replaces a quilt. */
export const OPEN_FILE_REASON = 'Before opening a file';
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
  /** "quilt" for a single-quilt file. Missing means "all". */
  scope?: 'all' | 'quilt';
  /** ISO 8601 time. */
  exportedAt: string;
  appVersion?: string;
  projects: Record<string, BackupProject>;
  /** Not written in a quilt file. */
  /** `currentProject` is the id of the open fabric set. Added without a format change. */
  settings?: { hintSeen?: boolean; currentProject?: string };
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
  /** Fabric ids she hid. Not written in a quilt file. */
  excludedFabrics?: string[];
  sizes: Record<string, BackupSize>;
}

export interface BackupSize {
  name?: string;
  cols?: number;
  rows?: number;
  design: Design | null;
  guide: GuideProgress | null;
  versions: DesignVersion[];
  /** The name she gave this quilt. Missing when it has none. Added without a format change. */
  quiltName?: string;
}

/** What a file holds once it is read and repaired, ready to write to storage. */
export interface ImportData {
  /** "all" replaces everything. "quilt" holds exactly one project with one size. */
  scope: 'all' | 'quilt';
  projects: ImportProject[];
  hintSeen: boolean;
  /** The open fabric set, when the file names one this app has. Only for scope "all". */
  currentProjectId?: string;
}

export interface ImportProject {
  projectId: string;
  lastSizeId: string | null;
  /** Hidden fabric ids this app knows. Missing in a quilt file, which never changes them. */
  excludedFabrics?: string[];
  sizes: ImportSize[];
}

export interface ImportSize {
  sizeId: string;
  design: Design | null;
  guide: GuideProgress | null;
  versions: DesignVersion[];
  /** Normalized and never blank. Missing when the file has no name for this quilt. */
  quiltName?: string;
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
  scope: 'all' | 'quilt';
  /** The quilt a scope "quilt" file holds. */
  quilt: { projectId: string; sizeId: string; sizeName: string; quiltName?: string } | null;
  /** Null when the file has no usable date. */
  exportedAt: string | null;
  notes: ImportNotes;
}

export type BackupError =
  | 'too-large'
  | 'not-json'
  | 'not-ours'
  | 'too-new'
  | 'bad-data'
  /** A quilt file for a pattern or size this app does not have. */
  | 'quilt-unknown'
  /** A quilt file with no design that can be opened. */
  | 'quilt-unreadable';

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
      const quiltName = readQuiltNameFrom(storage, projectId, sizeId);
      // A size that has only a name is kept, so the name is not lost.
      if (design || guide || versions.length > 0 || quiltName) {
        const size: BackupSize = { design, guide, versions };
        if (quiltName) size.quiltName = quiltName;
        sizes[sizeId] = size;
      }
    }
    const lastSizeId = readLastSizeFrom(storage, projectId);
    const excluded = readExcludedFrom(storage, projectId);
    const hasExcluded = excluded !== null && excluded.length > 0;
    if (Object.keys(sizes).length === 0 && lastSizeId === null && !hasExcluded) continue;
    const project: BackupProject = lastSizeId === null ? { sizes } : { lastSizeId, sizes };
    if (hasExcluded) project.excludedFabrics = excluded;
    projects[projectId] = project;
  }
  const settings: NonNullable<BackupFile['settings']> = readHintSeenFrom(storage) ? { hintSeen: true } : {};
  const current = readCurrentProjectFrom(storage);
  if (current !== null) settings.currentProject = current;
  return { projects, settings };
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

/** Add the descriptive fields for projects and sizes this app knows. */
function describe(projects: Record<string, BackupProject>, ctx: BackupContext): void {
  for (const [id, project] of Object.entries(projects)) {
    const def = ctx.projects.find((p) => p.id === id);
    if (!def) continue;
    project.title = def.title;
    project.pattern = { id: def.pattern.id, name: def.pattern.name, pieceIds: def.pattern.block.pieces.map((p) => p.id) };
    const known = new Map(def.collection.fabrics.map((f) => [f.id, f]));
    const fabrics: NonNullable<BackupProject['collection']>['fabrics'] = {};
    for (const [sizeId, size] of Object.entries(project.sizes)) {
      const sizeDef = def.pattern.sizes.find((s) => s.id === sizeId);
      if (sizeDef) Object.assign(size, { name: sizeDef.name, cols: sizeDef.cols, rows: sizeDef.rows });
      for (const fid of usedFabricIds(size)) {
        const f = known.get(fid);
        if (f) fabrics[fid] = { name: f.name, sku: f.sku, design: f.design, colorway: f.colorway };
      }
    }
    project.collection = { id: def.collection.id, name: def.collection.name, fabrics };
  }
}

function header(now: Date, ctx: BackupContext): Pick<BackupFile, 'app' | 'format' | 'readableBy' | 'exportedAt' | 'appVersion'> {
  const h: ReturnType<typeof header> = { app: BACKUP_APP, format: BACKUP_FORMAT, readableBy: 2, exportedAt: now.toISOString() };
  if (ctx.appVersion) h.appVersion = ctx.appVersion;
  return h;
}

export function buildBackup(storage: KeyValueStorage, now: Date, ctx: BackupContext): BackupFile {
  const { projects, settings } = collect(storage);
  describe(projects, ctx);
  // A set this app does not know would only be ignored on import.
  if (settings?.currentProject !== undefined) {
    const id = resolveAlias(ctx.projectAliases, settings.currentProject);
    if (ctx.projects.some((p) => p.id === id)) settings.currentProject = id;
    else delete settings.currentProject;
  }
  return { ...header(now, ctx), projects, settings };
}

/**
 * A file for one size of one project: its design, all its saved versions and
 * its guide progress. Pass `design` to use the live design instead of the
 * stored one. A design that was only loaded is not written back to storage
 * until she edits it, so the stored copy can be missing or older.
 */
export function buildQuiltBackup(
  storage: KeyValueStorage,
  now: Date,
  ctx: BackupContext,
  projectId: string,
  sizeId: string,
  design?: Design,
): BackupFile {
  const size: BackupSize = {
    design: design ?? readDesignFrom(storage, projectId, sizeId),
    guide: readGuideFrom(storage, projectId, sizeId),
    versions: readVersionsFrom(storage, projectId, sizeId),
  };
  const quiltName = readQuiltNameFrom(storage, projectId, sizeId);
  if (quiltName) size.quiltName = quiltName;
  const projects = { [projectId]: { sizes: { [sizeId]: size } } };
  describe(projects, ctx);
  return { ...header(now, ctx), scope: 'quilt', projects };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

/** "vibe-quilting-2026-03-12.json", using the local date. */
export function backupFileName(now: Date): string {
  return `vibe-quilting-${localDate(now)}.json`;
}

/**
 * "Ginger's Quilt 2026-03-12.json" for a named quilt, else
 * "vibe-quilting-throw-2026-03-12.json". Uses the local date.
 */
export function quiltFileName(sizeId: string, now: Date, quiltName = ''): string {
  const base = quiltFileBase(quiltName);
  return base === null ? `vibe-quilting-${sizeId}-${localDate(now)}.json` : `${base} ${localDate(now)}.json`;
}

function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
      const size: ImportSize = { sizeId, design, guide: parseGuideProgress(s.guide), versions };
      // A name of the wrong type, or a blank one, is ignored.
      const quiltName = normalizeQuiltName(s.quiltName);
      if (quiltName) size.quiltName = quiltName;
      sizes.set(sizeId, size);
    }
    const last = typeof p.lastSizeId === 'string' ? resolveAlias(def.pattern.aliases?.sizes, p.lastSizeId) : null;
    projects.set(def.id, {
      projectId: def.id,
      lastSizeId: last !== null && def.pattern.sizes.some((x) => x.id === last) ? last : null,
      // A list of the wrong type is ignored. Unknown ids are dropped.
      excludedFabrics: parseExcluded(p.excludedFabrics, def.collection) ?? [],
      sizes: [...sizes.values()],
    });
  }
  notes.missingFabrics = missing.size;
  const settings = isRecord(file.settings) ? file.settings : {};
  const data: ImportData = { scope: 'all', projects: [...projects.values()], hintSeen: settings.hintSeen === true };
  // An id this app does not have is ignored, so the app opens on its first project.
  if (typeof settings.currentProject === 'string') {
    const id = resolveAlias(ctx.projectAliases, settings.currentProject);
    if (ctx.projects.some((p) => p.id === id)) data.currentProjectId = id;
  }
  return { data, notes };
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
    const read = readFile(file, ctx);
    const { notes } = read;
    let data = read.data;
    const exportedAt =
      typeof file.exportedAt === 'string' && !Number.isNaN(Date.parse(file.exportedAt)) ? file.exportedAt : null;
    // Only a missing scope or exactly "all" replaces everything. Any other value is read as a single quilt.
    if (json.scope !== undefined && json.scope !== 'all') {
      const found = data.projects.flatMap((p) => p.sizes.filter((s) => s.design).map((s) => ({ p, s })));
      const [one] = found;
      if (found.length !== 1 || !one) {
        const unknown = found.length === 0 && notes.skippedQuilts + notes.skippedVersions > 0;
        return { ok: false, reason: unknown ? 'quilt-unknown' : 'quilt-unreadable' };
      }
      const sizeName = ctx.projects.find((x) => x.id === one.p.projectId)?.pattern.sizes.find((z) => z.id === one.s.sizeId)?.name;
      data = {
        scope: 'quilt',
        projects: [{ projectId: one.p.projectId, lastSizeId: one.s.sizeId, sizes: [one.s] }],
        hintSeen: false,
      };
      const quilt: NonNullable<BackupSummary['quilt']> = {
        projectId: one.p.projectId,
        sizeId: one.s.sizeId,
        sizeName: sizeName ?? one.s.sizeId,
      };
      if (one.s.quiltName) quilt.quiltName = one.s.quiltName;
      return {
        ok: true,
        file: data,
        summary: { ...countQuilts([one.s]), entries: 0, exportedAt, notes, scope: 'quilt', quilt },
      };
    }
    const counts = countQuilts(data.projects.flatMap((p) => p.sizes));
    return { ok: true, file: data, summary: { ...counts, entries: 0, exportedAt, notes, scope: 'all', quilt: null } };
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
  // A quilt file must never replace everything.
  if (data.scope !== 'all') return { ok: false, reason: 'failed' };
  const before: Record<string, string> = {};
  for (const k of appKeys(storage)) {
    const v = storage.getItem(k);
    if (v !== null) before[k] = v;
  }
  try {
    for (const k of appKeys(storage)) storage.removeItem(k);
    for (const p of data.projects) {
      if (p.lastSizeId !== null) writeLastSizeTo(storage, p.projectId, p.lastSizeId);
      if (p.excludedFabrics && p.excludedFabrics.length > 0) writeExcludedTo(storage, p.projectId, p.excludedFabrics);
      for (const s of p.sizes) {
        if (s.design) writeDesignTo(storage, p.projectId, s.design);
        if (s.guide) writeGuideTo(storage, p.projectId, s.sizeId, s.guide);
        if (s.versions.length > 0) writeVersionsTo(storage, p.projectId, s.sizeId, s.versions);
        // Every key was removed above, so sizes without a name in the file end up unnamed.
        if (s.quiltName) writeQuiltNameTo(storage, p.projectId, s.sizeId, s.quiltName);
      }
    }
    if (data.hintSeen) writeHintSeenTo(storage);
    if (data.currentProjectId) writeCurrentProjectTo(storage, data.currentProjectId);
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

/**
 * Open a quilt file without touching other sizes or settings, except that the
 * quilt's fabric set becomes the open one. The device's
 * current quilt for that size is kept as an automatic version (by the usual
 * `addVersion` rules), the incoming design is written, and the file's versions
 * are merged into the size's list. A name in the file replaces the size's name,
 * and a file without one keeps it. If anything fails, the keys it touched go
 * back to what they were.
 */
export function applyQuiltBackup(
  storage: KeyValueStorage,
  data: ImportData,
  opts: { now: number; versionId: string },
): ApplyResult {
  const project = data.projects[0];
  const size = project?.sizes[0];
  if (data.scope !== 'quilt' || !project || !size?.design || data.projects.length !== 1 || project.sizes.length !== 1) {
    return { ok: false, reason: 'failed' };
  }
  const { projectId } = project;
  const { sizeId, design } = size;
  const keys = [...quiltKeys(projectId, sizeId), CURRENT_PROJECT_KEY];
  const before = new Map(keys.map((k) => [k, storage.getItem(k)]));
  try {
    let list = readVersionsFrom(storage, projectId, sizeId);
    const current = readDesignFrom(storage, projectId, sizeId);
    if (current && !designsEqual(current, design)) {
      list = addVersion(list, {
        id: opts.versionId,
        sizeId,
        name: OPEN_FILE_REASON,
        createdAt: opts.now,
        auto: true,
        reason: OPEN_FILE_REASON,
        design: current,
      });
    }
    list = mergeVersions(list, size.versions);
    writeDesignTo(storage, projectId, design);
    if (list.length > 0) writeVersionsTo(storage, projectId, sizeId, list);
    const complete = design.lineup.every((id) => id !== null);
    if (complete) writeGuideTo(storage, projectId, sizeId, 'done');
    else if (size.guide) writeGuideTo(storage, projectId, sizeId, size.guide);
    else removeGuideFrom(storage, projectId, sizeId);
    // A file without a name leaves the name on this device alone.
    if (size.quiltName) writeQuiltNameTo(storage, projectId, sizeId, size.quiltName);
    writeLastSizeTo(storage, projectId, sizeId);
    // The app opens on the quilt's own fabric set.
    writeCurrentProjectTo(storage, projectId);
    return { ok: true };
  } catch (err) {
    try {
      for (const [k, v] of before) {
        if (v === null) storage.removeItem(k);
        else storage.setItem(k, v);
      }
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
