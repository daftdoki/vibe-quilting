import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stacks } from '../patterns/stacks';
import { createDesign, createEmptyDesign, setLineupSlot, setOverride } from './design';
import {
  loadDesign,
  loadExcluded,
  loadGuide,
  loadLastSize,
  loadQuiltName,
  normalizeQuiltName,
  parseDataKey,
  parseGuideProgress,
  parseExcluded,
  saveDesign,
  saveExcluded,
  saveGuide,
  saveLastSize,
  saveQuiltName,
  setWritesFrozen,
} from './storage';
import { makeCollection } from './test-fixtures';

const collection = makeCollection();

function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
  return data;
}

beforeEach(() => void stubStorage());
afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('round trips a design and the last size', () => {
    const d = createDesign(stacks, collection, 'crib');
    saveDesign('p', d);
    saveLastSize('p', 'crib');
    expect(loadDesign('p', 'crib')).toEqual(d);
    expect(loadDesign('p', 'king')).toBeNull();
    expect(loadLastSize('p')).toBe('crib');
    expect(loadLastSize('other')).toBeNull();
  });

  it('returns null on corrupt or wrong-shaped JSON', () => {
    const data = stubStorage();
    data.set('vq:v1:design:p:crib', '{nope');
    expect(loadDesign('p', 'crib')).toBeNull();
    data.set('vq:v1:design:p:crib', JSON.stringify({ sizeId: 'crib', lineup: [1] }));
    expect(loadDesign('p', 'crib')).toBeNull();
  });

  it('is safe when storage is missing or throws', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadDesign('p', 'crib')).toBeNull();
    expect(() => saveDesign('p', createDesign(stacks, collection, 'crib'))).not.toThrow();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(loadLastSize('p')).toBeNull();
    expect(() => saveLastSize('p', 'crib')).not.toThrow();
  });
});

describe('empty slots', () => {
  const half = setOverride(
    stacks,
    setLineupSlot(setLineupSlot(createEmptyDesign(stacks, 'throw'), 0, 'd0-c0'), 5, 'd2-c1'),
    3,
    'C',
    'd4-c0',
  );

  it('round trips a design with empty slots', () => {
    saveDesign('p', half);
    expect(loadDesign('p', 'throw')).toEqual(half);
    const empty = createEmptyDesign(stacks, 'crib');
    saveDesign('p', empty);
    expect(loadDesign('p', 'crib')).toEqual(empty);
  });
});

describe('guide progress', () => {
  it('round trips per project and size', () => {
    expect(loadGuide('p', 'throw')).toBeNull();
    saveGuide('p', 'throw', { step: 'fabrics', block: 0 });
    saveGuide('p', 'king', { step: 'touchups', block: 7 });
    saveGuide('q', 'throw', 'done');
    expect(loadGuide('p', 'throw')).toEqual({ step: 'fabrics', block: 0 });
    expect(loadGuide('p', 'king')).toEqual({ step: 'touchups', block: 7 });
    expect(loadGuide('q', 'throw')).toBe('done');
    expect(loadGuide('p', 'crib')).toBeNull();
  });

  it('uses the documented key', () => {
    const data = stubStorage();
    saveGuide('p', 'twin', { step: 'blocks', block: 0 });
    expect(JSON.parse(data.get('vq:v1:guide:p:twin')!)).toEqual({ step: 'blocks', block: 0 });
  });

  it('round trips the opening overview step, and older progress still reads', () => {
    saveGuide('p', 'throw', { step: 'intro', block: 0 });
    expect(loadGuide('p', 'throw')).toEqual({ step: 'intro', block: 0 });
    const data = stubStorage();
    for (const step of ['size', 'fabrics', 'blocks', 'touchups']) {
      data.set('vq:v1:guide:p:throw', JSON.stringify({ step, block: 0 }));
      expect(loadGuide('p', 'throw')).toEqual({ step, block: 0 });
    }
    data.set('vq:v1:guide:p:throw', '"done"');
    expect(loadGuide('p', 'throw')).toBe('done');
  });

  it('reads the retired Mix the order step as Pick your fabrics', () => {
    const data = stubStorage();
    data.set('vq:v1:guide:p:throw', JSON.stringify({ step: 'shuffle', block: 0 }));
    expect(loadGuide('p', 'throw')).toEqual({ step: 'fabrics', block: 0 });
    data.set('vq:v1:guide:p:throw', JSON.stringify({ step: 'shuffle', block: 3, extra: true }));
    expect(loadGuide('p', 'throw')).toEqual({ step: 'fabrics', block: 0 });
    // A bad block still makes the entry unreadable, as for any step.
    data.set('vq:v1:guide:p:throw', JSON.stringify({ step: 'shuffle', block: -1 }));
    expect(loadGuide('p', 'throw')).toBeNull();
    expect(parseGuideProgress({ step: 'toString', block: 0 })).toBeNull();
  });

  it('returns null on bad data', () => {
    const data = stubStorage();
    const key = 'vq:v1:guide:p:throw';
    for (const bad of ['{nope', '"later"', '{"step":"wander","block":0}', '{"step":"size","block":-1}', '{"step":"size","block":1.5}', '{"step":"size"}', 'null']) {
      data.set(key, bad);
      expect(loadGuide('p', 'throw'), bad).toBeNull();
    }
  });
});

describe('hidden fabrics', () => {
  it('round trips and keeps only known ids, once each', () => {
    saveExcluded('p', ['d0-c1', 'd2-c2']);
    expect(loadExcluded('p', collection)).toEqual(['d0-c1', 'd2-c2']);
    expect(loadExcluded('other', collection)).toEqual([]);
  });

  it('drops unknown ids and bad entries, and survives bad JSON', () => {
    const data = stubStorage();
    data.set('vq:v1:excluded:p', JSON.stringify(['d0-c1', 'gone', 3, null, 'd0-c1']));
    expect(loadExcluded('p', collection)).toEqual(['d0-c1']);
    data.set('vq:v1:excluded:p', '{not json');
    expect(loadExcluded('p', collection)).toEqual([]);
    data.set('vq:v1:excluded:p', JSON.stringify({ a: 1 }));
    expect(loadExcluded('p', collection)).toEqual([]);
  });

  it('resolves old ids through the collection aliases', () => {
    const data = stubStorage();
    data.set('vq:v1:excluded:p', JSON.stringify(['old-id', 'd1-c0']));
    const aliased = { ...collection, aliases: { 'old-id': 'd1-c0', toString: 'x' } };
    expect(loadExcluded('p', aliased)).toEqual(['d1-c0']);
    expect(parseExcluded(['toString'], aliased)).toEqual([]);
  });

  it('parses the key', () => {
    expect(parseDataKey('vq:v1:excluded:p')).toEqual({ kind: 'excluded', projectId: 'p', sizeId: null });
  });
});

describe('quilt names', () => {
  function fullStub() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    return data;
  }

  it('normalizes: trims, collapses whitespace and caps at 60 characters', () => {
    expect(normalizeQuiltName('  My \n  quilt  ')).toBe('My quilt');
    expect(normalizeQuiltName('x'.repeat(70))).toBe('x'.repeat(60));
    expect(normalizeQuiltName(`${'x'.repeat(59)} y`)).toBe('x'.repeat(59));
    expect(normalizeQuiltName(7)).toBe('');
    expect(normalizeQuiltName('   ')).toBe('');
  });

  it('stores one name per project and size, and an empty name removes the key', () => {
    const data = fullStub();
    expect(saveQuiltName('p', 'throw', '  Ginger\'s   Quilt ')).toBe("Ginger's Quilt");
    expect(data.get('vq:v1:name:p:throw')).toBe("Ginger's Quilt");
    expect(loadQuiltName('p', 'throw')).toBe("Ginger's Quilt");
    expect(loadQuiltName('p', 'crib')).toBe('');
    saveQuiltName('p', 'throw', '   ');
    expect(data.has('vq:v1:name:p:throw')).toBe(false);
    expect(loadQuiltName('p', 'throw')).toBe('');
  });

  it('skips saving while writes are frozen', () => {
    const data = fullStub();
    saveQuiltName('p', 'throw', 'Kept');
    setWritesFrozen(true);
    try {
      saveQuiltName('p', 'throw', 'Changed');
      saveQuiltName('p', 'throw', '');
    } finally {
      setWritesFrozen(false);
    }
    expect(data.get('vq:v1:name:p:throw')).toBe('Kept');
  });

  it('parseDataKey knows the name key', () => {
    expect(parseDataKey('vq:v1:name:p:throw')).toEqual({ kind: 'name', projectId: 'p', sizeId: 'throw' });
  });
});
