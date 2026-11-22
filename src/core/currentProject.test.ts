import { afterEach, describe, expect, it, vi } from 'vitest';
import { stacks } from '../patterns/stacks';
import {
  applyBackup,
  applyQuiltBackup,
  buildBackup,
  buildQuiltBackup,
  clearAllData,
  parseBackup,
  serializeBackup,
  summarizeStorage,
  type BackupContext,
  type KeyValueStorage,
} from './backup';
import { createDesign } from './design';
import v1 from './fixtures/backup-v1.json';
import v2 from './fixtures/backup-v2.json';
import {
  loadCurrentProject,
  readCurrentProjectFrom,
  saveCurrentProject,
  setWritesFrozen,
  writeCurrentProjectTo,
} from './storage';
import { makeCollection } from './test-fixtures';
import type { ProjectDef } from './types';

const collection = makeCollection();
const a: ProjectDef = { id: 'a', title: 'A', pattern: stacks, collection };
const b: ProjectDef = { id: 'b', title: 'B', pattern: stacks, collection: { ...collection, id: 'fake-b' } };
const two: BackupContext = { projects: [a, b] };
const NOW = new Date(2026, 10, 21, 9);

class FakeStorage implements KeyValueStorage {
  map = new Map<string, string>();
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

function withDesigns(): FakeStorage {
  const s = new FakeStorage();
  s.setItem('vq:v1:design:a:throw', JSON.stringify(createDesign(stacks, collection, 'throw')));
  s.setItem('vq:v1:design:b:crib', JSON.stringify(createDesign(stacks, collection, 'crib')));
  return s;
}

function parsed(text: string, ctx: BackupContext = two) {
  const r = parseBackup(text, ctx);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setWritesFrozen(false);
});

describe('stored current project', () => {
  it('is null until one is saved, and an empty value counts as none', () => {
    const s = new FakeStorage();
    expect(readCurrentProjectFrom(s)).toBeNull();
    s.setItem('vq:v1:project', '');
    expect(readCurrentProjectFrom(s)).toBeNull();
  });

  it('round trips under the vq:v1:project key', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    expect(loadCurrentProject()).toBeNull();
    saveCurrentProject('b');
    expect(data.get('vq:v1:project')).toBe('b');
    expect(loadCurrentProject()).toBe('b');
  });

  it('is safe when storage is missing or throws, and skips writes while they are frozen', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadCurrentProject()).toBeNull();
    expect(() => saveCurrentProject('b')).not.toThrow();
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    setWritesFrozen(true);
    saveCurrentProject('b');
    expect(data.size).toBe(0);
  });

  it('does not count as a quilt, but does count as an entry that Clear all data removes', () => {
    const s = new FakeStorage();
    writeCurrentProjectTo(s, 'b');
    expect(summarizeStorage(s)).toMatchObject({ quilts: 0, versions: 0, entries: 1 });
    clearAllData(s);
    expect(readCurrentProjectFrom(s)).toBeNull();
  });
});

describe('current project in the data file', () => {
  it('is written as an optional setting, only for a set this app has', () => {
    const s = withDesigns();
    expect(buildBackup(s, NOW, two).settings).toEqual({});
    writeCurrentProjectTo(s, 'b');
    const f = buildBackup(s, NOW, two);
    expect(f.settings).toEqual({ currentProject: 'b' });
    expect(f.format).toBe(2);
    writeCurrentProjectTo(s, 'gone');
    expect(buildBackup(s, NOW, two).settings).toEqual({});
  });

  it('comes back after an import', () => {
    const s = withDesigns();
    writeCurrentProjectTo(s, 'b');
    const dest = new FakeStorage();
    dest.setItem('vq:v1:project', 'a');
    const { file } = parsed(serializeBackup(buildBackup(s, NOW, two)));
    expect(file.currentProjectId).toBe('b');
    expect(applyBackup(dest, file)).toEqual({ ok: true });
    expect(readCurrentProjectFrom(dest)).toBe('b');
  });

  it('resets to the default when the file names no set or an unknown one', () => {
    const noSetting = JSON.parse(serializeBackup(buildBackup(withDesigns(), NOW, two)));
    const unknown = { ...noSetting, settings: { currentProject: 'gone' } };
    for (const file of [noSetting, unknown]) {
      const dest = new FakeStorage();
      dest.setItem('vq:v1:project', 'b');
      const r = parsed(JSON.stringify(file));
      expect(r.file.currentProjectId).toBeUndefined();
      expect(applyBackup(dest, r.file)).toEqual({ ok: true });
      expect(readCurrentProjectFrom(dest)).toBeNull();
    }
  });

  it('follows project aliases', () => {
    const file = { ...JSON.parse(serializeBackup(buildBackup(withDesigns(), NOW, two))), settings: { currentProject: 'old' } };
    expect(parsed(JSON.stringify(file), { ...two, projectAliases: { old: 'b' } }).file.currentProjectId).toBe('b');
  });

  it('is absent from a quilt file, and opening one switches to its set', () => {
    const s = withDesigns();
    writeCurrentProjectTo(s, 'a');
    const file = buildQuiltBackup(s, NOW, two, 'b', 'crib');
    expect(file.settings).toBeUndefined();
    const r = parsed(serializeBackup(file));
    expect(r.file.currentProjectId).toBeUndefined();
    expect(applyQuiltBackup(s, r.file, { now: 1, versionId: 'x' })).toEqual({ ok: true });
    expect(readCurrentProjectFrom(s)).toBe('b');
  });

  it('puts the open set back when opening a quilt file fails part way', () => {
    const s = withDesigns();
    writeCurrentProjectTo(s, 'a');
    const r = parsed(serializeBackup(buildQuiltBackup(s, NOW, two, 'b', 'crib')));
    const failing = Object.assign(Object.create(s), {
      setItem(k: string, v: string) {
        if (k === 'vq:v1:project') throw new Error('nope');
        s.setItem(k, v);
      },
      getItem: (k: string) => s.getItem(k),
      removeItem: (k: string) => s.removeItem(k),
    }) as KeyValueStorage;
    expect(applyQuiltBackup(failing, r.file, { now: 1, versionId: 'x' })).toMatchObject({ ok: false });
    expect(readCurrentProjectFrom(s)).toBe('a');
  });

  it('existing fixtures import with no current set', () => {
    for (const f of [v1, v2]) expect(parsed(JSON.stringify(f), { projects: [a, b, ...[]] }).file.currentProjectId).toBeUndefined();
  });
});
