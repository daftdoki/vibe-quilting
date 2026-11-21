import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, push, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory(1);
    h = push(push(h, 2), 3);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
    expect(redo(h).present).toBe(3);
  });

  it('clears redo on push and ignores empty undo/redo', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    const p = push(undo(push(h, 'b')), 'c');
    expect(canRedo(p)).toBe(false);
  });

  it('caps at 100 entries', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 250; i++) h = push(h, i);
    expect(h.past.length + 1).toBe(100);
    expect(h.present).toBe(250);
  });
});
