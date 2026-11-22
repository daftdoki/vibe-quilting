/** Step titles, shared by the guide card and the opening overview so the names never drift. */
import type { GuideStepId } from '../../core/storage';
import { COUNTED_STEPS } from './useGuide';

/**
 * With more than one fabric set, the first step also picks the set. With one
 * set the step is only the size, so its title stays as it was.
 */
export function stepTitles(multipleSets: boolean): Record<GuideStepId, string> {
  return {
    intro: `Set up your quilt in ${COUNTED_STEPS.length} steps`,
    size: multipleSets ? 'Pick your fabrics and size' : 'Quilt size',
    fabrics: 'Pick your fabrics',
    blocks: 'Turn and move blocks',
    touchups: 'Touch-ups',
    done: 'Your quilt is ready',
  };
}

export const TITLES = stepTitles(false);
