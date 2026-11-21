/** Immutable undo/redo stack. */
const MAX_ENTRIES = 100;

export interface History<T> {
  /** Older states, oldest first. */
  readonly past: readonly T[];
  readonly present: T;
  /** Undone states, next redo first. */
  readonly future: readonly T[];
}

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

/** Record a new state. Clears redo. Keeps at most 100 states including the present. */
export function push<T>(history: History<T>, value: T): History<T> {
  const past = [...history.past, history.present].slice(-(MAX_ENTRIES - 1));
  return { past, present: value, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const past = history.past.slice(0, -1);
  return {
    past,
    present: history.past[history.past.length - 1]!,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const [next, ...future] = history.future;
  return { past: [...history.past, history.present], present: next!, future };
}
