import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Extra class on the dialog, for sizing. */
  className?: string;
}

/**
 * Modal sheet on a native <dialog>, which gives focus trapping and Escape.
 * It slides up from the bottom on phones and sits as a card on wide screens.
 */
export function Sheet({ open, title, onClose, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sheet ${className ?? ''}`}
      aria-labelledby={titleId}
      onClose={() => {
        // Only report closes the parent did not ask for.
        if (openRef.current) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          const inside =
            e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) onClose();
        }
      }}
    >
      <div className="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="sheet-body">{open ? children : null}</div>
    </dialog>
  );
}
