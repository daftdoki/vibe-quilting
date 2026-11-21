import type { ReactNode } from 'react';
import { Sheet } from '../Sheet';
import type { DataTransfer } from './useDataTransfer';
import { clearText, fileHoldsText, IMPORT_ERROR_TITLE, importErasesText, importNotesText } from './text';

/**
 * The safe button gets focus. The attribute covers a sheet that is still
 * opening, and the focus call covers one that swaps its content while open.
 */
function focusFirst(el: HTMLButtonElement | null) {
  if (!el) return;
  el.setAttribute('autofocus', '');
  if (el.closest('dialog')?.open) el.focus();
}

/** The hidden file input and the sheets for import, clear and errors. */
export function DataSheets({ data }: { data: DataTransfer }) {
  const { sheet, device, closeSheet } = data;
  const hasDevice = device.quilts + device.versions > 0;

  // Export first only makes sense when there is something to export.
  const exportFirst = hasDevice && (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        void data.exportData();
      }}
    >
      Export my data first
    </button>
  );

  let body: ReactNode = null;
  let title = '';
  if (sheet?.kind === 'notice') {
    title = sheet.title;
    body = (
      <>
        <p className="confirm-text">{sheet.text}</p>
        <div className="confirm-actions">
          <button ref={focusFirst} type="button" className="btn btn-ghost" onClick={closeSheet}>
            Close
          </button>
        </div>
      </>
    );
  } else if (sheet?.kind === 'import') {
    title = 'Replace everything with this file?';
    body = (
      <>
        <p className="confirm-text">{fileHoldsText(sheet.summary, sheet.summary.exportedAt)}</p>
        {importNotesText(sheet.summary.notes).map((t) => (
          <p key={t} className="confirm-text">
            {t}
          </p>
        ))}
        <p className="confirm-text">{importErasesText(device)}</p>
        <div className="confirm-actions confirm-actions-wrap">
          {exportFirst}
          <button ref={focusFirst} type="button" className="btn btn-ghost" onClick={closeSheet}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={data.confirmImport}>
            Replace everything
          </button>
        </div>
      </>
    );
  } else if (sheet?.kind === 'clear') {
    title = 'Erase everything?';
    body = (
      <>
        <p className="confirm-text">{clearText(device)}</p>
        <div className="confirm-actions confirm-actions-wrap">
          {exportFirst}
          <button ref={focusFirst} type="button" className="btn btn-ghost" onClick={closeSheet}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={data.confirmClear}>
            Erase everything
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <input
        ref={data.fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={data.onFileChosen}
      />
      <Sheet open={sheet !== null} title={title || IMPORT_ERROR_TITLE} onClose={closeSheet}>
        {body}
      </Sheet>
    </>
  );
}
