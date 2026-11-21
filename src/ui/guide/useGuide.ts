/**
 * Guided setup state for one project. The guide walks one size at a time from
 * an empty quilt to a finished design. Progress saves per size, so a reload or
 * a size switch resumes where she was.
 *
 * Everything that depends on the design (the slot a tray tap fills, the block
 * being touched up) is worked out from the current design on each render, so
 * undo and redo never leave the guide pointing at stale state.
 */
import { useCallback, useEffect, useState } from 'react';
import { createEmptyDesign, fillEmptySlots, isEmptyDesign, randomLineup, setLineupSlot } from '../../core/design';
import { GUIDE_STEPS, loadGuide, saveGuide, type GuideStepId } from '../../core/storage';
import type { FabricCollection, ProjectDef } from '../../core/types';
import type { DesignState } from '../useDesign';
import { REASONS, type CheckpointUpdate } from '../versions/useVersions';

/** Steps shown in the "Step 2 of 4" counter. The opening overview and the closing step are not counted. */
export const COUNTED_STEPS: readonly GuideStepId[] = GUIDE_STEPS.filter((s) => s !== 'intro' && s !== 'done');

/** What the rest of the app does while a guide step is showing. */
export interface GuideControl {
  /** What a tap on the quilt does. 'none' ignores taps on pieces and blocks. */
  mode: 'fabrics' | 'blocks' | 'none';
  /** 'paint' is the normal tray, 'fill' puts a tapped fabric in the stack, 'hidden' hides the tray. */
  tray: 'paint' | 'fill' | 'hidden';
  /** Cell the canvas zooms to and highlights. */
  focusCell: number | null;
}

const CONTROLS: Record<GuideStepId, GuideControl> = {
  intro: { mode: 'none', tray: 'hidden', focusCell: null },
  size: { mode: 'none', tray: 'hidden', focusCell: null },
  fabrics: { mode: 'none', tray: 'fill', focusCell: null },
  blocks: { mode: 'blocks', tray: 'hidden', focusCell: null },
  touchups: { mode: 'fabrics', tray: 'paint', focusCell: null },
  done: { mode: 'none', tray: 'hidden', focusCell: null },
};

interface Progress {
  step: GuideStepId;
  block: number;
}

interface State {
  sizeId: string;
  /** Null when the guide is not running for this size. */
  progress: Progress | null;
  /** Size picked from the size step. It opens on the size step instead of its own saved progress. */
  carryTo: string | null;
  /** Size just picked from the size step that already has a design. */
  conflictSize: string | null;
  /** Slot she tapped in the fat quarters step. The next tray tap replaces it. */
  pickedSlot: number | null;
  /** She pressed Next with slots still empty. */
  offerFill: boolean;
  /** Hide mode in the fat quarters step: a tray tap hides a fabric or brings it back. */
  hiding: boolean;
}

export interface Guide {
  active: boolean;
  step: GuideStepId | null;
  /** Cell index for the touch-ups step, clamped to the quilt. */
  block: number;
  blockCount: number;
  control: GuideControl | null;
  /** Slot the next tray tap fills in the fat quarters step, or null when every slot is full. */
  targetSlot: number | null;
  /** True when the target slot was tapped on purpose, so it can be cleared. */
  slotPicked: boolean;
  emptySlots: number;
  /** She picked a size in the size step that already has a design with something in it. */
  sizeConflict: boolean;
  offerFill: boolean;
  /** True while tray taps hide fabrics instead of filling the stack. */
  hiding: boolean;

  pickSize(sizeId: string): void;
  startSizeEmpty(): void;
  pickSlot(slot: number | null): void;
  fillFromTray(fabricId: string): void;
  clearSlot(slot: number): void;
  fillRest(): void;
  /** Empty every fat quarter slot. Hand-placed pieces stay. */
  clearPicks(): void;
  /** Replace every fat quarter with a random selection of fabrics. Hand-placed pieces stay. */
  randomPicks(): void;
  /** Fill the empty slots and go to the next step. */
  fillRestAndNext(): void;
  dismissFillOffer(): void;
  /** Turn the hide mode on or off. */
  setHiding(on: boolean): void;
  next(): void;
  back(): void;
  setBlock(cell: number): void;
  skipTouchups(): void;
  /** Close the guide and leave the design as it is. */
  exit(): void;
  /** Start from the opening overview. The caller empties the design first. */
  start(): void;
  /**
   * Open the guide again on the current quilt without changing it. It opens at
   * the fat quarters step when a slot is empty, otherwise at the blocks step.
   */
  resume(): void;
}

/**
 * `usable` is the collection without the fabrics she hid. Fill the rest
 * and Pick at random only choose from it.
 */
export function useGuide(
  project: ProjectDef,
  ds: DesignState,
  checkpointUpdate: CheckpointUpdate,
  usable: FabricCollection,
): Guide {
  const { pattern } = project;
  const collection = usable;
  const { design, update, wasCreated } = ds;

  const progressFor = useCallback(
    (sizeId: string): Progress | null => {
      const saved = loadGuide(project.id, sizeId);
      if (saved === 'done') return null;
      if (saved) return saved;
      // A size opened for the first time starts with the overview.
      return wasCreated(sizeId) ? { step: 'intro', block: 0 } : null;
    },
    [project.id, wasCreated],
  );

  const [state, setState] = useState<State>(() => ({
    sizeId: ds.sizeId,
    progress: progressFor(ds.sizeId),
    carryTo: null,
    conflictSize: null,
    pickedSlot: null,
    offerFill: false,
    hiding: false,
  }));

  // A size switch replaces the state during render, so no frame shows the old size's step.
  let current = state;
  if (state.sizeId !== ds.sizeId) {
    const carried = state.carryTo === ds.sizeId;
    current = {
      sizeId: ds.sizeId,
      progress: carried ? { step: 'size', block: 0 } : progressFor(ds.sizeId),
      carryTo: null,
      conflictSize: carried ? state.conflictSize : null,
      pickedSlot: null,
      offerFill: false,
      hiding: false,
    };
    setState(current);
  }

  // Save progress whenever it changes. Reaching the last step marks the guide done.
  useEffect(() => {
    const p = state.progress;
    if (!p) return;
    saveGuide(project.id, state.sizeId, p.step === 'done' ? 'done' : p);
  }, [state.progress, state.sizeId, project.id]);

  const progress = current.progress;
  const step = progress?.step ?? null;
  const blockCount = design.cells.length;
  const block = Math.max(0, Math.min(blockCount - 1, progress?.block ?? 0));
  const firstEmpty = design.lineup.indexOf(null);
  const emptySlots = design.lineup.filter((id) => id === null).length;
  const picked = current.pickedSlot !== null && current.pickedSlot < design.lineup.length ? current.pickedSlot : null;
  const targetSlot = picked ?? (firstEmpty >= 0 ? firstEmpty : null);

  const control: GuideControl | null = step
    ? { ...CONTROLS[step], focusCell: step === 'touchups' ? block : null }
    : null;

  const goTo = useCallback((s: GuideStepId, blockIndex = 0) => {
    setState((st) =>
      st.progress
        ? {
            ...st,
            progress: { step: s, block: blockIndex },
            pickedSlot: null,
            offerFill: false,
            conflictSize: null,
            hiding: false,
          }
        : st,
    );
  }, []);

  const exit = useCallback(() => {
    saveGuide(project.id, ds.sizeId, 'done');
    setState((st) => ({
      ...st,
      progress: null,
      pickedSlot: null,
      offerFill: false,
      conflictSize: null,
      hiding: false,
    }));
  }, [project.id, ds.sizeId]);

  const pickSize = useCallback(
    (next: string) => {
      if (next === ds.sizeId) return;
      // A size she leaves with a design in it is closed. One she leaves empty keeps
      // the guide, so it opens with the setup when she comes back to it.
      saveGuide(project.id, ds.sizeId, isEmptyDesign(design) ? { step: 'size', block: 0 } : 'done');
      setState((st) => ({ ...st, carryTo: next, conflictSize: next }));
      ds.setSize(next);
    },
    [ds, project.id, design],
  );

  const next = useCallback(() => {
    if (!step) return;
    if (step === 'fabrics' && emptySlots > 0) {
      setState((st) => ({ ...st, offerFill: true, hiding: false }));
      return;
    }
    if (step === 'touchups') {
      if (block < blockCount - 1) goTo('touchups', block + 1);
      else goTo('done', block);
      return;
    }
    const i = GUIDE_STEPS.indexOf(step);
    const to = GUIDE_STEPS[i + 1];
    if (to) goTo(to);
  }, [step, emptySlots, block, blockCount, goTo]);

  const setHiding = useCallback(
    (on: boolean) => setState((st) => ({ ...st, hiding: on, pickedSlot: null, offerFill: false })),
    [],
  );

  const back = useCallback(() => {
    if (!step) return;
    const i = GUIDE_STEPS.indexOf(step);
    const to = GUIDE_STEPS[i - 1];
    if (!to) return;
    // Going back into touch-ups lands on the last block she saw.
    goTo(to, to === 'touchups' ? block : 0);
  }, [step, block, goTo]);

  return {
    active: progress !== null,
    step,
    block,
    blockCount,
    control,
    targetSlot,
    slotPicked: picked !== null,
    emptySlots,
    sizeConflict: step === 'size' && current.conflictSize === ds.sizeId && !isEmptyDesign(design),
    offerFill: step === 'fabrics' && current.offerFill && emptySlots > 0,
    hiding: step === 'fabrics' && current.hiding,

    pickSize,
    startSizeEmpty: () => {
      checkpointUpdate(REASONS.startOver, (d) => createEmptyDesign(pattern, d.sizeId));
      setState((st) => ({ ...st, conflictSize: null }));
    },
    pickSlot: (slot) => setState((st) => ({ ...st, pickedSlot: slot })),
    fillFromTray: (fabricId) => {
      if (targetSlot === null) return;
      const slot = targetSlot;
      update((d) => setLineupSlot(d, slot, fabricId));
      setState((st) => ({ ...st, pickedSlot: null }));
    },
    clearSlot: (slot) => {
      update((d) => setLineupSlot(d, slot, null));
      setState((st) => ({ ...st, pickedSlot: null }));
    },
    fillRest: () => {
      checkpointUpdate(REASONS.fillRest, (d) => fillEmptySlots(pattern, collection, d));
      setState((st) => ({ ...st, pickedSlot: null, offerFill: false }));
    },
    clearPicks: () => {
      checkpointUpdate(REASONS.clearPicks, (d) => ({ ...d, lineup: d.lineup.map(() => null) }));
      setState((st) => ({ ...st, pickedSlot: null, offerFill: false }));
    },
    randomPicks: () => {
      const seed = (Math.random() * 2 ** 32) >>> 0;
      checkpointUpdate(REASONS.randomPicks, (d) => randomLineup(pattern, collection, d, seed));
      setState((st) => ({ ...st, pickedSlot: null, offerFill: false }));
    },
    fillRestAndNext: () => {
      checkpointUpdate(REASONS.fillRest, (d) => fillEmptySlots(pattern, collection, d));
      goTo('blocks');
    },
    dismissFillOffer: () => setState((st) => ({ ...st, offerFill: false })),
    setHiding,
    next,
    back,
    setBlock: (cell) => goTo('touchups', Math.max(0, Math.min(blockCount - 1, cell))),
    skipTouchups: () => goTo('done', block),
    exit,
    start: () =>
      setState((st) => ({
        ...st,
        progress: { step: 'intro', block: 0 },
        pickedSlot: null,
        offerFill: false,
        conflictSize: null,
        hiding: false,
      })),
    resume: () =>
      setState((st) => ({
        ...st,
        progress: { step: emptySlots > 0 ? 'fabrics' : 'blocks', block: 0 },
        pickedSlot: null,
        offerFill: false,
        conflictSize: null,
        hiding: false,
      })),
  };
}
