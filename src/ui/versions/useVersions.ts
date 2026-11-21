/**
 * Saved versions of the current size's design. Versions are stored per size on
 * this device and never cross sizes. Big changes go through
 * `updateWithCheckpoint`, which saves an automatic version of the design first.
 */
import { useCallback, useState } from 'react';
import { repairDesign } from '../../core/repair';
import { loadVersions, saveVersions } from '../../core/storage';
import type { Design, DesignVersion, ProjectDef } from '../../core/types';
import { addVersion, defaultVersionName, deleteVersion, designsEqual, renameVersion } from '../../core/versions';
import { isEmptyDesign } from '../../core/design';
import type { DesignState } from '../useDesign';

export const STORAGE_FULL = 'Could not save the version. Storage on this device is full.';

/** Reasons for automatic versions, shown in the list. */
export const REASONS = {
  shuffle: 'Before shuffle',
  resetShuffle: 'Before reset to shuffle',
  resetBlocks: 'Before reset blocks',
  turnPattern: 'Before turn every other block',
  turnNone: 'Before all the same way up',
  fillRest: 'Before fill the rest',
  clearPicks: 'Before clearing picks',
  randomPicks: 'Before random picks',
  leaveOut: 'Before excluding a fabric',
  startOver: 'Before starting fresh',
  restore: 'Before restoring a version',
} as const;

export type CheckpointUpdate = (reason: string, fn: (d: Design) => Design) => void;

export interface Versions {
  list: DesignVersion[];
  /** False when the live design is empty, so there is nothing worth saving. */
  canSave: boolean;
  /** Save the live design as a manual version. Returns its name, or null when storage failed. */
  save(): string | null;
  /** Apply a change, saving an automatic version of the design first when the change does something. */
  updateWithCheckpoint: CheckpointUpdate;
  /** Replace the live design with a version. Returns false when the version cannot be restored. */
  restore(id: string): boolean;
  rename(id: string, name: string): void;
  remove(id: string): void;
  /** Delete every version for this size. Returns false when storage failed. */
  clearAll(): boolean;
  /** True when the version holds exactly the live design. */
  isCurrent(v: DesignVersion): boolean;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function useVersions(project: ProjectDef, ds: DesignState, notify: (message: string) => void): Versions {
  const { pattern, collection } = project;
  const { design, update } = ds;
  const [state, setState] = useState(() => ({ sizeId: ds.sizeId, list: loadVersions(project.id, ds.sizeId) }));

  // A size switch loads that size's versions during render.
  let current = state;
  if (state.sizeId !== ds.sizeId) {
    current = { sizeId: ds.sizeId, list: loadVersions(project.id, ds.sizeId) };
    setState(current);
  }
  const list = current.list;

  const commit = useCallback(
    (next: DesignVersion[]): boolean => {
      if (!saveVersions(project.id, ds.sizeId, next)) {
        notify(STORAGE_FULL);
        return false;
      }
      setState({ sizeId: ds.sizeId, list: next });
      return true;
    },
    [project.id, ds.sizeId, notify],
  );

  const checkpoint = (reason: string) => {
    const next = addVersion(list, {
      id: newId(),
      sizeId: design.sizeId,
      name: reason,
      createdAt: Date.now(),
      auto: true,
      reason,
      design,
    });
    // addVersion returns an equal list when it skips the version.
    if (next.length !== list.length || next.some((v, i) => v !== list[i])) commit(next);
  };

  const updateWithCheckpoint: CheckpointUpdate = (reason, fn) => {
    const next = fn(design);
    if (designsEqual(next, design)) return;
    checkpoint(reason);
    update(fn);
  };

  return {
    list,
    canSave: !isEmptyDesign(design),
    save: () => {
      if (isEmptyDesign(design)) return null;
      const name = defaultVersionName(list);
      const ok = commit(
        addVersion(list, { id: newId(), sizeId: design.sizeId, name, createdAt: Date.now(), auto: false, design }),
      );
      return ok ? name : null;
    },
    updateWithCheckpoint,
    restore: (id) => {
      const v = list.find((x) => x.id === id);
      const clean = v ? (repairDesign(pattern, collection, v.design)?.design ?? null) : null;
      if (!clean) {
        notify('This version no longer fits this quilt, so it cannot be restored.');
        return false;
      }
      if (designsEqual(clean, design)) return true;
      checkpoint(REASONS.restore);
      update(() => clean);
      return true;
    },
    rename: (id, name) => commit(renameVersion(list, id, name)),
    remove: (id) => commit(deleteVersion(list, id)),
    clearAll: () => (list.length === 0 ? true : commit([])),
    isCurrent: (v) => designsEqual(v.design, design),
  };
}
