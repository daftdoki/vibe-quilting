import type { ProjectDef } from '../core/types';
import { stacksHappyPlace } from './stacks-happy-place';

export const projects: ProjectDef[] = [stacksHappyPlace];

export function getProject(id: string): ProjectDef | undefined {
  return projects.find((p) => p.id === id);
}
