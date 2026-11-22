import { describe, expect, it } from 'vitest';
import { toClickWords } from './pointerWords';

describe('toClickWords', () => {
  it('swaps every form of tap', () => {
    expect(toClickWords('Tap a block, then tap another.')).toBe('Click a block, then click another.');
    expect(toClickWords('by tapping the title')).toBe('by clicking the title');
    expect(toClickWords('a tap on a piece')).toBe('a click on a piece');
    expect(toClickWords('Double tap the mat, or double tap again.')).toBe('Double click the mat, or double click again.');
    expect(toClickWords('It taps and tapped.')).toBe('It clicks and clicked.');
  });

  it('leaves other words alone', () => {
    expect(toClickWords('Staple the tape to the tapestry.')).toBe('Staple the tape to the tapestry.');
  });
});
