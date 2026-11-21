import type { FabricDef } from '../core/types';
import { imageCache } from './imageCache';
import { drawScene, type Scene } from './renderQuilt';

const TARGET_PX_PER_INCH = 20;
const MAX_SIDE = 4096;

export async function renderPng(scene: Scene): Promise<Blob> {
  const used = new Map<string, FabricDef>();
  for (const item of scene.items) if (item.fabric) used.set(item.fabric.id, item.fabric);
  await imageCache.loadAll([...used.values()]);

  const k = Math.min(TARGET_PX_PER_INCH, MAX_SIDE / Math.max(scene.width, scene.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(scene.width * k);
  canvas.height = Math.round(scene.height * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawScene(ctx, scene, imageCache, { devicePxPerInch: k, dpr: 1, empty: 'print' });

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png');
  });
}

/**
 * Share the file where the platform can (phones), else download it.
 * Returns false when she closed the share sheet without sending anything.
 */
export async function shareOrDownload(blob: Blob, filename: string, title: string, mime: string): Promise<boolean> {
  const file = new File([blob], filename, { type: mime });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // NotAllowedError and others fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
