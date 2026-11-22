import type { ProjectDef } from '../core/types';
import { stacksHappyPlace } from './stacks-happy-place';
import { stacksRubyStar } from './stacks-ruby-star';

export const projects: ProjectDef[] = [stacksHappyPlace, stacksRubyStar];

export function getProject(id: string): ProjectDef | undefined {
  return projects.find((p) => p.id === id);
}

/**
 * Project ids are permanent, because data files name them. If a project must
 * be renamed, add the old id here, pointing to the new one.
 */
export const projectAliases: Readonly<Record<string, string>> = {};
