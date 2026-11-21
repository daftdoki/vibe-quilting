/** Screen view of the quilt: CSS pixels per inch and the quilt origin in CSS pixels. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Box {
  width: number;
  height: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function fitView(viewport: Box, quilt: Box, pad: Padding): View {
  const pw = Math.max(1, viewport.width - pad.left - pad.right);
  const ph = Math.max(1, viewport.height - pad.top - pad.bottom);
  const scale = Math.max(0.01, Math.min(pw / quilt.width, ph / quilt.height));
  return {
    scale,
    x: pad.left + (pw - quilt.width * scale) / 2,
    y: pad.top + (ph - quilt.height * scale) / 2,
  };
}

export function zoomLimits(fitScale: number): { min: number; max: number } {
  return { min: fitScale * 0.6, max: Math.max(fitScale * 5, 110) };
}

/** Zoom by `factor` keeping the screen point (sx, sy) fixed. */
export function zoomAt(view: View, factor: number, sx: number, sy: number, min: number, max: number): View {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const k = scale / view.scale;
  return { scale, x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k };
}

/** Keep at least `keep` CSS pixels of the quilt on screen on each axis. */
export function clampView(view: View, viewport: Box, quilt: Box, keep = 80): View {
  const qw = quilt.width * view.scale;
  const qh = quilt.height * view.scale;
  const kx = Math.min(keep, qw);
  const ky = Math.min(keep, qh);
  return {
    scale: view.scale,
    x: Math.min(viewport.width - kx, Math.max(kx - qw, view.x)),
    y: Math.min(viewport.height - ky, Math.max(ky - qh, view.y)),
  };
}
