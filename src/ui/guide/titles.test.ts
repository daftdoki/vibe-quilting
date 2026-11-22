import { describe, expect, it } from 'vitest';
import { stepTitles, TITLES } from './titles';

describe('step titles', () => {
  it('keeps the size step as it was with one fabric set', () => {
    expect(stepTitles(false).size).toBe('Quilt size');
    expect(TITLES.size).toBe('Quilt size');
  });

  it('adds the fabrics to the first step with several sets, and changes no other title', () => {
    const many = stepTitles(true);
    expect(many.size).toBe('Pick your fabrics and size');
    expect({ ...many, size: '' }).toEqual({ ...stepTitles(false), size: '' });
  });
});
