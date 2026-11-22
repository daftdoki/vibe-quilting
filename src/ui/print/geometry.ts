/**
 * Sizes for the build sheet, in millimetres for the page and in points
 * (1/72 inch) for the drawings. The SVGs use a viewBox in the same points as
 * their width and height, so a font size of 26 prints at 26pt and the screen
 * preview matches.
 *
 * Every page is a fixed box of 186mm by 242mm. With the 10mm `@page` margin
 * in buildSheet.css, Letter has 195.9mm by 259.4mm to print on and A4 has
 * 190mm by 277mm. Safari enlarges the page until it fills the printable
 * width, which on Letter makes the box 5% bigger (measured from a real PDF).
 * So the box is kept squatter than Letter's printable area: 242mm becomes
 * about 255mm when enlarged, which still leaves 4mm. A taller box spills its
 * last lines onto a blank page.
 * The page CSS reads these numbers through custom properties set from
 * `SHEET_VARS`, so this file is the one place they live.
 */
import type { BlockDef, Point } from '../../core/types';

export const PT_PER_MM = 72 / 25.4;
/** CSS pixels per millimetre. */
export const PX_PER_MM = 96 / 25.4;

/** The page box. */
export const PAGE_W_MM = 186;
export const PAGE_H_MM = 242;
/** Running line at the top of each page, and the space under it. */
export const RUNNING_MM = 7;
export const RUNNING_GAP_MM = 2;
/** "Page N of M" at the bottom of each page, and the space above it. */
export const FOLIO_MM = 6;
export const FOLIO_GAP_MM = 2;
/** Height left for the content between the running line and the page number. */
export const BODY_H_MM = PAGE_H_MM - RUNNING_MM - RUNNING_GAP_MM - FOLIO_MM - FOLIO_GAP_MM;
/** Kept free at the bottom of every page, in case print wraps text a little differently from the screen. */
export const SLACK_MM = 2;
/** Height the packer fills on each page. */
export const FILL_H_MM = BODY_H_MM - SLACK_MM;
/** The "Block cards" heading and its note on the first card page. */
export const CARDS_HEAD_MM = 16;

/** Width and height of the page box in points. */
export const PAGE_W = PAGE_W_MM * PT_PER_MM;
export const PAGE_H = PAGE_H_MM * PT_PER_MM;
export const BODY_H = BODY_H_MM * PT_PER_MM;

/** Room around a drawing so the outer line is not cut in half. Equal to the block outline width. */
export const DRAW_EDGE_PT = 1.5;

/** Card parts, as set in buildSheet.css. */
const CARD_BORDER_PT = 0.5;
const CARD_PAD_X_MM = 1.5;
const CARD_PAD_TOP_MM = 1.5;
const CARD_PAD_BOTTOM_MM = 0.5;
const CARD_FOOT_GAP_MM = 0.5;
/** One line of a card footnote: 12pt type at line height 1.25. */
export const FOOT_LINE_PT = 15;

/** Fabric swatch in the fabrics table, which keeps a 20-fabric table on one page. */
export const TABLE_SWATCH_MM = 5.5;
/** Fabric swatch in the stack list, and the smaller one used when the list would not fit its page. */
export const STACK_SWATCH_MM = 11;
export const STACK_SWATCH_SMALL_MM = 9;
/** The stack list uses 3 columns above this many entries, and 2 up to it. */
export const STACK_TWO_COLUMNS_MAX = 20;

export function stackColumns(entries: number): 2 | 3 {
  return entries > STACK_TWO_COLUMNS_MAX ? 3 : 2;
}

export type CardSize = 'large' | 'medium' | 'compact';

interface CardLayout {
  cols: number;
  rows: number;
  rowGapMm: number;
  colGapMm: number;
  /** Height of the card's top line: block number and Sewn box. */
  headMm: number;
  numberPt: number;
  letterPt: number;
  padPt: number;
}

const CARD_LAYOUT: Record<CardSize, CardLayout> = {
  large: { cols: 2, rows: 2, rowGapMm: 5, colGapMm: 6, headMm: 9, numberPt: 26, letterPt: 11, padPt: 4 },
  // Not offered in the toolbar. A block is taller than wide, so 6 to a page leaves wide empty margins
  // either way round, and 9 to a page draws each block just as large. Kept so old code paths still type-check.
  medium: { cols: 2, rows: 3, rowGapMm: 3, colGapMm: 6, headMm: 8, numberPt: 18, letterPt: 10, padPt: 2 },
  compact: { cols: 3, rows: 3, rowGapMm: 3, colGapMm: 4, headMm: 7, numberPt: 17, letterPt: 10, padPt: 3 },
};

export interface CardSpec {
  /** Cards across and down one page. */
  cols: number;
  rows: number;
  rowGapMm: number;
  colGapMm: number;
  headMm: number;
  /** Lines kept for the footnote on every card. */
  footLines: number;
  /** Largest height and width of the block drawing in points, outline not included. */
  drawH: number;
  drawW: number;
  numberPt: number;
  letterPt: number;
  /** Blank space kept inside each piece around its number. */
  padPt: number;
}

/**
 * Card sizes worked out from the page box. The grid fills the first card
 * page under the "Block cards" heading. Every card keeps room for
 * `footLines` lines of footnote, so all cards are the same size. On later
 * card pages the cards stretch to fill the page and the drawing stays the
 * same size.
 */
export function cardSpec(size: CardSize, footLines = 1): CardSpec {
  const L = CARD_LAYOUT[size];
  const lines = Math.min(4, Math.max(1, Math.round(footLines)));
  const gridH = (FILL_H_MM - CARDS_HEAD_MM - (L.rows - 1) * L.rowGapMm) * PT_PER_MM;
  const cardH = gridH / L.rows;
  const chrome =
    2 * CARD_BORDER_PT +
    (CARD_PAD_TOP_MM + CARD_PAD_BOTTOM_MM + L.headMm + CARD_FOOT_GAP_MM) * PT_PER_MM +
    2 * DRAW_EDGE_PT +
    lines * FOOT_LINE_PT;
  const cardW = (PAGE_W - (L.cols - 1) * L.colGapMm * PT_PER_MM) / L.cols;
  const drawW = cardW - 2 * CARD_BORDER_PT - 2 * CARD_PAD_X_MM * PT_PER_MM - 2 * DRAW_EDGE_PT;
  return {
    cols: L.cols,
    rows: L.rows,
    rowGapMm: L.rowGapMm,
    colGapMm: L.colGapMm,
    headMm: L.headMm,
    footLines: lines,
    drawH: Math.floor((cardH - chrome) * 10) / 10,
    drawW: Math.floor(drawW * 10) / 10,
    numberPt: L.numberPt,
    letterPt: L.letterPt,
    padPt: L.padPt,
  };
}

/** Height of one card in points at its smallest, as laid out by buildSheet.css. */
export function cardHeight(spec: CardSpec, block: BlockDef): number {
  const drawH = block.height * cardScale(block, spec);
  return (
    2 * CARD_BORDER_PT +
    (CARD_PAD_TOP_MM + CARD_PAD_BOTTOM_MM + spec.headMm + CARD_FOOT_GAP_MM) * PT_PER_MM +
    drawH +
    2 * DRAW_EDGE_PT +
    spec.footLines * FOOT_LINE_PT
  );
}

/** The quilt picture page: heading above the picture, caption line below it, in mm. */
export const PICTURE_HEAD_MM = 11;
export const PICTURE_CAPTION_MM = 10;
/** Print resolution for the quilt picture, and the cap on its longest side, in pixels. */
export const PICTURE_PX_PER_INCH = 150;
export const PICTURE_MAX_PX = 2400;

/**
 * Size of the quilt picture on its page in mm: as large as fits under the
 * heading and above the caption, keeping the quilt's proportions, with room
 * for its outline.
 */
export function pictureBox(quiltW: number, quiltH: number): { wMm: number; hMm: number } {
  const maxW = PAGE_W_MM - 2;
  const maxH = FILL_H_MM - PICTURE_HEAD_MM - PICTURE_CAPTION_MM - 2;
  if (!(quiltW > 0 && quiltH > 0)) return { wMm: maxW, hMm: maxH };
  const k = Math.min(maxW / quiltW, maxH / quiltH);
  return { wMm: Math.floor(quiltW * k * 10) / 10, hMm: Math.floor(quiltH * k * 10) / 10 };
}

/** Canvas size in pixels for a picture printed at `wMm` by `hMm`. */
export function picturePixels(wMm: number, hMm: number): { w: number; h: number } {
  const ppmm = PICTURE_PX_PER_INCH / 25.4;
  const k = Math.min(ppmm, PICTURE_MAX_PX / Math.max(wMm, hMm, 1));
  return { w: Math.max(1, Math.round(wMm * k)), h: Math.max(1, Math.round(hMm * k)) };
}

/** Custom properties for the page CSS. */
export const SHEET_VARS: Record<string, string> = {
  '--bs-page-w': `${PAGE_W_MM}mm`,
  '--bs-page-h': `${PAGE_H_MM}mm`,
  '--bs-running-h': `${RUNNING_MM}mm`,
  '--bs-running-gap': `${RUNNING_GAP_MM}mm`,
  '--bs-folio-h': `${FOLIO_MM}mm`,
  '--bs-folio-gap': `${FOLIO_GAP_MM}mm`,
  '--bs-body-h': `${BODY_H_MM}mm`,
  '--bs-cards-head-h': `${CARDS_HEAD_MM}mm`,
  '--bs-foot-line': `${FOOT_LINE_PT}pt`,
  '--bs-table-swatch': `${TABLE_SWATCH_MM}mm`,
  '--bs-stack-swatch': `${STACK_SWATCH_MM}mm`,
  '--bs-stack-swatch-small': `${STACK_SWATCH_SMALL_MM}mm`,
  '--bs-picture-head-h': `${PICTURE_HEAD_MM}mm`,
  '--bs-picture-caption-h': `${PICTURE_CAPTION_MM}mm`,
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

/** Points per block inch for a card drawing: the block fills the drawing height unless the card is too narrow. */
export function cardScale(block: BlockDef, spec: CardSpec): number {
  return Math.min(spec.drawH / block.height, spec.drawW / block.width);
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

/** The map's margins in mm: 2mm above and 3mm below, as in buildSheet.css. */
export const MAP_MARGIN_TOP_MM = 2;
export const MAP_MARGIN_BOTTOM_MM = 3;
/** The map heading and a map note of up to 3 lines, in mm, for the default map size. */
const MAP_HEADING_MM = 11;
const MAP_NOTE_MM = 19;

/** Height for the map when it has its page to itself, outline not included. */
export const MAP_MAX_H =
  (FILL_H_MM - MAP_HEADING_MM - MAP_MARGIN_TOP_MM - MAP_MARGIN_BOTTOM_MM - MAP_NOTE_MM) * PT_PER_MM - 2 * DRAW_EDGE_PT;

/** Cell sizes for the layout map so the whole grid fits `maxH` points and the page width, as large as it can be. */
export function mapSpec(block: BlockDef, cols: number, rows: number, maxH: number = MAP_MAX_H): MapSpec {
  const gap = 4;
  const labelW = 46;
  const byW = (PAGE_W - 2 * DRAW_EDGE_PT - labelW - gap * (cols - 1)) / cols;
  const byH = ((maxH - gap * (rows - 1)) / rows) * (block.width / block.height);
  const cellW = Math.max(1, Math.min(byW, byH));
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

/** Height of the map's block on the page in points: margins, grid and outline. */
export function mapBlockHeight(block: BlockDef, cols: number, rows: number, maxH: number = MAP_MAX_H): number {
  const m = mapSpec(block, cols, rows, maxH);
  return (MAP_MARGIN_TOP_MM + MAP_MARGIN_BOTTOM_MM) * PT_PER_MM + rows * m.cellH + (rows - 1) * m.gap + 2 * DRAW_EDGE_PT;
}
