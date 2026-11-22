/** File names made from a quilt's name. Pure, no DOM. */

/** Longest file base, in characters, before the extension or date. */
export const MAX_FILE_BASE = 60;

/**
 * Characters Windows, macOS or iOS refuse in a file name, and control
 * characters. Each one becomes a space, so "Quilt/v2" reads "Quilt v2".
 */
const ILLEGAL = /[/\\:*?"<>|\u0000-\u001f\u007f-\u009f]/g;

/** Names Windows keeps for devices, which no file may use, with or without an extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Trim spaces and dots from both ends. Windows drops a trailing dot, and a leading one hides the file. */
const trimEnds = (s: string) => s.replace(/^[\s.]+|[\s.]+$/g, '');

/**
 * A quilt name made safe to use as the start of a file name. Letters (accented
 * ones too), digits, spaces, hyphens, underscores, apostrophes and other
 * harmless marks stay. Characters that are illegal in a file name become
 * spaces, whitespace runs collapse to one space, spaces and dots go from the
 * ends, and the result is cut to `MAX_FILE_BASE` characters. Null when nothing
 * usable is left.
 */
export function quiltFileBase(name: string): string | null {
  const cleaned = trimEnds(name.replace(ILLEGAL, ' ').replace(/\s+/g, ' '));
  const capped = trimEnds(Array.from(cleaned).slice(0, MAX_FILE_BASE).join(''));
  if (capped === '' || RESERVED.test(capped)) return null;
  return capped;
}

/** "Ginger's Quilt.png" for a named quilt, "<project>-<size>.png" otherwise. */
export function pngFileName(quiltName: string, projectId: string, sizeId: string): string {
  const base = quiltFileBase(quiltName);
  return base === null ? `${projectId}-${sizeId}.png` : `${base}.png`;
}
