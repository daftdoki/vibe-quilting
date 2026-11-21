import { happyPlace } from '../fabrics/happy-place';
import { stacks } from '../patterns/stacks';
import type { ProjectDef } from '../core/types';

export const stacksHappyPlace: ProjectDef = {
  id: 'stacks-happy-place',
  title: 'Stacks × Happy Place',
  pattern: stacks,
  collection: happyPlace,
};
