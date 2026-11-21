/**
 * Shared data shapes. A pattern and a fabric collection are plain data, and a
 * project pairs one of each. New patterns and collections are added as new
 * folders under src/patterns and src/fabrics without touching core or ui.
 *
 * All lengths are finished inches (after seams) unless a name says otherwise.
 */

/** [x, y] in inches. */
export type Point = readonly [number, number];

/** Block rotation in degrees, clockwise. */
export type Rotation = 0 | 90 | 180 | 270;

export interface PieceDef {
  /** Unique within the block, for example "A". */
  id: string;
  label: string;
  /** Closed outline in block-local inches, origin at the block's top left. */
  polygon: readonly Point[];
}

export interface BlockDef {
  width: number;
  height: number;
  pieces: readonly PieceDef[];
}

export interface QuiltSize {
  id: string;
  name: string;
  cols: number;
  rows: number;
}

export interface PatternDef {
  id: string;
  name: string;
  designer: string;
  block: BlockDef;
  sizes: readonly QuiltSize[];
  defaultSizeId: string;
  /** Rotations a block may take. Rectangular blocks allow only 0 and 180. */
  rotations: readonly Rotation[];
  /** How many lineup slots (fat quarters) this size uses. */
  lineupLength(size: QuiltSize): number;
  /**
   * The pattern's own fabric shuffle. Returns the lineup slot that fills
   * piece `pieceIndex` of block `blockId`, given `lineupLength` slots.
   */
  assign(blockId: number, pieceIndex: number, lineupLength: number): number;
  /** Rotation the pattern suggests for the block at a grid cell. */
  defaultRotation(col: number, row: number): Rotation;
}

export interface FabricDef {
  id: string;
  /** Display name, for example "Log Cabin · Sunset". */
  name: string;
  design: string;
  colorway: string;
  sku: string;
  /** URL of the full swatch image, ruler removed. */
  image: string;
  /** URL of a small square thumbnail for the tray. */
  thumb: string;
  /** Image pixels per inch of real fabric. */
  pxPerInch: number;
  /** Size of the swatch image in pixels. */
  widthPx: number;
  heightPx: number;
  /** Average color as #rrggbb, drawn before the image loads. */
  color: string;
}

export interface FabricCollection {
  id: string;
  name: string;
  designer: string;
  manufacturer: string;
  fabrics: readonly FabricDef[];
}

export interface ProjectDef {
  id: string;
  title: string;
  pattern: PatternDef;
  collection: FabricCollection;
}

/** One grid cell of the quilt. */
export interface PlacedBlock {
  /**
   * Identity of the sewn block, 0..n-1. It stays with the block when blocks
   * swap cells, so the shuffle, overrides, and print placement travel with it.
   */
  blockId: number;
  rotation: Rotation;
}

/** A saved design for one quilt size. */
export interface Design {
  sizeId: string;
  /** Fabric ids, one per lineup slot. A null slot has no fabric picked yet. */
  lineup: (string | null)[];
  /** Row-major grid cells. cells[row * cols + col]. */
  cells: PlacedBlock[];
  /** Hand-placed fabrics. Key is `${blockId}:${pieceId}`, value is a fabric id. */
  overrides: Record<string, string>;
}

/** A piece resolved to quilt coordinates, ready to draw or hit test. */
export interface ResolvedPiece {
  key: string;
  blockId: number;
  cellIndex: number;
  pieceId: string;
  pieceIndex: number;
  /** Null when the piece has no fabric yet. */
  fabricId: string | null;
  overridden: boolean;
  /** Outline in quilt inches, after block placement and rotation. */
  polygon: Point[];
  /** Rotation of the block, which also rotates the print. */
  rotation: Rotation;
  /**
   * Top left of the fabric crop in swatch inches, before rotation. The piece
   * shows the swatch at true scale starting from this offset. [0, 0] when
   * the piece has no fabric.
   */
  cropOrigin: Point;
}

/** A stored copy of one size's design that can be restored. */
export interface DesignVersion {
  id: string;
  sizeId: string;
  name: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  /** True for versions the app saves before a big change. */
  auto: boolean;
  /** Short label for an automatic version, for example "Before shuffle". */
  reason?: string;
  design: Design;
}
