/** Design state for one project: per-size undo history, autosave, size switching. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyDesign } from '../core/design';
import {
  canRedo,
  canUndo,
  createHistory,
  push,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from '../core/history';
import { repairDesign } from '../core/repair';
import { loadDesign, loadLastSize, saveDesign, saveLastSize } from '../core/storage';
import type { Design, ProjectDef } from '../core/types';

function initialSizeId(project: ProjectDef): string {
  const last = loadLastSize(project.id);
  const { pattern } = project;
  return last && pattern.sizes.some((s) => s.id === last) ? last : pattern.defaultSizeId;
}

/** The saved design for a size, or a new empty one. `created` says which. */
function loadOrCreate(project: ProjectDef, sizeId: string): { design: Design; created: boolean } {
  const { pattern, collection } = project;
  const saved = loadDesign(project.id, sizeId);
  // Repair keeps a quilt whose fabrics or blocks changed. Only an unknown size makes it start empty.
  const clean = saved ? repairDesign(pattern, collection, saved) : null;
  return clean ? { design: clean.design, created: false } : { design: createEmptyDesign(pattern, sizeId), created: true };
}

function sameDesign(a: Design, b: Design): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export interface DesignState {
  design: Design;
  sizeId: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Apply a change. A change that leaves the design as it was adds no undo step. */
  update(fn: (d: Design) => Design): void;
  undo(): void;
  redo(): void;
  setSize(sizeId: string): void;
  /**
   * True when this size had no usable saved design when it first opened in
   * this session, so it started empty.
   */
  wasCreated(sizeId: string): boolean;
}

export function useDesign(project: ProjectDef): DesignState {
  // Histories of sizes visited this session, so undo survives a size switch.
  const histories = useRef(new Map<string, History<Design>>());
  const [boot] = useState(() => {
    const sizeId = initialSizeId(project);
    return { sizeId, ...loadOrCreate(project, sizeId) };
  });
  // Recorded at load time, because autosave writes the new design right away.
  // Kept in state so it never depends on a ref from a discarded render.
  const [created, setCreated] = useState<ReadonlySet<string>>(() =>
    boot.created ? new Set([boot.sizeId]) : new Set(),
  );
  const [history, setHistory] = useState<History<Design>>(() => createHistory(boot.design));
  const sizeId = history.present.sizeId;

  // Autosave after every change, including undo and redo. A design that was only
  // loaded is not written back until the size is changed, so a stored quilt this
  // version could not read in full (or not at all) stays as it was until she edits it.
  const saved = useRef<Design | null>(null);
  const loaded = useRef(new WeakSet<Design>([boot.design]));
  const written = useRef(new Set<string>());
  useEffect(() => {
    const present = history.present;
    histories.current.set(present.sizeId, history);
    if (saved.current === present) return;
    saved.current = present;
    if (loaded.current.has(present) && !written.current.has(present.sizeId)) return;
    saveDesign(project.id, present);
    written.current.add(present.sizeId);
  }, [history, project.id]);

  const update = useCallback((fn: (d: Design) => Design) => {
    setHistory((h) => {
      const next = fn(h.present);
      return sameDesign(next, h.present) ? h : push(h, next);
    });
  }, []);

  const undo = useCallback(() => setHistory((h) => undoHistory(h)), []);
  const redo = useCallback(() => setHistory((h) => redoHistory(h)), []);

  const setSize = useCallback(
    (next: string) => {
      if (!project.pattern.sizes.some((s) => s.id === next)) return;
      let h = histories.current.get(next);
      if (!h) {
        const fresh = loadOrCreate(project, next);
        if (fresh.created) setCreated((c) => new Set([...c, next]));
        loaded.current.add(fresh.design);
        h = createHistory(fresh.design);
      }
      histories.current.set(next, h);
      saveLastSize(project.id, next);
      setHistory(h);
    },
    [project],
  );

  const wasCreated = useCallback((id: string) => created.has(id), [created]);

  return {
    design: history.present,
    sizeId,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    update,
    undo,
    redo,
    setSize,
    wasCreated,
  };
}
