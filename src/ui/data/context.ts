import type { BackupContext } from '../../core/backup';
import { projectAliases, projects } from '../../projects';
import pkg from '../../../package.json';

/** What the backup code needs to know about this app. */
export const BACKUP_CONTEXT: BackupContext = {
  projects,
  projectAliases,
  appVersion: pkg.version,
};
