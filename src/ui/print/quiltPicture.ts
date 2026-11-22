/**
 * The colour picture of the whole quilt for the build sheet, drawn with the
 * same scene code as the PNG export. It goes on the page as an <img>, since
 * a <canvas> can print blank in some browsers.
 */
import { resolvePieces } from '../../core/layout';
import type { Design, FabricDef, ProjectDef } from '../../core/types';
import { imageCache } from '../imageCache';
import { buildScene, drawScene } from '../renderQuilt';
import { pictureBox, picturePixels } from './geometry';

/** Draws the quilt at print resolution for its place on the page. Resolves to an image file. */
export async function renderQuiltPicture(project: ProjectDef, design: Design): Promise<Blob> {
  const { pattern, collection } = project;
  const scene = buildScene(pattern, collection, design, resolvePieces(pattern, collection, design));
  const used = new Map<string, FabricDef>();
  for (const item of scene.items) if (item.fabric) used.set(item.fabric.id, item.fabric);
  await imageCache.loadAll([...used.values()]);

  const box = pictureBox(scene.width, scene.height);
  const px = picturePixels(box.wMm, box.hMm);
  const canvas = document.createElement('canvas');
  canvas.width = px.w;
  canvas.height = px.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, px.w, px.h);
  const k = px.w / scene.width;
  ctx.setTransform(k, 0, 0, px.h / scene.height, 0, 0);
  drawScene(ctx, scene, imageCache, { devicePxPerInch: k, dpr: 1, empty: 'print' });

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the picture'))), 'image/jpeg', 0.92);
  });
}
