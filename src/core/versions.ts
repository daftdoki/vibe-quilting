/**
 * Pure helpers for a size's list of saved versions. Lists are newest first and
 * every function returns a new list.
 */
import { isEmptyDesign } from './design';
import type { Design, DesignVersion } from './types';

export interface VersionLimits {
  manual: number;
  auto: number;
}

export const VERSION_LIMITS: VersionLimits = { manual: 30, auto: 8 };

/** Longest name a version can have. */
export const MAX_VERSION_NAME = 40;

/** Automatic versions with the same reason this close together count as one run. */
export const AUTO_RUN_MS = 60_000;

/** Deep equality of two designs: same size, lineup, cells and overrides. */
export function designsEqual(a: Design, b: Design): boolean {
  if (a === b) return true;
  if (a.sizeId !== b.sizeId) return false;
  if (a.lineup.length !== b.lineup.length || a.cells.length !== b.cells.length) return false;
  if (a.lineup.some((id, i) => id !== b.lineup[i])) return false;
  if (a.cells.some((c, i) => c.blockId !== b.cells[i]?.blockId || c.rotation !== b.cells[i]?.rotation)) {
    return false;
  }
  const ka = Object.keys(a.overrides);
  if (ka.length !== Object.keys(b.overrides).length) return false;
  return ka.every((k) => a.overrides[k] === b.overrides[k]);
}

/**
 * Add a version to the front of the list. An automatic version is skipped when
 * its design is empty, when it equals the newest stored version, or when the
 * newest stored version is an automatic one with the same reason made less than
 * a minute earlier, so a run of shuffles keeps the state from before the first.
 * Over the limit, the oldest version of the same kind is dropped. Automatic
 * versions never push out manual ones.
 */
export function addVersion(
  list: readonly DesignVersion[],
  version: DesignVersion,
  limits: VersionLimits = VERSION_LIMITS,
): DesignVersion[] {
  const newest = list[0];
  if (version.auto) {
    if (isEmptyDesign(version.design)) return [...list];
    if (newest && designsEqual(newest.design, version.design)) return [...list];
    if (
      newest?.auto &&
      newest.reason === version.reason &&
      version.createdAt - newest.createdAt >= 0 &&
      version.createdAt - newest.createdAt < AUTO_RUN_MS
    ) {
      return [...list];
    }
  }
  const next = [version, ...list];
  const cap = version.auto ? limits.auto : limits.manual;
  let kept = 0;
  return next.filter((v) => {
    if (v.auto !== version.auto) return true;
    kept++;
    return kept <= cap;
  });
}

/** Rename a version. The name is trimmed and cut to 40 characters; an empty name keeps the old one. */
export function renameVersion(list: readonly DesignVersion[], id: string, name: string): DesignVersion[] {
  const clean = name.trim().slice(0, MAX_VERSION_NAME).trim();
  return list.map((v) => (v.id === id && clean !== '' ? { ...v, name: clean } : v));
}

export function deleteVersion(list: readonly DesignVersion[], id: string): DesignVersion[] {
  return list.filter((v) => v.id !== id);
}

/** "Version n" with the lowest n that no manual version uses yet. */
export function defaultVersionName(list: readonly DesignVersion[]): string {
  const used = new Set<number>();
  for (const v of list) {
    if (v.auto) continue;
    const m = /^Version (\d+)$/.exec(v.name);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return `Version ${n}`;
}
