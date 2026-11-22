/**
 * The printable build sheet and its full-screen preview. The preview is a
 * plain element portaled to <body>, outside #root, so the print rules can
 * hide the whole app and print only the pages. A <dialog> sits in the top
 * layer, which prints as one fixed page, so this does not use one.
 *
 * Pages are laid out in code. Every block of the sheet is first rendered in
 * a hidden measuring box as wide as a page, its height is read, and
 * `packPages` assigns blocks to fixed-size pages. Each page in the preview is
 * then one printed page. When measuring is not possible, the sheet falls
 * back to flowing pages that the browser breaks.
 *
 * Section order: Fabrics (header, note, fabrics table, extras), then the
 * colour picture of the quilt on a page of its own when it is on, then the
 * stacking order on a new page, the block cards, and the map with the
 * changes table. With the picture off, the stacking order follows the
 * fabrics on the same page when it fits.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { buildSheetData, type BuildSheet, type SheetBlock, type SheetFabric } from '../../core/buildSheet';
import { loadSheetPrefs, saveSheetPrefs, type SheetPrefs } from '../../core/storage';
import type { BlockDef, Design, ProjectDef } from '../../core/types';
import { inches } from '../format';
import { Icon } from '../Icon';
import { BlockDrawing, LayoutMap } from './drawings';
import {
  cardSpec,
  DRAW_EDGE_PT,
  FILL_H_MM,
  FOOT_LINE_PT,
  MAP_MARGIN_BOTTOM_MM,
  MAP_MARGIN_TOP_MM,
  MAP_MAX_H,
  mapBlockHeight,
  mapSpec,
  PAGE_W_MM,
  pictureBox,
  PT_PER_MM,
  PX_PER_MM,
  SHEET_VARS,
  stackColumns,
  type CardSize,
} from './geometry';
import { packPages, type PackItem, type Placed } from './paginate';
import { renderQuiltPicture } from './quiltPicture';
import './buildSheet.css';

/** Class on <html> while the preview is open. The print rules key off it. */
const OPEN_CLASS = 'has-build-sheet';
/** Screen width of one sheet of paper in the preview, in CSS px: the 186mm page box and 12mm each side. */
const PAPER_PX = 210 * PX_PER_MM;
/** Longest wait for fabric pictures before the pages are laid out anyway. */
const IMAGE_WAIT_MS = 10000;

const varsStyle = SHEET_VARS as CSSProperties;

const CARD_CHOICES: readonly (readonly [CardSize, string])[] = [
  ['compact', 'Standard cards, 9 to a page'],
  ['large', 'Large cards, 4 to a page'],
];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "A", "A and B", "A, B and C" */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function fabricText(f: SheetFabric | undefined, n: number | null): string {
  if (n === null) return 'No fabric';
  return f ? `Fabric ${n} · ${f.name}` : `Fabric ${n}`;
}

function TickBox({ label }: { label?: string }) {
  return (
    <span className="bs-tick-wrap">
      <span className="bs-tick" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

/** A small square of the fabric, or an empty outlined square. Decorative: the text next to it names the fabric. */
function Swatch({ src }: { src: string | undefined }) {
  if (!src) return <span className="bs-swatch bs-swatch-empty" aria-hidden="true" />;
  return <img className="bs-swatch" src={src} width={42} height={42} alt="" draggable={false} />;
}

function shortageLines(sheet: BuildSheet): string[] {
  return sheet.buy
    .filter((b) => b.extra > 0)
    .map((b) => {
      const parts = sheet.shortages
        .filter((s) => s.fabric === b.fabric)
        .map((s) => `${s.extra} extra ${s.piece} ${s.extra === 1 ? 'piece' : 'pieces'}`);
      const more = b.extra === 1 ? '1 more fat quarter' : `${b.extra} more fat quarters`;
      return `Fabric ${b.fabric} needs ${joinList(parts)}, so buy ${more} of it.`;
    });
}

function changedText(b: SheetBlock): string {
  const changed = b.pieces.filter((p) => p.changed).map((p) => p.label);
  return changed.length > 0 ? `${joinList(changed)} changed by hand` : '';
}

// Sheet content as blocks

type TableKey = 'fabrics' | 'changes';

interface TableDef {
  className: string;
  cols: { key: string; label: string; mm: number; ariaLabel?: string }[];
  count: number;
  row(i: number, measureId?: string): ReactNode;
}

/** One measurable piece of a flowing section. `gap` is the space above it in mm, dropped at the top of a page. */
export type Blk =
  | { kind: 'node'; id: string; gap: number; keep?: boolean; node: ReactNode }
  | { kind: 'head'; id: string; table: TableKey; gap: number }
  | { kind: 'row'; id: string; table: TableKey; row: number }
  /** The whole Stacking order section: one block that never splits. */
  | { kind: 'stacking'; id: string; gap: number }
  /** The layout map, drawn at the size the layout picks. */
  | { kind: 'map'; id: string };

/** Choices the measuring makes that change how blocks draw. */
export interface DrawChoices {
  /** Use the smaller stack swatch, so the Stacking order fits its page. */
  stackSmall: boolean;
  /** Most height for the layout map, in points. */
  mapMaxH: number;
}

const DEFAULT_CHOICES: DrawChoices = { stackSmall: false, mapMaxH: MAP_MAX_H };

export interface SheetContent {
  running: string;
  pictures: boolean;
  /** The Fabrics section and the Stacking order section, in that order. */
  first: Blk[];
  /** How many of `first` belong to the Fabrics section. */
  fabricsCount: number;
  map: Blk[];
  tables: Record<TableKey, TableDef>;
  stacking(small: boolean): ReactNode;
  mapNode(maxH: number): ReactNode;
  mapGrid: { block: BlockDef; cols: number; rows: number };
}

export function sheetContent({
  project,
  sheet,
  printed,
  quiltName,
  pictures,
  thumbs,
}: {
  project: ProjectDef;
  sheet: BuildSheet;
  printed: string;
  quiltName: string;
  pictures: boolean;
  thumbs: ReadonlyMap<string, string>;
}): SheetContent {
  const { pattern } = project;
  const { summary } = sheet;
  const fabricByNo = new Map(sheet.fabrics.map((f) => [f.number, f]));
  const thumbOf = (n: number | null): string | undefined => {
    const f = n === null ? undefined : fabricByNo.get(n);
    return f ? thumbs.get(f.id) : undefined;
  };
  const running = quiltName
    ? `${quiltName}, ${project.title}, ${summary.sizeName}`
    : `${project.title}, ${summary.sizeName}`;
  const lines = shortageLines(sheet);
  const notes = pattern.buildNotes ?? [];
  const firstLabel = pattern.block.pieces[0]?.label ?? '';

  const fabricCols = pictures
    ? [
        { key: 'pic', label: '', mm: 10, ariaLabel: 'Fabric picture' },
        { key: 'no', label: 'No.', mm: 12 },
        { key: 'name', label: 'Fabric', mm: 62 },
        { key: 'sku', label: 'SKU', mm: 26 },
        { key: 'buy', label: 'Fat quarters to buy', mm: 54 },
        { key: 'have', label: 'Have it', mm: 22 },
      ]
    : [
        { key: 'no', label: 'No.', mm: 14 },
        { key: 'name', label: 'Fabric', mm: 68 },
        { key: 'sku', label: 'SKU', mm: 30 },
        { key: 'buy', label: 'Fat quarters to buy', mm: 52 },
        { key: 'have', label: 'Have it', mm: 22 },
      ];

  const tables: Record<TableKey, TableDef> = {
    fabrics: {
      className: 'bs-fabrics',
      cols: fabricCols,
      count: sheet.fabrics.length,
      row(i, measureId) {
        const f = sheet.fabrics[i];
        if (!f) return null;
        const buy = sheet.buy[f.number - 1];
        return (
          <tr key={f.id} data-m={measureId}>
            {pictures && (
              <td className="bs-swatch-cell">
                <Swatch src={thumbs.get(f.id)} />
              </td>
            )}
            <td className="bs-no">{f.number}</td>
            <td>{f.name}</td>
            <td>{f.sku}</td>
            <td>
              <strong>{buy?.total ?? 0}</strong>
              {buy && buy.extra > 0 && <span className="bs-cell-note">with {buy.extra} extra, see below</span>}
            </td>
            <td className="bs-have">
              <TickBox />
            </td>
          </tr>
        );
      },
    },
    changes: {
      className: 'bs-changes',
      cols: [
        { key: 'block', label: 'Block', mm: 20 },
        { key: 'piece', label: 'Piece', mm: 20 },
        { key: 'use', label: 'Use fabric', mm: 73 },
        { key: 'was', label: 'In place of', mm: 73 },
      ],
      count: sheet.changes.length,
      row(i, measureId) {
        const c = sheet.changes[i];
        if (!c) return null;
        return (
          <tr key={`${c.block}:${c.piece}`} data-m={measureId}>
            <td>{c.block}</td>
            <td>{c.piece}</td>
            <td>{fabricText(fabricByNo.get(c.fabric), c.fabric)}</td>
            <td>{fabricText(c.shuffled === null ? undefined : fabricByNo.get(c.shuffled), c.shuffled)}</td>
          </tr>
        );
      },
    },
  };

  const stackCols = stackColumns(sheet.stack.length);
  // Three narrow columns leave out the word "Fabric", and a key line says what the numbers mean.
  const terse = stackCols === 3;
  const stackRows = Math.max(1, Math.ceil(sheet.stack.length / stackCols));
  const stacking = (small: boolean) => (
    <div className={`bs-stacking${pictures ? ' bs-stacking-pictures' : ''}${small ? ' bs-stack-small' : ''}`}>
      <h2>Stacking order</h2>
      {notes.length > 0 && (
        <ol className="bs-steps">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      )}
      <p className="bs-stack-intro">Cut each fat quarter as your pattern shows.</p>
      {terse && (
        <p className="bs-stack-intro">
          In the list, the bold number is the place in the pile. After it come the fabric's number and name from the
          Fabrics table.
        </p>
      )}
      <h3 className="bs-stack-h">The stack, top to bottom</h3>
      <ol
        className="bs-stack"
        style={{
          gridTemplateColumns: `repeat(${stackCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${stackRows}, auto)`,
        }}
      >
        {sheet.stack.map((slot) => {
          const f = slot.fabric === null ? undefined : fabricByNo.get(slot.fabric);
          const text =
            slot.fabric === null
              ? 'No fabric yet'
              : terse
                ? f
                  ? `${slot.fabric} · ${f.name}`
                  : String(slot.fabric)
                : fabricText(f, slot.fabric);
          return (
            <li key={slot.position}>
              <strong className="bs-stack-pos">
                {slot.position}
                {terse ? '' : '.'}
              </strong>
              {pictures && <Swatch src={thumbOf(slot.fabric)} />}
              <span className="bs-stack-name">{text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const first: Blk[] = [
    {
      kind: 'node',
      id: 'head',
      gap: 0,
      node: (
        <header className="bs-head">
          <h1>{quiltName || project.title}</h1>
          <dl className="bs-facts">
            {quiltName && (
              <>
                <dt>Pattern and fabrics</dt>
                <dd>{project.title}</dd>
              </>
            )}
            <dt>Size</dt>
            <dd>{summary.sizeName}</dd>
            <dt>Finished size</dt>
            <dd>
              {inches(summary.widthIn)} by {inches(summary.heightIn)} inches
            </dd>
            <dt>Grid</dt>
            <dd>
              {summary.cols} by {summary.rows} blocks, {summary.blockCount} in all
            </dd>
            <dt>Fat quarters</dt>
            <dd>{summary.fatQuarters}</dd>
            <dt>Printed</dt>
            <dd>{printed}</dd>
          </dl>
        </header>
      ),
    },
    {
      kind: 'node',
      id: 'lead',
      gap: 3,
      node: <p className="bs-lead">Numbers stand for fabrics. Label each fat quarter with its number before you cut.</p>,
    },
    { kind: 'node', id: 'fabrics-h', gap: 5, keep: true, node: <h2>Fabrics</h2> },
    { kind: 'head', id: 'fabrics:head', table: 'fabrics', gap: 0 },
    ...sheet.fabrics.map((_, i): Blk => ({ kind: 'row', id: `fabrics:${i}`, table: 'fabrics', row: i })),
  ];
  if (lines.length > 0) {
    first.push({
      kind: 'node',
      id: 'extras',
      gap: 4,
      node: (
        <div className="bs-box">
          <h3>Extra fat quarters, for pieces placed by hand</h3>
          <ul>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ),
    });
  }
  if (sheet.emptyPieces > 0) {
    first.push({
      kind: 'node',
      id: 'empty',
      gap: 3,
      node: (
        <p>
          {sheet.emptyPieces === 1
            ? '1 piece has no fabric yet. It is marked with a dash.'
            : `${sheet.emptyPieces} pieces have no fabric yet. They are marked with a dash.`}
        </p>
      ),
    });
  }
  const fabricsCount = first.length;
  first.push({ kind: 'stacking', id: 'stacking', gap: 7 });

  const map: Blk[] = [
    { kind: 'node', id: 'map-h', gap: 0, keep: true, node: <h2>Where each block goes</h2> },
    { kind: 'map', id: 'map' },
    {
      kind: 'node',
      id: 'map-note',
      gap: 0,
      node: (
        <p className="bs-map-note">
          {firstLabel} marks the same corner of every block. Turn each block so its {firstLabel} sits where the map
          shows. Row 1 is the top of the quilt.
        </p>
      ),
    },
  ];
  if (sheet.changes.length > 0) {
    map.push(
      { kind: 'node', id: 'changes-h', gap: 7, keep: true, node: <h2>Changes by hand</h2> },
      { kind: 'head', id: 'changes:head', table: 'changes', gap: 0 },
      ...sheet.changes.map((_, i): Blk => ({ kind: 'row', id: `changes:${i}`, table: 'changes', row: i })),
    );
  }

  const mapNode = (maxH: number) => (
    <LayoutMap
      block={pattern.block}
      cols={sheet.layout.cols}
      rows={sheet.layout.rows}
      cells={sheet.layout.cells}
      maxH={maxH}
    />
  );

  return {
    running,
    pictures,
    first,
    fabricsCount,
    map,
    tables,
    stacking,
    mapNode,
    mapGrid: { block: pattern.block, cols: sheet.layout.cols, rows: sheet.layout.rows },
  };
}

function SheetTable({ def, rows, measure }: { def: TableDef; rows: readonly number[]; measure?: TableKey }) {
  return (
    <table className={`bs-table ${def.className}`}>
      <colgroup>
        {def.cols.map((c) => (
          <col key={c.key} style={{ width: `${c.mm}mm` }} />
        ))}
      </colgroup>
      <thead data-m={measure ? `${measure}:head` : undefined}>
        <tr>
          {def.cols.map((c) => (
            <th key={c.key} scope="col" aria-label={c.ariaLabel}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map((i) => def.row(i, measure ? `${measure}:${i}` : undefined))}</tbody>
    </table>
  );
}

function Spaced({ first, gap, children }: { first: boolean; gap: number; children: ReactNode }) {
  return (
    <div className="bs-blk" style={first || gap === 0 ? undefined : { marginTop: `${gap}mm` }}>
      {children}
    </div>
  );
}

/** The blocks placed on one page. Consecutive parts of one table become one table with its header row. */
function placedBlocks(
  content: SheetContent,
  blks: readonly Blk[],
  placed: readonly Placed[],
  choices: DrawChoices,
): ReactNode[] {
  const out: ReactNode[] = [];
  let run: { table: TableKey; rows: number[]; first: boolean; gap: number; key: string } | null = null;
  const flush = () => {
    if (!run) return;
    out.push(
      <Spaced key={run.key} first={run.first} gap={run.gap}>
        <SheetTable def={content.tables[run.table]} rows={run.rows} />
      </Spaced>,
    );
    run = null;
  };
  for (const p of placed) {
    const b = blks[p.item];
    if (!b) continue;
    if (b.kind === 'head' || b.kind === 'row') {
      if (!run || run.table !== b.table) {
        flush();
        run = { table: b.table, rows: [], first: p.first, gap: b.kind === 'head' ? b.gap : 0, key: b.id };
      }
      if (b.kind === 'row') run.rows.push(b.row);
      continue;
    }
    flush();
    const node =
      b.kind === 'node' ? b.node : b.kind === 'stacking' ? content.stacking(choices.stackSmall) : content.mapNode(choices.mapMaxH);
    out.push(
      <Spaced key={b.id} first={p.first} gap={b.kind === 'map' ? 0 : b.gap}>
        {node}
      </Spaced>,
    );
  }
  flush();
  return out;
}

/** Blocks from..to of a section in order, for the flowing fallback. */
function allPlaced(from: number, to: number): Placed[] {
  const out: Placed[] = [];
  for (let i = from; i < to; i++) out.push({ item: i, first: i === from, repeatsHeader: false });
  return out;
}

// Pages

export type SheetPage =
  | { kind: 'flow'; section: 'first' | 'map'; placed: Placed[] }
  | { kind: 'cards'; index: number; blocks: SheetBlock[] }
  | { kind: 'picture' };

/** The colour picture of the quilt, ready to place. */
interface QuiltPicture {
  url: string;
  wMm: number;
  hMm: number;
  alt: string;
  caption: string;
}

function PicturePage({ picture }: { picture: QuiltPicture }) {
  return (
    <section className="bs-picture">
      <h2 className="bs-picture-head">The finished quilt</h2>
      <div className="bs-picture-area">
        <img
          className="bs-quilt-pic"
          src={picture.url}
          alt={picture.alt}
          style={{ width: `${picture.wMm}mm`, height: `${picture.hMm}mm` }}
        />
      </div>
      <p className="bs-picture-caption">{picture.caption}</p>
    </section>
  );
}

/** Packed pages of each flowing part. `Placed.item` indexes `content.first` or `content.map`. */
export interface SheetLayout extends DrawChoices {
  /** The Fabrics section alone, and the Stacking order section alone, for when the picture sits between them. */
  fabrics: Placed[][];
  stacking: Placed[][];
  /** Both sections packed one after the other, for when there is no picture. */
  together: Placed[][];
  map: Placed[][];
  /** Footnote lines kept on every card. */
  footLines: number;
}

function cardPages(blocks: readonly SheetBlock[], size: CardSize): SheetPage[] {
  const spec = cardSpec(size);
  const perPage = spec.cols * spec.rows;
  const pages: SheetPage[] = [];
  for (let i = 0; i < blocks.length; i += perPage) {
    pages.push({ kind: 'cards', index: pages.length, blocks: blocks.slice(i, i + perPage) });
  }
  return pages;
}

function PageFrame({
  running,
  folio,
  className,
  children,
}: {
  running: string;
  /** "Page N of M", or null for a flowing page. */
  folio: string | null;
  className: string;
  children: ReactNode;
}) {
  return (
    <article className={`bs-page ${folio === null ? 'bs-flow' : 'bs-fixed'} ${className}`}>
      <p className="bs-running">{running}</p>
      <div className="bs-body">{children}</div>
      {folio !== null && <p className="bs-folio">{folio}</p>}
    </article>
  );
}

function CardsPage({
  project,
  blocks,
  first,
  size,
  footLines,
}: {
  project: ProjectDef;
  blocks: readonly SheetBlock[];
  first: boolean;
  size: CardSize;
  footLines: number;
}) {
  const { pattern } = project;
  const spec = cardSpec(size, footLines);
  return (
    <section className={`bs-cards bs-cards-${size}`} aria-label={first ? undefined : 'Block cards, continued'}>
      {first && (
        <div className="bs-cards-head">
          <h2>Block cards</h2>
          <p>Big numbers are fabrics. Small letters name the pieces.</p>
        </div>
      )}
      <div
        className="bs-card-grid"
        style={{
          gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`,
          gap: `${spec.rowGapMm}mm ${spec.colGapMm}mm`,
        }}
      >
        {blocks.map((b) => (
          <div key={b.number} className="bs-card">
            <div className="bs-card-head" style={{ height: `${spec.headMm}mm` }}>
              <h3>Block {b.number}</h3>
              <TickBox label="Sewn" />
            </div>
            <div className="bs-card-draw">
              <BlockDrawing
                block={pattern.block}
                pieces={b.pieces}
                spec={spec}
                label={`Block ${b.number}. ${b.pieces
                  .map((p) => `${p.label} ${p.fabric === null ? 'no fabric' : `fabric ${p.fabric}`}`)
                  .join(', ')}.`}
              />
            </div>
            <p className="bs-card-foot" style={{ height: `${spec.footLines * FOOT_LINE_PT}pt` }}>
              {changedText(b)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SheetPages({
  project,
  sheet,
  content,
  layout,
  cardSize,
  picture,
}: {
  project: ProjectDef;
  sheet: BuildSheet;
  content: SheetContent;
  /** Null for the flowing fallback. */
  layout: SheetLayout | null;
  cardSize: CardSize;
  picture: QuiltPicture | null;
}) {
  const pages = composePages(content, sheet, cardSize, layout, picture !== null);
  // The fallback keeps two footnote lines, enough for every piece of a nine-piece block.
  const footLines = layout?.footLines ?? 2;
  const choices: DrawChoices = layout ?? DEFAULT_CHOICES;
  return (
    <>
      {pages.map((p, i) => {
        const folio = layout ? `Page ${i + 1} of ${pages.length}` : null;
        if (p.kind === 'picture') {
          return (
            <PageFrame key="picture" running={content.running} folio={folio} className="bs-page-picture">
              <PicturePage picture={picture!} />
            </PageFrame>
          );
        }
        if (p.kind === 'cards') {
          return (
            <PageFrame key={`cards${p.index}`} running={content.running} folio={folio} className="bs-page-cards">
              <CardsPage project={project} blocks={p.blocks} first={p.index === 0} size={cardSize} footLines={footLines} />
            </PageFrame>
          );
        }
        const blks = p.section === 'first' ? content.first : content.map;
        return (
          <PageFrame key={`${p.section}${i}`} running={content.running} folio={folio} className={`bs-page-${p.section}`}>
            {placedBlocks(content, blks, p.placed, choices)}
          </PageFrame>
        );
      })}
    </>
  );
}

/**
 * Every page in order: Fabrics, the quilt picture on its own page, Stacking
 * order on a new page, block cards, then the map and changes. With no
 * picture, Stacking order follows Fabrics on the same page when it fits.
 */
export function composePages(
  content: SheetContent,
  sheet: BuildSheet,
  cardSize: CardSize,
  layout: SheetLayout | null,
  withPicture: boolean,
): SheetPage[] {
  const first = (placed: Placed[]): SheetPage => ({ kind: 'flow', section: 'first', placed });
  const map = (placed: Placed[]): SheetPage => ({ kind: 'flow', section: 'map', placed });
  const n = content.fabricsCount;
  const total = content.first.length;
  const fabrics = layout ? layout.fabrics : [allPlaced(0, n)];
  const stacking = layout ? layout.stacking : [allPlaced(n, total)];
  const together = layout ? layout.together : [allPlaced(0, total)];
  const head: SheetPage[] = withPicture
    ? [...fabrics.map(first), { kind: 'picture' }, ...stacking.map(first)]
    : together.map(first);
  const mapPages = layout ? layout.map : [allPlaced(0, content.map.length)];
  return [...head, ...cardPages(sheet.blocks, cardSize), ...mapPages.map(map)];
}

// Measuring

/** Every block rendered once, at page width, to read its height. Hidden, and not printed. */
function Measurer({
  content,
  sheet,
  cardSize,
  measureRef,
}: {
  content: SheetContent;
  sheet: BuildSheet;
  cardSize: CardSize;
  measureRef: React.RefObject<HTMLDivElement | null>;
}) {
  const spec = cardSpec(cardSize);
  const nodes = [...content.first, ...content.map].filter((b) => b.kind === 'node');
  return (
    <div ref={measureRef} className="bs-measure" aria-hidden="true" style={varsStyle}>
      {nodes.map((b) => (
        <div key={b.id} className="bs-blk" data-m={b.id}>
          {b.node}
        </div>
      ))}
      <div className="bs-blk" data-m="stacking">
        {content.stacking(false)}
      </div>
      {content.pictures && (
        <div className="bs-blk" data-m="stacking:small">
          {content.stacking(true)}
        </div>
      )}
      {(['fabrics', 'changes'] as const).map((key) => {
        const def = content.tables[key];
        if (def.count === 0 && key === 'changes') return null;
        return (
          <div key={key} className="bs-blk">
            <SheetTable def={def} rows={Array.from({ length: def.count }, (_, i) => i)} measure={key} />
          </div>
        );
      })}
      <div className={`bs-cards bs-cards-${cardSize}`}>
        <div
          className="bs-card-grid"
          style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`, gap: `${spec.rowGapMm}mm ${spec.colGapMm}mm` }}
        >
          {sheet.blocks.map((b, i) => {
            const text = changedText(b);
            if (!text) return null;
            return (
              <div key={b.number} className="bs-card">
                <p className="bs-card-foot" data-m={`foot:${i}`}>
                  {text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Settles when every image under `root` has loaded or failed, or after a time limit. */
function imagesSettled(root: Element | null): Promise<void> {
  if (!root) return Promise.resolve();
  const waits = Array.from(root.querySelectorAll('img'))
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    );
  if (waits.length === 0) return Promise.resolve();
  const limit = new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS));
  return Promise.race([Promise.all(waits).then(() => undefined), limit]);
}

function toItems(
  blks: readonly Blk[],
  h: ReadonlyMap<string, number>,
  mm: (n: number) => number,
  special: { stacking: number; map: number },
): PackItem[] | null {
  const items: PackItem[] = [];
  for (const b of blks) {
    if (b.kind === 'stacking') {
      items.push({ height: special.stacking, gapBefore: mm(b.gap) });
      continue;
    }
    if (b.kind === 'map') {
      items.push({ height: special.map, keepWithNext: true });
      continue;
    }
    const height = h.get(b.id);
    if (height === undefined) return null;
    if (b.kind === 'node') items.push({ height, gapBefore: mm(b.gap), keepWithNext: b.keep });
    else if (b.kind === 'head') items.push({ height, gapBefore: mm(b.gap), keepWithNext: true, group: b.table });
    else items.push({ height, group: b.table, header: h.get(`${b.table}:head`) ?? 0 });
  }
  return items;
}

/** Points to CSS pixels. */
const PX_PER_PT = 96 / 72;

/** Read the measured heights and pack the pages. Null when the box cannot be measured. */
function measureLayout(root: HTMLElement, content: SheetContent, sheet: BuildSheet): SheetLayout | null {
  const width = root.getBoundingClientRect().width;
  // The box is 186mm wide. Anything far off means styles are missing or the box is not laid out.
  if (!(width > PAGE_W_MM * PX_PER_MM * 0.9)) return null;
  const h = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('[data-m]').forEach((el) => {
    const id = el.dataset.m;
    if (id) h.set(id, el.getBoundingClientRect().height);
  });
  if ([...h.values()].some((v) => !Number.isFinite(v)) || (h.get('head') ?? 0) <= 0) return null;
  const mm = (n: number) => n * PX_PER_MM;
  const pageH = mm(FILL_H_MM);

  // Stacking order: one block. The smaller swatch is used only when the larger does not fit.
  const big = h.get('stacking');
  if (big === undefined) return null;
  const small = h.get('stacking:small');
  const stackSmall = big > pageH && small !== undefined && small < big;
  const stackingH = stackSmall && small !== undefined ? small : big;

  // Map: as large as its page allows, or smaller so the changes table fits under it.
  const { block, cols, rows } = content.mapGrid;
  // Half a millimetre less than the exact room, so a map sized to fill it never tips over the page by rounding.
  const mapRoom = pageH - (h.get('map-h') ?? 0) - (h.get('map-note') ?? 0) - mm(0.5);
  const fullMaxH = mapRoom / PX_PER_PT - (MAP_MARGIN_TOP_MM + MAP_MARGIN_BOTTOM_MM) * PT_PER_MM - 2 * DRAW_EDGE_PT;
  let mapMaxH = fullMaxH;
  if (sheet.changes.length > 0) {
    let changesPx = mm(7.5) + (h.get('changes-h') ?? 0) + (h.get('changes:head') ?? 0);
    for (let i = 0; i < sheet.changes.length; i++) changesPx += h.get(`changes:${i}`) ?? 0;
    const sharedMaxH = fullMaxH - changesPx / PX_PER_PT;
    const full = mapSpec(block, cols, rows, fullMaxH);
    const shared = sharedMaxH > 0 ? mapSpec(block, cols, rows, sharedMaxH) : null;
    // Share the page only while the map keeps at least 60% of its size and 14pt block numbers.
    if (shared && shared.cellW >= full.cellW * 0.6 && shared.cellW * 0.32 >= 14) mapMaxH = sharedMaxH;
  }
  const mapH = mapBlockHeight(block, cols, rows, mapMaxH) * PX_PER_PT;

  const special = { stacking: stackingH, map: mapH };
  const first = toItems(content.first, h, mm, special);
  const map = toItems(content.map, h, mm, special);
  if (!first || !map) return null;

  const linePx = FOOT_LINE_PT * PX_PER_PT;
  let footLines = 1;
  for (const [id, v] of h) if (id.startsWith('foot:')) footLines = Math.max(footLines, Math.round(v / linePx));

  const n = content.fabricsCount;
  const offset = (pages: Placed[][]) => pages.map((pg) => pg.map((p) => ({ ...p, item: p.item + n })));
  return {
    fabrics: packPages(first.slice(0, n), pageH),
    stacking: offset(packPages(first.slice(n), pageH)),
    together: packPages(first, pageH),
    map: packPages(map, pageH),
    footLines,
    stackSmall,
    mapMaxH,
  };
}

// Preview

interface Measured {
  content: SheetContent;
  cardSize: CardSize;
  epoch: number;
  /** Null when measuring failed, and the pages flow instead. */
  result: SheetLayout | null;
}

/** Full-screen preview with a toolbar. Escape closes it. */
export function BuildSheetOverlay({
  project,
  design,
  quiltName,
  onClose,
  fallbackFocus,
}: {
  project: ProjectDef;
  design: Design;
  /** The quilt's name, for the heading. The workspace sets the page title. */
  quiltName: string;
  onClose(): void;
  /** Where focus goes on close if the element that had it is gone. */
  fallbackFocus?: React.RefObject<HTMLElement | null>;
}) {
  const [prefs, setPrefs] = useState<SheetPrefs>(loadSheetPrefs);
  const { cardSize, pictures, quiltPicture } = prefs;
  const titleId = useId();
  const statusId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const sheet = useMemo(
    () => buildSheetData(project.pattern, project.collection, design),
    [project, design],
  );
  const thumbs = useMemo(() => new Map(project.collection.fabrics.map((f) => [f.id, f.thumb])), [project]);
  const [printed] = useState(() =>
    new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
  );
  const content = useMemo(
    () => sheetContent({ project, sheet, printed, quiltName, pictures, thumbs }),
    [project, sheet, printed, quiltName, pictures, thumbs],
  );

  const [fontEpoch, setFontEpoch] = useState(0);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const current =
    measured && measured.content === content && measured.cardSize === cardSize && measured.epoch === fontEpoch
      ? measured
      : null;

  // The colour picture of the quilt, drawn for this project and design.
  const [drawn, setDrawn] = useState<{ project: ProjectDef; design: Design; url: string | null } | null>(null);
  const pictureSettled = !quiltPicture || (drawn !== null && drawn.project === project && drawn.design === design);
  const pictureFailed = quiltPicture && pictureSettled && drawn?.url === null;
  const picture = useMemo((): QuiltPicture | null => {
    if (!quiltPicture || !drawn || drawn.url === null || drawn.project !== project || drawn.design !== design) return null;
    const { summary } = sheet;
    const box = pictureBox(summary.widthIn, summary.heightIn);
    return {
      url: drawn.url,
      ...box,
      alt: `The finished quilt in colour, ${summary.cols} by ${summary.rows} blocks.`,
      caption: `${summary.sizeName}, ${inches(summary.widthIn)} by ${inches(summary.heightIn)} inches`,
    };
  }, [quiltPicture, drawn, project, design, sheet]);

  // What the pages show. Print waits until every picture on them has loaded.
  const shown = useMemo(() => (current && pictureSettled ? { current, picture } : null), [current, pictureSettled, picture]);
  const [imagesFor, setImagesFor] = useState<typeof shown>(null);
  const ready = shown !== null && imagesFor === shown;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  useEffect(() => saveSheetPrefs(prefs), [prefs]);

  // Take focus, make the app behind inert, and give focus back on close.
  // Escape is heard on the document, since a click on the paper can leave focus on <body>.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById('root');
    document.documentElement.classList.add(OPEN_CLASS);
    appRoot?.setAttribute('inert', '');
    printRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove(OPEN_CLASS);
      appRoot?.removeAttribute('inert');
      // An element inside a closed sheet is not rendered, so it cannot take focus.
      const usable = before && before.isConnected && before.getClientRects().length > 0;
      (usable ? before : fallbackRef.current?.current)?.focus();
    };
  }, []);

  // A font that finishes loading changes text sizes, so measure again.
  useEffect(() => {
    const fonts = document.fonts as FontFaceSet | undefined;
    if (!fonts?.addEventListener) return;
    const onDone = () => setFontEpoch((e) => e + 1);
    fonts.addEventListener('loadingdone', onDone);
    return () => fonts.removeEventListener('loadingdone', onDone);
  }, []);

  // Measure once fonts and pictures are in, then pack the pages.
  useLayoutEffect(() => {
    let cancelled = false;
    let frame = 0;
    const epoch = fontEpoch;
    const fonts = document.fonts as FontFaceSet | undefined;
    const run = () => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const el = measureRef.current;
        let result: SheetLayout | null = null;
        try {
          result = el ? measureLayout(el, content, sheet) : null;
        } catch {
          result = null;
        }
        setMeasured({ content, cardSize, epoch, result });
      });
    };
    Promise.all([fonts?.ready ?? Promise.resolve(), imagesSettled(measureRef.current)]).then(run, run);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [content, sheet, cardSize, fontEpoch]);

  // Draw the quilt picture. A failed drawing leaves the page out.
  useEffect(() => {
    if (!quiltPicture) return;
    let cancelled = false;
    let url: string | null = null;
    renderQuiltPicture(project, design).then(
      (blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setDrawn({ project, design, url });
      },
      () => {
        if (!cancelled) setDrawn({ project, design, url: null });
      },
    );
    return () => {
      cancelled = true;
      if (url) {
        const gone = url;
        URL.revokeObjectURL(gone);
        setDrawn((d) => (d?.url === gone ? null : d));
      }
    };
  }, [project, design, quiltPicture]);

  // Print waits until the pictures on the pages themselves have loaded.
  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    void imagesSettled(pagesRef.current).then(() => {
      if (!cancelled) setImagesFor(shown);
    });
    return () => {
      cancelled = true;
    };
  }, [shown]);

  // Shrink the paper to fit a narrow screen. Print resets this.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, (el.clientWidth - 24) / PAPER_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageCount = shown?.current.result
    ? composePages(content, sheet, cardSize, shown.current.result, shown.picture !== null).length
    : null;
  const colourQuilt = quiltPicture && !pictureFailed;
  const inkNote =
    colourQuilt && pictures
      ? 'The quilt picture and fabric pictures use colour ink. Turn them off for black and white.'
      : colourQuilt
        ? 'The quilt picture uses colour ink. Turn it off for black and white.'
        : pictures
          ? 'Fabric pictures use a little colour ink. Turn them off for black and white.'
          : 'Black and white, light on ink.';
  const status = !ready ? 'Preparing pages' : pageCount !== null ? plural(pageCount, 'page', 'pages') : '';

  return createPortal(
    <div
      ref={rootRef}
      className="bs-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bs-toolbar">
        <h2 id={titleId} className="bs-toolbar-title">
          Build sheet
        </h2>
        <button
          ref={printRef}
          type="button"
          className="btn btn-primary"
          aria-disabled={!ready}
          aria-describedby={statusId}
          onClick={() => {
            if (ready) window.print();
          }}
        >
          <Icon name="print" />
          Print
        </button>
        <p id={statusId} className="bs-count" role="status">
          {status}
        </p>
        <div className="seg bs-size" role="group" aria-label="Card size">
          {CARD_CHOICES.map(([size, label]) => (
            <button
              key={size}
              type="button"
              aria-pressed={cardSize === size}
              onClick={() => setPrefs((p) => ({ ...p, cardSize: size }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="seg bs-size" role="group" aria-label="Pictures">
          <button
            type="button"
            aria-pressed={pictures}
            onClick={() => setPrefs((p) => ({ ...p, pictures: !p.pictures }))}
          >
            Fabric pictures
          </button>
          <button
            type="button"
            aria-pressed={quiltPicture}
            onClick={() => setPrefs((p) => ({ ...p, quiltPicture: !p.quiltPicture }))}
          >
            Quilt picture
          </button>
        </div>
        <p className="bs-toolbar-note">
          {pictureFailed && 'The quilt picture could not be drawn, so its page is left out. '}
          {inkNote} Use your printer's Save as PDF to keep a copy.
        </p>
        <button type="button" className="btn btn-ghost bs-close" onClick={onClose}>
          <Icon name="close" />
          Close
        </button>
      </div>
      <div ref={scrollRef} className="bs-scroll">
        {shown ? (
          <div ref={pagesRef} className="bs-pages" style={{ ...varsStyle, zoom }}>
            <SheetPages
              project={project}
              sheet={sheet}
              content={content}
              layout={shown.current.result}
              cardSize={cardSize}
              picture={shown.picture}
            />
          </div>
        ) : (
          <p className="bs-preparing">Preparing pages</p>
        )}
      </div>
      {!current && <Measurer content={content} sheet={sheet} cardSize={cardSize} measureRef={measureRef} />}
    </div>,
    document.body,
  );
}
