import { quiltSizeInches } from '../core/layout';
import type { PatternDef, QuiltSize } from '../core/types';

/** 62, 46.5 */
export function inches(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** "62 × 74 in" */
export function sizeInches(pattern: PatternDef, size: QuiltSize): string {
  const { width, height } = quiltSizeInches(pattern, size);
  return `${inches(width)} × ${inches(height)} in`;
}

/** The quiet note shown when her picks put one fabric twice in a block. Null when there is nothing to say. */
export function repeatNote(blocks: number | null): string | null {
  if (!blocks) return null;
  const head = blocks === 1 ? '1 block has the same fabric twice.' : `${blocks} blocks have the same fabric twice.`;
  return `${head} Change or move a fat quarter to spread them out, or leave it if you like the look.`;
}

/** "4 × 5 blocks" */
export function sizeGrid(size: QuiltSize): string {
  const n = size.cols * size.rows;
  return `${size.cols} × ${size.rows} ${n === 1 ? 'block' : 'blocks'}`;
}

/**
 * When something was saved: relative for the last 12 hours ("Just now",
 * "5 minutes ago", "2 hours ago"), otherwise a short date and time.
 */
export function savedWhen(time: number, now: number): string {
  const s = Math.max(0, now - time) / 1000;
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.floor(m / 60);
  if (h < 12) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  return new Date(time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
