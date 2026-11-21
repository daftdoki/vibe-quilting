import { describe, expect, it } from 'vitest';
import { savedWhen } from './format';

describe('savedWhen', () => {
  const now = Date.UTC(2026, 10, 21, 12, 0, 0);
  it('is relative for recent times', () => {
    expect(savedWhen(now - 20_000, now)).toBe('Just now');
    expect(savedWhen(now - 60_000, now)).toBe('1 minute ago');
    expect(savedWhen(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(savedWhen(now - 3 * 3_600_000, now)).toBe('3 hours ago');
  });

  it('falls back to a date and time', () => {
    expect(savedWhen(now - 2 * 86_400_000, now)).not.toMatch(/ago|now/);
  });
});
