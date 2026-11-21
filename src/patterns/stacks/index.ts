import type { PatternDef, PieceDef, Point } from '../../core/types';

/** Clockwise rectangle from the top left corner. */
function rect(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** Build a column of pieces from top to bottom. `heights` must sum to the block height. */
function column(
  x0: number,
  x1: number,
  items: readonly (readonly [string, number])[],
): PieceDef[] {
  let y = 0;
  return items.map(([id, h]) => {
    const piece: PieceDef = { id, label: id, polygon: rect(x0, y, x1, y + h) };
    y += h;
    return piece;
  });
}

/**
 * "Stacks" by Connie Kresin Campbell. One 15.5 x 18.5 block of nine
 * rectangles in three columns, cut from stacked fat quarters.
 */
export const stacks: PatternDef = {
  id: 'stacks',
  name: 'Stacks',
  designer: 'Connie Kresin Campbell',
  block: {
    width: 15.5,
    height: 18.5,
    pieces: [
      ...column(0, 3.5, [['A', 6.5], ['B', 7.5], ['C', 4.5]]),
      ...column(3.5, 11, [['D', 8.5], ['E', 3.5], ['F', 6.5]]),
      ...column(11, 15.5, [['G', 4.5], ['H', 8.5], ['I', 5.5]]),
    ],
  },
  sizes: [
    { id: 'runner', name: 'Table runner', cols: 3, rows: 1 },
    { id: 'crib', name: 'Crib', cols: 3, rows: 3 },
    { id: 'throw', name: 'Throw', cols: 4, rows: 4 },
    { id: 'twin', name: 'Twin', cols: 4, rows: 5 },
    { id: 'full', name: 'Full', cols: 5, rows: 5 },
    { id: 'queen', name: 'Queen', cols: 6, rows: 5 },
    { id: 'king', name: 'King', cols: 6, rows: 6 },
  ],
  defaultSizeId: 'throw',
  rotations: [0, 180],
  // One fat quarter per block.
  lineupLength: (size) => size.cols * size.rows,
  // Nine stacks of cut pieces. Stack p has its top p layers moved to the bottom,
  // so block b takes layer (b + p) mod n from stack p.
  assign: (blockId, pieceIndex, n) => (blockId + pieceIndex) % n,
  // Every other block is turned upside down.
  defaultRotation: (col, row) => ((col + row) % 2 === 1 ? 180 : 0),
  // With slot 0 on top, block k takes layer k of every shuffled stack, which
  // is slot (k + p) mod n, the same as `assign`. So the k-th block off the
  // stacks is block number k + 1.
  buildNotes: [
    'Lay the fat quarters in one pile in the order below, with number 1 on top, before you cut.',
    'Cut the pile and shuffle the stacks the way the pattern shows.',
    'The first block you take off the stacks is block 1, the next one is block 2, and so on.',
  ],
};
