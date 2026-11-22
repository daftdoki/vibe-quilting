/**
 * The printable build sheet and its full-screen preview. The preview is a
 * plain element portaled to <body>, outside #root, so the print rules can
 * hide the whole app and let the pages flow. A <dialog> sits in the top
 * layer, which prints as one fixed page, so this does not use one.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { buildSheetData, type BuildSheet, type SheetFabric } from '../../core/buildSheet';
import type { Design, ProjectDef } from '../../core/types';
import { inches } from '../format';
import { Icon } from '../Icon';
import { BlockDrawing, LayoutMap } from './drawings';
import { CARD_SPECS, type CardSize } from './geometry';
import './buildSheet.css';

/** Class on <html> while the preview is open. The print rules key off it. */
const OPEN_CLASS = 'has-build-sheet';
/** Screen width of one sheet of paper in the preview, in CSS px (210mm). */
const PAPER_PX = (210 / 25.4) * 96;

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

export function BuildSheetPages({
  project,
  sheet,
  cardSize,
  printed,
  quiltName = '',
}: {
  project: ProjectDef;
  sheet: BuildSheet;
  cardSize: CardSize;
  printed: string;
  /** The quilt's name. Empty when it has none, and the project title is the heading. */
  quiltName?: string;
}) {
  const { pattern } = project;
  const { summary } = sheet;
  const spec = CARD_SPECS[cardSize];
  const perPage = spec.cols * spec.rows;
  const fabricByNo = new Map(sheet.fabrics.map((f) => [f.number, f]));
  const running = quiltName
    ? `${quiltName}, ${project.title}, ${summary.sizeName}`
    : `${project.title}, ${summary.sizeName}`;
  const lines = shortageLines(sheet);
  const notes = pattern.buildNotes ?? [];
  const firstLabel = pattern.block.pieces[0]?.label ?? '';

  const cardPages: (typeof sheet.blocks)[] = [];
  for (let i = 0; i < sheet.blocks.length; i += perPage) cardPages.push(sheet.blocks.slice(i, i + perPage));

  const page = (key: string, children: ReactNode, className = '') => (
    <article key={key} className={`bs-page ${className}`}>
      <p className="bs-running">{running}</p>
      {children}
    </article>
  );

  return (
    <>
      {page(
        'first',
        <>
          <header className="bs-head">
            <h1>{quiltName || project.title}</h1>
            {quiltName && (
              <p className="bs-subtitle">
                {project.title}, {summary.sizeName}
              </p>
            )}
            <dl className="bs-facts">
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
            <p className="bs-lead">Numbers stand for fabrics. Label each fat quarter with its number before you cut.</p>
          </header>

          <section className="bs-section">
            <h2>Fabrics</h2>
            <table className="bs-table bs-fabrics">
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Fabric</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Fat quarters to buy</th>
                  <th scope="col">Have it</th>
                </tr>
              </thead>
              <tbody>
                {sheet.fabrics.map((f) => {
                  const buy = sheet.buy[f.number - 1];
                  return (
                    <tr key={f.id}>
                      <td className="bs-no">{f.number}</td>
                      <td>{f.name}</td>
                      <td>{f.sku}</td>
                      <td>
                        <strong>{buy?.total ?? 0}</strong>
                        {buy && buy.extra > 0 && (
                          <span className="bs-cell-note">includes {buy.extra} extra, see below</span>
                        )}
                      </td>
                      <td className="bs-have">
                        <TickBox />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lines.length > 0 && (
              <div className="bs-box">
                <h3>Extra fat quarters</h3>
                <p>Each fat quarter gives one piece of each letter. Some pieces placed by hand need more than that.</p>
                <ul>
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {sheet.emptyPieces > 0 && (
              <p className="bs-empty-note">
                {sheet.emptyPieces === 1
                  ? '1 piece has no fabric yet. It is marked with a dash.'
                  : `${sheet.emptyPieces} pieces have no fabric yet. They are marked with a dash.`}
              </p>
            )}
          </section>

          <section className="bs-section bs-stacking">
            <h2>Stacking order</h2>
            {notes.length > 0 && (
              <ol className="bs-steps">
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
            )}
            <p>Cut each fat quarter as your pattern shows.</p>
            <h3>The stack, top to bottom</h3>
            <ol
              className="bs-stack"
              style={{ gridTemplateRows: `repeat(${Math.ceil(sheet.stack.length / 2)}, auto)` }}
            >
              {sheet.stack.map((s) => (
                <li key={s.position}>
                  {s.position}. {s.fabric === null ? 'No fabric yet' : fabricText(fabricByNo.get(s.fabric), s.fabric)}
                </li>
              ))}
            </ol>
          </section>
        </>,
        'bs-page-first',
      )}

      {cardPages.map((blocks, i) =>
        page(
          `cards${i}`,
          <section className={`bs-cards bs-cards-${cardSize}`} aria-label={i === 0 ? undefined : 'Block cards, continued'}>
            {i === 0 && (
              <div className="bs-section-head">
                <h2>Block cards</h2>
                <p>Big numbers are fabrics. Small letters name the pieces.</p>
              </div>
            )}
            <div className="bs-card-grid" style={{ gridTemplateColumns: `repeat(${spec.cols}, 1fr)` }}>
              {blocks.map((b) => {
                const changed = b.pieces.filter((p) => p.changed).map((p) => p.label);
                return (
                  <div key={b.number} className="bs-card">
                    <div className="bs-card-head">
                      <h3>Block {b.number}</h3>
                      <TickBox label="Sewn" />
                    </div>
                    <BlockDrawing
                      block={pattern.block}
                      pieces={b.pieces}
                      spec={spec}
                      label={`Block ${b.number}. ${b.pieces
                        .map((p) => `${p.label} ${p.fabric === null ? 'no fabric' : `fabric ${p.fabric}`}`)
                        .join(', ')}.`}
                    />
                    <p className="bs-card-foot">{changed.length > 0 ? `${joinList(changed)} changed by hand` : ''}</p>
                  </div>
                );
              })}
            </div>
          </section>,
          'bs-page-cards',
        ),
      )}

      {page(
        'map',
        <>
          <section className="bs-section">
            <h2>Where each block goes</h2>
            <LayoutMap block={pattern.block} cols={sheet.layout.cols} rows={sheet.layout.rows} cells={sheet.layout.cells} />
            <p className="bs-map-note">
              {firstLabel} marks the same corner of every block. Turn each block so its {firstLabel} sits where the map
              shows. Row 1 is the top of the quilt.
            </p>
          </section>
          {sheet.changes.length > 0 && (
            <section className="bs-section bs-changes">
              <h2>Changes by hand</h2>
              <table className="bs-table">
                <thead>
                  <tr>
                    <th scope="col">Block</th>
                    <th scope="col">Piece</th>
                    <th scope="col">Use fabric</th>
                    <th scope="col">In place of</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.changes.map((c) => (
                    <tr key={`${c.block}:${c.piece}`}>
                      <td>{c.block}</td>
                      <td>{c.piece}</td>
                      <td>{fabricText(fabricByNo.get(c.fabric), c.fabric)}</td>
                      <td>{fabricText(c.shuffled === null ? undefined : fabricByNo.get(c.shuffled), c.shuffled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>,
        'bs-page-map',
      )}
    </>
  );
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
  const [cardSize, setCardSize] = useState<CardSize>('large');
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const sheet = useMemo(
    () => buildSheetData(project.pattern, project.collection, design),
    [project, design],
  );
  const [printed] = useState(() =>
    new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
  );

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

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
        <button ref={printRef} type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="print" />
          Print
        </button>
        <div className="seg bs-size" role="group" aria-label="Card size">
          <button type="button" aria-pressed={cardSize === 'large'} onClick={() => setCardSize('large')}>
            Large cards, 4 to a page
          </button>
          <button type="button" aria-pressed={cardSize === 'compact'} onClick={() => setCardSize('compact')}>
            Compact cards, 9 to a page
          </button>
        </div>
        <p className="bs-toolbar-note">Black and white, light on ink. Use your printer's Save as PDF to keep a copy.</p>
        <button type="button" className="btn btn-ghost bs-close" onClick={onClose}>
          <Icon name="close" />
          Close
        </button>
      </div>
      <div ref={scrollRef} className="bs-scroll">
        <div className="bs-pages" style={{ zoom }}>
          <BuildSheetPages project={project} sheet={sheet} cardSize={cardSize} printed={printed} quiltName={quiltName} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
