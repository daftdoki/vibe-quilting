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
