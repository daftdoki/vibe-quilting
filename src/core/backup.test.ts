import { describe, expect, it } from 'vitest';
import { stacks } from '../patterns/stacks';
import {
  applyBackup,
  BACKUP_FORMAT,
  backupFileName,
  buildBackup,
  clearAllData,
  MAX_BACKUP_CHARS,
  parseBackup,
  serializeBackup,
  summarizeStorage,
  type BackupContext,
  type KeyValueStorage,
} from './backup';
import { createDesign, createEmptyDesign, setLineupSlot } from './design';
import v1 from './fixtures/backup-v1.json';
import v2 from './fixtures/backup-v2.json';
import { readDesignFrom, readGuideFrom, readHintSeenFrom, readLastSizeFrom, readVersionsFrom } from './storage';
import { makeCollection } from './test-fixtures';
import type { DesignVersion, ProjectDef } from './types';

const collection = makeCollection();
const project: ProjectDef = { id: 'p', title: 'Test project', pattern: stacks, collection };
const ctx: BackupContext = { projects: [project], appVersion: '0.1.0' };
const NOW = new Date(2026, 2, 12, 15, 40);

class FakeStorage implements KeyValueStorage {
  map = new Map<string, string>();
  /** Throw on the nth setItem call from now (1 is the next), or never. */
  failOnSet: number | null = null;
  failName = 'QuotaExceededError';
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
    if (this.failOnSet !== null && --this.failOnSet === 0) {
      const e = new Error('full');
      e.name = this.failName;
      throw e;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

function version(sizeId: string, n: number): DesignVersion {
  return { id: `v${n}`, sizeId, name: `Version ${n}`, createdAt: n, auto: false, design: createDesign(stacks, collection, sizeId) };
}

function filled(): FakeStorage {
  const s = new FakeStorage();
  s.setItem('vq:v1:design:p:throw', JSON.stringify(createDesign(stacks, collection, 'throw')));
  s.setItem('vq:v1:design:p:crib', JSON.stringify(createDesign(stacks, collection, 'crib')));
  s.setItem('vq:v1:versions:p:throw', JSON.stringify([version('throw', 1), version('throw', 2)]));
  s.setItem('vq:v1:guide:p:throw', JSON.stringify({ step: 'shuffle', block: 0 }));
  s.setItem('vq:v1:size:p', 'crib');
  s.setItem('vq:v1:hint-seen', '1');
  s.setItem('other-app:thing', 'keep me');
  return s;
}

const appEntries = (s: FakeStorage) => Object.fromEntries([...s.map].filter(([k]) => k.startsWith('vq:v1:')));

/** Everything the app can see through its loaders for the test project. */
function seen(s: FakeStorage) {
  return {
    sizes: stacks.sizes.map((z) => ({
      id: z.id,
      design: readDesignFrom(s, 'p', z.id),
      guide: readGuideFrom(s, 'p', z.id),
      versions: readVersionsFrom(s, 'p', z.id),
    })),
    last: readLastSizeFrom(s, 'p'),
    hint: readHintSeenFrom(s),
  };
}

function ok(text: string, c: BackupContext = ctx) {
  const r = parseBackup(text, c);
  if (!r.ok) throw new Error(`parse failed: ${r.reason}`);
  return r;
}

function applyText(text: string, c: BackupContext = ctx) {
  const dest = new FakeStorage();
  const r = ok(text, c);
  expect(applyBackup(dest, r.file)).toEqual({ ok: true });
  return { dest, summary: r.summary };
}

describe('writer', () => {
  it('writes format 2 with descriptive fields for the fabrics it uses', () => {
    const b = buildBackup(filled(), NOW, ctx);
    expect(b).toMatchObject({ app: 'vibe-quilting', format: 2, readableBy: 2, appVersion: '0.1.0', settings: { hintSeen: true } });
    expect(b.exportedAt).toBe(NOW.toISOString());
    const p = b.projects.p!;
    expect(p.lastSizeId).toBe('crib');
    expect(p.title).toBe('Test project');
    expect(p.pattern?.id).toBe('stacks');
    expect(p.sizes.throw).toMatchObject({ name: 'Throw', cols: 4, rows: 4 });
    expect(p.sizes.throw?.versions).toHaveLength(2);
    expect(p.sizes.throw?.guide).toEqual({ step: 'shuffle', block: 0 });
    expect(p.collection?.fabrics['d0-c0']).toMatchObject({ sku: 'd0-c0' });
    expect(JSON.stringify(b)).not.toContain('other-app');
  });

  it('keeps data for projects and sizes this app does not know', () => {
    const s = new FakeStorage();
    s.setItem('vq:v1:design:old:huge', JSON.stringify({ ...createDesign(stacks, collection, 'throw'), sizeId: 'huge' }));
    const b = buildBackup(s, NOW, ctx);
    expect(b.projects.old?.sizes.huge?.design?.sizeId).toBe('huge');
  });
});

describe('round trip', () => {
  it('build, serialize, parse and apply gives the same data through the loaders', () => {
    const src = filled();
    const { dest } = applyText(serializeBackup(buildBackup(src, NOW, ctx)));
    expect(seen(dest)).toEqual(seen(src));
    expect(dest.getItem('vq:v1:size:p')).toBe('crib');
  });

  it('survives an empty device', () => {
    const { dest, summary } = applyText(serializeBackup(buildBackup(new FakeStorage(), NOW, ctx)));
    expect(dest.length).toBe(0);
    expect(summary).toMatchObject({ quilts: 0, versions: 0 });
  });
});

describe('golden fixtures. Never edit or delete a fixture, only add new ones. Every format must keep importing.', () => {
  it('imports format 1, the raw key dump', () => {
    const { dest, summary } = applyText(JSON.stringify(v1));
    const x = seen(dest);
    expect(summary).toMatchObject({ quilts: 2, versions: 2, exportedAt: '2026-03-12T15:40:00.000Z' });
    expect(summary.sizeIds.sort()).toEqual(['crib', 'throw']);
    expect(x.last).toBe('throw');
    expect(x.hint).toBe(true);
    expect(x.sizes.find((z) => z.id === 'crib')?.design?.overrides).toEqual({ '2:B': 'd3-c1' });
    expect(x.sizes.find((z) => z.id === 'crib')?.guide).toBe('done');
    const t = x.sizes.find((z) => z.id === 'throw')!;
    expect(t.design?.lineup[0]).toBe('d0-c0');
    expect(t.design?.lineup[4]).toBe('d1-c2');
    expect(t.guide).toEqual({ step: 'fabrics', block: 0 });
    expect(t.versions.map((v) => v.id)).toEqual(['v2', 'v1']);
    expect(t.versions[0]).toMatchObject({ auto: true, reason: 'Before shuffle', sizeId: 'throw' });
  });

  it('imports format 2', () => {
    const { dest, summary } = applyText(JSON.stringify(v2));
    const x = seen(dest);
    expect(summary).toMatchObject({ quilts: 2, versions: 2, exportedAt: '2026-11-21T10:00:00.000Z' });
    expect(summary.notes).toEqual({ skippedQuilts: 0, skippedVersions: 0, unreadable: 0, missingFabrics: 0, blocksReset: 0 });
    expect(x.last).toBe('throw');
    expect(x.hint).toBe(true);
    expect(x.sizes.find((z) => z.id === 'throw')?.guide).toEqual({ step: 'fabrics', block: 0 });
    expect(x.sizes.find((z) => z.id === 'throw')?.versions).toHaveLength(2);
    expect(x.sizes.find((z) => z.id === 'crib')?.design?.overrides).toEqual({ '2:B': 'd3-c1' });
  });

  it('format 1 and format 2 fixtures hold the same data', () => {
    expect(seen(applyText(JSON.stringify(v1)).dest)).toEqual(seen(applyText(JSON.stringify(v2)).dest));
  });
});

describe('a file from the future', () => {
  const design = createDesign(stacks, collection, 'crib');
  const future = {
    app: 'vibe-quilting',
    format: 9,
    readableBy: 2,
    exportedAt: '2030-01-01T00:00:00.000Z',
    somethingNew: { a: 1 },
    projects: {
      p: {
        newField: true,
        lastSizeId: 'crib',
        sizes: {
          crib: {
            colorTheme: 'blue',
            design: { ...design, paperSize: 'A4', cells: design.cells },
            guide: { step: 'polish', block: 0 },
            versions: [{ id: 'v1', sizeId: 'crib', name: 'Mine', createdAt: 5, auto: false, tags: ['x'], design }],
          },
          giant: { design: { ...design, sizeId: 'giant' }, guide: 'done', versions: [{ id: 'g', sizeId: 'giant', name: 'G', createdAt: 1, auto: false, design: { ...design, sizeId: 'giant' } }] },
        },
      },
      newPattern: { sizes: { big: { design: { ...design, sizeId: 'big' }, versions: [] } } },
    },
    settings: { hintSeen: true, theme: 'dark' },
  };

  it('imports what it understands and reports the skips', () => {
    const { dest, summary } = applyText(JSON.stringify(future));
    expect(summary).toMatchObject({ quilts: 1, versions: 1 });
    expect(summary.notes).toMatchObject({ skippedQuilts: 2, skippedVersions: 1, unreadable: 0 });
    const x = seen(dest);
    expect(x.sizes.find((z) => z.id === 'crib')?.design).toEqual(design);
    expect(x.sizes.find((z) => z.id === 'crib')?.guide).toBeNull();
    expect(x.sizes.find((z) => z.id === 'crib')?.versions[0]).toEqual({ id: 'v1', sizeId: 'crib', name: 'Mine', createdAt: 5, auto: false, design });
    expect(x.last).toBe('crib');
    expect(x.hint).toBe(true);
  });

  it('refuses a file whose readableBy is too new', () => {
    const r = parseBackup(JSON.stringify({ ...future, format: 10, readableBy: 3 }), ctx);
    expect(r).toEqual({ ok: false, reason: 'too-new' });
  });
});

describe('tolerant reading', () => {
  const design = createDesign(stacks, collection, 'crib');
  const file = (projects: unknown, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ app: 'vibe-quilting', format: 2, readableBy: 2, exportedAt: NOW.toISOString(), projects, ...extra });

  it('imports the other designs when one is malformed', () => {
    const { dest, summary } = applyText(
      file({
        p: {
          sizes: {
            crib: { design, guide: null, versions: [] },
            throw: { design: { sizeId: 'throw', lineup: 'nope' }, guide: null, versions: [] },
          },
        },
      }),
    );
    expect(summary).toMatchObject({ quilts: 1 });
    expect(summary.notes.unreadable).toBe(1);
    expect(readDesignFrom(dest, 'p', 'crib')).toEqual(design);
    expect(readDesignFrom(dest, 'p', 'throw')).toBeNull();
  });

  it('drops one bad version and one bad guide, not the file', () => {
    const good = { id: 'a', sizeId: 'crib', name: 'A', createdAt: 1, auto: false, design };
    const { dest, summary } = applyText(
      file({ p: { sizes: { crib: { design, guide: 7, versions: [good, { ...good, id: 5 }, 'x'] } } } }),
    );
    expect(summary.versions).toBe(1);
    expect(summary.notes.unreadable).toBe(2);
    expect(readGuideFrom(dest, 'p', 'crib')).toBeNull();
  });

  it('ignores a project that is not an object and a missing size list', () => {
    expect(ok(file({ p: 5, q: {} })).summary).toMatchObject({ quilts: 0, versions: 0 });
  });

  it('reports missing fabrics and reset blocks, and still imports', () => {
    const odd = { ...setLineupSlot(design, 0, 'gone'), cells: design.cells.slice(1) };
    const r = ok(file({ p: { sizes: { crib: { design: odd, versions: [] } } } }));
    expect(r.summary.notes).toMatchObject({ missingFabrics: 1, blocksReset: 1 });
    const crib = r.file.projects[0]?.sizes[0]?.design;
    expect(crib?.lineup[0]).toBeNull();
    expect(crib?.cells).toEqual(design.cells);
  });

  it('reads a file with no exportedAt', () => {
    const r = ok(JSON.stringify({ app: 'vibe-quilting', format: 2, projects: {} }));
    expect(r.summary.exportedAt).toBeNull();
  });
});

describe('aliases', () => {
  const design = createDesign(stacks, collection, 'crib');
  const file = (projectId: string, d: unknown, last: string) =>
    JSON.stringify({ app: 'vibe-quilting', format: 2, readableBy: 2, exportedAt: NOW.toISOString(), projects: { [projectId]: { lastSizeId: last, sizes: { [(d as { sizeId: string }).sizeId]: { design: d, versions: [] } } } } });

  it('reads an old project id, size id and fabric id', () => {
    const renamed: ProjectDef = {
      ...project,
      pattern: { ...stacks, sizes: stacks.sizes.map((s) => (s.id === 'crib' ? { ...s, id: 'baby' } : s)), aliases: { sizes: { crib: 'baby' } } },
      collection: { ...collection, fabrics: collection.fabrics.map((f) => (f.id === 'd0-c0' ? { ...f, id: 'new-0' } : f)), aliases: { 'd0-c0': 'new-0' } },
    };
    const c: BackupContext = { projects: [renamed], projectAliases: { 'old-p': 'p' } };
    const r = ok(file('old-p', design, 'crib'), c);
    const p = r.file.projects[0];
    expect(p?.projectId).toBe('p');
    expect(p?.lastSizeId).toBe('baby');
    expect(p?.sizes[0]?.sizeId).toBe('baby');
    expect(p?.sizes[0]?.design?.sizeId).toBe('baby');
    expect(p?.sizes[0]?.design?.lineup[0]).toBe('new-0');
    expect(r.summary.notes.missingFabrics).toBe(0);
  });
});

describe('applyBackup', () => {
  it('replaces and removes keys that are not in the file', () => {
    const dest = new FakeStorage();
    dest.setItem('vq:v1:size:p', 'throw');
    dest.setItem('vq:v1:guide:p:throw', '"done"');
    dest.setItem('vq:v1:junk', 'x');
    dest.setItem('other-app:thing', 'x');
    const r = ok(JSON.stringify({ app: 'vibe-quilting', format: 2, readableBy: 2, projects: { p: { lastSizeId: 'crib', sizes: {} } } }));
    expect(applyBackup(dest, r.file)).toEqual({ ok: true });
    expect(appEntries(dest)).toEqual({ 'vq:v1:size:p': 'crib' });
    expect(dest.getItem('other-app:thing')).toBe('x');
  });

  it('puts the old data back when a write fails part way', () => {
    const dest = filled();
    const before = new Map(dest.map);
    const r = ok(serializeBackup(buildBackup(filled(), NOW, ctx)));
    dest.failOnSet = 3;
    expect(applyBackup(dest, r.file)).toEqual({ ok: false, reason: 'storage-full' });
    expect(dest.map).toEqual(before);
  });

  it('reports other write errors as failed', () => {
    const dest = filled();
    const before = new Map(dest.map);
    const r = ok(serializeBackup(buildBackup(filled(), NOW, ctx)));
    dest.failOnSet = 1;
    dest.failName = 'SecurityError';
    expect(applyBackup(dest, r.file)).toEqual({ ok: false, reason: 'failed' });
    expect(dest.map).toEqual(before);
  });
});

describe('parseBackup rejections', () => {
  const reason = (text: string) => {
    const r = parseBackup(text, ctx);
    return r.ok ? 'ok' : r.reason;
  };
  const file = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ app: 'vibe-quilting', format: 2, readableBy: 2, exportedAt: NOW.toISOString(), projects: {}, ...over });
  it('rejects text that is not JSON', () => expect(reason('not json {')).toBe('not-json'));
  it('rejects JSON that is not an object', () => expect(reason('[1]')).toBe('not-ours'));
  it('rejects a missing or wrong app marker', () => {
    expect(reason(file({ app: undefined }))).toBe('not-ours');
    expect(reason(file({ app: 'other' }))).toBe('not-ours');
  });
  it('rejects readableBy newer than this reader', () => expect(reason(file({ readableBy: BACKUP_FORMAT + 1 }))).toBe('too-new'));
  it('accepts a newer format that is still readable', () => expect(reason(file({ format: 5 }))).toBe('ok'));
  it('rejects projects that is missing or not an object', () => {
    expect(reason(file({ projects: undefined }))).toBe('bad-data');
    expect(reason(file({ projects: [] }))).toBe('bad-data');
    expect(reason(JSON.stringify({ app: 'vibe-quilting', format: 1 }))).toBe('bad-data');
    expect(reason(JSON.stringify({ app: 'vibe-quilting', format: 1, data: [] }))).toBe('bad-data');
  });
  it('rejects text over the size limit without throwing', () => {
    expect(reason(' '.repeat(MAX_BACKUP_CHARS + 1))).toBe('too-large');
  });
  it('ignores keys and values in a format 1 file that it does not use', () => {
    const t = JSON.stringify({ app: 'vibe-quilting', format: 1, data: { 'other:b': '2', 'vq:v1:size:p': 5 } });
    expect(reason(t)).toBe('ok');
  });
});

describe('summaries', () => {
  it('counts quilts, versions and sizes, skipping bad and empty entries', () => {
    const s = filled();
    s.setItem('vq:v1:design:p:twin', JSON.stringify(createEmptyDesign(stacks, 'twin')));
    s.setItem('vq:v1:design:p:lap', 'not json');
    s.setItem('vq:v1:versions:p:crib', 'garbage');
    const counts = summarizeStorage(s);
    expect(counts.quilts).toBe(2);
    expect(counts.versions).toBe(2);
    expect(counts.sizeIds.sort()).toEqual(['crib', 'throw']);
    expect(counts.entries).toBe(Object.keys(appEntries(s)).length);
  });

  it('does not count a design stored under another size id', () => {
    const s = new FakeStorage();
    s.setItem('vq:v1:design:p:crib', JSON.stringify(createDesign(stacks, collection, 'throw')));
    expect(summarizeStorage(s).quilts).toBe(0);
  });
});

describe('clearAllData', () => {
  it('removes app keys and leaves others', () => {
    const s = filled();
    clearAllData(s);
    expect(appEntries(s)).toEqual({});
    expect(s.getItem('other-app:thing')).toBe('keep me');
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 2, 5, 23, 59))).toBe('vibe-quilting-2026-03-05.json');
    expect(backupFileName(new Date(2026, 11, 25, 0, 1))).toBe('vibe-quilting-2026-12-25.json');
  });
});
