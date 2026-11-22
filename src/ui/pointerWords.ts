/**
 * The app's text is written for touch ("Tap a block"). On a device whose main
 * pointer is a mouse or trackpad, the same sentences read "Click a block".
 * Write every sentence with "tap" and pass it through `tapText` where it is shown.
 */

const WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDouble tap\b/g, 'Double click'],
  [/\bdouble tap\b/g, 'double click'],
  [/\bTapping\b/g, 'Clicking'],
  [/\btapping\b/g, 'clicking'],
  [/\bTapped\b/g, 'Clicked'],
  [/\btapped\b/g, 'clicked'],
  [/\bTaps\b/g, 'Clicks'],
  [/\btaps\b/g, 'clicks'],
  [/\bTap\b/g, 'Click'],
  [/\btap\b/g, 'click'],
];

/** Swap the tap words for click words. Pure, for tests. */
export function toClickWords(text: string): string {
  let out = text;
  for (const [from, to] of WORDS) out = out.replace(from, to);
  return out;
}

/** True when the main pointer is a mouse or trackpad. Read once when the app loads. */
export const usesMouse: boolean =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** The sentence as written on touch devices, with click words on a mouse. */
export function tapText(text: string): string {
  return usesMouse ? toClickWords(text) : text;
}
