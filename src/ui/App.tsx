import { projects } from '../projects';
import { Workspace } from './Workspace';

/** Shows the first project. A project picker can replace this later. */
export function App() {
  const project = projects[0];
  if (!project) return <p className="empty">No projects found.</p>;
  return <Workspace key={project.id} project={project} />;
}
