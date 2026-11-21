/** Step titles, shared by the guide card and the opening overview so the names never drift. */
import type { GuideStepId } from '../../core/storage';
import { COUNTED_STEPS } from './useGuide';

export const TITLES: Record<GuideStepId, string> = {
  intro: `Set up your quilt in ${COUNTED_STEPS.length} steps`,
  size: 'Quilt size',
  fabrics: 'Pick your fabrics',
  blocks: 'Turn and move blocks',
  touchups: 'Touch-ups',
  done: 'Your quilt is ready',
};
