/** Step-specific controls for the guide card. Each one is driven by the pattern and collection. */
import { useEffect, useRef } from 'react';
import { getSize, setAllRotations } from '../../core/design';
import type { Design, FabricDef, PatternDef } from '../../core/types';
import { inches, repeatNote } from '../format';
import { quiltSizeInches } from '../../core/layout';
import { Icon } from '../Icon';
import { REASONS, type CheckpointUpdate } from '../versions/useVersions';
import type { Guide } from './useGuide';

export function SizeStep({ guide, pattern, design }: { guide: Guide; pattern: PatternDef; design: Design }) {
  return (
    <>
      <ul className="guide-sizes" role="radiogroup" aria-label="Quilt size">
        {pattern.sizes.map((s) => {
          const on = s.id === design.sizeId;
          const { width, height } = quiltSizeInches(pattern, s);
          const blocks = s.cols * s.rows;
          return (
            <li key={s.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className={`guide-size${on ? ' is-on' : ''}`}
                onClick={() => guide.pickSize(s.id)}
              >
                <span className="guide-size-name">{s.name}</span>
                <span className="guide-size-meta">
                  {blocks} {blocks === 1 ? 'block' : 'blocks'}
                </span>
                <span className="guide-size-meta">
                  {inches(width)} × {inches(height)} in
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {guide.sizeConflict && (
        <div className="guide-choice" role="group" aria-label="This size already has a design">
          <p>This size already has a design.</p>
          <div className="guide-choice-actions">
            <button type="button" className="btn btn-small" onClick={guide.startSizeEmpty}>
              Start this size empty
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={guide.exit}>
              Keep it and exit the guide
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function FabricsStep({
  guide,
  design,
  fabricsById,
  fabricCount,
  cutLine,
  repeatBlocks,
}: {
  guide: Guide;
  design: Design;
  fabricsById: ReadonlyMap<string, FabricDef>;
  fabricCount: number;
  /** Blocks where her picks put one fabric twice, or null when that cannot be avoided. */
  repeatBlocks: number | null;
  /** How a fat quarter is cut, worded from the pattern. */
  cutLine: string | null;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const target = guide.targetSlot;
  const n = design.lineup.length;

  // Keep the current slot in view without scrolling the page or the panel.
  useEffect(() => {
    const list = listRef.current;
    if (!list || target === null) return;
    const el = list.children[target] as HTMLElement | undefined;
    if (!el) return;
    const left = el.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft) list.scrollLeft = left - 8;
    else if (left + el.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left + el.offsetWidth - list.clientWidth + 8;
    }
  }, [target]);

  const targetFilled = target !== null && design.lineup[target] !== null;

  return (
    <>
      <ol className="guide-slots" ref={listRef} aria-label="Fat quarter stack">
        {design.lineup.map((id, i) => {
          const f = id ? fabricsById.get(id) : undefined;
          const current = i === target;
          return (
            <li key={i}>
              <button
                type="button"
                className={`guide-slot${f ? '' : ' is-empty'}${current ? ' is-current' : ''}`}
                aria-pressed={current}
                aria-label={`Fat quarter ${i + 1}: ${f ? f.name : 'empty'}${current ? ', next to fill' : ''}`}
                title={f?.name}
                onClick={() => guide.pickSlot(i)}
              >
                {f && (
                  <span className="guide-slot-img" style={{ backgroundColor: f.color }}>
                    <img src={f.thumb} alt="" draggable={false} loading="lazy" />
                  </span>
                )}
                <span className="guide-slot-num" aria-hidden="true">
                  {i + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {guide.offerFill ? (
        <div className="guide-choice" role="group" aria-label="Empty fat quarters">
          <p>
            {guide.emptySlots} {guide.emptySlots === 1 ? 'fat quarter is' : 'fat quarters are'} still empty.
          </p>
          <div className="guide-choice-actions">
            <button type="button" className="btn btn-small btn-primary" onClick={guide.fillRestAndNext}>
              Fill the rest and go on
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={guide.dismissFillOffer}>
              Keep picking
            </button>
          </div>
        </div>
      ) : (
        <div className="guide-row">
          {guide.emptySlots > 0 && (
            <button type="button" className="btn btn-small" onClick={guide.fillRest}>
              <Icon name="stack" size={18} />
              Fill the rest for me
            </button>
          )}
          {guide.slotPicked && targetFilled && target !== null && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => guide.clearSlot(target)}
              aria-label={`Clear fat quarter ${target + 1}`}
            >
              <Icon name="close" size={18} />
              Clear
            </button>
          )}
        </div>
      )}

      {repeatNote(repeatBlocks) && (
        <p className="guide-note repeat-note" role="status">
          {repeatNote(repeatBlocks)}
        </p>
      )}

      {cutLine && <p className="guide-note guide-cut">{cutLine}</p>}

      {n > fabricCount && (
        <p className="guide-note">
          This size has {n} fat quarters and the collection has {fabricCount} fabrics, so some fabrics will repeat.
        </p>
      )}
    </>
  );
}

export function ShuffleStep({
  onShuffle,
  disabled,
  onUndo,
  canUndo,
}: {
  onShuffle(): void;
  disabled: boolean;
  onUndo(): void;
  canUndo: boolean;
}) {
  return (
    <div className="guide-row guide-row-center">
      <button type="button" className="btn btn-shuffle guide-shuffle" onClick={onShuffle} disabled={disabled}>
        <Icon name="shuffle" />
        Shuffle
      </button>
      <button type="button" className="btn guide-undo" onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" />
        Undo
      </button>
    </div>
  );
}

type RotationChoice = 'pattern' | 'none';

function currentRotation(pattern: PatternDef, design: Design): RotationChoice | null {
  const { cols } = getSize(pattern, design.sizeId);
  const isPattern = design.cells.every(
    (c, i) => c.rotation === pattern.defaultRotation(i % cols, Math.floor(i / cols)),
  );
  if (isPattern) return 'pattern';
  if (design.cells.every((c) => c.rotation === 0)) return 'none';
  return null;
}

/**
 * "Turn every other block" and "All the same way up", with the one the quilt
 * matches exactly marked. Used by the guide's blocks step and by Blocks mode.
 */
export function TurnChoices({
  pattern,
  design,
  update,
  className,
}: {
  pattern: PatternDef;
  design: Design;
  /** Applies the change after saving an automatic version. */
  update: CheckpointUpdate;
  className?: string;
}) {
  // A pattern with one rotation, or none without a turn, has nothing to choose.
  if (pattern.rotations.length < 2 || !pattern.rotations.includes(0)) return null;
  const current = currentRotation(pattern, design);
  const choices: { id: RotationChoice; label: string; reason: string }[] = [
    { id: 'pattern', label: 'Turn every other block', reason: REASONS.turnPattern },
    { id: 'none', label: 'All the same way up', reason: REASONS.turnNone },
  ];
  return (
    <div className={`guide-options ${className ?? ''}`} role="radiogroup" aria-label="Turn all blocks">
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={current === c.id}
          className={`guide-option${current === c.id ? ' is-on' : ''}`}
          onClick={() => update(c.reason, (d) => setAllRotations(pattern, d, c.id))}
        >
          {current === c.id && <Icon name="check" size={18} />}
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function BlocksStep(props: { pattern: PatternDef; design: Design; update: CheckpointUpdate }) {
  return <TurnChoices {...props} />;
}

export function TouchupsStep({ guide }: { guide: Guide }) {
  const last = guide.block >= guide.blockCount - 1;
  return (
    <div className="guide-row guide-nav-row">
      <button type="button" className="btn btn-small btn-ghost" onClick={guide.back}>
        Back
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => guide.setBlock(guide.block - 1)}
        disabled={guide.block === 0}
      >
        Previous block
      </button>
      <button type="button" className="btn btn-small btn-primary" onClick={guide.next}>
        {last ? 'Finish' : 'Next block'}
      </button>
      <button type="button" className="btn btn-small btn-text" onClick={guide.skipTouchups}>
        Skip touch-ups
      </button>
    </div>
  );
}

export function DoneStep({
  wide,
  exporting,
  onExport,
  onSaveQuilt,
  canSaveQuilt,
  onHelp,
  onKeepEditing,
}: {
  wide: boolean;
  exporting: boolean;
  onExport(): void;
  onSaveQuilt(): void;
  canSaveQuilt: boolean;
  onHelp(): void;
  onKeepEditing(): void;
}) {
  const places = wide
    ? [
        'The side panel has the fabrics and the fat quarter stack with Shuffle.',
        'Blocks, at the top, moves and turns blocks.',
        'The three dots menu has Export PNG, Save quilt file and the resets.',
        'Save this as a version from Versions at the top or the three dots menu, then keep trying other layouts.',
      ]
    : [
        'Fat quarters, below the quilt, opens the stack and Shuffle.',
        'Blocks, next to it, moves and turns blocks.',
        'The three dots menu has Export PNG, Save quilt file and the resets.',
        'Save this as a version from the three dots menu, then keep trying other layouts.',
      ];
  return (
    <>
      <div className="guide-row">
        <button type="button" className="btn btn-small btn-primary" onClick={onExport} disabled={exporting}>
          <Icon name="download" size={18} />
          {exporting ? 'Exporting' : 'Export PNG'}
        </button>
        <button type="button" className="btn btn-small" onClick={onSaveQuilt} disabled={!canSaveQuilt}>
          <Icon name="file" size={18} />
          Save quilt file
        </button>
        <button type="button" className="btn btn-small" onClick={onKeepEditing}>
          Keep editing
        </button>
      </div>
      <div className="guide-tip">
        <span className="guide-tip-label">Where things are</span>
        <ul className="guide-places">
          {places.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div className="guide-help">
        <p>The full how to use guide is always under the ? button and in the three dots menu.</p>
        <button type="button" className="btn btn-small btn-ghost" onClick={onHelp}>
          <Icon name="help" size={18} />
          How to use
        </button>
      </div>
    </>
  );
}
