/** A small picture of a saved design, drawn with the shared quilt renderer. */
import { useEffect, useMemo, useRef } from 'react';
import { resolvePieces } from '../../core/layout';
import { sanitizeDesign } from '../../core/storage';
import type { Design, ProjectDef } from '../../core/types';
import { imageCache } from '../imageCache';
import { buildScene, drawScene } from '../renderQuilt';

/** Longest side in CSS pixels. */
const SIDE = 160;

export function VersionThumb({ project, design, label }: { project: ProjectDef; design: Design; label: string }) {
  const { pattern, collection } = project;
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useMemo(() => {
    const clean = sanitizeDesign(pattern, collection, design);
    if (!clean) return null;
    try {
      return buildScene(pattern, collection, clean, resolvePieces(pattern, collection, clean));
    } catch {
      return null;
    }
  }, [pattern, collection, design]);

  const k = scene ? SIDE / Math.max(scene.width, scene.height) : 1;
  const cssW = scene ? Math.round(scene.width * k) : SIDE;
  const cssH = scene ? Math.round(scene.height * k) : Math.round(SIDE * 0.75);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !scene) return;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const px = k * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(px, 0, 0, px, 0, 0);
      drawScene(ctx, scene, imageCache, { devicePxPerInch: px, dpr, empty: 'print', seams: false });
    };
    draw();
    return imageCache.subscribe(draw);
  }, [scene, k, cssW, cssH]);

  if (!scene) {
    return (
      <span className="version-thumb version-thumb-missing" role="img" aria-label={`${label}, no picture`}>
        No picture
      </span>
    );
  }
  return (
    <canvas
      ref={ref}
      className="version-thumb"
      style={{ width: `${cssW}px`, height: `${cssH}px` }}
      role="img"
      aria-label={`Picture of ${label}`}
    />
  );
}
