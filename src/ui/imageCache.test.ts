import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FabricDef } from '../core/types';
import { ImageCache } from './imageCache';

const fabric = (id: string): FabricDef => ({
  id,
  name: id,
  design: 'd',
  colorway: 'c',
  sku: id,
  image: `/${id}.jpg`,
  thumb: `/${id}.thumb.jpg`,
  pxPerInch: 10,
  widthPx: 40,
  heightPx: 40,
  color: '#808080',
});

const requested: string[] = [];

beforeEach(() => {
  requested.length = 0;
  // An image that finishes loading on the next tick.
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decoding = '';
      naturalWidth = 40;
      naturalHeight = 40;
      set src(url: string) {
        requested.push(url);
        queueMicrotask(() => this.onload?.());
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('ImageCache lazy loading', () => {
  it('level() starts a load for an unseen fabric and tells subscribers when it finishes', async () => {
    const cache = new ImageCache();
    const redraw = vi.fn();
    cache.subscribe(redraw);
    const f = fabric('x');
    expect(cache.level(f, 10)).toBeNull();
    expect(requested).toEqual(['/x.jpg']);
    await cache.load(f);
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(cache.level(f, 10)).not.toBeNull();
  });

  it('loads each image once, and loadAll only fetches the fabrics it is given', async () => {
    const cache = new ImageCache();
    await cache.loadAll([fabric('a'), fabric('b')]);
    cache.level(fabric('a'), 10);
    await cache.loadAll([fabric('a')]);
    expect(requested).toEqual(['/a.jpg', '/b.jpg']);
  });
});
