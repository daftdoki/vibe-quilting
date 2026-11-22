/** Step-specific controls for the guide card. Each one is driven by the pattern and collection. */
import { useEffect, useRef } from 'react';
import { getSize, setAllRotations } from '../../core/design';
import type { Design, FabricDef, PatternDef, ProjectDef } from '../../core/types';
import type { GuideStepId } from '../../core/storage';
import { inches, repeatNote } from '../format';
import { quiltSizeInches } from '../../core/layout';
import { FabricSetCards } from '../FabricSets';
import { Icon } from '../Icon';
import { tapText } from '../pointerWords';
import { GuideNameField } from '../QuiltName';
import { REASONS, type CheckpointUpdate } from '../versions/useVersions';
import { COUNTED_STEPS, type Guide } from './useGuide';
import { stepTitles, TITLES } from './titles';

export function SizeStep({
  guide,
  pattern,
  design,
  projects,
  currentId,
  onPickProject,
}: {
  guide: Guide;
  pattern: PatternDef;
  design: Design;
  /** Every fabric set. With more than one, the step also picks the set. */
  projects: readonly ProjectDef[];
  currentId: string;
  onPickProject(project: ProjectDef): void;
}) {
  const multi = projects.length > 1;
  return (
    <>
      {multi && (
        <>
          <h3 className="guide-subhead">Fabric set</h3>
          <FabricSetCards projects={projects} currentId={currentId} onPick={onPickProject} />
          <h3 className="guide-subhead">Quilt size</h3>
        </>
      )}
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
          <p>{multi ? 'This size already has a design in this fabric set.' : 'This size already has a design.'}</p>
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
  excludedCount,
  repeatBlocks,
  onRearrange,
}: {
  guide: Guide;
  design: Design;
  fabricsById: ReadonlyMap<string, FabricDef>;
  fabricCount: number;
  /** Fabrics she hid. */
  excludedCount: number;
  /** Blocks where her picks put one fabric twice, or null when that cannot be avoided. */
  repeatBlocks: number | null;
  /** Shuffle the stack order, keeping the same fabrics. */
  onRearrange(): void;
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

  // The hide mode takes over the step, so the only things on the card are what
  // to do, how many are hidden, and the way out.
  if (guide.hiding) {
    return (
      <div className="guide-hide" role="group" aria-label="Exclude fabrics">
        <p className="guide-hide-count" role="status">
          {excludedCount === 0
            ? 'No fabrics are excluded yet.'
            : excludedCount === 1
              ? '1 fabric is excluded.'
              : `${excludedCount} fabrics are excluded.`}
        </p>
        <button type="button" className="btn btn-primary guide-hide-done" onClick={() => guide.setHiding(false)}>
          <Icon name="check" size={20} />
          Done
        </button>
      </div>
    );
  }

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
          <button type="button" className="btn btn-small" onClick={guide.randomPicks}>
            <Icon name="shuffle" size={18} />
            Pick at random
          </button>
          {guide.emptySlots > 0 && (
            <button type="button" className="btn btn-small" onClick={guide.fillRest}>
              <Icon name="stack" size={18} />
              Fill the rest for me
            </button>
          )}
          {n - guide.emptySlots >= 2 && (
            <button type="button" className="btn btn-small" onClick={onRearrange}>
              <Icon name="shuffle" size={18} />
              Rearrange
            </button>
          )}
          {guide.emptySlots < n && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={guide.clearPicks}
              aria-label="Clear picks. Empty every fat quarter."
            >
              <Icon name="reset" size={18} />
              Clear picks
            </button>
          )}
          <button type="button" className="btn btn-small btn-ghost" onClick={() => guide.setHiding(true)}>
            <Icon name="ban" size={18} />
            Exclude a fabric
          </button>
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

      {excludedCount > 0 && (
        <p className="guide-note guide-hidden-note">
          {excludedCount === 1 ? '1 fabric is excluded.' : `${excludedCount} fabrics are excluded.`}{' '}
          <button type="button" className="btn btn-small btn-text" onClick={() => guide.setHiding(true)}>
            {excludedCount === 1 ? 'Show it' : 'Show them'}
          </button>
        </p>
      )}
    </>
  );
}

/** Background on the Pick your fabrics step, shown when she taps "How it works" beside the title. */
export function FabricsHow({
  id,
  slotCount,
  fabricCount,
  excludedCount,
  cutLine,
  onExplain,
}: {
  id: string;
  slotCount: number;
  fabricCount: number;
  excludedCount: number;
  cutLine: string | null;
  onExplain(): void;
}) {
  const inUse = fabricCount - excludedCount;
  return (
    <div className="guide-how" id={id}>
      <ul className="guide-how-list">
        {cutLine && <li>{cutLine}</li>}
        <li>{tapText('Pick at random chooses fabrics for you and replaces every pick. Tap it again for a different mix.')}</li>
        <li>Rearrange keeps the fabrics you have and only changes where each one lands. Use it after picking by hand.</li>
        <li>Fill the rest for me keeps the fabrics you picked and fills only the empty fat quarters.</li>
        <li>Clear picks empties every fat quarter so you can pick again.</li>
        <li>Exclude a fabric keeps a fabric you do not want out of Pick at random and Fill the rest for me.</li>
        {slotCount > inUse && (
          <li>
            {excludedCount > 0
              ? `This size has ${slotCount} fat quarters and ${inUse} ${inUse === 1 ? 'fabric is' : 'fabrics are'} in use, so some fabrics will repeat.`
              : `This size has ${slotCount} fat quarters and the collection has ${fabricCount} fabrics, so some fabrics will repeat.`}
          </li>
        )}
      </ul>
      <button type="button" className="btn btn-small btn-ghost" onClick={onExplain}>
        <Icon name="help" size={18} />
        See how a fat quarter is used
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
      <button type="button" className="btn btn-small guide-back" onClick={guide.back}>
        <Icon name="arrowLeft" size={18} />
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
      <button type="button" className="btn btn-small guide-skip" onClick={guide.skipTouchups}>
        Skip touch-ups
      </button>
    </div>
  );
}

export function DoneStep({
  wide,
  multi,
  exporting,
  onExport,
  onSaveQuilt,
  canSaveQuilt,
  onPrint,
  canPrint,
  quiltName,
  onSaveName,
  onHelp,
  onKeepEditing,
}: {
  wide: boolean;
  /** More than one fabric set. */
  multi: boolean;
  exporting: boolean;
  onExport(): void;
  onSaveQuilt(): void;
  canSaveQuilt: boolean;
  onPrint(): void;
  canPrint: boolean;
  quiltName: string;
  onSaveName(name: string): void;
  onHelp(): void;
  onKeepEditing(): void;
}) {
  const places = wide
    ? [
        'The side panel has the fabrics and the fat quarter stack with Shuffle.',
        'Blocks, at the top, moves and turns blocks.',
        'Save & export, at the top, has Save quilt file, Open a quilt file, Export PNG and Print build sheet.',
        'The three dots menu has the resets and your data.',
        'Save this as a version from Versions at the top or the three dots menu, then keep trying other layouts.',
        ...(multi ? ['The set name at the top left, beside the size, switches to another fabric set. Each set keeps its own quilts.'] : []),
      ]
    : [
        'Fat quarters, below the quilt, opens the stack and Shuffle.',
        'Blocks, next to it, moves and turns blocks.',
        'The three dots menu has Save quilt file, Open a quilt file, Export PNG and Print build sheet under Save & export, the resets, and your data.',
        'Save this as a version from the three dots menu, then keep trying other layouts.',
        ...(multi ? ['Fabric set, in the three dots menu, switches to another fabric set. Each set keeps its own quilts.'] : []),
      ];
  return (
    <>
      {quiltName ? (
        <p className="guide-name-line">
          Quilt name: <strong>{quiltName}</strong>
        </p>
      ) : (
        <GuideNameField onSave={onSaveName} />
      )}
      {/* Printing the build sheet is what the design work leads to, so it comes first and stands out. */}
      <div className="guide-finish">
        <p>The next step is on paper. The build sheet lists your fabrics and shows every block, ready to cut and sew from.</p>
        <button type="button" className="btn btn-primary guide-finish-btn" onClick={onPrint} disabled={!canPrint}>
          <Icon name="print" size={20} />
          Print build sheet
        </button>
      </div>
      <div className="guide-row">
        <button type="button" className="btn btn-small" onClick={onSaveQuilt} disabled={!canSaveQuilt}>
          <Icon name="file" size={18} />
          Save quilt file
        </button>
        <button type="button" className="btn btn-small" onClick={onExport} disabled={exporting}>
          <Icon name="download" size={18} />
          {exporting ? 'Exporting' : 'Export PNG'}
        </button>
        <button type="button" className="btn btn-small" onClick={onKeepEditing}>
          Keep editing
        </button>
      </div>
      <div className="guide-tip">
        <span className="guide-tip-label">Where things are once the guide closes</span>
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

/** One plain line for each counted step on the opening overview. */
function stepLines(multi: boolean): Partial<Record<GuideStepId, string>> {
  return {
    ...STEP_LINES,
    ...(multi ? { size: 'Choose a fabric set, then how big the quilt will be.' } : {}),
  };
}

const STEP_LINES: Partial<Record<GuideStepId, string>> = {
  size: 'Choose how big the quilt will be.',
  fabrics: 'Choose each fabric yourself, or let the app pick for you.',
  blocks: 'Arrange the blocks until you like the layout.',
  touchups: 'Change single pieces if you want to. You can skip this.',
};

/** The opening overview: the steps in order, what comes after them, then where to get help. */
export function IntroStep({ onSkip, multi }: { onSkip(): void; multi: boolean }) {
  const titles = stepTitles(multi);
  const lines = stepLines(multi);
  return (
    <>
      <ol className="guide-intro-steps">
        {COUNTED_STEPS.map((s) => (
          <li key={s}>
            <strong>{titles[s]}</strong>
            {lines[s] && <span>{lines[s]}</span>}
          </li>
        ))}
      </ol>
      <div className="guide-intro-after">
        <h3>After the steps</h3>
        <p>When the steps are done, you can keep changing anything on the main screen.</p>
        <p>Prefer to do it all by hand? Skip the guide and work on the quilt directly.</p>
        <button type="button" className="btn btn-small guide-skip" onClick={onSkip}>
          Skip the guide
        </button>
      </div>
      <div className="guide-intro-help">
        <h3>Where to get help</h3>
        <ul>
          <li>{tapText('Tap the ? button on the quilt at any time for the full How to use guide.')}</li>
          <li>In {TITLES.fabrics}, How it works explains that step.</li>
          <li>Exit guide closes the guide. Resume the guide, in the three dots menu, brings it back.</li>
        </ul>
      </div>
    </>
  );
}
