import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearAllOverrides,
  clearOverride,
  createEmptyDesign,
  fabricUsage,
  fillEmptySlots,
  getSize,
  resetBlocks,
  rotateCell,
  setLineupSlot,
  setOverride,
  shuffleLineup,
  slotUsage,
  swapCells,
  swapLineupSlots,
} from '../core/design';
import { piecesForSlot, resolvePieces } from '../core/layout';
import type { ProjectDef } from '../core/types';
import { FabricTray } from './FabricTray';
import { GuideCard } from './guide/GuideCard';
import { TurnChoices } from './guide/steps';
import { useGuide } from './guide/useGuide';
import { Help } from './Help';
import { renderPng, shareOrDownload } from './exportPng';
import { sizeInches } from './format';
import { Icon } from './Icon';
import { imageCache } from './imageCache';
import { Lineup } from './Lineup';
import { QuiltCanvas, type QuiltCanvasHandle, type QuiltTap } from './QuiltCanvas';
import { buildScene, type Highlights } from './renderQuilt';
import { Sheet } from './Sheet';
import { SizePicker } from './SizePicker';
import { useDesign } from './useDesign';
import { useFabricDrag, type DropResult } from './useFabricDrag';
import { useMediaQuery, WIDE_QUERY } from './useMediaQuery';
import { REASONS, useVersions } from './versions/useVersions';
import { VersionsList } from './versions/VersionsList';

type Mode = 'fabrics' | 'blocks';
type SheetName = 'lineup' | 'size' | 'more' | 'help' | 'versions' | 'confirm-reset' | 'confirm-guide' | null;

const HINT_KEY = 'vq:v1:hint-seen';

/** Drag props for a tray that should not start drags. */
const NO_DRAG = () => ({
  onPointerDown() {},
  onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  },
});

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function Workspace({ project }: { project: ProjectDef }) {
  const { pattern, collection } = project;
  const ds = useDesign(project);
  const { design, update, undo, redo } = ds;
  const size = getSize(pattern, design.sizeId);
  const wide = useMediaQuery(WIDE_QUERY);

  const [mode, setMode] = useState<Mode>('fabrics');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [hintSeen, setHintSeen] = useState(readHintSeen);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const versions = useVersions(project, ds, setToast);
  // Big changes save an automatic version first, so they can be got back after a reload.
  const checkpoint = versions.updateWithCheckpoint;
  const guide = useGuide(project, ds, checkpoint);
  const guideControl = guide.control;
  /** Slot picked in the fat quarter stack outside the guide. */
  const [lineupSlot, setLineupSlotPick] = useState<number | null>(null);
  const canvasRef = useRef<QuiltCanvasHandle>(null);

  // The guide decides what taps do while it runs. Otherwise the Fabrics/Blocks toggle does.
  const tapMode: Mode | 'none' = guideControl?.mode ?? mode;
  const trayRole = guideControl?.tray ?? 'paint';

  const pieces = useMemo(() => resolvePieces(pattern, collection, design), [pattern, collection, design]);
  const scene = useMemo(
    () => buildScene(pattern, collection, design, pieces),
    [pattern, collection, design, pieces],
  );
  const usage = useMemo(
    () => (trayRole === 'fill' ? slotUsage(design) : fabricUsage(pattern, design)),
    [trayRole, pattern, design],
  );
  const fabricsById = useMemo(() => new Map(collection.fabrics.map((f) => [f.id, f])), [collection]);
  const overrideCount = Object.keys(design.overrides).length;

  useEffect(() => {
    void imageCache.loadAll(collection.fabrics);
  }, [collection]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const dismissHint = useCallback(() => {
    setHintSeen(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Hint shows again next time.
    }
  }, []);

  const focusCell = guideControl?.focusCell ?? null;

  // The stack shows beside the guide on wide screens while the order is being mixed.
  const stackBesideGuide = wide && (guide.step === 'shuffle' || guide.step === 'blocks');
  const lineupVisible = wide ? !guide.active || stackBesideGuide : sheet === 'lineup';
  // The slot whose pieces get yellow outlines: the guide's target, or the slot picked in the stack.
  const outlinedSlot = guide.step === 'fabrics' ? guide.targetSlot : lineupVisible ? lineupSlot : null;
  const slotPieces = useMemo(
    () => (outlinedSlot === null ? [] : piecesForSlot(pattern, pieces, design.lineup.length, outlinedSlot, true)),
    [pattern, pieces, design.lineup.length, outlinedSlot],
  );
  const slotKeys = useMemo(
    () => new Set(slotPieces.filter((p) => !p.overridden).map((p) => p.key)),
    [slotPieces],
  );

  const highlights = useMemo<Highlights>(
    () => ({
      infoKey: tapMode === 'fabrics' ? infoKey : null,
      selectedCell: tapMode === 'blocks' ? selectedCell : null,
      focusCell,
      slotKeys,
    }),
    [tapMode, infoKey, selectedCell, focusCell, slotKeys],
  );

  // A picked slot belongs to one size and one visit to the stack.
  useEffect(() => {
    setLineupSlotPick(null);
  }, [design.sizeId, lineupVisible]);

  // A new guide step starts with nothing picked.
  const guideStep = guide.step;
  useEffect(() => {
    setActiveId(null);
    setInfoKey(null);
    setSelectedCell(null);
  }, [guideStep]);

  // Zoom to the block being touched up, and fit the quilt again afterwards.
  const zoomedRef = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (focusCell !== null) {
      canvas.zoomToCell(focusCell);
      zoomedRef.current = true;
    } else if (zoomedRef.current || guideStep === 'done') {
      canvas.fit();
      zoomedRef.current = false;
    }
    // A size switch refits the canvas, so zoom again after it.
  }, [focusCell, guideStep, design.sizeId]);

  const onTap = useCallback(
    ({ piece, cell }: QuiltTap) => {
      if (tapMode === 'none') return;
      if (tapMode === 'blocks') {
        if (cell === null) setSelectedCell(null);
        else if (selectedCell === null) setSelectedCell(cell);
        else if (selectedCell === cell) update((d) => rotateCell(pattern, d, cell));
        else {
          const from = selectedCell;
          update((d) => swapCells(d, from, cell));
          setSelectedCell(null);
        }
        return;
      }
      if (!piece) {
        setInfoKey(null);
        return;
      }
      if (activeId) {
        update((d) => setOverride(pattern, d, piece.blockId, piece.pieceId, activeId));
        setInfoKey(null);
        if (!hintSeen) dismissHint();
      } else {
        setInfoKey((k) => (k === piece.key ? null : piece.key));
      }
    },
    [tapMode, selectedCell, activeId, pattern, update, hintSeen, dismissHint],
  );

  const onDrop = useCallback(
    ({ fabricId, piece, slot }: DropResult) => {
      // The guide only lets a drag start in steps where painting is allowed.
      if (piece) update((d) => setOverride(pattern, d, piece.blockId, piece.pieceId, fabricId));
      else if (slot !== null) update((d) => setLineupSlot(d, slot, fabricId));
      if (!hintSeen) dismissHint();
    },
    [pattern, update, hintSeen, dismissHint],
  );

  const { dragProps, takeClickSuppression } = useFabricDrag({
    canvas: canvasRef,
    scrollAxis: wide ? 'y' : 'x',
    onDrop,
    onStart: () => setInfoKey(null),
  });

  const toggleFabric = useCallback((id: string) => {
    setActiveId((cur) => (cur === id ? null : id));
    setInfoKey(null);
    setMode('fabrics');
  }, []);

  const fillFromTray = guide.fillFromTray;
  const onTrayTap = useCallback(
    (id: string) => (trayRole === 'fill' ? fillFromTray(id) : toggleFabric(id)),
    [trayRole, fillFromTray, toggleFabric],
  );

  const switchMode = (m: Mode) => {
    setMode(m);
    setInfoKey(null);
    setSelectedCell(null);
  };

  const startGuideOver = () => {
    checkpoint(REASONS.startOver, (d) => createEmptyDesign(pattern, d.sizeId));
    guide.start();
    setActiveId(null);
    setInfoKey(null);
    setSelectedCell(null);
    setSheet(null);
  };

  const pickSize = (id: string) => {
    ds.setSize(id);
    setInfoKey(null);
    setSelectedCell(null);
    setSheet(null);
  };

  const shuffle = () => {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    checkpoint(REASONS.shuffle, (d) => shuffleLineup(d, seed));
  };

  // Undo and redo. On a phone the buttons have no labels, so a short note says what happened.
  const doUndo = useCallback(() => {
    if (!ds.canUndo) return;
    undo();
    if (!wide) setToast('Undone');
  }, [ds.canUndo, undo, wide]);
  const doRedo = useCallback(() => {
    if (!ds.canRedo) return;
    redo();
    if (!wide) setToast('Redone');
  }, [ds.canRedo, redo, wide]);

  // One gentle pulse the first time each button becomes available in a session.
  const [pulse, setPulse] = useState<{ undo: boolean; redo: boolean }>({ undo: false, redo: false });
  const pulsed = useRef({ undo: false, redo: false });
  useEffect(() => {
    const which = ds.canUndo && !pulsed.current.undo ? 'undo' : ds.canRedo && !pulsed.current.redo ? 'redo' : null;
    if (!which) return;
    pulsed.current[which] = true;
    setPulse((p) => ({ ...p, [which]: true }));
    const t = window.setTimeout(() => setPulse((p) => ({ ...p, [which]: false })), 1200);
    return () => window.clearTimeout(t);
  }, [ds.canUndo, ds.canRedo]);

  const saveVersion = () => {
    const name = versions.save();
    if (name) setToast(`Saved as ${name}`);
  };

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    setSheet(null);
    try {
      const blob = await renderPng(scene);
      const name = `${project.id}-${size.id}.png`;
      await shareOrDownload(blob, name, `${project.title}, ${size.name}`);
      setToast(`Exported ${name}`);
    } catch {
      setToast('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        doRedo();
      } else if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setActiveId(null);
        setInfoKey(null);
        setSelectedCell(null);
      }
    };
    // iOS ignores user-scalable=no; this stops a page pinch on the chrome.
    const noPinch = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    document.addEventListener('gesturestart', noPinch);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('gesturestart', noPinch);
    };
  }, [doUndo, doRedo]);

  const activeFabric = activeId ? fabricsById.get(activeId) : undefined;
  const infoPiece = infoKey ? pieces.find((p) => p.key === infoKey) : undefined;
  const infoFabric = infoPiece?.fabricId ? fabricsById.get(infoPiece.fabricId) : undefined;
  const emptySlots = design.lineup.filter((id) => id === null).length;

  let status: React.ReactNode = null;
  if (tapMode === 'none') {
    status = null;
  } else if (tapMode === 'blocks') {
    status =
      selectedCell === null ? (
        <>
          <span className="status-text">Tap a block to pick it up.</span>
          <button type="button" className="btn btn-small" onClick={() => checkpoint(REASONS.resetBlocks, (d) => resetBlocks(pattern, d))}>
            Reset blocks
          </button>
        </>
      ) : (
        <>
          <span className="status-text">Tap another block to swap, or this one again to turn it.</span>
          <button type="button" className="btn btn-small" onClick={() => setSelectedCell(null)}>
            Done
          </button>
        </>
      );
  } else if (activeFabric) {
    status = (
      <>
        <img className="status-thumb" src={activeFabric.thumb} alt="" draggable={false} />
        <span className="status-text">
          <strong>{activeFabric.name}</strong>
          <span>Tap pieces to paint.</span>
        </span>
        <button type="button" className="btn btn-small" onClick={() => setActiveId(null)}>
          Done
        </button>
      </>
    );
  } else if (infoPiece && (infoFabric || infoPiece.fabricId === null)) {
    const col = (infoPiece.cellIndex % size.cols) + 1;
    const row = Math.floor(infoPiece.cellIndex / size.cols) + 1;
    status = (
      <>
        {infoFabric ? (
          <img className="status-thumb" src={infoFabric.thumb} alt="" draggable={false} />
        ) : (
          <span className="status-thumb status-thumb-empty" aria-hidden="true" />
        )}
        <span className="status-text">
          <strong>{infoFabric ? infoFabric.name : 'No fabric yet'}</strong>
          <span>
            Piece {pattern.block.pieces[infoPiece.pieceIndex]?.label ?? infoPiece.pieceId}, row {row}, block {col}
            {infoPiece.overridden ? ', placed by hand' : ''}
          </span>
        </span>
        {infoPiece.overridden && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => update((d) => clearOverride(d, infoPiece.blockId, infoPiece.pieceId))}
          >
            Reset to shuffle
          </button>
        )}
        <button type="button" className="icon-btn icon-btn-small" aria-label="Close" onClick={() => setInfoKey(null)}>
          <Icon name="close" size={18} />
        </button>
      </>
    );
  } else if (!hintSeen && !guide.active) {
    status = (
      <>
        <span className="status-text">
          Tap a fabric, then tap pieces to paint it. Or drag a fabric onto a piece.
        </span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            dismissHint();
            setSheet('help');
          }}
        >
          More tips
        </button>
        <button type="button" className="btn btn-small" onClick={dismissHint}>
          Got it
        </button>
      </>
    );
  }

  const modeToggle = (
    <div className="seg" role="group" aria-label="What a tap on the quilt does">
      <button type="button" aria-pressed={mode === 'fabrics'} onClick={() => switchMode('fabrics')}>
        Fabrics
      </button>
      <button type="button" aria-pressed={mode === 'blocks'} onClick={() => switchMode('blocks')}>
        Blocks
      </button>
    </div>
  );

  // Labeled in the wide layout, icons on a phone. Labels drop to icons when the top bar is tight.
  const undoRedo = (
    <div className="btn-row">
      <button
        type="button"
        className={`${wide ? 'btn btn-ghost topbar-btn' : 'icon-btn'}${pulse.undo ? ' is-pulse' : ''}`}
        onClick={doUndo}
        disabled={!ds.canUndo}
        aria-label="Undo"
        title="Undo"
      >
        <Icon name="undo" />
        {wide && <span className="btn-label">Undo</span>}
      </button>
      <button
        type="button"
        className={`${wide ? 'btn btn-ghost topbar-btn' : 'icon-btn'}${pulse.redo ? ' is-pulse' : ''}`}
        onClick={doRedo}
        disabled={!ds.canRedo}
        aria-label="Redo"
        title="Redo"
      >
        <Icon name="redo" />
        {wide && <span className="btn-label">Redo</span>}
      </button>
    </div>
  );

  const tray = (
    <FabricTray
      fabrics={collection.fabrics}
      usage={usage}
      activeId={trayRole === 'fill' ? null : activeId}
      layout={wide ? 'grid' : 'strip'}
      countNoun={trayRole === 'fill' ? 'slot' : 'piece'}
      onToggle={onTrayTap}
      dragProps={trayRole === 'fill' ? NO_DRAG : dragProps}
      takeClickSuppression={takeClickSuppression}
    />
  );

  const lineup = (
    <Lineup
      pattern={pattern}
      fabrics={collection.fabrics}
      lineup={design.lineup}
      blockCount={design.cells.length}
      onSetSlot={(slot, id) => update((d) => setLineupSlot(d, slot, id))}
      onSwap={(a, b) => update((d) => swapLineupSlots(d, a, b))}
      onShuffle={shuffle}
      onFillRest={() => checkpoint(REASONS.fillRest, (d) => fillEmptySlots(pattern, collection, d))}
      selected={lineupSlot}
      onSelect={setLineupSlotPick}
      showShuffle={!guide.active}
    />
  );

  // Turn-all choices for Blocks mode outside the guide. The guide shows its own.
  const turnChoices =
    !guide.active && mode === 'blocks' ? (
      <TurnChoices pattern={pattern} design={design} update={checkpoint} className="turn-choices" />
    ) : null;

  const guideCard = guide.active ? (
    <GuideCard
      guide={guide}
      project={project}
      design={design}
      checkpointUpdate={checkpoint}
      canUndo={ds.canUndo}
      onUndo={doUndo}
      fabricsById={fabricsById}
      activeName={activeFabric?.name ?? null}
      slotPieces={slotPieces}
      wide={wide}
      exporting={exporting}
      onExport={doExport}
      onHelp={() => setSheet('help')}
      onShuffle={shuffle}
    />
  ) : null;
  const showTray = trayRole !== 'hidden';

  return (
    <div className={`app ${wide ? 'is-wide' : 'is-narrow'} mode-${tapMode}${guide.active ? ' is-guided' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="title-btn"
          onClick={() => setSheet('size')}
          aria-label={`${project.title}. Size ${size.name}, ${sizeInches(pattern, size)}. Change size`}
        >
          <span className="title">{project.title}</span>
          <span className="size-chip">
            <span className="size-chip-name">{size.name}</span>
            <span className="size-chip-dim">{sizeInches(pattern, size)}</span>
            <Icon name="chevron" size={16} />
          </span>
        </button>
        {wide && (guide.active ? <span aria-hidden="true" /> : modeToggle)}
        <div className="topbar-actions">
          {undoRedo}
          {wide && (
            <>
              <button
                type="button"
                className="btn btn-ghost topbar-btn topbar-btn-wide topbar-versions"
                onClick={() => setSheet('versions')}
                aria-label="Versions"
                title="Versions"
              >
                <Icon name="versions" />
                <span className="btn-label">Versions</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost topbar-btn topbar-btn-wide"
                onClick={doExport}
                disabled={exporting}
                aria-label={exporting ? 'Exporting' : 'Export PNG'}
                title="Export PNG"
              >
                <Icon name="download" />
                <span className="btn-label">{exporting ? 'Exporting' : 'Export PNG'}</span>
              </button>
            </>
          )}
          <button type="button" className="icon-btn" onClick={() => setSheet('more')} aria-label="More actions">
            <Icon name="more" />
          </button>
        </div>
      </header>

      <main className="stage">
        <div className={`canvas-wrap${activeFabric && tapMode === 'fabrics' ? ' is-painting' : ''}`}>
          <QuiltCanvas ref={canvasRef} scene={scene} highlights={highlights} onTap={onTap} className="quilt" />
          <button
            type="button"
            className="icon-btn fit-btn"
            onClick={() => canvasRef.current?.fit()}
            aria-label="Fit quilt to screen"
            title="Fit quilt to screen"
          >
            <Icon name="fit" />
          </button>
          <button
            type="button"
            className="icon-btn fit-btn help-btn"
            onClick={() => setSheet('help')}
            aria-label="How to use"
            title="How to use"
          >
            <Icon name="help" />
          </button>
          {!guide.active && emptySlots > 0 && (
            <button
              type="button"
              className="resume-btn"
              onClick={guide.resume}
              aria-label={`Finish setup. ${emptySlots} ${emptySlots === 1 ? 'fat quarter is' : 'fat quarters are'} empty.`}
            >
              <span className="resume-dot" aria-hidden="true" />
              Finish setup
            </button>
          )}
          <div className="status-slot" aria-live="polite">
            {status && <div className={`status status-${tapMode}`}>{status}</div>}
          </div>
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </div>

        {wide ? (
          <aside className="panel" aria-label={guide.active ? 'Guided setup' : 'Fabrics and fat quarter stack'}>
            {guideCard}
            {turnChoices && (
              <section className="panel-section" aria-label="Turn all blocks">
                <div className="panel-head">
                  <h2>Turn all blocks</h2>
                </div>
                {turnChoices}
              </section>
            )}
            {showTray && (
              <section className="panel-section">
                <div className="panel-head">
                  <h2>Fabrics</h2>
                  <p>
                    {trayRole === 'fill'
                      ? 'Tap one to put it in the next fat quarter.'
                      : 'Tap one to paint with it, or drag it onto a piece.'}
                  </p>
                </div>
                {tray}
              </section>
            )}
            {(!guide.active || stackBesideGuide) && (
              <section className="panel-section">
                <div className="panel-head">
                  <h2>Fat quarter stack</h2>
                  {stackBesideGuide && <p>Watch the order change as you shuffle.</p>}
                </div>
                {lineup}
              </section>
            )}
          </aside>
        ) : (
          <div className="dock">
            {guideCard ?? (
              <div className="dock-bar">
                {modeToggle}
                <button type="button" className="btn btn-ghost" onClick={() => setSheet('lineup')}>
                  <Icon name="stack" />
                  Fat quarters
                </button>
              </div>
            )}
            {turnChoices}
            {showTray && tray}
          </div>
        )}
      </main>

      <Sheet open={sheet === 'size'} title="Quilt size" onClose={() => setSheet(null)}>
        <SizePicker pattern={pattern} sizeId={design.sizeId} onPick={pickSize} />
      </Sheet>

      <Sheet open={sheet === 'lineup'} title="Fat quarter stack" onClose={() => setSheet(null)} className="sheet-lineup">
        {lineup}
      </Sheet>

      <Sheet open={sheet === 'more'} title="Quilt actions" onClose={() => setSheet(null)}>
        <ul className="action-list">
          <li>
            <button type="button" className="action" onClick={() => setSheet('help')}>
              <Icon name="help" />
              <span>
                <strong>How to use</strong>
                <span>Placing fabrics, moving blocks, sizes and saving.</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="action" onClick={doExport} disabled={exporting}>
              <Icon name="download" />
              <span>
                <strong>Export PNG</strong>
                <span>Save or share a picture of the whole quilt.</span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action"
              onClick={() => {
                saveVersion();
                setSheet(null);
              }}
              disabled={!versions.canSave}
            >
              <Icon name="save" />
              <span>
                <strong>Save a version</strong>
                <span>
                  {versions.canSave
                    ? 'Keep a copy of this layout to come back to.'
                    : 'The quilt is empty, so there is nothing to save yet.'}
                </span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="action" onClick={() => setSheet('versions')}>
              <Icon name="versions" />
              <span>
                <strong>Versions</strong>
                <span>
                  {versions.list.length === 0
                    ? 'No saved versions for this size yet.'
                    : `${versions.list.length} saved for this size. Restore, rename or delete them.`}
                </span>
              </span>
            </button>
          </li>
          {!guide.active && (
            <li>
              <button
                type="button"
                className="action"
                onClick={() => {
                  guide.resume();
                  setSheet(null);
                }}
              >
                <Icon name="flag" />
                <span>
                  <strong>Resume the guide</strong>
                  <span>Keep this quilt as it is and pick up the steps again.</span>
                </span>
              </button>
            </li>
          )}
          <li>
            <button type="button" className="action" onClick={() => setSheet('confirm-guide')}>
              <Icon name="reset" />
              <span>
                <strong>Start over with the guide</strong>
                <span>Empty this quilt and set it up again from the first step.</span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action"
              onClick={() => setSheet('confirm-reset')}
              disabled={overrideCount === 0}
            >
              <Icon name="reset" />
              <span>
                <strong>Reset to shuffle</strong>
                <span>
                  {overrideCount === 0
                    ? 'No pieces are placed by hand.'
                    : `Remove ${overrideCount} hand-placed ${overrideCount === 1 ? 'fabric' : 'fabrics'}.`}
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action"
              onClick={() => {
                checkpoint(REASONS.resetBlocks, (d) => resetBlocks(pattern, d));
                setSelectedCell(null);
                setSheet(null);
              }}
            >
              <Icon name="rotate" />
              <span>
                <strong>Reset blocks</strong>
                <span>Put every block back in its place and turn.</span>
              </span>
            </button>
          </li>
        </ul>
      </Sheet>

      <Sheet open={sheet === 'help'} title="How to use" onClose={() => setSheet(null)} className="sheet-help">
        <Help
          wide={wide}
          pieceCount={pattern.block.pieces.length}
          letterRange={`${pattern.block.pieces[0]?.label ?? ''} to ${pattern.block.pieces[pattern.block.pieces.length - 1]?.label ?? ''}`}
        />
      </Sheet>

      <Sheet open={sheet === 'versions'} title="Versions" onClose={() => setSheet(null)} className="sheet-versions">
        <VersionsList
          project={project}
          sizeName={size.name}
          versions={versions}
          onSave={saveVersion}
          onRestored={(name) => {
            setSheet(null);
            setToast(`Restored ${name}. Undo brings back what you had.`);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'confirm-guide'} title="Start over with the guide?" onClose={() => setSheet(null)}>
        <p className="confirm-text">This empties the quilt and starts the setup again. You can undo it.</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>
            Keep my quilt
          </button>
          <button type="button" className="btn btn-danger" onClick={startGuideOver}>
            Start over
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'confirm-reset'} title="Reset to shuffle?" onClose={() => setSheet(null)}>
        <p className="confirm-text">
          This removes {overrideCount} hand-placed {overrideCount === 1 ? 'fabric' : 'fabrics'} and goes back to the
          pattern's shuffle. You can undo it.
        </p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>
            Keep them
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              checkpoint(REASONS.resetShuffle, clearAllOverrides);
              setInfoKey(null);
              setSheet(null);
            }}
          >
            Reset to shuffle
          </button>
        </div>
      </Sheet>
    </div>
  );
}
