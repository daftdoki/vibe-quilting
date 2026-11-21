import type { FabricDef } from '../core/types';

interface Props {
  fabrics: readonly FabricDef[];
  usage: Map<string, number>;
  activeId: string | null;
  layout: 'strip' | 'grid';
  /** What the count badge counts. */
  countNoun?: 'piece' | 'slot';
  /** Fabrics she hid. The list only gets them in the hide mode, where they show dimmed and struck through, with no count. */
  excluded?: ReadonlySet<string>;
  /** In the hide mode a tap hides a fabric or brings it back, and pressed means hidden. */
  hideMode?: boolean;
  onToggle(fabricId: string): void;
  dragProps(fabric: FabricDef): {
    onPointerDown(e: React.PointerEvent<HTMLElement>): void;
    onContextMenu(e: React.MouseEvent): void;
  };
  takeClickSuppression(): boolean;
}

/** The collection's fabrics. Tap to pick one for painting, drag one onto a piece. */
export function FabricTray({
  fabrics,
  usage,
  activeId,
  layout,
  countNoun = 'piece',
  excluded,
  hideMode = false,
  onToggle,
  dragProps,
  takeClickSuppression,
}: Props) {
  const noun = (n: number) =>
    countNoun === 'slot' ? (n === 1 ? 'fat quarter' : 'fat quarters') : n === 1 ? 'piece' : 'pieces';
  return (
    <ul className={`tray tray-${layout}${hideMode ? ' is-hiding' : ''}`} aria-label="Fabrics">
      {fabrics.map((f) => {
        const count = usage.get(f.id) ?? 0;
        const out = excluded?.has(f.id) ?? false;
        const active = !out && f.id === activeId;
        return (
          <li key={f.id}>
            <button
              type="button"
              className={`swatch${active ? ' is-active' : ''}${out ? ' is-excluded' : ''}`}
              aria-pressed={hideMode ? out : active}
              aria-label={out ? `${f.name}, hidden` : hideMode ? `${f.name}, showing` : `${f.name}, ${count} ${noun(count)}`}
              title={out ? `${f.name}, hidden` : f.name}
              {...dragProps(f)}
              onClick={() => {
                if (takeClickSuppression()) return;
                onToggle(f.id);
              }}
            >
              <span className="swatch-media">
                <span className="swatch-img" style={{ backgroundColor: f.color }}>
                  <img src={f.thumb} alt="" draggable={false} decoding="async" />
                </span>
                {out ? (
                  <span className="swatch-out" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="30" height="30" focusable="false">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M6 18 18 6" />
                    </svg>
                  </span>
                ) : hideMode ? (
                  <span className="swatch-eye" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
                      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.8" />
                    </svg>
                  </span>
                ) : (
                  <span className={`swatch-count${count === 0 ? ' is-zero' : ''}`} aria-hidden="true">
                    {count}
                  </span>
                )}
              </span>
              {layout === 'grid' && (
                <span className="swatch-name" aria-hidden="true">
                  <span>{f.design}</span>
                  <span>{f.colorway}</span>
                  {out && <span className="swatch-out-label">Hidden</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
