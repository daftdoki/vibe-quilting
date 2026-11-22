/**
 * Choosing between projects (fabric sets). A project pairs the pattern with
 * one fabric collection, and each project keeps its own quilts. Nothing here
 * touches the DOM.
 */
import { isEmptyDesign } from './design';
import { resolveAlias } from './repair';
import {
  loadDesign,
  loadLastSize,
  saveCurrentProject,
  saveGuide,
  saveLastSize,
  type GuideProgress,
} from './storage';
import type { FabricCollection, FabricDef, ProjectDef } from './types';

/**
 * The project to show. A stored id goes through the project aliases. A
 * missing or unknown id gives the first project, and no projects give undefined.
 */
export function chooseProject(
  projects: readonly ProjectDef[],
  aliases: Readonly<Record<string, string>> | undefined,
  storedId: string | null,
): ProjectDef | undefined {
  if (storedId !== null) {
    const id = resolveAlias(aliases, storedId);
    const found = projects.find((p) => p.id === id);
    if (found) return found;
  }
  return projects[0];
}

/** Up to `count` fabrics spread evenly through the collection, in collection order. */
export function sampleFabrics(collection: FabricCollection, count: number): FabricDef[] {
  const all = collection.fabrics;
  if (count <= 0) return [];
  if (all.length <= count) return [...all];
  const out: FabricDef[] = [];
  for (let i = 0; i < count; i++) out.push(all[Math.floor((i * all.length) / count)]!);
  return out;
}

/** Where a switch was made. The guide's first step, or the main screen. */
export type SwitchFrom = 'guide' | 'main';

export interface SwitchPlan {
  /** Size the new project opens on. */
  sizeId: string;
  /** Guide progress to save for that size, or null to leave what is saved. */
  guide: GuideProgress | null;
}

/**
 * What to open after switching to project `to`.
 *
 * From the guide's first step, the new project's guide starts at the size step.
 * The size she had is carried over unless that size already holds a quilt in
 * the new project. Then the new project keeps the size it had open.
 *
 * From the main screen, the size is carried over. A quilt there opens as it is.
 * With no quilt, the guide starts at the fabrics step.
 */
export function planSwitch(
  to: ProjectDef,
  carriedSizeId: string,
  from: SwitchFrom,
  lastSizeId: string | null,
  hasQuilt: (sizeId: string) => boolean,
): SwitchPlan {
  const { pattern } = to;
  const known = (id: string | null): id is string => id !== null && pattern.sizes.some((s) => s.id === id);
  const remembered = known(lastSizeId) ? lastSizeId : pattern.defaultSizeId;
  if (from === 'guide') {
    const carry = known(carriedSizeId) && !hasQuilt(carriedSizeId);
    return { sizeId: carry ? carriedSizeId : remembered, guide: { step: 'size', block: 0 } };
  }
  const sizeId = known(carriedSizeId) ? carriedSizeId : remembered;
  return { sizeId, guide: hasQuilt(sizeId) ? null : { step: 'fabrics', block: 0 } };
}

/** True when the project has a quilt with something in it at this size. */
export function hasQuiltAt(projectId: string, sizeId: string): boolean {
  const d = loadDesign(projectId, sizeId);
  return d !== null && !isEmptyDesign(d);
}

/** Save what the plan says, then the current project. The caller then shows the project. */
export function applySwitch(to: ProjectDef, carriedSizeId: string, from: SwitchFrom): SwitchPlan {
  const plan = planSwitch(to, carriedSizeId, from, loadLastSize(to.id), (id) => hasQuiltAt(to.id, id));
  saveLastSize(to.id, plan.sizeId);
  if (plan.guide) saveGuide(to.id, plan.sizeId, plan.guide);
  saveCurrentProject(to.id);
  return plan;
}
