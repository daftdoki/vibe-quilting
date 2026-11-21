/**
 * Export, import and clear for everything saved on this device. Import and
 * clear change storage and then reload the page, so every hook starts from the
 * new data. Writes are frozen from the storage change until the reload, so no
 * pending autosave can put the old state back.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  applyBackup,
  applyQuiltBackup,
  backupFileName,
  buildBackup,
  buildQuiltBackup,
  clearAllData,
  parseBackup,
  quiltFileName,
  serializeBackup,
  summarizeStorage,
  type BackupError,
  type BackupSummary,
  type ImportData,
  type KeyValueStorage,
  type StorageCounts,
} from '../../core/backup';
import { isEmptyDesign } from '../../core/design';
import { readDesignFrom, setWritesFrozen } from '../../core/storage';
import type { Design } from '../../core/types';
import { shareOrDownload } from '../exportPng';
import { BACKUP_CONTEXT } from './context';
import {
  ERASE_FAILED,
  holdsText,
  IMPORT_ERROR_TITLE,
  IMPORT_FAILED,
  IMPORT_FULL,
  importErrorText,
  QUILT_FAILED,
  QUILT_FULL,
  QUILT_OPENED,
} from './text';

/** sessionStorage key for the note shown once after the reload. */
const FLASH_KEY = 'vq-flash';
/** No real backup is this big. Even at 4 bytes a character it is over the 5,000,000 character limit. */
const MAX_FILE_BYTES = 20_000_000;
const NO_DATA: StorageCounts = { quilts: 0, versions: 0, sizeIds: [], entries: 0 };

export type DataSheet =
  | { kind: 'notice'; title: string; text: string }
  | { kind: 'import'; file: ImportData; summary: BackupSummary }
  | { kind: 'quilt'; file: ImportData; summary: BackupSummary; deviceHasQuilt: boolean }
  | { kind: 'clear' };

export interface DataTransfer {
  /** What is saved on this device, as of the last `refresh`. */
  device: StorageCounts;
  canExport: boolean;
  canClear: boolean;
  sheet: DataSheet | null;
  fileInput: React.RefObject<HTMLInputElement | null>;
  /** Read storage again. Call when the menu opens. */
  refresh(): void;
  exportData(): Promise<void>;
  /** Save a file with this size's quilt and versions. Pass the live design. */
  saveQuilt(projectId: string, design: Design): Promise<void>;
  /** Open the system file picker. */
  pickFile(): void;
  onFileChosen(e: ChangeEvent<HTMLInputElement>): void;
  askClear(): void;
  confirmImport(): void;
  confirmQuilt(): void;
  confirmClear(): void;
  closeSheet(): void;
}

function storage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readDevice(): StorageCounts {
  const s = storage();
  return s ? summarizeStorage(s) : NO_DATA;
}

function reloadWith(message: string): void {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // The page still reloads, just without the note.
  }
  location.reload();
}

export function useDataTransfer(notify: (message: string) => void): DataTransfer {
  const [device, setDevice] = useState<StorageCounts>(readDevice);
  const [sheet, setSheet] = useState<DataSheet | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const exporting = useRef(false);

  // The note left by an import or clear, shown once after the reload.
  useEffect(() => {
    try {
      const message = sessionStorage.getItem(FLASH_KEY);
      if (message === null) return;
      sessionStorage.removeItem(FLASH_KEY);
      notify(message);
    } catch {
      // No session storage, no note.
    }
  }, [notify]);

  const refresh = useCallback(() => setDevice(readDevice()), []);

  const exportData = useCallback(async () => {
    const s = storage();
    if (!s || exporting.current) return;
    exporting.current = true;
    try {
      const now = new Date();
      const name = backupFileName(now);
      const blob = new Blob([serializeBackup(buildBackup(s, now, BACKUP_CONTEXT))], { type: 'application/json' });
      const done = await shareOrDownload(blob, name, 'Vibe Quilting data', 'application/json');
      if (done) notify(`Exported ${name}`);
    } catch {
      notify('Export failed. Try again.');
    } finally {
      exporting.current = false;
    }
  }, [notify]);

  const saveQuilt = useCallback(
    async (projectId: string, design: Design) => {
      const s = storage();
      if (!s || exporting.current) return;
      exporting.current = true;
      try {
        const now = new Date();
        const name = quiltFileName(design.sizeId, now);
        const text = serializeBackup(buildQuiltBackup(s, now, BACKUP_CONTEXT, projectId, design.sizeId, design));
        const done = await shareOrDownload(new Blob([text], { type: 'application/json' }), name, 'Vibe Quilting quilt', 'application/json');
        if (done) notify(`Saved ${name}`);
      } catch {
        notify('Save failed. Try again.');
      } finally {
        exporting.current = false;
      }
    },
    [notify],
  );

  const pickFile = useCallback(() => fileInput.current?.click(), []);

  const onFileChosen = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Reset so the same file can be picked again.
    input.value = '';
    if (!file) return;
    const fail = (reason: BackupError) =>
      setSheet({ kind: 'notice', title: IMPORT_ERROR_TITLE, text: importErrorText(reason) });
    if (file.size > MAX_FILE_BYTES) {
      fail('too-large');
      return;
    }
    file
      .text()
      .then((text) => {
        const parsed = parseBackup(text, BACKUP_CONTEXT);
        if (!parsed.ok) {
          fail(parsed.reason);
          return;
        }
        setDevice(readDevice());
        const { quilt } = parsed.summary;
        if (parsed.summary.scope === 'quilt' && quilt) {
          const current = readDesignFrom(storage(), quilt.projectId, quilt.sizeId);
          setSheet({
            kind: 'quilt',
            file: parsed.file,
            summary: parsed.summary,
            deviceHasQuilt: current !== null && !isEmptyDesign(current),
          });
          return;
        }
        setSheet({ kind: 'import', file: parsed.file, summary: parsed.summary });
      })
      .catch(() => fail('not-json'));
  }, []);

  const askClear = useCallback(() => {
    setDevice(readDevice());
    setSheet({ kind: 'clear' });
  }, []);

  const confirmImport = useCallback(() => {
    if (sheet?.kind !== 'import') return;
    const s = storage();
    if (!s) {
      setSheet({ kind: 'notice', title: IMPORT_ERROR_TITLE, text: IMPORT_FAILED });
      return;
    }
    setWritesFrozen(true);
    const result = applyBackup(s, sheet.file);
    if (!result.ok) {
      setWritesFrozen(false);
      setSheet({
        kind: 'notice',
        title: IMPORT_ERROR_TITLE,
        text: result.reason === 'storage-full' ? IMPORT_FULL : IMPORT_FAILED,
      });
      return;
    }
    reloadWith(`Imported ${holdsText(sheet.summary)}.`);
  }, [sheet]);

  const confirmQuilt = useCallback(() => {
    if (sheet?.kind !== 'quilt' || !sheet.summary.quilt) return;
    const { sizeName } = sheet.summary.quilt;
    const s = storage();
    if (!s) {
      setSheet({ kind: 'notice', title: IMPORT_ERROR_TITLE, text: QUILT_FAILED });
      return;
    }
    setWritesFrozen(true);
    const versionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const result = applyQuiltBackup(s, sheet.file, { now: Date.now(), versionId });
    if (!result.ok) {
      setWritesFrozen(false);
      setSheet({
        kind: 'notice',
        title: IMPORT_ERROR_TITLE,
        text: result.reason === 'storage-full' ? QUILT_FULL : QUILT_FAILED,
      });
      return;
    }
    reloadWith(QUILT_OPENED(sizeName));
  }, [sheet]);

  const confirmClear = useCallback(() => {
    const s = storage();
    if (!s) return;
    setWritesFrozen(true);
    try {
      clearAllData(s);
    } catch {
      setWritesFrozen(false);
      setDevice(readDevice());
      setSheet({ kind: 'notice', title: 'Could not erase', text: ERASE_FAILED });
      return;
    }
    reloadWith('Everything was erased.');
  }, []);

  return {
    device,
    canExport: device.quilts + device.versions > 0,
    canClear: device.entries > 0,
    sheet,
    fileInput,
    refresh,
    exportData,
    saveQuilt,
    pickFile,
    onFileChosen,
    askClear,
    confirmImport,
    confirmQuilt,
    confirmClear,
    closeSheet: () => setSheet(null),
  };
}
