/**
 * Sizes for the build sheet drawings, in points (1/72 inch). The SVGs use a
 * viewBox in the same points as their width and height, so a font size of 26
 * prints at 26pt and the screen preview matches.
 *
 * Every page fits the smaller printable box of US Letter and A4 with 12mm
 * margins: 186mm wide (A4) by 255mm tall (Letter).
 */
import type { BlockDef, Point } from '../../core/types';

export const PT_PER_MM = 72 / 25.4;
/** Printable width and height in points. */
export const PAGE_W = 186 * PT_PER_MM;
export const PAGE_H = 255 * PT_PER_MM;

export type CardSize = 'large' | 'compact';

export interface CardSpec {
  /** Cards across and down one page. */
  cols: number;
  rows: number;
  /** Height of the block drawing in points. */
  drawH: number;
  numberPt: number;
  letterPt: number;
  /** Blank space kept inside each piece around its number. */
  padPt: number;
}

export const CARD_SPECS: Record<CardSize, CardSpec> = {
  large: { cols: 2, rows: 2, drawH: 240, numberPt: 26, letterPt: 11, padPt: 4 },
  compact: { cols: 3, rows: 3, drawH: 138, numberPt: 16, letterPt: 9, padPt: 3 },
};

/** Area-weighted center of a polygon. */
export function centroid(poly: readonly Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return poly[0] ?? [0, 0];
  return [cx / (3 * a), cy / (3 * a)];
}

export function bbox(poly: readonly Point[]): { x: number; y: number; w: number; h: number } {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Rough width of bold digits and capitals, as a share of the font size. */
const GLYPH_W = 0.62;
/** Rough height of digits and capitals, as a share of the font size. */
const GLYPH_H = 0.78;

/**
 * The largest font size up to `wantPt` at which `text` fits a box of
 * `boxW` by `boxH` points with `padPt` clear on every side.
 */
export function fitFont(text: string, wantPt: number, boxW: number, boxH: number, padPt: number): number {
  const chars = Math.max(1, text.length);
  const byW = (boxW - 2 * padPt) / (chars * GLYPH_W);
  const byH = (boxH - 2 * padPt) / GLYPH_H;
  return Math.max(4, Math.min(wantPt, byW, byH));
}

/** Estimated drawn width of text at a font size. */
export function textWidth(text: string, pt: number): number {
  return text.length * GLYPH_W * pt;
}

/** Points per block inch for a card drawing. */
export function cardScale(block: BlockDef, spec: CardSpec): number {
  return spec.drawH / block.height;
}

export interface MapSpec {
  cellW: number;
  cellH: number;
  gap: number;
  /** Width kept on the left for "Row 1" labels. */
  labelW: number;
  numberPt: number;
  letterPt: number;
}

/** Height kept for the map on its page, below the heading and above the note. */
export const MAP_MAX_H = 200 * PT_PER_MM;

/** Cell sizes for the layout map so the whole grid fits one page. */
export function mapSpec(block: BlockDef, cols: number, rows: number): MapSpec {
  const gap = 4;
  const labelW = 46;
  const byW = (PAGE_W - labelW - gap * (cols - 1)) / cols;
  const byH = ((MAP_MAX_H - gap * (rows - 1)) / rows) * (block.width / block.height);
  const cellW = Math.min(byW, byH, 150);
  const cellH = cellW * (block.height / block.width);
  return {
    cellW,
    cellH,
    gap,
    labelW,
    numberPt: Math.min(32, Math.max(14, cellW * 0.32)),
    letterPt: Math.min(16, Math.max(10, cellW * 0.15)),
  };
}
