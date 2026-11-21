import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stacks } from '../patterns/stacks';
import { createDesign, createEmptyDesign, rotateCell, setLineupSlot, shuffleLineup } from './design';
import { loadVersions, saveVersions } from './storage';
import { makeCollection } from './test-fixtures';
import type { Design, DesignVersion } from './types';
import { addVersion, AUTO_RUN_MS, defaultVersionName, deleteVersion, designsEqual, renameVersion } from './versions';

const collection = makeCollection();
const base = createDesign(stacks, collection, 'throw');

let n = 0;
function version(design: Design, opts: Partial<DesignVersion> = {}): DesignVersion {
  n++;
  return {
    id: `v${n}`,
    sizeId: design.sizeId,
    name: `Version ${n}`,
    createdAt: n * AUTO_RUN_MS * 2,
    auto: false,
    design,
    ...opts,
  };
}

/** A different design for each i. */
const variant = (i: number) => shuffleLineup(base, i + 1);

describe('designsEqual', () => {
  it('compares deeply', () => {
    expect(designsEqual(base, structuredClone(base))).toBe(true);
    expect(designsEqual(base, rotateCell(stacks, base, 0))).toBe(false);
    expect(designsEqual(base, setLineupSlot(base, 0, null))).toBe(false);
    expect(designsEqual(base, { ...base, overrides: { '0:A': 'd0-c0' } })).toBe(false);
  });
});

describe('addVersion', () => {
  it('puts the newest first', () => {
    const a = version(variant(1));
    const b = version(variant(2));
    expect(addVersion(addVersion([], a), b).map((v) => v.id)).toEqual([b.id, a.id]);
  });

  it('keeps each kind under its own limit, dropping the oldest of that kind', () => {
    const limits = { manual: 3, auto: 2 };
    let list: DesignVersion[] = [];
    const manual: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = version(variant(i));
      manual.push(v.id);
      list = addVersion(list, v, limits);
    }
    for (let i = 0; i < 4; i++)
      list = addVersion(list, version(variant(10 + i), { auto: true, reason: `r${i}` }), limits);
    expect(list.filter((v) => !v.auto)).toHaveLength(3);
    expect(list.filter((v) => v.auto)).toHaveLength(2);
    // The manual ones kept are the three newest.
    expect(list.filter((v) => !v.auto).map((v) => v.id)).toEqual(manual.slice(2).reverse());
  });

  it('never lets automatic versions push out manual ones', () => {
    const limits = { manual: 2, auto: 1 };
    let list = addVersion(addVersion([], version(variant(1)), limits), version(variant(2)), limits);
    for (let i = 0; i < 5; i++)
      list = addVersion(list, version(variant(20 + i), { auto: true, reason: `r${i}` }), limits);
    expect(list.filter((v) => !v.auto)).toHaveLength(2);
    expect(list.filter((v) => v.auto)).toHaveLength(1);
  });

  it('skips an automatic version equal to the newest or empty', () => {
    const list = addVersion([], version(base));
    expect(addVersion(list, version(structuredClone(base), { auto: true, reason: 'x' }))).toHaveLength(1);
    expect(addVersion(list, version(createEmptyDesign(stacks, 'throw'), { auto: true, reason: 'x' }))).toHaveLength(1);
    // A manual version is always added.
    expect(addVersion(list, version(structuredClone(base)))).toHaveLength(2);
  });

  it('keeps one version for a run of the same automatic reason within a minute', () => {
    const first = version(variant(1), { auto: true, reason: 'Before shuffle', createdAt: 1_000_000 });
    let list = addVersion([], first);
    list = addVersion(list, version(variant(2), { auto: true, reason: 'Before shuffle', createdAt: 1_020_000 }));
    list = addVersion(list, version(variant(3), { auto: true, reason: 'Before shuffle', createdAt: 1_040_000 }));
    expect(list.map((v) => v.id)).toEqual([first.id]);
    // A different reason, or a later one, starts a new entry.
    list = addVersion(list, version(variant(4), { auto: true, reason: 'Before reset blocks', createdAt: 1_041_000 }));
    expect(list).toHaveLength(2);
    list = addVersion(
      list,
      version(variant(5), { auto: true, reason: 'Before reset blocks', createdAt: 1_041_000 + AUTO_RUN_MS }),
    );
    expect(list).toHaveLength(3);
  });
});

describe('names', () => {
  it('uses the lowest unused number among manual versions', () => {
    expect(defaultVersionName([])).toBe('Version 1');
    const list = [
      version(base, { name: 'Version 1' }),
      version(base, { name: 'Version 3' }),
      version(base, { name: 'Version 2', auto: true, reason: 'x' }),
      version(base, { name: 'Blue one' }),
    ];
    expect(defaultVersionName(list)).toBe('Version 2');
  });

  it('renames, trims, caps the length, and keeps the old name when empty', () => {
    const a = version(base, { name: 'Old' });
    expect(renameVersion([a], a.id, '  New name  ')[0]!.name).toBe('New name');
    expect(renameVersion([a], a.id, '   ')[0]!.name).toBe('Old');
    expect(renameVersion([a], a.id, 'x'.repeat(60))[0]!.name).toHaveLength(40);
    expect(renameVersion([a], 'other', 'New')[0]!.name).toBe('Old');
  });

  it('deletes by id', () => {
    const a = version(base);
    const b = version(variant(1));
    expect(deleteVersion([a, b], a.id)).toEqual([b]);
  });
});

describe('version storage', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round trips, including empty slots, under the documented key', () => {
    const list = [version(setLineupSlot(base, 2, null), { auto: true, reason: 'Before shuffle' }), version(base)];
    expect(saveVersions('p', 'throw', list)).toBe(true);
    expect(data.has('vq:v1:versions:p:throw')).toBe(true);
    expect(loadVersions('p', 'throw')).toEqual(list);
    expect(loadVersions('p', 'king')).toEqual([]);
  });

  it('drops corrupt entries and keeps the rest', () => {
    const good = version(base);
    data.set(
      'vq:v1:versions:p:throw',
      JSON.stringify([
        { id: 'bad', name: 3 },
        good,
        { ...good, id: 'other-size', sizeId: 'king' },
        { ...good, id: 'x', design: { sizeId: 'throw' } },
      ]),
    );
    expect(loadVersions('p', 'throw')).toEqual([good]);
    data.set('vq:v1:versions:p:throw', '{nope');
    expect(loadVersions('p', 'throw')).toEqual([]);
  });

  it('reports a failed write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(saveVersions('p', 'throw', [version(base)])).toBe(false);
  });
});
