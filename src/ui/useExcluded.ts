/**
 * Fabrics she hid in a project. One list for every size, stored on this
 * device. The list only stops a fabric from being picked. Loading and repair
 * keep using the full collection, so quilts that use it still open.
 */
import { useCallback, useState } from 'react';
import { loadExcluded, saveExcluded } from '../core/storage';
import type { ProjectDef } from '../core/types';

export interface Excluded {
  ids: ReadonlySet<string>;
  /** Replace the list and store it. */
  set(ids: ReadonlySet<string>): void;
}

export function useExcluded(project: ProjectDef): Excluded {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(loadExcluded(project.id, project.collection)));
  const set = useCallback(
    (next: ReadonlySet<string>) => {
      setIds(next);
      // If this cannot be stored, the list lasts until a reload.
      saveExcluded(project.id, [...next]);
    },
    [project.id],
  );
  return { ids, set };
}
