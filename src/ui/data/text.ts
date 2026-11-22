/** Wording for the data sheets. Plain words, with counts that read correctly. */
import type { BackupError, ImportNotes, StorageCounts } from '../../core/backup';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const quiltsText = (n: number) => count(n, 'quilt', 'quilts');
export const versionsText = (n: number) => count(n, 'saved version', 'saved versions');

/** "3 quilts and 5 saved versions" */
export function holdsText(c: Pick<StorageCounts, 'quilts' | 'versions'>): string {
  return `${quiltsText(c.quilts)} and ${versionsText(c.versions)}`;
}

/** "12 March 2026 at 3:40 pm", in the viewer's locale. */
export function exportedOn(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

export const IMPORT_ERROR_TITLE = "This file can't be imported";

export function importErrorText(reason: BackupError): string {
  switch (reason) {
    case 'not-ours':
      return "This isn't a Vibe Quilting file.";
    case 'not-json':
      return "This file can't be read. Pick a file you exported from Vibe Quilting.";
    case 'too-new':
      return 'This file came from a newer version of the app. Update the app and try again.';
    case 'bad-data':
      return "This file is damaged and can't be read.";
    case 'too-large':
      return 'This file is too large to be a Vibe Quilting file.';
    case 'quilt-unknown':
      return 'This quilt is for a pattern or size this app does not have.';
    case 'quilt-unreadable':
      return 'This file does not hold a quilt that can be opened.';
  }
}

export const IMPORT_FULL = 'Could not import. Storage on this device is full. Your quilts are unchanged.';
export const IMPORT_FAILED = 'Could not import. Your quilts are unchanged.';
export const ERASE_FAILED = 'Could not erase everything. Try again.';

/** The file's contents, for the confirm sheet. */
export function fileHoldsText(c: Pick<StorageCounts, 'quilts' | 'versions'>, exportedAt: string | null): string {
  const when = exportedAt === null ? '' : `, exported on ${exportedOn(exportedAt)}`;
  return c.quilts === 0 && c.versions === 0
    ? `This file holds no quilts or saved versions${when}.`
    : `This file holds ${holdsText(c)}${when}.`;
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Short paragraphs about what the app cannot take from a file. Empty when there is nothing to tell. */
export function importNotesText(notes: ImportNotes): string[] {
  const out: string[] = [];
  if (notes.missingFabrics > 0) {
    out.push(
      notes.missingFabrics === 1
        ? '1 fabric in this file is not in this app. Its spots will be empty.'
        : `${notes.missingFabrics} fabrics in this file are not in this app. Those spots will be empty.`,
    );
  }
  if (notes.blocksReset > 0) {
    out.push(
      notes.blocksReset === 1
        ? '1 quilt has blocks that no longer fit this app. Its blocks will be put back in their starting places.'
        : `${notes.blocksReset} quilts have blocks that no longer fit this app. Their blocks will be put back in their starting places.`,
    );
  }
  const skipped = [
    notes.skippedQuilts > 0 ? n(notes.skippedQuilts, 'quilt', 'quilts') : '',
    notes.skippedVersions > 0 ? n(notes.skippedVersions, 'saved version', 'saved versions') : '',
  ].filter(Boolean);
  if (skipped.length > 0) {
    const one = notes.skippedQuilts + notes.skippedVersions === 1;
    out.push(
      `This file also has ${skipped.join(' and ')} for a pattern or size this app does not have. ${one ? 'It' : 'They'} will be skipped.`,
    );
  }
  if (notes.unreadable > 0) {
    out.push(`${n(notes.unreadable, 'item', 'items')} in this file could not be read and will be skipped.`);
  }
  return out;
}

/** What importing erases. */
export function importErasesText(c: Pick<StorageCounts, 'quilts' | 'versions'>): string {
  return c.quilts === 0 && c.versions === 0
    ? 'Nothing is saved on this device yet.'
    : `This erases the ${holdsText(c)} on this device. It cannot be undone.`;
}

export function clearText(c: Pick<StorageCounts, 'quilts' | 'versions'>): string {
  return c.quilts === 0 && c.versions === 0
    ? 'This erases your saved settings on this device. It cannot be undone.'
    : `This erases ${holdsText(c)} on this device, for every size. It cannot be undone, and Undo will not bring them back.`;
}

/** What a quilt file holds, for the confirm sheet. Uses the quilt's name when the file has one. */
export function quiltHoldsText(sizeName: string, versions: number, exportedAt: string | null, quiltName?: string): string {
  const when = exportedAt === null ? '' : `, exported on ${exportedOn(exportedAt)}`;
  if (quiltName) {
    const extra = versions > 0 ? `, and ${versionsText(versions)}` : '';
    return `This file holds ${quiltName}, the ${sizeName} quilt${extra}${when}.`;
  }
  const extra = versions > 0 ? ` and ${versionsText(versions)}` : '';
  return `This file holds the ${sizeName} quilt${extra}${when}.`;
}

/**
 * What opening a quilt file does to the name. Null when nothing changes: the
 * file has no name, which leaves the name here alone, or the names match.
 */
export function quiltNameChangeText(fileName: string | undefined, deviceName: string): string | null {
  if (!fileName || fileName === deviceName) return null;
  return deviceName ? `The name ${deviceName} changes to ${fileName}.` : `The quilt gets the name ${fileName}.`;
}

/** What opening a quilt file does. `deviceHasQuilt` says whether that size has a quilt here now. */
export function quiltOpensText(sizeName: string, deviceHasQuilt: boolean): string {
  return deviceHasQuilt
    ? `It replaces the ${sizeName} quilt on this device. If the quilt you have there now is different, it is kept as an automatic version. The file's versions are added to yours. Your other sizes are not touched.`
    : `The ${sizeName} size is empty on this device, so nothing is replaced. The file's versions are added to yours. Your other sizes are not touched.`;
}

export const QUILT_OPENED = (sizeName: string, quiltName?: string) =>
  quiltName ? `Opened ${quiltName}, the ${sizeName} quilt.` : `Opened the ${sizeName} quilt.`;
export const QUILT_FAILED = 'Could not open the quilt. Your quilts are unchanged.';
export const QUILT_FULL = 'Could not open the quilt. Storage on this device is full. Your quilts are unchanged.';
