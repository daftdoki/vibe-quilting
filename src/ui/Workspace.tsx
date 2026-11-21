import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearAllOverrides,
  clearOverride,
  createEmptyDesign,
  isEmptyDesign,
  removeFabric,
  usableCollection,
  visibleFabrics,
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
import { loadHintSeen, saveHintSeen } from '../core/storage';
import type { FabricDef, ProjectDef } from '../core/types';
import { FabricTray } from './FabricTray';
import { FatQuarterExplainer } from './FatQuarterDiagram';
import { GuideCard } from './guide/GuideCard';
import { TurnChoices } from './guide/steps';
import { useGuide } from './guide/useGuide';
import { DataSheets } from './data/DataSheets';
import { useDataTransfer } from './data/useDataTransfer';
import { Help } from './Help';
import { renderPng, shareOrDownload } from './exportPng';
import { sizeInches } from './format';
import { Icon } from './Icon';
import { imageCache } from './imageCache';
import { Lineup } from './Lineup';
import { BuildSheetOverlay } from './print/BuildSheet';
import { SaveMenu, type MenuAction } from './SaveMenu';
import { QuiltCanvas, type QuiltCanvasHandle, type QuiltTap } from './QuiltCanvas';
import { buildScene, type Highlights } from './renderQuilt';
import { Sheet } from './Sheet';
import { SizePicker } from './SizePicker';
import { useDesign } from './useDesign';
import { useExcluded } from './useExcluded';
import { useFabricDrag, type DropResult } from './useFabricDrag';
import { useMediaQuery, WIDE_QUERY } from './useMediaQuery';
import { REASONS, useVersions } from './versions/useVersions';
import { VersionsList } from './versions/VersionsList';

type Mode = 'fabrics' | 'blocks';
type SheetName =
  | 'lineup'
  | 'size'
  | 'more'
  | 'help'
  | 'versions'
  | 'fat-quarter'
  | 'confirm-reset'
  | 'confirm-guide'
  | null;

/** Drag props for a tray that should not start drags. */
const NO_DRAG = () => ({
  onPointerDown() {},
  onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  },
});

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
  const [hintSeen, setHintSeen] = useState(loadHintSeen);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const versions = useVersions(project, ds, setToast);
  const data = useDataTransfer(setToast);
  // Big changes save an automatic version first, so they can be got back after a reload.
  const checkpoint = versions.updateWithCheckpoint;
  // Fabrics she hid. They leave the fabric list, and Fill the rest and Pick at random never choose them.
  const excluded = useExcluded(project);
  const excludedIds = excluded.ids;
  const usable = useMemo(() => usableCollection(collection, excludedIds), [collection, excludedIds]);
  const guide = useGuide(project, ds, checkpoint, usable);
  const guideControl = guide.control;
  /** Slot picked in the fat quarter stack outside the guide. */
  const [lineupSlot, setLineupSlotPick] = useState<number | null>(null);
  const canvasRef = useRef<QuiltCanvasHandle>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const saveMenuBtnRef = useRef<HTMLButtonElement>(null);
  // The #build-sheet hash keeps the build sheet open across a reload, unless the quilt is empty.
  const [printOpen, setPrintOpen] = useState(
    () => location.hash === '#build-sheet' && !isEmptyDesign(ds.design),
  );

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
    // If this cannot be saved, the hint shows again next time.
    saveHintSeen();
  }, []);

  const focusCell = guideControl?.focusCell ?? null;

  // The stack shows beside the guide on wide screens while the order is being mixed.
  const stackBesideGuide = wide && guide.step === 'blocks';
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
    } else if (zoomedRef.current || guideStep === 'done' || guideStep === 'intro') {
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

  /**
   * Hide a fabric, or bring it back. Hiding one also takes it off this size's
   * quilt in one undoable change. The last fabric cannot be hidden.
   */
  const toggleExcluded = useCallback(
    (id: string) => {
      const next = new Set(excludedIds);
      const name = collection.fabrics.find((f) => f.id === id)?.name ?? 'That fabric';
      if (next.has(id)) {
        next.delete(id);
        excluded.set(next);
        setToast(`${name} is back.`);
        return;
      }
      if (collection.fabrics.filter((f) => !next.has(f.id)).length <= 1) {
        setToast('Keep at least one fabric.');
        return;
      }
      next.add(id);
      excluded.set(next);
      setToast(`${name} is excluded.`);
      if (removeFabric(design, id) !== design) checkpoint(REASONS.leaveOut, (d) => removeFabric(d, id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    [excludedIds, excluded, collection, design, checkpoint],
  );

  const onDrop = useCallback(
    ({ fabricId, piece, slot }: DropResult) => {
      // A hidden fabric is not in the list, so it cannot be dragged. Refuse it anyway.
      if (excludedIds.has(fabricId)) return;
      // The guide only lets a drag start in steps where painting is allowed.
      if (piece) update((d) => setOverride(pattern, d, piece.blockId, piece.pieceId, fabricId));
      else if (slot !== null) update((d) => setLineupSlot(d, slot, fabricId));
      if (!hintSeen) dismissHint();
    },
    [pattern, update, hintSeen, dismissHint, excludedIds],
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
  const hiding = guide.hiding;
  const hidingRef = useRef(hiding);
  hidingRef.current = hiding;
  const setHiding = guide.setHiding;
  const onTrayTap = useCallback(
    (id: string) => {
      if (hiding) toggleExcluded(id);
      else if (excludedIds.has(id)) return;
      else if (trayRole === 'fill') fillFromTray(id);
      else toggleFabric(id);
    },
    [hiding, toggleExcluded, excludedIds, trayRole, fillFromTray, toggleFabric],
  );
  // Hidden fabrics only show in the hide mode, where dragging is off. This is a second guard.
  const trayDragProps = useCallback(
    (f: FabricDef) => (trayRole === 'fill' || excludedIds.has(f.id) ? NO_DRAG() : dragProps(f)),
    [trayRole, excludedIds, dragProps],
  );

  const [freshDropsVersions, setFreshDropsVersions] = useState(false);
  // Nothing to start over from when the quilt is empty and no version is saved.
  const canStartFresh = !isEmptyDesign(design) || versions.list.length > 0;
  const openStartFresh = () => {
    setFreshDropsVersions(false);
    setSheet('confirm-guide');
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setInfoKey(null);
    setSelectedCell(null);
  };

  // Start fresh: empty this size and run the setup again. With `dropVersions`
  // the size's saved versions go too, so no automatic version is kept either.
  const startGuideOver = () => {
    if (freshDropsVersions && versions.list.length > 0) {
      if (!versions.clearAll()) return;
      update((d) => createEmptyDesign(pattern, d.sizeId));
    } else {
      checkpoint(REASONS.startOver, (d) => createEmptyDesign(pattern, d.sizeId));
    }
    setFreshDropsVersions(false);
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

  const canSaveQuilt = !isEmptyDesign(design) || versions.list.length > 0;
  const saveQuiltFile = () => {
    setSheet(null);
    void data.saveQuilt(project.id, design);
  };

  // The build sheet. The #build-sheet hash keeps it open across a reload.
  const canPrint = !isEmptyDesign(design);
  const canPrintRef = useRef(canPrint);
  canPrintRef.current = canPrint;
  const openPrint = useCallback(() => {
    setSheet(null);
    setPrintOpen(true);
  }, []);
  const closePrint = useCallback(() => setPrintOpen(false), []);
  useEffect(() => {
    const sync = () => {
      if (location.hash !== '#build-sheet') setPrintOpen(false);
      else if (canPrintRef.current) openPrint();
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
    // Hash changes only. The first open comes from the initial state.
  }, []);
  useEffect(() => {
    const want = printOpen ? '#build-sheet' : '';
    if (location.hash === want || (!want && location.hash === '')) return;
    history.replaceState(history.state, '', `${location.pathname}${location.search}${want}`);
  }, [printOpen]);

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    setSheet(null);
    try {
      const blob = await renderPng(scene);
      const name = `${project.id}-${size.id}.png`;
      // False means she closed the share sheet without saving, so there is nothing to report.
      const done = await shareOrDownload(blob, name, `${project.title}, ${size.name}`, 'image/png');
      if (done) setToast(`Exported ${name}`);
    } catch {
      setToast('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The build sheet covers the quilt, and a menu may have handled the key already.
      if (printOpen || e.defaultPrevented) return;
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
        if (hidingRef.current) setHiding(false);
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
  }, [doUndo, doRedo, printOpen, setHiding]);

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
      fabrics={visibleFabrics(collection.fabrics, excludedIds, hiding)}
      usage={usage}
      activeId={trayRole === 'fill' ? null : activeId}
      layout={wide ? 'grid' : 'strip'}
      countNoun={trayRole === 'fill' ? 'slot' : 'piece'}
      excluded={excludedIds}
      hideMode={hiding}
      onToggle={onTrayTap}
      dragProps={trayDragProps}
      takeClickSuppression={takeClickSuppression}
    />
  );

  const lineup = (
    <Lineup
      pattern={pattern}
      fabrics={usable.fabrics}
      lineup={design.lineup}
      blockCount={design.cells.length}
      onSetSlot={(slot, id) => {
        // The picker lists only fabrics that are not hidden. Refuse a hidden one anyway.
        if (id !== null && excludedIds.has(id)) return;
        update((d) => setLineupSlot(d, slot, id));
      }}
      onSwap={(a, b) => update((d) => swapLineupSlots(d, a, b))}
      onShuffle={shuffle}
      onFillRest={() => checkpoint(REASONS.fillRest, (d) => fillEmptySlots(pattern, usable, d))}
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
      fabricsById={fabricsById}
      activeName={activeFabric?.name ?? null}
      slotPieces={slotPieces}
      wide={wide}
      exporting={exporting}
      onExport={doExport}
      onSaveQuilt={saveQuiltFile}
      canSaveQuilt={canSaveQuilt}
      onPrint={openPrint}
      canPrint={canPrint}
      onHelp={() => setSheet('help')}
      onExplainFatQuarter={() => setSheet('fat-quarter')}
      onShuffle={shuffle}
      excludedCount={excludedIds.size}
    />
  ) : null;
  const showTray = trayRole !== 'hidden';

  // Save & export actions: the Save & export menu on wide screens, a group in the three dots menu on phones.
  const saveItems: MenuAction[] = [
    {
      key: 'save',
      icon: 'file',
      label: 'Save quilt file',
      description: canSaveQuilt
        ? 'This quilt and its versions, to open again here or on another device.'
        : 'Nothing to save yet.',
      disabled: !canSaveQuilt,
      onSelect: saveQuiltFile,
    },
    {
      key: 'open',
      icon: 'fileDown',
      label: 'Open a quilt file',
      description: 'Load a quilt file or a full export you saved before.',
      onSelect: () => {
        setSheet(null);
        data.pickFile();
      },
    },
    {
      key: 'png',
      icon: 'download',
      label: exporting ? 'Exporting' : 'Export PNG',
      description: 'A picture of this quilt to share.',
      disabled: exporting,
      dividerBefore: true,
      onSelect: () => void doExport(),
    },
    {
      key: 'print',
      icon: 'print',
      label: 'Print build sheet',
      description: canPrint ? 'A black and white reference for cutting and sewing.' : 'Nothing to print yet.',
      disabled: !canPrint,
      onSelect: openPrint,
    },
  ];

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
                className="btn btn-ghost topbar-btn topbar-versions"
                onClick={() => setSheet('versions')}
                aria-label="Versions"
                title="Versions"
              >
                <Icon name="versions" />
                <span className="btn-label">Versions</span>
              </button>
              <SaveMenu items={saveItems} buttonRef={saveMenuBtnRef} />
            </>
          )}
          <button
            ref={moreBtnRef}
            type="button"
            className="icon-btn"
            onClick={() => {
              data.refresh();
              setSheet('more');
            }}
            aria-label="More actions"
          >
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
          <div className="canvas-pills">
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
            {!isEmptyDesign(design) && (
              <button
                type="button"
                className="resume-btn fresh-btn"
                onClick={openStartFresh}
                aria-label={`Start fresh. Empty the ${size.name} quilt and set it up again.`}
                title="Empty this quilt and set it up again"
              >
                <Icon name="reset" size={18} />
                Start fresh
              </button>
            )}
          </div>
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
                  <h2>{hiding ? 'Tap to exclude or bring back' : 'Fabrics'}</h2>
                  <p>
                    {hiding
                      ? 'Fabrics with a slash are excluded.'
                      : trayRole === 'fill'
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
          {!wide && (
            <>
              <li className="action-group" role="presentation">
                <h3 className="action-group-title">Save &amp; export</h3>
              </li>
              {saveItems.map((item) => (
                <li key={item.key} className={item.dividerBefore ? 'action-divider' : undefined}>
                  <button type="button" className="action" onClick={item.onSelect} disabled={item.disabled}>
                    <Icon name={item.icon} />
                    <span>
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                  </button>
                </li>
              ))}
              <li className="action-group" role="presentation" aria-hidden="true" />
            </>
          )}
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
            <button type="button" className="action" onClick={openStartFresh} disabled={!canStartFresh}>
              <Icon name="reset" />
              <span>
                <strong>Start fresh</strong>
                <span>
                  {canStartFresh
                    ? 'Empty this quilt and set it up again from the start.'
                    : 'This quilt is already empty.'}
                </span>
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
          <li className="action-group" role="presentation">
            <h3 className="action-group-title">Your data</h3>
          </li>
          <li>
            <button
              type="button"
              className="action"
              disabled={!data.canExport}
              onClick={() => {
                setSheet(null);
                void data.exportData();
              }}
            >
              <Icon name="fileUp" />
              <span>
                <strong>Export data</strong>
                <span>{data.canExport ? 'Save every quilt and version to a file.' : 'Nothing to export yet.'}</span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action"
              onClick={() => {
                setSheet(null);
                data.pickFile();
              }}
            >
              <Icon name="fileDown" />
              <span>
                <strong>Import data</strong>
                <span>Open a quilt file, or load a full export. A full export replaces everything here.</span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action action-danger"
              disabled={!data.canClear}
              onClick={() => {
                setSheet(null);
                data.askClear();
              }}
            >
              <Icon name="trash" />
              <span>
                <strong>Clear all data</strong>
                <span>{data.canClear ? 'Erase every quilt and version on this device.' : 'Nothing to erase.'}</span>
              </span>
            </button>
          </li>
        </ul>
      </Sheet>

      <Sheet open={sheet === 'help'} title="How to use" onClose={() => setSheet(null)} className="sheet-help">
        <Help
          wide={wide}
          pattern={pattern}
          pieceCount={pattern.block.pieces.length}
          letterRange={`${pattern.block.pieces[0]?.label ?? ''} to ${pattern.block.pieces[pattern.block.pieces.length - 1]?.label ?? ''}`}
        />
      </Sheet>

      <Sheet open={sheet === 'fat-quarter'} title="How a fat quarter is used" onClose={() => setSheet(null)}>
        <FatQuarterExplainer pattern={pattern} />
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

      <Sheet open={sheet === 'confirm-guide'} title={`Start fresh with the ${size.name} quilt?`} onClose={() => setSheet(null)}>
        <p className="confirm-text">
          This empties the {size.name} quilt and starts the setup again. Your other sizes are not touched. You can undo
          it.
        </p>
        {versions.list.length > 0 && (
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={freshDropsVersions}
              onChange={(e) => setFreshDropsVersions(e.target.checked)}
            />
            <span>
              Also delete the {versions.list.length} saved {versions.list.length === 1 ? 'version' : 'versions'} for
              this size. Undo will not bring {versions.list.length === 1 ? 'it' : 'them'} back.
            </span>
          </label>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>
            Keep my quilt
          </button>
          <button type="button" className="btn btn-danger" onClick={startGuideOver}>
            Start fresh
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
      <DataSheets data={data} />
      {printOpen && (
        <BuildSheetOverlay
          project={project}
          design={design}
          onClose={closePrint}
          fallbackFocus={wide ? saveMenuBtnRef : moreBtnRef}
        />
      )}
    </div>
  );
}
