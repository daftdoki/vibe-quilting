import type { FabricDef } from '../core/types';

interface Props {
  fabrics: readonly FabricDef[];
  usage: Map<string, number>;
  activeId: string | null;
  layout: 'strip' | 'grid';
  /** What the count badge counts. */
  countNoun?: 'piece' | 'slot';
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
  onToggle,
  dragProps,
  takeClickSuppression,
}: Props) {
  const noun = (n: number) =>
    countNoun === 'slot' ? (n === 1 ? 'fat quarter' : 'fat quarters') : n === 1 ? 'piece' : 'pieces';
  return (
    <ul className={`tray tray-${layout}`} aria-label="Fabrics">
      {fabrics.map((f) => {
        const count = usage.get(f.id) ?? 0;
        const active = f.id === activeId;
        return (
          <li key={f.id}>
            <button
              type="button"
              className={`swatch${active ? ' is-active' : ''}`}
              aria-pressed={active}
              aria-label={`${f.name}, ${count} ${noun(count)}`}
              title={f.name}
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
                <span className={`swatch-count${count === 0 ? ' is-zero' : ''}`} aria-hidden="true">
                  {count}
                </span>
              </span>
              {layout === 'grid' && (
                <span className="swatch-name" aria-hidden="true">
                  <span>{f.design}</span>
                  <span>{f.colorway}</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
