/**
 * The quilt's name: the field at the top of the screen, the "Name your quilt"
 * prompt shown before a file is saved, and the short field on the guide's last
 * screen. Each size of each project has its own name. Storage normalizes it
 * (see `saveQuiltName`), so `onSave` returns what was kept.
 */
import { useEffect, useRef, useState } from 'react';
import { MAX_QUILT_NAME } from '../core/storage';
import { Icon } from './Icon';

export const NAME_PLACEHOLDER = 'Type a name for your quilt';

/**
 * Focus an input when its sheet opens. The attribute covers a dialog that is
 * still opening, since `showModal` focuses the element marked autofocus, and
 * the call covers one that is already open.
 */
function focusOnOpen(el: HTMLInputElement | null) {
  if (!el) return;
  el.setAttribute('autofocus', '');
  if (el.closest('dialog')?.open) el.focus();
}

/**
 * The name field in the top bar. It reads as a heading when it holds a name
 * and shows the grey placeholder when empty. Enter or leaving the field saves,
 * Escape puts back the name it had. Give it a `key` per project and size so a
 * size switch starts a fresh draft.
 */
export function QuiltNameField({ name, onSave }: { name: string; onSave(name: string): string }) {
  const [draft, setDraft] = useState(name);
  const editing = useRef(false);
  const cancelled = useRef(false);

  // A name set elsewhere (the prompt, the guide, Start fresh) shows here unless she is typing.
  useEffect(() => {
    if (!editing.current) setDraft(name);
  }, [name]);

  return (
    <label className={`name-field${draft.trim() === '' ? ' is-empty' : ''}`}>
      <input
        className="name-input"
        type="text"
        value={draft}
        placeholder={NAME_PLACEHOLDER}
        aria-label="Quilt name"
        maxLength={MAX_QUILT_NAME}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelled.current = true;
            setDraft(name);
            e.currentTarget.blur();
          }
        }}
        onBlur={() => {
          editing.current = false;
          if (cancelled.current) {
            cancelled.current = false;
            setDraft(name);
            return;
          }
          setDraft(onSave(draft));
        }}
      />
      <span className="name-pencil" aria-hidden="true">
        <Icon name="pencil" size={18} />
      </span>
    </label>
  );
}

/**
 * The body of the "Name your quilt" sheet. Both buttons run the action she
 * chose from their own click (or the form's submit), so a share or download
 * that needs a tap still has one.
 */
export function NamePrompt({ onSave, onSkip }: { onSave(name: string): void; onSkip(): void }) {
  const [draft, setDraft] = useState('');
  const empty = draft.trim() === '';
  return (
    <form
      className="name-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) onSave(draft);
      }}
    >
      <p className="confirm-text">
        The name is used for the files you save. You can change it later at the top of the screen.
      </p>
      <input
        ref={focusOnOpen}
        className="version-input name-prompt-input"
        type="text"
        value={draft}
        placeholder={NAME_PLACEHOLDER}
        aria-label="Quilt name"
        maxLength={MAX_QUILT_NAME}
        enterKeyHint="done"
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="confirm-actions confirm-actions-wrap">
        <button type="button" className="btn btn-ghost" onClick={onSkip}>
          Not now
        </button>
        <button type="submit" className="btn btn-primary" disabled={empty}>
          Save name and continue
        </button>
      </div>
    </form>
  );
}

/** A short name field for the guide's last screen, shown while the quilt has no name. */
export function GuideNameField({ onSave }: { onSave(name: string): void }) {
  const [draft, setDraft] = useState('');
  const empty = draft.trim() === '';
  return (
    <form
      className="guide-name"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) onSave(draft);
      }}
    >
      <p>Give your quilt a name. It is used for the files you save.</p>
      <div className="guide-name-row">
        <input
          className="version-input guide-name-input"
          type="text"
          value={draft}
          placeholder={NAME_PLACEHOLDER}
          aria-label="Quilt name"
          maxLength={MAX_QUILT_NAME}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-small" disabled={empty}>
          Save name
        </button>
      </div>
    </form>
  );
}
