/**
 * Black line drawings for the build sheet: one block card drawing, and the
 * layout map. All sizes are points, and each SVG's viewBox uses the same
 * points as its width and height.
 */
import { rotatePoint } from '../../core/layout';
import type { SheetCell, SheetPiece } from '../../core/buildSheet';
import type { BlockDef, Point } from '../../core/types';
import { bbox, cardScale, centroid, fitFont, mapSpec, textWidth, type CardSpec } from './geometry';

/** Stroke widths in points. */
const PIECE_LINE = 0.75;
const BLOCK_LINE = 1.5;
const MARK_LINE = 1.5;
/** Room around the drawing so the outer line is not cut in half. */
const EDGE = BLOCK_LINE;

function pts(poly: readonly Point[], s: number, dx = 0, dy = 0): string {
  return poly.map(([x, y]) => `${(x * s + dx).toFixed(2)},${(y * s + dy).toFixed(2)}`).join(' ');
}

function svgBox(w: number, h: number) {
  return {
    width: `${(w + 2 * EDGE).toFixed(2)}pt`,
    height: `${(h + 2 * EDGE).toFixed(2)}pt`,
    viewBox: `${-EDGE} ${-EDGE} ${(w + 2 * EDGE).toFixed(2)} ${(h + 2 * EDGE).toFixed(2)}`,
  };
}

/**
 * One block, unrotated. Each piece shows its fabric number in the middle and
 * its letter in the top left corner. A hand-placed number is underlined, and
 * an empty piece shows a short dash.
 */
export function BlockDrawing({
  block,
  pieces,
  spec,
  label,
}: {
  block: BlockDef;
  pieces: readonly SheetPiece[];
  spec: CardSpec;
  label: string;
}) {
  const s = cardScale(block, spec);
  const w = block.width * s;
  const h = block.height * s;
  return (
    <svg className="bs-draw" {...svgBox(w, h)} role="img" aria-label={label}>
      {block.pieces.map((def, i) => {
        const piece = pieces[i];
        const b = bbox(def.polygon);
        const [cx0, cy0] = centroid(def.polygon);
        const cx = cx0 * s;
        const cy = cy0 * s;
        const text = piece?.fabric == null ? '' : String(piece.fabric);
        const pt = fitFont(text || '00', spec.numberPt, b.w * s, b.h * s, spec.padPt);
        const half = textWidth(text, pt) / 2;
        const dash = Math.min(spec.numberPt * 0.7, b.w * s - 2 * spec.padPt) / 2;
        return (
          <g key={def.id}>
            <polygon points={pts(def.polygon, s)} fill="none" stroke="#000" strokeWidth={PIECE_LINE} strokeLinejoin="miter" />
            <text
              className="bs-letter"
              x={b.x * s + spec.padPt}
              y={b.y * s + spec.padPt + spec.letterPt * 0.8}
              fontSize={spec.letterPt}
            >
              {def.label}
            </text>
            {text ? (
              <>
                <text className="bs-num" x={cx} y={cy} fontSize={pt} textAnchor="middle" dominantBaseline="central">
                  {text}
                </text>
                {piece?.changed && (
                  <line
                    x1={cx - half - 1}
                    x2={cx + half + 1}
                    y1={cy + pt * 0.48}
                    y2={cy + pt * 0.48}
                    stroke="#000"
                    strokeWidth={MARK_LINE}
                  />
                )}
              </>
            ) : (
              <line x1={cx - dash} x2={cx + dash} y1={cy} y2={cy} stroke="#000" strokeWidth={MARK_LINE * 1.5} />
            )}
          </g>
        );
      })}
      <rect x={0} y={0} width={w} height={h} fill="none" stroke="#000" strokeWidth={BLOCK_LINE} />
    </svg>
  );
}

/**
 * The quilt grid. Each cell is the block outline turned as placed, with its
 * block number upright in the middle and the first piece's letter upright
 * inside that piece, so the turn shows.
 */
export function LayoutMap({
  block,
  cols,
  rows,
  cells,
}: {
  block: BlockDef;
  cols: number;
  rows: number;
  cells: readonly SheetCell[];
}) {
  const m = mapSpec(block, cols, rows);
  const s = m.cellW / block.width;
  const w = m.labelW + cols * m.cellW + (cols - 1) * m.gap;
  const h = rows * m.cellH + (rows - 1) * m.gap;
  const first = block.pieces[0];
  const firstCenter = first ? centroid(first.polygon) : null;
  const cx = block.width / 2;
  const cy = block.height / 2;
  return (
    <svg
      className="bs-draw bs-map"
      {...svgBox(w, h)}
      role="img"
      aria-label={`Quilt layout, ${cols} by ${rows} blocks, with each block's number in its place.`}
    >
      {Array.from({ length: rows }, (_, r) => (
        <text
          key={`row${r}`}
          className="bs-row-label"
          x={0}
          y={r * (m.cellH + m.gap) + m.cellH / 2}
          fontSize={12}
          dominantBaseline="central"
        >
          Row {r + 1}
        </text>
      ))}
      {cells.map((cell, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dx = m.labelW + col * (m.cellW + m.gap);
        const dy = row * (m.cellH + m.gap);
        const turn = (poly: readonly Point[]) => poly.map((p) => rotatePoint(p, cell.rotation, cx, cy));
        const letterAt = firstCenter ? rotatePoint(firstCenter, cell.rotation, cx, cy) : null;
        return (
          <g key={i}>
            {/* Only the first piece is drawn. It shows which way up the block goes without cluttering the number. */}
            {first && (
              <polygon points={pts(turn(first.polygon), s, dx, dy)} fill="none" stroke="#000" strokeWidth={0.75} />
            )}
            <rect x={dx} y={dy} width={m.cellW} height={m.cellH} fill="none" stroke="#000" strokeWidth={BLOCK_LINE} />
            {first && letterAt && (
              <text
                className="bs-map-letter"
                x={letterAt[0] * s + dx}
                y={letterAt[1] * s + dy}
                fontSize={m.letterPt}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {first.label}
              </text>
            )}
            <text
              className="bs-map-num"
              x={dx + m.cellW / 2}
              y={dy + m.cellH / 2}
              fontSize={m.numberPt}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {cell.block}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
