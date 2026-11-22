import { useCallback, useState } from 'react';
import { applySwitch, chooseProject, type SwitchFrom } from '../core/projectChoice';
import { loadCurrentProject } from '../core/storage';
import type { ProjectDef } from '../core/types';
import { projectAliases, projects } from '../projects';
import { Workspace } from './Workspace';

/**
 * Shows the open fabric set (project). The choice is saved, and a missing or
 * unknown one opens the first project. Each project keeps its own quilts.
 */
export function App() {
  const [projectId, setProjectId] = useState(() => chooseProject(projects, projectAliases, loadCurrentProject())?.id);
  const switchProject = useCallback((to: ProjectDef, sizeId: string, from: SwitchFrom) => {
    // Saves the size and guide step the new set opens on, then the set itself.
    applySwitch(to, sizeId, from);
    setProjectId(to.id);
  }, []);
  const project = projects.find((p) => p.id === projectId);
  if (!project) return <p className="empty">No projects found.</p>;
  return <Workspace key={project.id} project={project} projects={projects} onSwitchProject={switchProject} />;
}
