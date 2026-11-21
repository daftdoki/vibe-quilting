import { useMemo } from 'react';
import type { FabricDef, PatternDef } from '../core/types';
import { Icon } from './Icon';

interface Props {
  pattern: PatternDef;
  fabrics: readonly FabricDef[];
  lineup: readonly (string | null)[];
  blockCount: number;
  /** A fabric id, or null to empty the slot. */
  onSetSlot(slot: number, fabricId: string | null): void;
  onSwap(a: number, b: number): void;
  onShuffle(): void;
  onFillRest(): void;
  /** The picked slot. The quilt outlines the pieces it fills. */
  selected: number | null;
  onSelect(slot: number | null): void;
  /** False hides the Shuffle button, when another one is on screen. Default true. */
  showShuffle?: boolean;
}

/** True when, for every piece position, each slot fills it in exactly one block. */
function onceEachPosition(pattern: PatternDef, blocks: number, n: number): boolean {
  if (blocks !== n) return false;
  for (let p = 0; p < pattern.block.pieces.length; p++) {
    const seen = new Set<number>();
    for (let b = 0; b < blocks; b++) seen.add(pattern.assign(b, p, n));
    if (seen.size !== n) return false;
  }
  return true;
}

/** The ordered fat quarter stack the pattern's shuffle cuts from. */
export function Lineup({
  pattern,
  fabrics,
  lineup,
  blockCount,
  onSetSlot,
  onSwap,
  onShuffle,
  onFillRest,
  selected,
  onSelect: setSelected,
  showShuffle = true,
}: Props) {
  const byId = useMemo(() => new Map(fabrics.map((f) => [f.id, f])), [fabrics]);
  const once = useMemo(
    () => onceEachPosition(pattern, blockCount, lineup.length),
    [pattern, blockCount, lineup.length],
  );
  const sel = selected !== null && selected < lineup.length ? selected : null;
  const selId = sel !== null ? lineup[sel] : null;
  const selFabric = selId ? byId.get(selId) : undefined;
  const empty = lineup.filter((id) => id === null).length;

  return (
    <div className="lineup">
      <div className="lineup-top">
        <p className="lineup-note">
          {once
            ? 'Each fat quarter lands once in every block position, as in the pattern.'
            : 'The pattern cuts every block from these fat quarters in order.'}
        </p>
        {showShuffle && (
          <button
            type="button"
            className="btn btn-shuffle"
            onClick={() => {
              setSelected(null);
              onShuffle();
            }}
          >
            <Icon name="shuffle" />
            Shuffle
          </button>
        )}
      </div>

      {empty > 0 && (
        <div className="lineup-empty">
          <p>
            {empty} {empty === 1 ? 'fat quarter is' : 'fat quarters are'} empty. Tap one to pick a fabric.
          </p>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setSelected(null);
              onFillRest();
            }}
          >
            Fill the rest for me
          </button>
        </div>
      )}

      <ol className="slots" aria-label="Fat quarter order">
        {lineup.map((id, i) => {
          const f = id ? byId.get(id) : undefined;
          return (
            <li key={i}>
              <button
                type="button"
                className={`slot${sel === i ? ' is-selected' : ''}${f ? '' : ' is-empty'}`}
                data-drop-slot={i}
                aria-pressed={sel === i}
                aria-label={`Fat quarter ${i + 1}: ${f?.name ?? 'empty'}`}
                title={f?.name}
                onClick={() => {
                  if (sel === null) setSelected(i);
                  else if (sel === i) setSelected(null);
                  else {
                    onSwap(sel, i);
                    setSelected(null);
                  }
                }}
              >
                <span className="slot-img" style={{ backgroundColor: f?.color }}>
                  {f && <img src={f.thumb} alt="" draggable={false} loading="lazy" />}
                </span>
                <span className="slot-num" aria-hidden="true">
                  {i + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {sel !== null && (
        <div className="slot-picker" role="group" aria-label={`Fabric for fat quarter ${sel + 1}`}>
          <p>
            <strong>Fat quarter {sel + 1}</strong>
            {selFabric ? ` is ${selFabric.name}.` : ' is empty.'} Pick a fabric, or tap another fat quarter to
            swap the two.
          </p>
          <ul className="picker-grid">
            {fabrics.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={`picker-item${f.id === lineup[sel] ? ' is-current' : ''}`}
                  aria-label={f.name}
                  title={f.name}
                  onClick={() => {
                    onSetSlot(sel, f.id);
                    setSelected(null);
                  }}
                >
                  <img src={f.thumb} alt="" draggable={false} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
          {selId !== null && (
            <button
              type="button"
              className="btn btn-small btn-ghost slot-clear"
              onClick={() => {
                onSetSlot(sel, null);
                setSelected(null);
              }}
            >
              <Icon name="close" size={18} />
              Clear fat quarter {sel + 1}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
