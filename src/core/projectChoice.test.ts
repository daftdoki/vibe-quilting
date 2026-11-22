import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stacks } from '../patterns/stacks';
import { createDesign, createEmptyDesign } from './design';
import { applySwitch, chooseProject, hasQuiltAt, planSwitch, sampleFabrics } from './projectChoice';
import { loadCurrentProject, loadGuide, loadLastSize, saveDesign, saveGuide, saveLastSize } from './storage';
import { makeCollection } from './test-fixtures';
import type { ProjectDef } from './types';

const collection = makeCollection();
const a: ProjectDef = { id: 'a', title: 'A', pattern: stacks, collection };
const b: ProjectDef = { id: 'b', title: 'B', pattern: stacks, collection: { ...collection, id: 'fake-b' } };
const sizes = stacks.sizes.map((s) => s.id);

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('chooseProject', () => {
  it('uses the stored id when the project exists', () => {
    expect(chooseProject([a, b], undefined, 'b')).toBe(b);
  });

  it('falls back to the first project when the id is missing or unknown', () => {
    expect(chooseProject([a, b], undefined, null)).toBe(a);
    expect(chooseProject([a, b], undefined, 'gone')).toBe(a);
    expect(chooseProject([a, b], undefined, '')).toBe(a);
  });

  it('follows project aliases', () => {
    expect(chooseProject([a, b], { old: 'b' }, 'old')).toBe(b);
  });

  it('works with one project and with none', () => {
    expect(chooseProject([a], undefined, 'b')).toBe(a);
    expect(chooseProject([], undefined, 'a')).toBeUndefined();
  });
});

describe('sampleFabrics', () => {
  it('returns the whole collection when it is small', () => {
    expect(sampleFabrics(collection, 100)).toHaveLength(collection.fabrics.length);
    expect(sampleFabrics(collection, 0)).toEqual([]);
  });

  it('spreads the picks through the collection without repeats', () => {
    const picks = sampleFabrics(collection, 8);
    expect(picks).toHaveLength(8);
    expect(new Set(picks.map((f) => f.id)).size).toBe(8);
    expect(picks[0]).toBe(collection.fabrics[0]);
    const index = picks.map((f) => collection.fabrics.indexOf(f));
    expect(index).toEqual([...index].sort((x, y) => x - y));
    expect(index[7]!).toBeGreaterThan(collection.fabrics.length / 2);
  });
});

describe('planSwitch', () => {
  const never = () => false;
  const always = () => true;

  it('from the guide, carries the size and lands on the size step', () => {
    expect(planSwitch(b, 'queen', 'guide', 'crib', never)).toEqual({ sizeId: 'queen', guide: { step: 'size', block: 0 } });
  });

  it('from the guide, keeps the other set\'s size when the carried size already has a quilt there', () => {
    expect(planSwitch(b, 'queen', 'guide', 'crib', (id) => id === 'queen')).toEqual({
      sizeId: 'crib',
      guide: { step: 'size', block: 0 },
    });
  });

  it('falls back to the default size when the remembered size is unknown', () => {
    expect(planSwitch(b, 'queen', 'guide', 'gone', always).sizeId).toBe(stacks.defaultSizeId);
    expect(planSwitch(b, 'gone', 'guide', null, never).sizeId).toBe(stacks.defaultSizeId);
  });

  it('from the main screen, carries the size and opens an existing quilt as it is', () => {
    expect(planSwitch(b, 'queen', 'main', 'crib', (id) => id === 'queen')).toEqual({ sizeId: 'queen', guide: null });
  });

  it('from the main screen, starts the guide at the fabrics step when there is no quilt', () => {
    expect(planSwitch(b, 'queen', 'main', 'crib', never)).toEqual({ sizeId: 'queen', guide: { step: 'fabrics', block: 0 } });
  });
});

describe('applySwitch', () => {
  const size = sizes[0]!;
  const other = sizes[1]!;

  it('saves the open set, the size and the guide step', () => {
    applySwitch(b, size, 'main');
    expect(loadCurrentProject()).toBe('b');
    expect(loadLastSize('b')).toBe(size);
    expect(loadGuide('b', size)).toEqual({ step: 'fabrics', block: 0 });
  });

  it('leaves a quilt and its guide state alone when the set has one for the size', () => {
    saveDesign('b', createDesign(stacks, collection, size));
    saveGuide('b', size, 'done');
    applySwitch(b, size, 'main');
    expect(hasQuiltAt('b', size)).toBe(true);
    expect(loadGuide('b', size)).toBe('done');
  });

  it('does not count an empty design as a quilt', () => {
    saveDesign('b', createEmptyDesign(stacks, size));
    expect(hasQuiltAt('b', size)).toBe(false);
    applySwitch(b, size, 'main');
    expect(loadGuide('b', size)).toEqual({ step: 'fabrics', block: 0 });
  });

  it('from the guide, opens the new set on the size step, and keeps the old set\'s data', () => {
    saveDesign('a', createDesign(stacks, collection, size));
    saveLastSize('b', other);
    applySwitch(b, size, 'guide');
    expect(loadLastSize('b')).toBe(size);
    expect(loadGuide('b', size)).toEqual({ step: 'size', block: 0 });
    expect(hasQuiltAt('a', size)).toBe(true);
  });
});
