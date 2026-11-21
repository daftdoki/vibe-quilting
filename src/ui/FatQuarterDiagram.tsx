import type { PatternDef, Point } from '../core/types';

/**
 * A picture of what happens to one fat quarter: it is cut into the block's
 * pieces, and the shuffle sends each piece to a different block. Drawn from
 * the pattern, so it works for any block shape.
 */

const W = 340;
const FQ_W = 124;
const GAP = 6;
const COLS = 3;
const ROWS = 3;

function centroid(poly: readonly Point[]): Point {
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

function points(poly: readonly Point[], scale: number, dx: number, dy: number): string {
  return poly.map(([x, y]) => `${(x * scale + dx).toFixed(1)},${(y * scale + dy).toFixed(1)}`).join(' ');
}

export function FatQuarterDiagram({ pattern }: { pattern: PatternDef }) {
  const { block } = pattern;
  const pieces = block.pieces;
  const blocks = COLS * ROWS;
  // The small quilt uses one fat quarter per block, like a real one.
  const slots = blocks;

  const s1 = FQ_W / block.width;
  const fqH = block.height * s1;
  const fqX = (W - FQ_W) / 2;
  const fqY = 30;

  const midY = fqY + fqH;
  const quiltY = midY + 98;
  const cellW = (W - GAP * (COLS - 1)) / COLS;
  const s2 = cellW / block.width;
  const cellH = block.height * s2;
  const H = quiltY + ROWS * cellH + GAP * (ROWS - 1) + 4;

  const first = pieces[0]?.label ?? '';
  const last = pieces[pieces.length - 1]?.label ?? '';

  return (
    <svg
      className="fq-diagram"
      viewBox={`0 0 ${W} ${H.toFixed(0)}`}
      role="img"
      aria-label={`One fat quarter is cut into ${pieces.length} pieces, ${first} to ${last}. After the shuffle each piece is in a different block.`}
    >
      <text className="fq-label" x={W / 2} y={18} textAnchor="middle">
        One fat quarter
      </text>
      {pieces.map((p) => {
        const [cx, cy] = centroid(p.polygon);
        return (
          <g key={p.id}>
            <polygon className="fq-piece is-own" points={points(p.polygon, s1, fqX, fqY)} />
            <text className="fq-letter is-own" x={cx * s1 + fqX} y={cy * s1 + fqY} textAnchor="middle" dominantBaseline="central">
              {p.label}
            </text>
          </g>
        );
      })}

      <text className="fq-step" x={W / 2} y={midY + 24} textAnchor="middle">
        cut into {pieces.length} pieces, then shuffled
      </text>
      <path
        className="fq-arrow"
        d={`M${W / 2} ${midY + 36} V${midY + 58} M${W / 2 - 8} ${midY + 50} L${W / 2} ${midY + 60} L${W / 2 + 8} ${midY + 50}`}
      />
      <text className="fq-label" x={W / 2} y={quiltY - 10} textAnchor="middle">
        Each piece lands in a different block
      </text>

      {Array.from({ length: blocks }, (_, b) => {
        const dx = (b % COLS) * (cellW + GAP);
        const dy = quiltY + Math.floor(b / COLS) * (cellH + GAP);
        return (
          <g key={b}>
            {pieces.map((p, i) => {
              const own = pattern.assign(b, i, slots) === 0;
              const [cx, cy] = centroid(p.polygon);
              return (
                <g key={p.id}>
                  <polygon className={`fq-piece${own ? ' is-own' : ''}`} points={points(p.polygon, s2, dx, dy)} />
                  {own && (
                    <text
                      className="fq-letter is-own"
                      x={cx * s2 + dx}
                      y={cy * s2 + dy}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
            <rect className="fq-block" x={dx} y={dy} width={cellW} height={cellH} />
          </g>
        );
      })}
    </svg>
  );
}

/** The diagram with the sentences that go with it. */
export function FatQuarterExplainer({ pattern }: { pattern: PatternDef }) {
  const n = pattern.block.pieces.length;
  const first = pattern.block.pieces[0]?.label ?? '';
  const last = pattern.block.pieces[n - 1]?.label ?? '';
  return (
    <div className="fq-explainer">
      <FatQuarterDiagram pattern={pattern} />
      <ul className="fq-points">
        <li>
          A fat quarter is one piece of fabric in one print. The pattern cuts it into {n} pieces, {first} to {last}.
        </li>
        <li>
          A block is {n} pieces sewn together, one for each letter. After the shuffle, each piece in a block comes from
          a different fat quarter.
        </li>
        <li>
          The numbers in the stack count fat quarters. The letters on the quilt name the places inside a block. A quilt
          needs one fat quarter for every block.
        </li>
      </ul>
    </div>
  );
}
